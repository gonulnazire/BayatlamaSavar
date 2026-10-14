# BayatlamaSavar — Supabase Göçü Tasarımı

**Tarih:** 14 Ekim 2026
**Durum:** Tasarım onaylandı, spec incelemesi bekliyor
**Sınıf:** Architectural — yeni alt sistem (kimlik, veritabanı) ve `page.tsx`'in
bağımlı olduğu `useProducts` arayüzünün değişmesi

---

## 1. Amaç

Uygulama şu anda verisini yalnızca tarayıcıda (`localStorage`) tutuyor. Bu
tasarımın amacı veriyi Supabase'e (Postgres) taşıyarak **tek kullanıcının
kendi cihazları arasında senkron** ve **veri kaybına karşı güvence**
sağlamak.

### Başarı ölçütü

1. Telefonda eklenen bir ürün, bilgisayarda girişten sonra görünüyor.
2. Tarayıcı verisi temizlense bile ürünler kaybolmuyor.
3. Bağlantı yokken liste **hâlâ görünüyor** (önbellekten) — mevcut çevrimdışı
   deneyim gerilemiyor.
4. Sayfa açılış hızı bugünkü seviyede kalıyor (önbellek anında çiziliyor).
5. Mevcut tarayıcı verisi hesaba kayıpsız aktarılıyor.

## 2. Alınan kararlar

Tasarım görüşmesinde netleşenler:

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| Kullanım amacı | **Tek kullanıcı**, çok cihaz. Paylaşım ileride olabilir | Kullanıcı beyanı: "şu an bir tek ben kullanacağım ama ileride genişletebilirim" |
| Şema | **"Tek kişilik ev"** — `households` baştan var | Paylaşım eklendiğinde veri göçü ve RLS yazımı gerekmesin |
| Çevrimdışı | **Yerel önbellek + çevrimiçi yazma** | Uygulama bugün %100 çevrimdışı çalışıyor; sunucuya taşımak bunu geriletmemeli |
| Giriş | **E-posta + şifre**, e-posta doğrulaması kapalı | Kurulum sürtünmesi sıfır, mail teslimine bağımlı değil |
| Veri katmanı | **A: mevcut dikiş yerini genişlet** — tarayıcı doğrudan Supabase ile konuşur | En az yeni parça; sayfa statik kalır; `useSyncExternalStore` deseni ve testleri korunur |
| Mevcut veri | **Tek seferlik aktarım düğmesi**, otomatik değil | Otomatik olsa, yerel verisi olan ikinci cihazdan girişte ürünler çoğalırdı |
| Silme | **Soft delete** (`consumed_at`), kalıcı `DELETE` değil | "Geri al" tek alan güncellemesine iniyor; israf istatistiği verisi birikiyor |
| Yazma | **Beklemeli** (iyimser değil) | Geri alma mantığı yazmamak; "kaydedildi" denen şeyin gerçekten kaydedilmiş olması |

## 3. Kapsam dışı

Bu turda **yapılmayacak**, bilinçli olarak sonraya bırakılanlar:

- **Ev arkadaşı paylaşımı ve davet akışı.** Şema hazır olacak, arayüz olmayacak.
- **Realtime.** Ev arkadaşının eklediğinin anında görünmesi; paylaşım gelmeden
  anlamsız.
- **Bildirimler** (e-posta / push). Supabase Edge Functions + `pg_cron` ile
  sonradan eklenir, bu tasarımı değiştirmez.
- **Tüketildi / çöpe atıldı ayrımı.** Arayüzde tek düğme var, ayrımı
  bilemiyoruz. `consumed_at` konuyor; ayrım arayüz bunu sorduğu gün bir
  kolonla eklenir.
- **Otomatik yeniden deneme döngüsü.** Elle "Tekrar dene" + `online` olayı +
  sekmeye dönüş yeterli.
- **Server-side route koruması / middleware.** Gerekçe bölüm 6'da.
- **RLS politikalarının otomatik testi.** Gerekçe ve karşılığı bölüm 9'da.

## 4. Veri modeli

```sql
create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Dolabım',
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'owner' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table products (
  id              uuid primary key,              -- istemciden gelir
  household_id    uuid not null references households on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  category        text not null check (category in
                    ('Süt Ürünü','Sos/Konserve','Et/Şarküteri','Diğer')),
  opened_at       date not null,
  shelf_life_days int  not null check (shelf_life_days between 0 and 365),
  created_by      uuid not null references auth.users,
  created_at      timestamptz not null default now(),
  consumed_at     timestamptz                    -- null = hâlâ takipte
);

create index products_active_idx
  on products (household_id) where consumed_at is null;
```

