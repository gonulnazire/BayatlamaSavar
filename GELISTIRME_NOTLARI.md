# BayatlamaSavar — Geliştirme Notları

Bu dosya, projenin her adımında verilen dönütlerin tek sayfada toplandığı kayıttır.
Her bölüm bir adımı anlatır: ne yapıldı, neden yapıldı, nasıl doğrulandı.

**Proje:** BayatlamaSavar — ambalajı açılmış gıdaların raf ömrü takibi
**Konum:** `bayatlamasavar/`
**Başlangıç:** 14 Ekim 2026

---

## Adım 0 — Kurulum ve çalışan ilk sürüm (MVP)

**Tarih:** 14 Ekim 2026

### Yapılanlar
Next.js 16.4 + React 19.3 + Tailwind CSS 4 + lucide-react ile proje kuruldu ve
gereksinim dokümanındaki MVP kapsamı baştan sona çalışır hale getirildi.

| Dosya | Sorumluluğu |
| --- | --- |
| `src/types/product.ts` | `Product` veri modeli ve 4 kategori sabiti |
| `src/lib/date.ts` | `daysLeft` formülü, `statusOf` renk eşikleri, `formatDate` (tr-TR) |
| `src/lib/storage.ts` | localStorage'ı saran `useProducts()` hook'u |
| `src/lib/useToday.ts` | Bugünün tarihi (yalnızca istemci) |
| `src/components/AddProductForm.tsx` | Ürün ekleme formu |
| `src/components/ProductCard.tsx` | Durum rozetli ürün kartı + sil butonu |
| `src/app/page.tsx` | Ana sayfa, aciliyete göre sıralı liste |

Karşılanan gereksinimler: 3.1 (ekleme), 3.2 (liste + formül + renk kodlaması),
3.3 (silme), 4 (dark mode, istemci tarafı render, sade arayüz).

### Yol boyunca çözülen iki teknik sorun
Next.js 16 iki şeyi artık **hata** sayıyor; ikisi de kestirme yerine mimari
düzeltmeyle çözüldü:

1. **`useEffect` içinde `setState` yasak** (`react-hooks/set-state-in-effect`).
   localStorage'ı React state'ine kopyalamak yerine `useSyncExternalStore` ile
   gerçek bir dış veri kaynağı olarak bağlandı.
   *Yan fayda:* ikinci sekmede yapılan değişiklik anında yansıyor.

2. **Prerender sırasında `new Date()` yasak.** Tarih okuması `useToday()`
   hook'una taşındı; sunucuda boş string, istemcide gerçek tarih döner.
   *Yan fayda:* sayfa açık kalırsa gece yarısı geçilince kalan günler
   kendiliğinden tazeleniyor.

### Doğrulama
- `npx tsc --noEmit` → temiz
- `npm run lint` → temiz
- `npm run build` → başarılı, `/` statik olarak prerender edildi
- `npm run dev` → http://localhost:3000, HTTP 200

### Açık kalan eksikler (sonraki adımların gerekçesi)
1. Test altyapısı yok — 0 test
2. localStorage'dan gelen veri doğrulanmıyor → bozuk kayıt sessizce **yeşil** görünebilir
3. Hata sınırı (`error.tsx`) yok
4. Commit atılmadı
5. Metadata/manifest/ikon eksik
6. Silmede onay veya geri alma yok

---

## Adım 1 — Test altyapısı ve `date.ts` birim testleri

**Tarih:** 14 Ekim 2026
**Hedef:** Projenin iş mantığını taşıyan saf fonksiyonları otomatik testle kilitlemek.

### Neden buradan başlandı
`daysLeft` ve `statusOf`, uygulamanın tek işini yapan fonksiyonlar: "bu ürün
daha güvenli mi, çöpe mi gidecek?". İkisi de saf fonksiyon — girdi verip çıktıyı
kontrol etmek bedava. Bunlar testle kilitlenmeden üzerine özellik eklemek,
sessizce yanlış cevap veren bir uygulamayı büyütmek demekti.

### Yapılanlar
- **Vitest 5.0.4** kuruldu (`devDependency`).
- `vitest.config.mts` eklendi: Node ortamı, `src/**/*.test.ts` deseni ve
  üretim kodundakiyle aynı `@/*` yol takma adı.
- `package.json` betikleri: `npm test` (tek seferlik) ve `npm run test:watch`.
- `src/lib/date.test.ts` → **15 test**.

