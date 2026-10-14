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
TypeScript 5 · Vitest 5 · lucide-react · Node 24

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

Veritabanı yok; tek kalıcılık `localStorage`. Sunucu tarafı mantık yoktur,
sayfa statik olarak prerender edilir.

### localStorage sözleşmesi

- Anahtar: `bayatlamasavar.products`
- Biçim: `{"version": 1, "products": [...]}`
- Okuma `parseStoredProducts()` üzerinden yapılır ve üç durumu ayırır:
  düz dizi (sürümsüz ilk biçim, göç edilir) · `version: 1` · tanınmayan sürüm
  (**boş döner** — yanlış veri göstermek hiç göstermemekten kötüdür)
- **Alan eklenir/değişirse `SCHEMA_VERSION` artırılır ve göç yolu yazılır.**

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

8. **Türkçe arama `toLocaleLowerCase("tr")` ile katlanır** (`lib/product-filter.ts`).
   Varsayılan `toLowerCase()` ile `"ILIK"` → `"ilik"` olur ve `"Ilık"` ile
   eşleşmez. I/ı ve İ/i çiftleri yalnızca `tr` yereliyle doğru çalışır.

## Test yaklaşımı

Vitest **jsdom** ortamında koşar (`vitest.config.mts`), kurulum dosyası
`src/test/setup.ts` (jest-dom eşleştiricileri, her testten sonra `cleanup()` ve
`localStorage.clear()`). Desen: `src/**/*.test.{ts,tsx}`. **121 test / 10 dosya:**

| Dosya | Test | Neyi kapsıyor |
| --- | --- | --- |
| `lib/product-schema.test.ts` | 22 | Doğrulama kuralları, şema sürümü, göç |
| `lib/date.test.ts` | 15 | Kalan gün, eşikler, ay/yıl/artık yıl/yaz saati sınırları |
| `lib/storage.test.ts` | 15 | `useProducts`: okuma, göç, ekleme, güncelleme, silme, geri alma, referans kararlılığı |
| `lib/product-list.test.ts` | 14 | Sıra koruyarak çıkarma/geri koyma/güncelleme |
| `lib/product-filter.test.ts` | 14 | Arama (Türkçe harf katlama dahil), durum filtresi, sayaçlar |
| `components/ProductForm.test.tsx` | 16 | Ekleme ve düzenleme kipleri, varsayılanlar, kırpma, boş ad reddi |
| `components/ProductCard.test.tsx` | 8 | Dört durum sınırı, tarih metni, düzenle/sil çağrıları |
| `components/FilterBar.test.tsx` | 6 | Arama kutusu, temizleme, durum düğmeleri, erişilebilir adlar |
| `app/error.test.tsx` | 6 | Hata ekranı, `reset`, `digest` |
| `components/UndoToast.test.tsx` | 5 | Bildirim, erişilebilirlik, 6 sn zamanlayıcı |

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

- Gereksinim dokümanındaki Post-MVP maddeleri: gerçek veritabanı
  (Supabase/PostgreSQL), kullanıcı girişi ile çoklu ev arkadaşı desteği,
  e-posta/push bildirimleri. Hiçbirine başlanmadı.
