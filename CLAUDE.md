# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

**BayatlamaSavar** — ambalajı açıldıktan sonra raf ömrü kısalan gıdaların
(süt, yoğurt, salça, soslar) takibi. Amaç gıda israfını önlemek ve kullanıcıyı
zamanında uyarmak. Arayüz dili **Türkçe**; kod yorumları, commit mesajları ve
kullanıcıya görünen her metin Türkçe yazılır.

Gereksinim dokümanı proje klasörünün **bir üstündedir**:
`../bayatlamasavar_gereksinim_analizi.md` — kapsam tartışmalarında kaynak odur.
Adım adım geliştirme kaydı ve alınan kararların gerekçeleri:
[`GELISTIRME_NOTLARI.md`](GELISTIRME_NOTLARI.md).

## Komutlar

```bash
npm run dev          # geliştirme sunucusu (Turbopack), http://localhost:3000
npm run build        # production build — prerender hatalarını burada yakalar
npm start            # build'i sunar
npm test             # Vitest, tek seferlik
npm run test:watch   # Vitest, izleme kipinde
npm run lint         # ESLint (next/core-web-vitals)
npx tsc --noEmit     # tip kontrolü (lint bunu kapsamaz, ayrı çalıştırılmalı)
```

Tek dosya ya da tek test:

```bash
npm test -- src/lib/date.test.ts
npx vitest run -t "negatif raf ömrünü reddeder"
```

Bir değişikliği "bitti" saymak için dördü birlikte yeşil olmalı:
`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Yığın

Next.js 16.4 (App Router, Turbopack) · React 19.3 · Tailwind CSS 4 ·
TypeScript 5 · **Supabase (Postgres + Auth)** · Vitest 5 + React Testing
Library · lucide-react · Node 24

Tailwind 4 yapılandırması **CSS içinde** (`src/app/globals.css`, `@theme inline`)
— `tailwind.config.js` yok, aramaya gerek yok.

## Mimari

Veri akışı tek yönlü ve katmanlar birbirini şu sırayla tanır:

```
types/product.ts          veri modeli (Product, CATEGORIES)
        ↓
lib/product-schema.ts     doğrulama + şema sürümleme (saf)
lib/product-list.ts       liste işlemleri, sıra koruyarak (saf)
lib/product-filter.ts     arama + durum filtresi, sayaçlar (saf)
lib/date.ts               iş mantığı: kalan gün, durum eşikleri (saf)
        ↓