**Kolon kararları:**

- `products.id` istemciden gelen `uuid`. `crypto.randomUUID()` zaten üretiyor;
  aktarımda kimlikler korunduğu için işlem tekrarlanabilir hale geliyor.
- `opened_at` `date`, `timestamptz` değil. Kod zaten `YYYY-MM-DD` metni
  taşıyor; saat dilimi sorunu doğmuyor.
- `check` kısıtları formdaki kuralların aynısı. `product-schema.ts` yine de
  kalıyor: sunucudan **gelen** yanıtı doğrulamak hâlâ değerli (bkz. bölüm 7).
- `products_active_idx` kısmi indeks; asıl sorgu her zaman tüketilmemişler.

### RLS

Üç tabloda da açık. `household_members`'a bakan politikalar sonsuz
özyinelemeye girer (politika tabloyu okur, tablo politikayı tetikler), bu
yüzden `security definer` yardımcı fonksiyon kullanılır:

```sql
create function public.is_household_member(hid uuid) returns boolean
  language sql
  security definer
  stable
  set search_path = ''                     -- zorunlu: aşağıya bakın
as $$ select exists (
     select 1 from public.household_members
     where household_id = hid and user_id = auth.uid()) $$;
```

**`set search_path = ''` atlanamaz.** `security definer` bir fonksiyon
tanımlayanın yetkisiyle çalışır; `search_path` sabitlenmezse çağıran kendi
şemasına aynı adlı bir tablo koyup fonksiyonu kandırabilir. Bu yüzden tablo
adları da tam nitelikli (`public.household_members`) yazılır. Aynı kural kayıt
tetikleyicisi için de geçerlidir. Supabase'in güvenlik denetleyicisi bunu
ayrıca uyarı olarak bildirir.

`products` üzerindeki dört politika (select / insert / update / delete) tek
koşula bakar: `is_household_member(household_id)`.

Paylaşım eklendiğinde **politikalar değişmez** — yalnızca
`household_members`'a satır eklenir.

### Kayıt tetikleyicisi

`auth.users`'a satır eklenince `security definer` bir tetikleyici kullanıcıya
bir `households` satırı ve `owner` üyeliği açar. Böylece uygulama hiç
"evim yok" durumuyla uğraşmaz.

SQL dosyaları `supabase/migrations/` altında tutulur.

## 5. Veri katmanı

`storage.ts` bugün 102 satırda üç işi birden yapıyor: önbellek, React köprüsü
ve yazma. Supabase girince bu üçe ayrılır:

