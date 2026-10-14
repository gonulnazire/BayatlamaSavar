# BayatlamaSavar — Sistem Mimarisi ve Backend Kararı

**Tarih:** 14 Ekim 2026
**Durum:** Yön belirlendi (Supabase). Kullanım amacı netleşti (tek kullanıcı,
ileride genişletilebilir). Diğer tasarım detayları açık.

Bu dosya, mevcut mimarinin tam resmini ve backend/veritabanı kararını kayda
geçirir. Kod yazmadan önce neyin netleşmesi gerektiği en sonda listelidir.

---

## 1. Mevcut durum: backend **yok**, veritabanı **yok**

Hiç yok. Ne API route, ne server action, ne sunucu kodu, ne ORM. Sayfa tamamen
statik üretiliyor (build çıktısı: `○ / Static`), tüm iş tarayıcıda yapılıyor.
Tek kalıcılık `localStorage`.

Kaynak kod **1095 satır** (test hariç), üstüne **121 test**.

## 2. Katmanlar

| Katman | Dosyalar | Satır | Sorumluluğu | Veri kaynağını bilir mi? |
| --- | --- | --- | --- | --- |
| **Model** | `types/product.ts` | 18 | `Product` tipi, 4 kategori | — |
| **Saf iş mantığı** | `date.ts`, `product-schema.ts`, `product-list.ts`, `product-filter.ts` | 255 | Kalan gün, renk eşikleri, doğrulama, şema sürümü, liste işlemleri, arama/filtre | **Hayır** — dizi girer, dizi çıkar |
| **Köprü** | `storage.ts`, `useToday.ts` | 122 | `localStorage` ↔ React, bugünün tarihi | **Evet — tek yer** |
| **Sunum** | `ProductForm`, `ProductCard`, `FilterBar`, `UndoToast` | 404 | Arayüz; veriyi prop olarak alır | Hayır |
| **Birleştirme** | `app/page.tsx` | 189 | Durumu bağlayan tek istemci bileşeni | Yalnızca `useProducts()` çağırır |

Veri akışı tek yönlü: `types` → saf `lib` → köprü `lib` → `components` → `page`.

## 3. Kararın dayandığı en önemli gerçek: tek dikiş yeri

**`localStorage`'a dokunan tek dosya `src/lib/storage.ts` (102 satır).**
Dışa açtığı tek şey:

```ts
useProducts() → { products, addProduct, updateProduct, removeProduct, restoreProduct }
```

Sonuçları:

- Bu arayüzün **arkasını** değiştirmek uygulamanın geri kalanını etkilemez.
  Backend'e geçiş "her yeri elden geçirmek" değil, bir dosyanın içini
  değiştirmek + yükleme/hata durumları eklemek.
- Saf katmandaki **65 test** (`date` 15 · `product-schema` 22 ·
  `product-list` 14 · `product-filter` 14) **olduğu gibi geçerli kalır**,
  çünkü verinin nereden geldiğini hiç bilmiyorlar.
- Şema zaten sürümlü (`{"version":1,"products":[...]}`) ve
  `parseStoredProducts()` doğrulanmış kayıt üretiyor. Mevcut kullanıcı
  verisini veritabanına taşımak düz bir toplu `insert`.

## 4. Mevcut mimarinin gerçek sınırları

Ölçek **sorun değil**: `localStorage` ~5 MB, binlerce ürün rahat sığar.
Backend'e geçmenin sebebi performans değil. Gerçek sınırlar:

| Sınır | Sonucu |
| --- | --- |
| Tek cihaz, tek tarayıcı | Telefonda eklenen, bilgisayarda görünmez |
| Paylaşım imkânsız | Dokümandaki "çoklu ev arkadaşı" bu mimariyle yapılamaz |
| Yedek yok | Tarayıcı verisi temizlenirse her şey gider |
| Bildirim imkânsız | Uygulama kapalıyken çalışan hiçbir şey yok; push/e-posta sunucu ister |
| Silme kalıcı | `consumed_at` gibi alan yok; "ne kadar israf ettim" türü veri birikmiyor |

Çok sekme senkronu ise **zaten çözülmüş** (`storage` olayı dinleniyor).

## 5. Değerlendirilen seçenekler

| | Yaklaşım | İş | Kazanç | Bedeli |
| --- | --- | --- | --- | --- |
| **A** | localStorage'da kal + JSON dışa/içe aktarma | ~yarım gün | Yedek alma, cihaz değişiminde elle taşıma | Çok cihaz, paylaşım, bildirim yine yok |
| **B** | **Supabase** (Postgres + Auth + Realtime) | ~2-3 gün | Çok cihaz, ev arkadaşı paylaşımı, yedek, bildirim zemini | İnternet bağımlılığı, dış servise bağımlılık, ücretsiz katman sınırları |
| **C** | Kendi backend'i (Next route handlers + Postgres + Drizzle/Prisma) | ~4-5 gün | Tam kontrol, satıcı bağımlılığı yok | Kimlik doğrulama ve güvenliği baştan sona kendin taşırsın |
| **D** | Offline-first hibrit (IndexedDB + sunucu senkronu) | 1 hafta+ | En iyi kullanıcı deneyimi | Çatışma çözümü ve senkron kuyruğu; bu aşamada erken |