lib/storage.ts            localStorage ↔ React köprüsü (useProducts hook'u)
lib/useToday.ts           bugünün tarihi (useToday hook'u)
        ↓
components/               sunum: ProductForm, ProductCard, FilterBar, UndoToast
        ↓
app/page.tsx              durumu birleştiren tek istemci bileşeni
```

**Kural:** `lib/` içindeki saf dosyalar (`date`, `product-schema`,
`product-list`, `product-filter`) React'i, DOM'u veya `localStorage`'ı tanımaz — girdi verip çıktı
kontrol edilerek test edilirler. Tek istisna `storage.ts` ve `useToday.ts`:
bunlar köprü katmanıdır ve DOM'a bağımlıdır. Yeni iş mantığı saf dosyalara
yazılır, bileşenlere yazılmaz.

Veri **Supabase'de** (Postgres). Tarayıcı doğrudan Supabase ile konuşur;
sunucu tarafı mantık ve API route **yoktur**, sayfa statik olarak prerender
edilir. Kimlik doğrulama e-posta + şifre.

### Veri katmanı

```
lib/supabase/client.ts    getSupabaseClient() — TEMBEL, ilk cagrida dogrular
lib/product-api.ts        sorgular + satir <-> Product cevrimi (ProductApi)
lib/product-cache.ts      localStorage onbellegi + eski veri okuma
lib/product-store.ts      createProductStore(api, cache) — tum senkron mantigi
lib/storage.ts            useProducts() — useSyncExternalStore sarmalayicisi
lib/useSession.ts         useSession(), signIn/signUp/signOut
app/providers.tsx         StoresProvider — testler sahte store enjekte eder
```

**Okuma** önbellekten anında döner, arka planda sunucudan tazelenir; sunucu
hatasında önbellek korunur ve durum `offline` olur.
**Yazma beklemelidir ve çevrimiçi gerektirir:** önce sunucu, başarıdan sonra
yerel durum. Başarısızsa liste değişmez — rollback mantığı yoktur.

Silme **soft delete**: `consumed_at` damgalanır, "Geri al" onu `null` yapar.

### localStorage anahtarları (AYRI tutulmalı)

| Anahtar | Ne |
| --- | --- |
| `bayatlamasavar.cache.v2` | Sunucu verisinin önbelleği |
| `bayatlamasavar.products` | Supabase öncesi veri; salt okunur, yalnızca tek seferlik aktarım için |

Karışırlarsa "aktarılmayı bekleyen eski veri" ile "sunucu önbelleği" ayırt
edilemez. Aktarım bitince eski anahtar silinir; kural tek cümle: *eski anahtar
varsa aktarım teklif edilir.*

İkisi de `{"version": 1, "products": [...]}` biçiminde ve
`parseStoredProducts()` ile okunuyor. **Alan eklenir/değişirse
`SCHEMA_VERSION` artırılır ve göç yolu yazılır** — hem SQL migration hem bu sürüm.

### Veritabanı ve güvenlik

SQL `supabase/migrations/` altında: `households` + `household_members` +
`products`. Paylaşım arayüzü **yok** ama şema hazır ("tek kişilik ev"):
paylaşım eklendiğinde **RLS politikaları değişmez**, yalnızca
`household_members`'a satır eklenir.

**RLS bu uygulamada tek güvenlik sınırıdır** — route koruması ve middleware
yok. `security definer` fonksiyonlarda `set search_path = ''` ve tam nitelikli
tablo adları **zorunlu**; sabitlenmezse çağıran kendi şemasına aynı adlı tablo
koyup fonksiyonu kandırabilir.

Env (`.env.local`, örnek: `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `service_role` anahtarı istemciye **hiç girmez**.

Kurulum adımları [`KURULUM.md`](KURULUM.md)'de. İki doğrulama komutu:
`npm run doctor` (env, şema, "Confirm email", tetikleyici, yazma yolu) ve
`npm run rls-check` (iki test hesabıyla veri yalıtımı). **RLS'in engellediği
`UPDATE`/`DELETE` hata vermez, 0 satır etkiler** — bu yüzden `rls-check`
"hata geldi mi" değil "satır etkilendi mi ve veri değişmemiş mi" diye bakar.

### İş kuralları

```
Kalan Gün = (Açılış Tarihi + Raf Ömrü) − Bugün
```

| Kalan gün | Durum | Renk |
| --- | --- | --- |
| ≥ 3 | `safe` | yeşil |
| 1–2 | `warning` | sarı |
| ≤ 0 | `expired` | kırmızı |

Eşikler `statusOf()` içinde tek yerde durur ve testle kilitlidir; renk sınıfları
`ProductCard` içindeki `STATUS_STYLES` tablosundadır.

Arama ürün adında **ve kategoride** geçer; durum filtresi aynı eşikleri
`statusOf()` üzerinden kullanır, eşik bilgisini kopyalamaz
(`lib/product-filter.ts`).

Tarih hesapları `Date.UTC`'ye sabitlenir (`lib/date.ts`), yoksa yaz saati
geçişinde gün kayar. Tarihler her yerde `YYYY-MM-DD` metni olarak taşınır,
`Date` nesnesi olarak değil.

## Bu projeye özgü tuzaklar

Aşağıdakilerin hepsi bir kez canlı olarak yaşandı; detaylar
`GELISTIRME_NOTLARI.md` içinde.

1. **`useEffect` içinde `setState` ESLint hatası** (`react-hooks/set-state-in-effect`).
   Bu yüzden `localStorage` React state'ine kopyalanmaz; `useSyncExternalStore`
   ile dış kaynak olarak bağlanır. Aynı deseni koruyun.

2. **Prerender sırasında `new Date()` build'i kırar.** Anlık saat yalnızca
   `useToday()` üzerinden okunur; sunucuda `""`, istemcide gerçek tarih döner.
   `today === ""` aynı zamanda "istemciye geçildi" sinyalidir ve liste bu
   kontrolden sonra çizilir. Bileşenler `today`'i **prop olarak** alır,
   kendi içinde `todayISO()` çağırmaz.

3. **`useSyncExternalStore` referans kararlılığı.** `getSnapshot` her çağrıda
   yeni dizi döndürürse sonsuz render olur. `storage.ts` ham metni
   (`cachedRaw`) karşılaştırıp aynıysa önbellekteki diziyi döner — bu
   önbelleği bozmayın.

4. **State updater'ları saf olmalı.** React StrictMode (Next'te varsayılan açık)
   updater'ları geliştirmede iki kez çağırır. `setX(prev => ...)` içine yan
   etki koymak işlemi iki kez yürütür; "Geri al" bir ürünü iki kez eklemişti.
   Yan etkiler olay işleyicisinde, updater'ın dışında.

5. **`error.tsx` prerender hatalarını yakalamaz.** Render sırasında atılan hata
   `error.tsx`'e ulaşmaz, **build'i kırar** — yani o sınıf hata üretime çıkamaz.
   `error.tsx`'in alanı hidrasyondan sonraki istemci hatalarıdır.

6. **Next 16'da `themeColor` `metadata`'ya değil `viewport` export'una ait**
   (`src/app/layout.tsx`).

7. **Form alanları prop'tan `key` ile doldurulur, effect ile değil.**
   `ProductForm` düzenleme kipinde alanları `initial` prop'undan doldurur ve
   bunu `useState` başlangıç değerleriyle yapar. Üst bileşen
   `key={editing?.id ?? "yeni"}` verir; kayıt değişince form yeniden kurulur ve
   alanlar kendiliğinden tazelenir. Bu, "prop'tan state türetme" sorununu
   1 numaralı yasağa girmeden çözer — effect içinde senkronizasyon yazmayın.
   Düzenlenen kayıt `products` listesinden türetilir (`editingId` → `find`),
   bu yüzden kayıt silinirse düzenleme kipi kendiliğinden kapanır.

8. **Sayfa seviyesinde yazma `await` edilmek ZORUNDA.** `handleSubmit`
   `addProduct`/`updateProduct` sonucunu beklemezse `ProductForm` yazmayı
   başarılı sanar, alanları temizler ve kullanıcı yazdığını kaybeder. Bu hata
   bir kez yaşandı ve yalnızca `app/page.test.tsx` yakaladı — formun izole
   birim testi yakalamaz.

9. **`getSnapshot` referans kararlılığını bozmayın** (`product-store.ts`).
   Anlık görüntü yalnızca durum değiştiğinde yeniden üretilir; her çağrıda
   yeni nesne dönerse `useSyncExternalStore` sonsuz render'a girer. Bir test
   bunu tutuyor.

10. **Store'lar `this` kullanmaz.** `useProducts` eylemleri destructure
    ediyor; `this`'e bağlı bir metot bağlamı kaybeder ve çağrıldığında çöker.

11. **`app/providers.tsx` ile `lib/useSession.ts` döngüsel içe aktarım
    yapıyor.** Varsayılan store'lar bu yüzden tembel kurulur; modül gövdesinde
    kurulsa yükleme sırasına göre `undefined` yakalanabilir.

12. **Türkçe arama `toLocaleLowerCase("tr")` ile katlanır** (`lib/product-filter.ts`).
   Varsayılan `toLowerCase()` ile `"ILIK"` → `"ilik"` olur ve `"Ilık"` ile
   eşleşmez. I/ı ve İ/i çiftleri yalnızca `tr` yereliyle doğru çalışır.

## Test yaklaşımı

Vitest **jsdom** ortamında koşar (`vitest.config.mts`), kurulum dosyası
`src/test/setup.ts` (jest-dom eşleştiricileri, her testten sonra `cleanup()` ve
`localStorage.clear()`). Desen: `src/**/*.test.{ts,tsx}`. **176 test / 18 dosya:**

| Dosya | Test | Neyi kapsıyor |
| --- | --- | --- |
| `lib/product-store.test.ts` | 28 | Okuma/yazma/aktarım/yeniden deneme; sahte API enjekte edilir |
| `lib/product-schema.test.ts` | 22 | Doğrulama kuralları, şema sürümü, göç |
| `components/ProductForm.test.tsx` | 18 | Kipler, `saving`, başarısızlıkta alanların korunması |
| `lib/date.test.ts` | 15 | Kalan gün, eşikler, ay/yıl/artık yıl/yaz saati sınırları |
| `lib/product-filter.test.ts` | 14 | Arama (Türkçe harf katlama), durum filtresi, sayaçlar |
| `components/ProductCard.test.tsx` | 9 | Dört durum sınırı, düzenle/tüket, `disabled` |
| `lib/product-cache.test.ts` | 9 | Gidiş-dönüş, anahtar ayrımı, yazılamayan depolama |
| `app/page.test.tsx` | 8 | **Uçtan uca:** giriş kapısı, ekle, tüket, geri al, yazma hatası, çevrimdışı, aktarım |
| `lib/product-api.test.ts` | 7 | Satır çevrimi, saat dilimi, bozuk satırın reddi |
| `components/AuthScreen.test.tsx` | 6 | Kipler, boş alan reddi, hata, kilitli buton |
| `components/ConnectionBanner.test.tsx` | 6 | Çevrimdışı / güncelleniyor / okunamayan kayıt / önbellek uyarısı |
| `components/FilterBar.test.tsx` | 6 | Arama, temizleme, durum düğmeleri, erişilebilir adlar |
| `app/error.test.tsx` | 6 | Hata ekranı, `reset`, `digest` |
| `components/Toast.test.tsx` | 5 | Mesaj, eylem, otomatik kapanma / kapanmama |
| `components/UndoToast.test.tsx` | 5 | Bildirim, erişilebilirlik, 6 sn zamanlayıcı |
| `lib/useSession.test.ts` | 5 | Oturum geçişleri, dinleyicinin bırakılması |
| `lib/product-list.test.ts` | 4 | `replaceById` — sırayı bozmadan güncelleme |
| `components/ImportPrompt.test.tsx` | 3 | Sayı, aktar düğmesi, meşgul durumu |

**Ağa dokunulmaz.** `product-store` API'yi parametre aldığı için senkron
mantığı sahte bir API ile test edilir; `app/page.test.tsx` de gerçek store +
sahte API + sahte oturumla çalışır.

Yeni kod için sıra: **önce kırmızı test, sonra kod.** Mevcut ve doğru çalışan bir
kod için yazılan test ilk denemede geçer ve hiçbir şey kanıtlamaz; testin bir
hatayı gerçekten yakaladığını görmek için önce kırmızıyı görmek gerekir.
Ortam kurulumları (node ve jsdom) bu yüzden birer kasıtlı kırıkla sınandı.

### Kalan test boşlukları

- `app/page.tsx` için bütünleşme testi yok — bileşenler ve hook ayrı ayrı test
  edildi, "sil → bildirim çıkar → geri al" akışı uçtan uca test edilmedi.
- `error.tsx`'in **Next tarafından** hata sınırı olarak bağlanması framework
  davranışıdır ve test edilmez; test edilen, bağlandığında ekranın doğru
  çalıştığıdır. (Prerender hatalarını yakalamadığı ayrıca doğrulandı — bkz.
  tuzak 5.)

## Next.js sürüm uyarısı

`AGENTS.md`, `next dev` tarafından otomatik yazılıp yenilenen bir blok içerir ve
şunu söyler: **bu Next.js sürümü eğitim verisindekinden farklıdır**; API'ler,
kurallar ve dosya yapısı değişmiş olabilir. Next'e dair bir şey yazmadan önce
ilgili kılavuzu `node_modules/next/dist/docs/` içinden okuyun. Yukarıdaki
1, 2, 5 ve 6 numaralı tuzaklar bu farkların doğrudan sonucudur.

`AGENTS.md`'deki bu bloğu diff'ten silmek işe yaramaz — `next dev` yeniden
ekler; işinizle birlikte commit'lemek ağacı temiz tutar.

## Henüz yapılmamışlar

- **Paylaşım arayüzü** (ev arkadaşı daveti). Şema hazır, arayüz yok.
- **Realtime** — paylaşım gelmeden anlamsız.
- **Bildirimler** (e-posta / push). Supabase Edge Functions + `pg_cron` ile
  eklenir, mevcut mimariyi değiştirmez.
- **Tüketildi / çöpe atıldı ayrımı.** Arayüzde tek düğme var; ayrım için
  ek kolon gerekir.
- **Tam çevrimdışı yazma.** Bugün yazma çevrimiçi gerektiriyor.
- **RLS'in CI içinde test edilmesi** — `npm run rls-check` gerçek bir projeye
  karşı koşuyor; Docker + Supabase CLI ile CI'da koşturmak ayrı bir iş.