### Test kapsamı
`daysLeft` (8 test):
- bugün açılan 3 günlük üründe 3 gün kalması
- raf ömrünün dolduğu gün tam `0` dönmesi (sarı/kırmızı sınırı)
- süre aşıldığında negatif dönmesi
- raf ömrü `0` olan ürünün açıldığı gün tükenmesi
- ay sınırı geçişi (30 Ekim → 2 Kasım)
- yıl sınırı geçişi (30 Aralık → 2 Ocak)
- artık yıl: 29 Şubat 2028'in sayılması
- **yaz saati geçişi**: 29 Mart 2026'da gün kaymaması

`statusOf` (3 test): `≥3` yeşil, `1–2` sarı, `≤0` kırmızı eşiklerinin tamamı.
`todayISO` (2 test): biçim ve yerel saate uygunluk.
`formatDate` (2 test): `14 Eki 2026` ve tek haneli günde `5 Oca 2026`.

### Yol boyunca çözülen üç sorun

1. **Peer dependency çakışması.** Vitest 5, `@types/node >= 24` istiyordu;
   `create-next-app` projeyi `^20` ile kurmuştu. `--legacy-peer-deps` ile
   bastırmak yerine tipler çalışılan runtime'a hizalandı (`@types/node@^24`,
   Node v24.14.1 ile uyumlu).

2. **Testlerin gerçekten çalıştığının kanıtı.** Mevcut ve doğru çalışan bir kod
   için yazılan testler ilk denemede geçer — bu da "testler bir hatayı yakalar
   mı?" sorusunu cevapsız bırakır. Bu yüzden önce kasıtlı yanlış bir beklenti
   (`statusOf(5)` için `expired`) eklendi ve koşuldu:

   ```
   FAIL  src/lib/date.test.ts > statusOf > HARNESS KONTROLU
   AssertionError: expected 'safe' to be 'expired'
   Tests  1 failed | 15 passed (16)
   ```

   Harness kırmızıyı doğru yerde ve doğru mesajla raporladı; kasıtlı kırık
   kaldırıldı.

3. **Çıktıdaki uyarı.** Vite, `vitest.config.ts` dosyasının CommonJS olarak
   yüklenip ESM sözdizimi içerdiğini bildiriyordu. Uyarıyı
   `VITE_CONFIG_NATIVE_IGNORE_WARNING` ile susturmak yerine dosya
   `vitest.config.mts` olarak adlandırıldı — sebep ortadan kalktı.

### Doğrulama
```
npm test        → Test Files 1 passed (1) | Tests 15 passed (15)   [uyarısız çıktı]
npx tsc --noEmit → temiz
npm run lint    → temiz
```

### Not
`date.ts` MVP sırasında testten önce yazılmıştı; bu adımdaki testler bu nedenle
"karakterizasyon testi" niteliğinde. Bundan sonra yazılacak **yeni** kod için
sıra tersine çevrilecek: önce kırmızı test, sonra kod.

---

## Adım 2 — Veri doğrulama katmanı ve şema sürümleme

**Tarih:** 14 Ekim 2026
**Hedef:** Depodan gelen veriye güvenmeyi bırakmak.

### Giderilen hata
Önceki kod localStorage'dan okuduğunu `as Product[]` diyerek gözü kapalı kabul
ediyordu. Bunun somut sonucu şuydu:

`shelfLifeDays` bozuksa (örn. `NaN`) → `daysLeft` **NaN** döner →
`statusOf(NaN)`'da `NaN <= 0` ve `NaN <= 2` karşılaştırmaları **false** olur →
fonksiyon `"safe"` döner. Yani **bozulmuş bir ürün ekranda yeşil görünür.**
Uygulamanın tek işi zamanında uyarmak olduğu için bu, en kötü türden sessiz
hatadır: kullanıcı güvende sanır.

### Yapılanlar
Yeni dosya: `src/lib/product-schema.ts`

| Dışa açılan | İşi |
| --- | --- |
| `SCHEMA_VERSION` | Depolanan biçimin sürümü (şu an `1`) |
| `parseProduct(value)` | Tek kaydı doğrular; güvenilmezse `null` |
| `parseStoredProducts(raw)` | Ham metni okur, sürümü tanır, bozukları atar |
| `serializeProducts(list)` | Sürüm bilgisiyle yazar |