| Modül | Sorumluluğu | Bağımlılığı |
| --- | --- | --- |
| `lib/supabase/client.ts` | Tarayıcı istemcisi (tek örnek), env anahtarları | — |
| `lib/product-api.ts` | Supabase sorguları + satır ↔ `Product` çevrimi | Supabase istemcisi |
| `lib/product-cache.ts` | `localStorage` önbelleği (bugünkü `storage.ts`'in içi) | `product-schema.ts` |
| `lib/product-store.ts` | Dış kaynak: durum tutar, eylemleri yürütür, önbelleği tazeler | API + önbellek (**enjekte edilir**) |
| `lib/storage.ts` | `useProducts()` — `useSyncExternalStore` sarmalayıcısı | store |

**Kritik tasarım tercihi:** `product-store.ts` bir hook değil, düz bir modül ve
API'yi parametre olarak alır. Senkron mantığı React render etmeden, ağ olmadan,
sahte bir API ile test edilebilir (bölüm 8). Mevcut `useSyncExternalStore`
deseni ve onu koruyan "referans kararlılığı" testi aynen kalır.

### `useProducts()` yeni imzası

```ts
{
  products: Product[],
  status: "loading" | "ready" | "offline",   // offline = önbellekten gösteriliyor
  saving: boolean,                            // yazma uçuşta
  error: string | null,
  lastSyncedAt: string | null,
  addProduct(product: Product): Promise<void>,
  updateProduct(product: Product): Promise<void>,
  consumeProduct(id: string): Promise<void>,
  restoreProduct(id: string): Promise<void>,
  retry(): void,
}
```

`removeProduct` → `consumeProduct` olarak adlandırılır (soft delete'i yansıtır).
`restoreProduct` artık `(product, index)` değil `(id)` alır.

### `household_id` nereden gelir

Her `insert` bir `household_id` istiyor, ama istemci bunu bilmiyor. Akış:

1. Oturum hazır olunca store bir kez `fetchHouseholdId()` çağırır:
   `select household_id from household_members where user_id = auth.uid() limit 1`
   (RLS zaten kullanıcıyı kendi satırlarına kısıtlıyor).
2. Sonuç store'da tutulur; tüm `insert`'ler ve aktarım bunu kullanır.
3. Sonuç boş gelirse (tetikleyici bir sebeple çalışmamışsa) durum `error`
   olur ve "hesap kurulumu tamamlanamadı" denir — sessizce `null`
   gönderilmez.

Tek kullanıcı olduğu için `limit 1` yeterli. Paylaşım eklendiğinde burası
"hangi ev" seçimine dönüşür; o zaman değişecek tek nokta budur.

### Okuma yolu

1. `getSnapshot()` önbellekteki ürünleri **anında** döner → sayfa açılışı
   bugünkü kadar hızlı.
2. Store arka planda `fetchProducts()` çağırır (`consumed_at is null`).
3. Başarılı → liste ve önbellek tazelenir, `status: "ready"`.
4. Başarısız → önbellek korunur, `status: "offline"`, `lastSyncedAt` gösterilir.

### Yazma yolu

**Beklemeli.** Önce Supabase'e gider; başarılıysa store ve önbellek güncellenir.
Başarısızsa liste **değişmez**, hata gösterilir. Buton uçuş sırasında devre dışı.

Geri alma (rollback) mantığı yazılmaz; kullanıcıya "kaydedildi" denen şey
gerçekten kaydedilmiş olur. Bedeli form gönderiminde 100–300 ms bekleme.

### Soft delete'in basitleştirdiği şey

"Geri al" artık diziye sıra numarasıyla geri sokmak değil, `consumed_at = null`.
Sonucu:

- `product-list.ts`'ten **`insertAt` silinir**
- `removeById`'nin `index` alanı gereksizleşir
- `replaceById` kalır (başarılı güncellemeden sonra yerel liste tazeleme)

## 6. Giriş akışı ve mevcut verinin aktarımı

**Yönlendirme yok, tek sayfa kalır.** Oturum yoksa `/` giriş ekranını, varsa
uygulamayı çizer. Middleware ve korumalı route kurulmaz: A yaklaşımında sunucu
tarafında korunacak bir şey yok, **gerçek güvenlik sınırı RLS**. Middleware
eklemek `@supabase/ssr` çerez düzeneğini ve kaçınılan sunucu katmanını geri
getirirdi. Sayfa böylece statik kalır.

| Dosya | İşi |
| --- | --- |
| `lib/useSession.ts` | Oturum durumu — `onAuthStateChange` bir abonelik olduğu için yine `useSyncExternalStore` |
| `components/AuthScreen.tsx` | E-posta + şifre; "Giriş yap" / "Kayıt ol" tek formda kip değiştirerek (`ProductForm` deseniyle aynı) |
| `components/ImportPrompt.tsx` | Tek seferlik aktarım şeridi |

Oturumun ilk okunması asenkron: üç durum var — **bilinmiyor** (iskelet göster,
giriş ekranının bir an parlamasını önler), **girişsiz**, **girişli**.

### Önbellek anahtarı ayrılır

Bugünkü veri `bayatlamasavar.products` altında. Önbellek de aynı anahtarı
kullanırsa "aktarılacak eski veri" ile "sunucu verisinin önbelleği" ayırt
edilemez:

- `bayatlamasavar.products` → **eski veri**, salt okunur, yalnızca aktarım için
- `bayatlamasavar.cache.v2` → **yeni önbellek**

Aktarım bitince eski anahtar silinir. Kural tek cümleye iner: *eski anahtar
varsa aktarım teklif edilir, yoksa edilmez.* Ayrı bir "aktarıldı" bayrağı
tutulmaz.

### Aktarım akışı

1. Giriş yapıldı, eski anahtarda kayıt var → şerit: "Tarayıcında N ürün var.
   Hesabına aktar."
2. Aktar → `parseStoredProducts()` ile okunur (zaten doğrulanmış kayıt üretir),
   `household_id` ve `created_by` eklenerek toplu `insert`.
3. `on conflict (id) do nothing` — kimlikler korunduğu için işlem
   tekrarlanabilir: yarıda kesilirse tekrar basmak ürünleri çoğaltmaz. İkinci
   bir cihazdaki aynı eski veriden aktarmak da zararsız.
4. Eski anahtar silinir, "N ürün aktarıldı" denir.

### Çıkış

`signOut()` sırasında `bayatlamasavar.cache.v2` silinir — aksi halde aynı
tarayıcıda başka hesaba girildiğinde önceki kullanıcının ürünleri bir an
görünürdü.

## 7. Hata ve yükleme durumları

| Durum | Kullanıcı ne görür | Liste |
| --- | --- | --- |
| İlk açılış, önbellek boş, bağlantı yok | "Bağlantı kurulamadı" + **Tekrar dene** | Boş |
| İlk açılış, önbellek dolu, bağlantı yok | Şerit: "Çevrimdışı — son güncelleme 14:32" | **Önbellekten** |
| Yazma başarısız (ağ) | "Kaydedilemedi, bağlantını kontrol et" + Tekrar dene | **Değişmez** |
| Yazma başarısız (RLS / kısıt) | "Kaydedilemedi" — teknik detay yalnızca console'a | Değişmez |
| Oturum geçersiz | "Oturumun sona erdi, tekrar giriş yap" → giriş ekranı | — |
| Env anahtarları eksik | Açılışta açık kurulum hatası (sessizce patlamaz) | — |
| Sunucu yanıtı beklenmedik biçimde | Şerit: "N kayıt okunamadı" | Sağlam kayıtlar |

Son satır bedava gelir: `parseProduct()` sunucu yanıtını da doğrular, bozuk
kayıt listeye girmez. Adım 2'de `NaN`'ın sessizce yeşil görünmesini engelleyen
katman, şimdi istemci/sunucu şema uyuşmazlığını da yakalar.

### Yükleme

- **Oturum bilinmiyor** → sayfa çatısı + gri iskelet
- **İlk veri, önbellek boş** → iskelet kartlar
- **Önbellek dolu** → liste anında + ince "güncelleniyor" göstergesi
- **Yazma uçuşta** → buton devre dışı + dönen simge, form alanları kilitli

### Yeniden deneme

Otomatik döngü yok. Üç tetikleyici: elle **Tekrar dene**, `window` `online`
olayı, `visibilitychange` (sekmeye dönüş). Üçü de abonelik;
`product-store.ts`'in `subscribe` fonksiyonu bunları barındırır.

### Hedeflenmiş iyileştirme: `Toast` genelleştirmesi

Hata bildirimi "mesaj + eylem düğmesi" ister — `UndoToast`'ın aynısı, tek farkı
kendiliğinden kapanmaması. İki benzer bileşen yazmamak için
`components/Toast.tsx` çıkarılır:

```ts
Toast({ message, actionLabel, onAction, autoDismissMs? })
```

`UndoToast` bunun ince bir kullanımına döner (6000 ms); hata bildirimi
`autoDismissMs` vermez. `UndoToast`'ın 5 testi anlamını korur, `Toast` kendi
testlerini alır.

Göçün gerektirdiği **tek** yapısal düzeltme budur; ilgisiz refactor yapılmaz.

## 8. Test stratejisi

Enjeksiyon kararının asıl kazancı burada: store API'yi parametre aldığı için
senkron mantığı ağa dokunmadan test edilir.

| Katman | Nasıl | Örnek testler |
| --- | --- | --- |
| `product-api.ts` çevrimi | Saf fonksiyon | `snake_case` ↔ `camelCase`, `opened_at` çevrimi, bozuk satırın reddi |
| `product-store.ts` | **Sahte API enjekte** | Önbellekten anında dönme → sunucuyla tazelenme; hata → `offline` + önbellek korunur; yazma hatasında listenin değişmemesi; `retry` ve `online` tazelemesi |
| `product-cache.ts` | jsdom + `localStorage` | Gidiş-dönüş, bozuk veri, eski anahtar/önbellek karışmaması, çıkışta temizlenme |
| `useSession.ts` | Sahte auth istemcisi | Bilinmiyor → girişsiz → girişli geçişleri |
| Yeni bileşenler | RTL (bugünkü desen) | `AuthScreen`, `ImportPrompt`, `Toast`, `ConnectionBanner` |

### Kapanan eski boşluk

Adım 8'de "`app/page.tsx` için bütünleşme testi yok" diye kayda geçmişti.
Enjeksiyon tasarımı bunu ucuz hale getirir: sahte API + sahte oturumla sayfa
render edilip tam akış test edilir — *ekle → listede görünür*, *sil → bildirim
→ geri al → geri döner*, *yazma hatası → liste değişmez*. **Bu işin kapsamına
dahildir.**

### Test sayısı tahmini

Bugün 121. Tahmin (kesin değil): **~92 korunur, ~20 yeniden yazılır, ~6
silinir, ~40 yeni** → toplam **~160**.

Dokunulmayanlar: `date` (15), `product-filter` (14), `product-schema` (22),
`ProductForm` (16), `ProductCard` (8), `FilterBar` (6), `UndoToast` (5),
`error` (6).

## 9. Otomatik test edilmeyen şey: RLS

**RLS politikaları ve kayıt tetikleyicisi otomatik test edilmeyecek.** Gerçek
bir Postgres gerektiriyor; otomatikleştirmek Supabase CLI + Docker + SQL
testleri demek ve projenin şu anki ağırlığının üstünde.

Bu küçümsenmiyor: bölüm 6'da route koruması konmadığı için **RLS tek güvenlik
sınırı**, ve elle doğrulanmış bir güvenlik sınırı otomatik doğrulanmıştan
zayıftır. Docker'lı kurulum ayrı bir adım olarak sonra eklenebilir.

### Elle doğrulama listesi

Göç tamamlandığında sırayla yapılacak:

1. İki ayrı hesap (A ve B) açılır.
2. A ile ürün eklenir; B ile girilir → **A'nın ürünleri görünmemeli.**
3. B'nin oturumuyla, A'nın `household_id`'si elle gönderilerek `insert`
   denenir → **reddedilmeli.**
4. B'nin oturumuyla A'nın bir ürün `id`'si `update` edilmeye çalışılır →
   **reddedilmeli.**
5. Yeni bir hesap açılır → tetikleyicinin `households` + `household_members`
   satırlarını oluşturduğu teyit edilir.
6. Anahtarsız (`anon` key olmadan) istek → reddedilmeli.

## 10. Kullanıcının elle yapması gerekenler

1. Supabase'de proje açmak.
2. **Authentication → Sign In / Up → "Confirm email" kapatmak.** Açık kalırsa
   kayıt sonrası onay maili beklenir.
3. `.env.local` dosyasına iki değeri girmek:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
   `.env.local` zaten `.gitignore`'da.
4. Göç sonunda bölüm 9'daki elle doğrulama listesini yürütmek.

## 11. Bilinen riskler

| Risk | Etkisi | Karşılığı |
| --- | --- | --- |
| RLS elle doğrulanıyor | Yanlış politika veri sızdırır | Bölüm 9'daki liste; sonra Docker'lı otomasyon |
| Yazma çevrimiçi gerektiriyor | Bağlantısızken ürün eklenemez | Bilinçli karar; tam çevrimdışı senkron ayrı bir iş (seçenek D) |
| Supabase ücretsiz katmanı | Proje uzun süre kullanılmazsa askıya alınabilir | Kişisel kullanımda kabul edilebilir; veri kaybı değil |
| Beklemeli yazma | 100–300 ms gecikme | Buton devre dışı + dönen simge ile görünür kılınır |
| `anon key` istemcide | Herkes görebilir | Tasarım gereği böyle; koruma RLS'te, `service_role` anahtarı **istemciye hiç girmez** |

## 12. Uygulama sırası

1. SQL migration'ları + RLS + tetikleyici (`supabase/migrations/`)
2. `supabase/client.ts`, `product-api.ts` (sorgular, çevrim,
   `fetchHouseholdId`) + çevrim testleri
3. `product-cache.ts` (bugünkü `storage.ts`'ten ayrıştırma) + testleri
4. `product-store.ts` + sahte API ile senkron testleri
5. `storage.ts` → yeni `useProducts()`; `product-list.ts` sadeleştirmesi
6. `useSession.ts` + `AuthScreen` + tek sayfa kapısı
7. `Toast` genelleştirmesi, `ConnectionBanner`, hata/yükleme durumları
8. `ImportPrompt` + aktarım akışı
9. `page.tsx` bütünleşme testleri
10. Elle RLS doğrulaması (bölüm 9) + dokümantasyon tazelemesi
    (`CLAUDE.md`, `README.md`, `MIMARI_KARARI.md`, `GELISTIRME_NOTLARI.md`)

Her adım sonunda dörtlü doğrulama: `npm test`, `npx tsc --noEmit`,
`npm run lint`, `npm run build`.