## 6. Karar: **B — Supabase**

**Gerekçe:** Gereksinim dokümanındaki Post-MVP maddelerinin üçü (gerçek
veritabanı, kullanıcı girişiyle çoklu ev arkadaşı desteği, e-posta/push
bildirimi) **tek bir altyapıyı** istiyor ve Supabase üçünü birlikte veriyor.
Mimari tek dikiş yerinde toplandığı için geçiş maliyeti düşük.

C'nin tek avantajı bağımsızlık; bedeli kimlik doğrulamayı kendin yazmak ve bu,
bu projenin asıl değerini artırmıyor. D ise 48 saatlik MVP ruhuna göre erken.

### Veri modeli taslağı

```sql
households          (id, name, created_at)
household_members   (household_id, user_id, role)
products            (id, household_id, name, category,
                     opened_at date, shelf_life_days int,
                     created_by, created_at,
                     consumed_at nullable)   -- soft delete: israf istatistiğini açar
```

Not: mevcut modelde `consumed_at` yok, silme kalıcı. Veritabanına geçerken
soft delete'e dönmek "tüketim geçmişi / israf istatistiği" özelliklerinin
kapısını açar — bu bir mimari çatal, kararı ayrıca verilmeli.

### Önemli mimari tavsiye

**Kalan gün ve renk hesabını SQL'e taşımayın.** Her gün değişen bir değer;
saf fonksiyon olarak istemcide kalsın, veritabanı yalnızca ham veriyi
(`opened_at`, `shelf_life_days`) tutsun. Mevcut `date.ts` ve
`product-filter.ts` o zaman aynen çalışmaya devam eder ve 29 testi korunur.

### Değişecek / değişmeyecek

| Değişecek | Değişmeyecek |
| --- | --- |
| `lib/storage.ts` içi (Supabase sorguları, async) | `types/product.ts` |
| `useProducts` imzası: `loading` / `error` eklenir | `date.ts`, `product-list.ts`, `product-filter.ts` |
| `page.tsx`: yükleme ve hata durumları | `ProductCard`, `FilterBar`, `UndoToast` |
| Yeni: giriş ekranı, RLS politikaları, tablo migration'ları | `product-schema.ts` (sunucu yanıtını doğrulamak için hâlâ değerli) |

---

## 7. Kod yazmadan önce netleşmesi gerekenler

Bunlar kararlaştırılmadan uygulamaya geçilmeyecek; her biri veri modelini
veya iş miktarını doğrudan değiştiriyor:

1. ~~**Kullanım amacı**~~ — **CEVAPLANDI (14 Ekim 2026):** Şimdilik tek
   kullanıcı (yalnızca proje sahibi), kendi cihazları arasında senkron ve
   yedek için. Ev arkadaşı paylaşımı **ileride genişletme olasılığı** olarak
   duruyor, şu an kapsam dışı.

   **Tasarıma etkisi:** Paylaşım bugün yazılmayacak (YAGNI), ama şema buna
   hazır kurulacak. Önerilen yol "tek kişilik ev" (*household of one*):
   `households` tablosu baştan var olur ve kayıt anında kullanıcıya bir
   kişisel ev satırı açılır. Bedeli bugün bir tablo + kayıtta bir `insert`;
   kazancı, paylaşım eklendiğinde veri göçü ve RLS politikalarını yeniden
   yazmak gerekmemesi. Alternatif (`products.user_id` ile başlayıp sonra
   `household_id`'ye geçmek) ileride migration + politika yazımı demek.
2. **Giriş yöntemi** — e-posta + şifre, e-postaya gelen bağlantı (magic link),
   yoksa Google ile giriş?
3. **Paylaşım akışı** — ev arkadaşı nasıl katılır: e-posta daveti mi, paylaşım
   kodu mu?
4. **Çevrimdışı davranış** — internet yokken uygulama ne yapsın: salt okunur mu
   olsun, yoksa yerelde biriktirip sonra göndersin mi?
5. **Mevcut verinin taşınması** — ilk girişte tarayıcıdaki ürünler hesaba
   aktarılsın mı?
6. **Realtime** — ev arkadaşının eklediği anında görünsün mü, yoksa sayfa
   yenilenince mi? (Sonraya bırakılabilir.)
7. **Bildirim** — e-posta mı, tarayıcı push'u mu? (Push için service worker +
   VAPID anahtarları gerekir; e-posta daha kısa yol.)

**Ayrıca pratik ön koşul:** Supabase projesi senin hesabında açılmalı ve
`NEXT_PUBLIC_SUPABASE_URL` ile `NEXT_PUBLIC_SUPABASE_ANON_KEY` değerleri
`.env.local` dosyasına girilmeli. Bunu benim yerine senin yapman gerekiyor.

---

## 8. Süreç

Bu iş **architectural** sınıfında: yeni bir alt sistem ve `page.tsx`'in
bağımlı olduğu arayüzün değişmesi. İzlenecek sıra:

```
sorular → yaklaşımlar → bölüm bölüm tasarım onayı
   → yazılı spec (docs/superpowers/specs/) → spec onayı
   → uygulama planı → kod
```

Şu an **1. adımda** (yukarıdaki 7 soru) duruluyor.