Doğrulama kuralları:
- `id` → boş olmayan metin, yoksa **ret**
- `name` → boş olmayan metin, baştaki/sondaki boşluk **kırpılır**
- `category` → bilinmiyorsa veriyi atmak yerine **"Diğer"e düşürülür**
- `openedAt` → hem `YYYY-MM-DD` biçimi hem de **takvimde gerçekten var olması**
  (`2026-02-30` ve artık yıl olmayan `2026-02-29` reddedilir)
- `shelfLifeDays` → sonlu sayı ve `>= 0`; `NaN`/`Infinity`/metin **ret**,
  ondalık ise aşağı yuvarlanır
- Bilinmeyen fazladan alanlar **taşınmaz** (yalnızca bilinen alanlar kopyalanır)

**Şema sürümleme ve göç (migration):** Depo artık
`{"version":1,"products":[...]}` biçiminde yazılıyor. Okuma tarafı üç durumu
ayırt eder:
1. düz dizi → sürümsüz ilk biçim, okunur (eski kullanıcı verisi kaybolmaz)
2. `version: 1` → mevcut biçim
3. tanınmayan sürüm → **boş döner**; körlemesine okuyup yanlış veri göstermek
   hiç göstermemekten kötüdür

`storage.ts` bu katmana bağlandı. Yazma yolu da doğrulamadan geçiriliyor:
ekranda görünen, depoda duran ve yeniden okunduğunda elde edilecek veri birebir
aynı.

### TDD akışı (bu adımda tam uygulandı)
1. **RED** — `src/lib/product-schema.test.ts` (22 test) henüz var olmayan modüle
   karşı yazıldı ve koşuldu. Beklenen sebeple patladı: modül bulunamadı.
2. **GREEN** — `product-schema.ts` yazıldı, 37/37 test yeşil.
3. **REFACTOR** — `storage.ts` yeni katmana bağlandı; testler yeşil kaldı.

### Doğrulama
```
npm test         → Test Files 2 passed (2) | Tests 37 passed (37)
npx tsc --noEmit → temiz
npm run lint     → temiz
npm run build    → başarılı, / statik prerender
```

---

## Adım 3 — Hata sınırı (`error.tsx`)

**Tarih:** 14 Ekim 2026
**Hedef:** Beklenmeyen bir render hatasında kullanıcıyı boş ekranla baş başa bırakmamak.

### Yapılanlar
`src/app/error.tsx` eklendi: koyu temaya uygun, Türkçe, uyarı ikonlu bir ekran.
İçeriği bilinçli olarak güven verici — "kayıtlı ürünlerin tarayıcında duruyor,
silinmedi" — çünkü kullanıcının ilk korkusu verisini kaybetmek olur.
"Tekrar dene" butonu React'in `reset()` fonksiyonunu çağırır; varsa Next'in
`digest` hata kodu ekranda gösterilir.

### Doğrulamada çıkan beklenmedik bulgu
"Derlendi" demek "çalışıyor" demek olmadığı için `page.tsx`'e geçici bir
`throw` eklenip gerçekten devreye girip girmediği denendi. **Girmedi:**

```
GET / 500   →  <html id="__next_error__">   (hata sınırı değil, Next'in 500 belgesi)
```

Aynı hatayla production build de denendi:

```
Export encountered an error on /page: /, exiting the build.
⨯ Next.js build worker exited with code: 1
```

**Çıkarım:** Bu sayfa statik olarak prerender edildiği için, render sırasında
atılan bir hata `error.tsx`'e hiç ulaşmıyor — **build'i kırıyor.** Bu aslında
iyi haber: o sınıf hata üretime çıkamaz, geliştirme sırasında yakalanır.
`error.tsx`'in gerçek görev alanı, hidrasyondan **sonra** istemcide oluşan
çalışma zamanı hatalarıdır (örn. etkileşim sırasında patlayan bir render).

Geçici `throw` geri alındı; `grep` ile dosyada iz kalmadığı doğrulandı.

### Dürüst sınır: neyi doğrulayamadım
`error.tsx`'in **istemci tarafı** hatayı yakaladığını bu ortamda
doğrulayamadım — bunun için ya tarayıcı sürücüsü ya da `jsdom` + React Testing
Library ile bileşen testi gerekiyor; ikisi de şu an projede yok.
Doğrulanan: dosya derleniyor, tipleri geçiyor, lint temiz ve Next'in beklediği
`{ error, reset }` arayüzüne uyuyor. Doğrulanmayan: gerçek bir istemci
hatasında ekranda göründüğü.

Bu, bileşen testi altyapısı (jsdom) kararı alınana kadar **açık bir eksik**
olarak kayda geçer.

---

## Adım 4 — Sürüm kontrolü

**Tarih:** 14 Ekim 2026

### Yapılanlar
O ana kadarki tüm iş tek bir commit'te kayda geçti:

```
86466bc  MVP, test altyapısı, veri doğrulama ve hata sınırı
019e0e5  Initial commit from Create Next App
```

Commit mesajı yalnızca "ne" değil "neden"i de içeriyor: Next.js 16'nın iki yeni
kuralının nasıl karşılandığı ve `NaN` kaynaklı sessiz yeşil hatasının ne olduğu
mesajın gövdesinde yazılı.

### Alınan kararlar
- **Tek commit, çok commit değil.** Adım 0-3'ün dosyaları birbirine bağımlıydı
  (`storage.ts` artık `product-schema.ts`'i içe aktarıyor). Yapay olarak
  bölünse, ara commit'lerin bazıları derlenmeyecekti. Her commit'in kendi
  başına çalışır olması, sayısından önemli.
- **Branch açılmadı.** Depo yerel, uzak sunucu (remote) yok, dal `master` ve
  tek kullanıcı var; dal açmak ardından birleştirme adımı doğuracaktı.
  Uzak depo eklendiğinde bu alışkanlık değişmeli.
- Sonraki adımlar ayrı commit'ler aldı.

### Yan iş
Windows'ta `git add` her dosyada `LF will be replaced by CRLF` uyarısı
veriyordu. `.gitattributes` eklenerek (`* text=auto eol=lf`) satır sonları
sabitlendi; ikili dosyalar (`.ico`, `.png`, `.jpg`, `.woff2`) ayrıca işaretlendi.

---

## Adım 5 — Metadata, ikon ve manifest

**Tarih:** 14 Ekim 2026
**Hedef:** Mobil hedefli bir uygulamanın tarayıcıda ve ana ekranda doğru görünmesi.

### Yapılanlar
- `public/icon.svg` — koyu zeminde okunan, emerald zeminli zamanlayıcı ikonu.
  SVG seçildi: tek dosya, her boyutta net, PNG üretme adımı gerekmiyor.
  `create-next-app`'in varsayılan `favicon.ico`'su silindi.
- `src/app/manifest.ts` — Next'in metadata dosya kuralıyla
  `/manifest.webmanifest` üretiliyor: `standalone` görüntüleme, `tr` dili,
  `#020617` (slate-950) arka plan ve tema rengi.
- `src/app/layout.tsx` — `metadata` genişletildi (başlık, açıklama,
  `applicationName`, anahtar kelimeler, ikonlar, `appleWebApp`).
  Next 16'da `themeColor` artık `metadata` değil **`viewport`** export'una ait;
  oraya `colorScheme: "dark"` ve `width/initialScale` ile birlikte yazıldı.

### Doğrulama
Build çıktısında yeni route göründü:
```
└ ○ /manifest.webmanifest
```

Ve gerçekten sunulan yanıt kontrol edildi (derlendiğine güvenmek yerine):
```
<title>BayatlamaSavar</title>
<link rel="icon" href="/icon.svg"/>
<link rel="apple-touch-icon" href="/icon.svg"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<meta name="theme-color" content="#020617"/>
<meta name="color-scheme" content="dark"/>

GET /manifest.webmanifest → geçerli JSON, tüm alanlar yerinde
GET /icon.svg            → HTTP 200, image/svg+xml
```

---

## Adım 6 — Silmede geri alma

**Tarih:** 14 Ekim 2026
**Hedef:** Yanlış tıklamanın veri kaybına dönüşmemesi.

### Tasarım kararı: onay penceresi değil, geri alma
Gereksinim dokümanı "kullanıcı bir ürünü eklemek için 5 saniyeden fazla vakit
harcamamalı" diyor; aynı hız beklentisi silme için de geçerli. Her silmede
"Emin misiniz?" sorusu, doğru olan %99 durumu da yavaşlatır. Bunun yerine silme
anında çalışır, altta 6 saniye duran bir bildirim "Geri al" sunar: hızlı yol
hızlı kalır, hata da telafi edilebilir olur.

### Yapılanlar
Yeni dosya `src/lib/product-list.ts` (saf fonksiyonlar, 10 test):

| Fonksiyon | İşi |
| --- | --- |
| `removeById(list, id)` | Kaydı çıkarır; çıkarılan kaydı **ve eski sırasını** döner |
| `insertAt(list, product, index)` | Kaydı eski sırasına geri koyar; sıra listenin dışındaysa sınıra çeker |

Eski sıranın saklanması önemli: geri alınan ürün listenin başına değil,
**bulunduğu yere** döner.

`useProducts()` iki noktada güncellendi: `removeProduct` artık çıkarma sonucunu
döndürüyor, `restoreProduct` eklendi. `src/components/UndoToast.tsx` ise
`role="status"` / `aria-live="polite"` ile ekran okuyuculara da bildiriyor ve
6 saniye sonra kendini kapatıyor. Üst üste silmelerde bildirimin süresi
sıfırlansın diye bileşene `key={product.id}` verildi.

### TDD akışı
1. **RED** — `product-list.test.ts` (10 test) var olmayan modüle karşı koşuldu,
   modül bulunamadı hatasıyla patladı.
2. **GREEN** — `product-list.ts` yazıldı, 47/47 yeşil.
3. **REFACTOR** — `storage.ts` ve `page.tsx` bağlandı; testler yeşil kaldı.

### Yol boyunca yakalanan hata
İlk bağlamada `handleUndo`, `restoreProduct`'ı `setUndoable` **updater'ının
içinde** çağırıyordu:

```ts
setUndoable((current) => {
  if (current) restoreProduct(current.product, current.index);  // yan etki!
  return null;
});
```

React StrictMode (Next.js'te varsayılan olarak açık) updater fonksiyonlarını
geliştirmede **iki kez** çağırır — yani "Geri al"a bir kez basmak ürünü **iki
kez** geri eklerdi. Yan etki updater'dan çıkarıldı:

```ts
if (!undoable) return;
restoreProduct(undoable.product, undoable.index);
setUndoable(null);
```

Bu hata derleyici, lint veya testlerden hiçbirine yakalanmazdı; yalnızca
updater'ların saf olması gerektiği kuralını bilmekle görülüyor.

### Doğrulama
```
npm test         → Test Files 3 passed (3) | Tests 47 passed (47)
npx tsc --noEmit → temiz
npm run lint     → temiz
npm run build    → başarılı
```

---

## Adım 7 — `CLAUDE.md` (proje belleği)

**Tarih:** 14 Ekim 2026
**Hedef:** Projeye sonradan bakan (insan ya da Claude) birinin aynı tuzaklara
tekrar düşmemesi.

### Yapılanlar
`CLAUDE.md` yazıldı (172 satır). İçeriği bilinçli olarak dosya listesi değil,
**birden fazla dosyayı okumadan anlaşılamayacak** bilgiler:

- Katman şeması ve "saf `lib/` React'i tanımaz" kuralı
- `localStorage` sözleşmesi: anahtar, biçim, üç sürüm durumu ve
  "alan değişirse `SCHEMA_VERSION` artır" kuralı
- İş kuralları: kalan gün formülü, renk eşikleri tablosu, tarihlerin neden
  `Date.UTC`'ye sabitlendiği, neden `Date` değil `YYYY-MM-DD` metni taşındığı
- **Bu projede canlı olarak yaşanmış altı tuzak** (her biri bu notların ilgili
  adımında anlatılan gerçek olaylar)
- Doğrulanmış komutlar — tek dosya ve tek test çalıştırma dahil, ikisi de
  yazmadan önce koşulup çıktısı görüldü
- Bilinen test boşlukları ve henüz yapılmamışlar, gizlenmeden

### `AGENTS.md`'den taşınan kural
`create-next-app`, `next dev` tarafından yenilenen bir `AGENTS.md` bırakmış ve
şunu söylüyor: **bu Next.js sürümü eğitim verisindekinden farklı**, Next'e dair
kod yazmadan önce `node_modules/next/dist/docs/` okunmalı. Bu uyarı
`CLAUDE.md`'ye alındı — çünkü bu projede yaşanan tuzakların dördü (effect'te
`setState` yasağı, prerender'da `new Date()` yasağı, `error.tsx`'in kapsamı,
`themeColor`'ın `viewport`'a taşınması) doğrudan bu sürüm farkının sonucu.

---

## Özet durum — 14 Ekim 2026

| Konu | Durum |
| --- | --- |
| Gereksinim dokümanı MVP kapsamı (3.1, 3.2, 3.3, 4) | Tamam |
| Test altyapısı | Vitest, 47 test, `lib/` tamamen kapsanmış |
| Veri doğrulama + şema sürümleme | Tamam |
| Hata sınırı | Dosya yerinde; istemci yakalaması doğrulanmadı |
| Sürüm kontrolü | 3 anlamlı commit, ağaç temiz |
| Metadata / ikon / manifest | Tamam, sunulan yanıtta doğrulandı |
| Geri alınabilir silme | Tamam |
| Proje belleği (`CLAUDE.md`) | Tamam |

**Açık kalanlar:** bileşen/hook testleri için jsdom kararı · `README.md` hâlâ
varsayılan · düzenleme akışı · filtre/arama · Post-MVP (veritabanı, giriş,
bildirimler).

---

## Adım 8 — Bileşen ve hook testleri (jsdom)

**Tarih:** 14 Ekim 2026
**Hedef:** Adım 1-6 boyunca "doğrulanmadı" diye kayda geçen üç boşluğu kapatmak.

### Kapatılan boşluklar
Adım 3'te `error.tsx` için "istemci tarafı yakalamayı doğrulayamadım", Adım 6
sonunda da "`storage.ts` ve bileşenlerin testi yok" yazmıştım. Üçü de kapandı.

### Kurulum
`jsdom`, `@testing-library/react` 16, `@testing-library/jest-dom` 7 ve
`@testing-library/user-event` 14 eklendi.

`vitest.config.mts`:
- ortam `node` → **`jsdom`** (saf `lib/` testleri jsdom altında da sorunsuz
  koşuyor; `storage.ts` testi zaten `localStorage` gerektiriyordu, tek ortam
  tutmak docblock'larla uğraşmaktan basit)
- desen `src/**/*.test.ts` → `src/**/*.test.{ts,tsx}`
- `setupFiles: ["src/test/setup.ts"]`

`src/test/setup.ts`: jest-dom eşleştiricileri + her testten sonra `cleanup()` ve
`localStorage.clear()` — testler birbirine sızmasın.

### Yeni testler: 38 → toplam 85

| Dosya | Test | Öne çıkan |
| --- | --- | --- |
| `components/ProductCard.test.tsx` | 7 | Dört durumun **sınır günleri** ayrı ayrı: 3 gün → Güvenli, 2 gün → Dikkat, 0 gün → "Son gün"/Süresi Doldu, -2 gün → "2 gün geçti" |
| `components/AddProductForm.test.tsx` | 8 | Varsayılan tarih/raf ömrü, ad kırpma, boş ad reddi, gönderim sonrası temizlenme, kullanıcının değiştirdiği tarihin korunması |
| `components/UndoToast.test.tsx` | 5 | `role="status"` + `aria-live`, 5999 ms'de kapanmaması / 6000 ms'de kapanması (sahte zamanlayıcı) |
| `app/error.test.tsx` | 6 | Mesaj, `reset` çağrısı, `digest` varken/yokken, console'a bildirim |
| `lib/storage.test.ts` | 12 | Okuma, **sürümsüz biçimden göç**, bozuk JSON'da çökmeme, ekleme/silme/geri alma, depoya sürümlü yazma, **referans kararlılığı** |

İki test özellikle mimariyi koruyor:

- **Referans kararlılığı:** `rerender()` sonrası `products` dizisinin **aynı
  referans** olduğunu doğrular. Bu testin kırılması, `useSyncExternalStore`
  önbelleğinin bozulduğu ve sonsuz render riskinin doğduğu anlamına gelir.
- **Göç:** Sürümsüz (düz dizi) veriyi okuyabildiğini doğrular. Kullanıcının
  eski verisinin kaybolmasını engelleyen tek güvence bu.

### Harness yine sınandı
Yeni ortam yeni altyapıdır; geçen testler jsdom'un gerçekten hata yakaladığını
kanıtlamaz. `ProductCard.test.tsx`'e kasıtlı bir kırık kondu ve koşuldu:

```
FAIL  src/components/ProductCard.test.tsx > HARNESS KONTROLU
Unable to find an element with the text: Süresi Doldu
Tests  1 failed | 7 passed (8)
```

jsdom hatayı tam DOM dökümüyle raporladı; kırık kaldırıldı.

### Çıktı temizliği
`error.tsx` hatayı bilinçli olarak `console.error`'a yazıyor. Testlerde bu
çağrı taklit edildi (`vi.spyOn`), hem çıktı kirlenmesin hem de "hatayı
gerçekten bildiriyor mu" ayrı bir testle doğrulanabilsin.

### Doğrulama
```
npm test         → Test Files 8 passed (8) | Tests 85 passed (85)   [uyarısız]
npx tsc --noEmit → temiz
npm run lint     → temiz
npm run build    → başarılı
```

### Dürüst sınır
`app/page.tsx` için **uçtan uca bütünleşme testi hâlâ yok** — bileşenler ve
hook ayrı ayrı test edildi, ama "sil → bildirim çıkar → geri al" akışının
tamamı tek testte denenmedi. Ayrıca `error.tsx`'in Next tarafından hata sınırı
olarak **bağlanması** framework davranışıdır ve test edilmez; test edilen,
bağlandığında ekranın doğru çalıştığıdır.

---

## Adım 9 — Dokümantasyon tazelemesi

**Tarih:** 14 Ekim 2026

### `CLAUDE.md` düzeltildi (önemli)
Adım 8, `CLAUDE.md`'yi **yanlış** hale getirdi: dosya "Vitest node ortamında
koşar, jsdom yok" diyor ve üç test boşluğunu açık listeliyordu. Yanlış
dokümantasyon, dokümantasyon olmamasından kötüdür. Güncellenen bölümler:

- Test bölümü: jsdom ortamı, kurulum dosyası, 8 dosya/85 testin dağılım tablosu
- "Bilinen test boşlukları" → "Kalan test boşlukları": yalnızca gerçekten
  kalan iki madde
- Mimari kuralı: "testlerde jsdom gerekmez" ifadesi artık doğru değildi;
  saf `lib/` dosyaları ile köprü katmanı (`storage.ts`, `useToday.ts`) ayrımı
  netleştirildi
- "Henüz yapılmamışlar" listesinden `README.md` maddesi çıkarıldı

### `README.md` yazıldı
`create-next-app`'in varsayılan içeriği silindi. Yeni README **kullanıcıya**
bakıyor (CLAUDE.md geliştiriciye bakıyor): uygulamanın ne yaptığı, kalan gün
formülü, renk tablosu, geri alma davranışı, kurulum, komut tablosu, dosya
haritası ve sıradaki işler. Mimari kararlar için `CLAUDE.md`'ye, geliştirme
kaydı için bu dosyaya yönlendiriyor.

---

## Adım 10 — Ürün düzenleme

**Tarih:** 14 Ekim 2026
**Hedef:** Yanlış girilen bir kaydı silip yeniden eklemek zorunda kalmamak.

### Tasarım kararı: ayrı pencere değil, formun yeniden kullanımı
Üç seçenek vardı: kart üzerinde satır içi düzenleme, modal pencere, ya da
üstteki formun düzenleme kipine geçmesi. Üçüncüsü seçildi çünkü doğrulama,
alan düzeni ve varsayılanlar tek yerde kalıyor — satır içi düzenleme aynı
mantığı ikinci kez yazmak demekti.

`AddProductForm` → **`ProductForm`** olarak yeniden adlandırıldı; `initial`
prop'u doluysa düzenleme kipinde çalışır: başlıkta "«X» düzenleniyor" yazar,
kenarlığı yeşile döner, buton "Ekle" yerine "Kaydet" olur ve yanına "Vazgeç"
gelir.

### Prop'tan state doldurmanın tuzağı ve çözümü
Düzenlemeye basıldığında form alanlarının seçilen üründen dolması gerekiyor.
Klasik çözüm `useEffect` ile prop'u state'e kopyalamaktır — ama bu projede
`react-hooks/set-state-in-effect` kuralı bunu **yasaklıyor** (Adım 0'daki
1 numaralı tuzak).

Çözüm: alanlar `useState` başlangıç değerleriyle `initial`'dan doluyor ve üst
bileşen forma `key={editing?.id ?? "yeni"}` veriyor. Kayıt değişince React
formu **yeniden kuruyor**, alanlar kendiliğinden tazeleniyor. Ne effect, ne
senkronizasyon kodu.

Düzenlenen kayıt `editingId`'den değil, listeden türetiliyor
(`products.find(...)`). Bunun bedava faydası: düzenlenirken ürün başka bir
sekmede silinirse düzenleme kipi kendiliğinden kapanıyor.

### TDD akışı
1. **RED** — `replaceById` için 4 test; `TypeError: replaceById is not a function`.
2. **GREEN** — `product-list.ts`'e `replaceById` eklendi (sıra korunarak).
3. `useProducts`'a `updateProduct` eklendi + 3 storage testi.
4. Bileşen testleri: `ProductForm` için 16 test (9 ekleme + 7 düzenleme kipi),
   `ProductCard` için düzenle düğmesi testi.

### Tip denetiminin işe yaradığı an
`ProductCard`'a `onEdit` prop'u eklenince `npx tsc --noEmit` yedi yerde hata
verdi — hepsi test dosyasındaki eksik prop'lar. Derleyici, testlerin
güncellenmesi gerektiğini sessizce geçmek yerine tek tek gösterdi.

### Doğrulama
```
npm test         → 10 dosya / 118 test (bu adım sonunda), hepsi yeşil
npx tsc --noEmit → temiz
npm run lint     → temiz
npm run build    → başarılı
```

---

## Adım 11 — Arama ve durum filtresi

**Tarih:** 14 Ekim 2026
**Hedef:** Liste kalabalıklaştığında aradığını bulabilmek.

### Yapılanlar
Yeni dosya `src/lib/product-filter.ts` (saf, 14 test):

| Dışa açılan | İşi |
| --- | --- |
| `filterProducts(list, {query, status}, today)` | Arama + durum filtresini birlikte uygular |
| `countByStatus(list, today)` | Düğmelerde gösterilen sayılar |
| `STATUS_FILTERS`, `STATUS_FILTER_LABELS` | Düğme sırası ve Türkçe etiketler |

Arama ürün adında **ve kategoride** geçer — "sos" yazınca tüm
Sos/Konserve ürünleri gelir. Durum filtresi eşikleri kopyalamıyor, aynı
`statusOf()` fonksiyonunu çağırıyor; eşik tek yerde kalıyor.

`src/components/FilterBar.tsx`: arama kutusu (dolu olduğunda temizleme
düğmesi çıkar) ve dört durum düğmesi, her birinde o duruma düşen ürün sayısı.
Etkin düğme hem renkle hem `aria-pressed` ile işaretli.

Sayfada iki ayrı boş durum var artık: hiç ürün yoksa "ilk ürününü ekle",
filtreye uyan yoksa "bu filtreye uyan ürün yok" + "Filtreyi temizle".
Başlık da filtre varken `3 / 12 ürün` biçimine geçiyor.

### Türkçe harf katlama
Arama `toLocaleLowerCase("tr")` kullanıyor. Varsayılan `toLowerCase()` ile
`"ILIK"` → `"ilik"` olur ve `"Ilık"` ile **eşleşmez**; I/ı ve İ/i çiftleri
yalnızca `tr` yereliyle doğru çalışır. İki test bunu kilitliyor: `"ILIK"` ve
`"ılık"` sorgularının ikisi de "Ilık Jambon"u buluyor.

### Testin yakaladığı erişilebilirlik kusuru
Düğmedeki sayı ayrı bir `<span>` olduğu için ekran okuyucunun hesapladığı
erişilebilir ad **"Tümü5"** çıkıyordu — aradaki boşluk yalnızca CSS kenar
boşluğuydu, metinde yoktu. Test bunu yakaladı:

```
Unable to find an accessible element with the role "button" and name /Tümü 5/
Here are the accessible roles:  Name "Tümü5"
```

Burada iki yol vardı: testi `/Tümü\s*5/` yapıp geçirmek, ya da kusuru
düzeltmek. İkincisi seçildi — her düğmeye `aria-label="Tümü, 5 ürün"`
verildi, görsel metin `aria-hidden` yapıldı. Test gevşetilmedi, kod düzeltildi.

### Doğrulama
```
npm test         → Test Files 10 passed (10) | Tests 121 passed (121)
npx tsc --noEmit → temiz
npm run lint     → temiz
npm run build    → başarılı
GET /            → HTTP 200
```

Dosya başına dağılım (`grep -c "^  test("` ile sayıldı, toplam 121 ile birebir):
`product-schema` 22 · `date` 15 · `storage` 15 · `product-list` 14 ·
`product-filter` 14 · `ProductForm` 16 · `ProductCard` 8 · `FilterBar` 6 ·
`error` 6 · `UndoToast` 5

### Dokümantasyon güncellendi
Hem `CLAUDE.md` hem `README.md` bu adımlardan sonra **yanlış** hale gelmişti:
README "düzenleme ve filtre/arama henüz yok" diyordu, CLAUDE.md'nin test
tablosu ve yapılmamışlar listesi eskimişti. İkisi de güncellendi; CLAUDE.md'ye
iki yeni tuzak eklendi (7: `key` ile form tazeleme, 8: Türkçe harf katlama).
