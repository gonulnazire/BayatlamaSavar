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

---

## Adım 12 — Mimari karar ve Supabase göç tasarımı (kod yazılmadı)

**Tarih:** 14 Ekim 2026
**Hedef:** Backend/veritabanı yönünü karara bağlamak ve göçü kod yazmadan önce
tasarlamak.

### Mimari özet çıkarıldı
`MIMARI_KARARI.md` yazıldı: mevcut mimarinin tam resmi (katmanlar, satır
sayıları), backend ve veritabanının **hiç olmadığının** açık tespiti, mevcut
mimarinin gerçek sınırları ve dört seçeneğin iş/kazanç/bedel karşılaştırması.

En belirleyici bulgu: **`localStorage`'a dokunan tek dosya `storage.ts`.**
Soyutlama zaten yerinde olduğu için backend'e geçiş "her yeri elden geçirmek"
değil, bir dosyanın içini değiştirmek. Saf katmandaki 65 test de olduğu gibi
geçerli kalıyor, çünkü verinin nereden geldiğini bilmiyorlar.

Ayrıca netleşti ki backend'e geçmenin sebebi **ölçek değil**: `localStorage`
~5 MB, binlerce ürün sığar. Sebep çok cihaz, yedek, paylaşım ve bildirim.

### Karar: Supabase
Gereksinim dokümanındaki Post-MVP maddelerinin üçü (veritabanı, çoklu ev
arkadaşı, bildirim) tek bir altyapıyı istiyor.

### Tasarım görüşmesi (architectural akış)
Bu iş architectural sınıfında olduğu için kod yazmadan önce sorular →
yaklaşımlar → bölüm bölüm tasarım → yazılı spec sırası izlendi. Netleşenler:

| Konu | Karar |
| --- | --- |
| Kullanım | Tek kullanıcı, çok cihaz; paylaşım ileride |
| Şema | "Tek kişilik ev" — `households` baştan var, paylaşım göç gerektirmeden eklenir |
| Çevrimdışı | Yerel önbellek + çevrimiçi yazma (mevcut çevrimdışı deneyim geriletilmiyor) |
| Giriş | E-posta + şifre, doğrulama kapalı |
| Veri katmanı | Tarayıcı doğrudan Supabase ile konuşur; `useSyncExternalStore` deseni korunur |
| Mevcut veri | Otomatik değil, tek seferlik aktarım düğmesi |
| Silme | Soft delete (`consumed_at`) |
| Yazma | Beklemeli, iyimser değil (rollback mantığı yazmamak için) |

Kapsam dışı tutulanlar açıkça yazıldı: paylaşım arayüzü, realtime, bildirimler,
tüketildi/çöpe atıldı ayrımı, middleware, otomatik yeniden deneme.

### Tasarımın iki kazancı
- **Enjeksiyon:** `product-store.ts` API'yi parametre alacak. Senkron mantığı
  ağa dokunmadan test edilebilir hale geliyor.
- **Eski boşluk kapanıyor:** Adım 8'de "`page.tsx` bütünleşme testi yok" diye
  kayda geçen madde, enjeksiyon sayesinde ucuzladı ve göçün kapsamına alındı.

Soft delete ayrıca kod *azaltıyor*: "Geri al" artık sıra numarasıyla diziye
geri sokmak değil, tek alan güncellemesi — `insertAt` tamamen siliniyor.

### Spec öz-incelemesinde bulunan iki kusur
Skill'in istediği öz-inceleme boş bir tören olmadı, iki gerçek kusur çıktı:

1. **`security definer` fonksiyonda `search_path` sabitlenmemişti.** Bu haliyle
   çağıran kendi şemasına aynı adlı bir tablo koyup fonksiyonu kandırabilir.
   `set search_path = ''` eklendi ve tablo adları tam nitelikli yazıldı.
2. **`household_id`'nin nereden geldiği hiç tanımlanmamıştı.** Her `insert`
   bunu istiyor ama istemci bilmiyordu. Oturum hazır olunca bir kez
   `fetchHouseholdId()` çağrılması, sonucun store'da tutulması ve boş gelirse
   sessizce `null` göndermek yerine açık hata verilmesi eklendi.

### Durum
Spec: `docs/superpowers/specs/2026-10-14-supabase-gocu-design.md` (403 satır).
**Kod yazılmadı.** Sıra: kullanıcının spec'i incelemesi → uygulama planı → kod.

---

## Adım 13 — Supabase göçü uygulandı (Task 1-11)

**Tarih:** 14 Ekim 2026
**Dal:** `supabase-gocu` (master'da uygulamaya başlanmadı)

### Ne yapıldı
Spec ve plan bir önceki adımda yazılmıştı; bu adımda plan 12 task halinde
yürütüldü. 11 task tamamlandı, Task 12 (elle RLS doğrulaması) kullanıcı
eylemi bekliyor.

| Task | Sonuç |
| --- | --- |
| 1 | SQL şema + RLS + kayıt tetikleyicisi; `.env.local.example`. **Panelde uygulanması kullanıcıda** |
| 2 | Tembel Supabase istemcisi + `product-api` çevrimi (7 test) |
| 3 | `product-cache` — önbellek/eski veri anahtar ayrımı (9 test) |
| 4 | `product-store` — senkron çekirdeği, sahte API ile (28 test) |
| 5 | `useProducts` store üzerine taşındı, `insertAt` kaldırıldı |
| 6 | `useSession` + `AuthScreen` + oturum kapısı (11 test) |
| 7 | `Toast` genelleştirmesi + `ConnectionBanner` (11 test) |
| 8 | Yükleme/hata/bekleyen yazma durumları (3 yeni test) |
| 9 | Tek seferlik aktarım, 200'lük parçalar (8 test) |
| 10 | Uçtan uca bütünleşme testleri (8 test) |
| 11 | Dokümantasyon tazelemesi |

**Test: 121 → 176.** Dörtlü doğrulama (test/tsc/lint/build) her task sonunda
yeşil geçti.

### Yol boyunca yakalanan dört gerçek hata

1. **`.gitignore`'daki `.env*` örnek dosyayı da yoksayıyordu** — planın commit
   adımı dosyayı sessizce atlardı. Negatif desen eklendi; `.env.local`'in
   kendisinin yoksayılmaya devam ettiği `git status` ile doğrulandı
   (`git check-ignore`'un çıkış kodu negatif desenlerde yanıltıcı).

2. **`retry()` içinde `this.init(...)`** — `useProducts` eylemleri destructure
   edeceği için bağlam kaybolup çağrı çökerdi. Testler nesne üzerinden
   çağırdığı için yakalamazdı; `this` kaldırıldı ve regresyon testi eklendi.

3. **`providers.tsx` ↔ `useSession.ts` döngüsel içe aktarımı** — varsayılan
   store nesnesi modül gövdesinde kurulduğu için yükleme sırası ters olsa
   `sessionStore` tanımsız yakalanırdı. Tembel hale getirildi.

4. **`page.tsx` yazmayı `await` etmiyordu** (en önemlisi) — `ProductForm`
   `await onSubmit(...)` ettiği için reddedilen promise yüzen hata olarak
   kalıyor, form yazmayı **başarılı sanıp alanları temizliyordu.** Yani
   "kullanıcı yazdığını kaybetmesin" koruması sayfa seviyesinde etkisizdi.
   Formun izole birim testi bunu yakalayamazdı; **bütünleşme testi yakaladı.**
   Bu, Task 10'un kendi maliyetini tek başına ödediği an.

### Süreç notu
Task 8'de brief'in adım sırası bozuldu (kod testten önce yazıldı). Düzeltme
uydurulmadı: testler yazılıp yeni davranışlar geçici olarak söküldü, üçünün de
kırmızı olduğu görüldü, sonra implementasyon geri konuldu. Bütün kararlar
(7 ruling) `.superpowers/sdd/.../progress.md` ledger'ında kayıtlı.

### Açık kalanlar
- **Task 12: elle RLS doğrulaması** — iki hesapla 6 maddelik liste. RLS bu
  uygulamada tek güvenlik sınırı olduğu için bu adım atlanamaz.
- Kullanıcı eylemleri: Supabase projesi, SQL'in uygulanması, "Confirm email"
  kapatılması, `.env.local`.
- Dal `supabase-gocu` henüz `master`'a birleştirilmedi.

> **Sonradan not:** Bu üç maddenin hepsi Adım 15'te kapandı — doğrulama
> betiklere çevrildi ve canlı projede koşturuldu, kullanıcı eylemleri
> tamamlandı, dal `master`'a birleştirildi.

---

## Adım 14 — Kurulum betikleri ve dal incelemesi

**Tarih:** 14 Ekim 2026
**Dal:** `supabase-gocu`

### Elle doğrulama betiğe çevrildi
Adım 13'ün açık bıraktığı "Task 12: elle RLS doğrulaması" altı maddelik bir
kontrol listesiydi. Liste insanın atlayabileceği bir şey olduğu için iki
komuta dönüştürüldü:

- `npm run doctor` — env, bağlantı, şema, RLS'in açık olması, "Confirm email"
  ayarı, kayıt tetikleyicisi, gerçek yazma yolu
- `npm run rls-check` — iki test hesabı açıp veri yalıtımını sınar

Betiğin ölçütü özellikle dikkatli seçildi: **RLS'in engellediği `UPDATE` ya da
`DELETE` Postgres'te hata vermez, yalnızca 0 satır etkiler.** "Hata geldi mi"
diye bakan bir kontrol burada yanlış bir güvence verirdi; bu yüzden betik hem
etkilenen satır sayısına hem de verinin gerçekten değişmemiş olduğuna bakıyor.

Adım adım panel rehberi `KURULUM.md`'ye yazıldı.

### Taze bağlamlı inceleme
Dal, hiçbir şeyini bilmeyen bir gözden geçiriciye verildi: **2 Critical,
7 Important, 10 Minor.** I1 etkisine bakılarak Critical'a, M1 Important'a
yükseltildi. Bulgular `INCELEME_BULGULARI.md`'ye yazıldı; düzeltme turunda
**9'u kapatıldı, her biri önce kırmızı test ile kanıtlandı.** Test 176 → 198.

En önemli iki bulgu aynı kökten geliyordu — **`ProductApi` sınırı hiç test
edilmemişti:**

1. **C1 — hata sınıflandırmasının tamamı ölü koddu.** postgrest-js'in
   fırlattığı şey bir `Error` değil, gövdeden ayrıştırılmış düz bir nesne ve
   `status` taşımıyor. Dolayısıyla `status === 401` hiç tutmuyor,
   `error instanceof Error` false olduğu için `String(error)` →
   `"[object Object]"` oluyordu. Her hata `unknown`'a düşüyor, kullanıcı ne
   olursa olsun "Beklenmeyen bir hata oluştu." görüyordu.
   **176 test bunu neden kaçırdı:** testler `Object.assign(new Error(...),
   {status: 401})` fırlatıyordu — gerçek API bu şekli hiç üretmiyor.
2. **I1 — `UPDATE` yazmaları doğrulanmıyordu.** `.select()` olmadan PostgREST
   satır bulamayınca da RLS filtreleyince de **204 ve hatasız** dönüyor.
   "Kaydedildi" denip hiçbir şey yazılmamış olması, beklemeli yazmanın bütün
   gerekçesini çürütüyordu.

**Ders:** Sahte nesneler gerçeğin şeklini taklit etmiyorsa test sayısı bir şey
ifade etmiyor. Sınır katmanı (`product-api`) artık gerçek PostgREST gövdeleriyle
test ediliyor (`product-api-errors.test.ts`).

### Ertelenen
- **I7** — aynı ürünü iki sekmede düzenlerken eski yazma yenisini eziyor.
  Doğru çözüm `Product` modeline eşzamanlılık belirteci (`updated_at`/`version`)
  eklemek: tip + `SCHEMA_VERSION` + önbellek göçü + çatışma arayüzü demek.
  Tek kullanıcılı bir uygulamada tetikleyici "kendi iki sekmen"; bedel
  orantısız bulundu. Veri silinmiyor, bir alan kayboluyor.
- **M2–M10** — ayrıntıları `INCELEME_BULGULARI.md`'de.

---

## Adım 15 — Canlı Supabase kurulumu, uçtan uca doğrulama ve örnek veri

**Tarih:** 15 Ekim 2026
**Sonuç:** Dal `master`'a birleştirildi (`a1fe2c0`). Göç bitti.

### Yapılanlar
Supabase projesi açıldı, şema panelde uygulandı, "Confirm email" kapatıldı,
`.env.local` dolduruldu; iki doğrulama betiği **gerçek projeye karşı ilk kez**
koşturuldu ve uygulama tarayıcıda uçtan uca denendi.

| Doğrulama | Sonuç |
| --- | --- |
| `npm test` | 198/198 |
| `npx tsc --noEmit` · `npm run lint` · `npm run build` | temiz |
| `npm run doctor` | 6/6 |
| `npm run rls-check` | 11/11 |
| Tarayıcıda ekle / düzenle / tüket / geri al / yenile | çalışıyor |

### Üç gerçek tuzak

1. **Sohbetten kopyalanan SQL'e açıklama metni karıştı.** Panel
   `syntax error at or near "Başlangıç"` dedi — 119. satır artık SQL değil,
   kod bloğunun altındaki paragraftı. Sözdizimi hatası ayrıştırma aşamasında
   yakalandığı için **hiçbir şey uygulanmamıştı**, yarım kalan bir durum
   oluşmadı. Ders: uzun SQL'i yapıştırtırken blok mesajın **en sonunda**
   olmalı, altına tek satır bile yazılmamalı.

2. **Türkçe karakterler kopyalamada risk.** `products.category` kısıtı
   uygulamadaki `CATEGORIES` sabitiyle **harfi harfine** eşleşmek zorunda;
   kopyalamada `ü/ş/ğ` bozulursa tablo yine kurulur ama sonra hiçbir ürün
   eklenemez. Çözüm: dört Türkçe metin Postgres'in Unicode kaçış sözdizimine
   çevrildi (`Diğer` → `U&'Di\011Fer'`), böylece dosyada **tek bir ASCII dışı
   karakter kalmadı**. Kaçışlar geri çözülerek birebir doğrulandı. Bu çevrimin güzel
   yanı sessiz başarısızlığın imkânsız olması: yanlış çözülse `check` kısıtı
   ilk eklemeyi reddeder — nitekim `doctor` tam da bunu sınıyor.

3. **Panelin verdiği adres `/rest/v1/` ile bitiyor.** `supabase-js` bu eki
   kendisi ekliyor; olduğu gibi yazılsaydı her istek
   `/rest/v1/rest/v1/...` adresine gidip 404 dönerdi.
   `NEXT_PUBLIC_SUPABASE_URL` çıplak proje adresi olmalı.

### Yanlış teşhis edilen iki şey (ikisi de uygulamada kusur değildi)

- **"Hesap kurulumu tamamlanamadı" ekranı.** İlk bakışta kayıt tetikleyicisinin
  çalışmadığı sanıldı. Gerçek sebep: dev sunucusu durdurulurken npm
  sarmalayıcısı öldü ama `next dev` süreci ayakta kaldı (Windows'ta çocuk süreç
  miras almıyor); tarayıcıdaki sayfa bayat kalmıştı. Yenilemeden sonra istekler
  200 döndü ve ev kimliği bulundu. Ders: sunucuyu durdurduktan sonra **portu
  kontrol et**, süreç adını değil.
- **"Ekle" düğmesinin çalışmaması.** Tarayıcı otomasyonunun referans üzerinden
  gönderdiği tıklama forma hiç ulaşmıyordu — ağ kaydında tek bir `POST` yoktu.
  Form doğrulaması geçiyordu, DOM ile React durumu birebir aynıydı; gerçek bir
  `click()` ilk denemede ekledi. Otomasyon kusuru, uygulama kusuru değil.
  Aynı şekilde "geri alma bildirimi çıkmıyor" sanılan durum da ekran görüntüsü
  gecikmesiydi: bildirim ölçüldüğünde `position: fixed`, `opacity: 1`,
  alt-ortada 384×58 piksel olarak **oradaydı**.

### Örnek veri
Uygulamayı dolu görebilmek için sekiz ürün eklendi; üç durum rengini ve dört
kategoriyi birden kapsıyor (2 kırmızı, 2 sarı, 4 yeşil). Liste aciliyete göre
doğru sıralandı ve filtre sayaçları tuttu (Tümü 8 · Güvenli 4 · Dikkat 2 ·
Süresi Doldu 2). Bunlar gerçek kayıtlar: istenmeyenler "Tükettim / Sil" ile
kaldırılabilir.

### Açık kalanlar
- **Çıkış → aynı hesapla tekrar giriş** canlıda denenmedi; şifre gerektirdiği
  için kullanıcıya bırakıldı. Bu yol incelemedeki C2'nin kilitlediği yoldu,
  düzeltmesi `app/page.test.tsx` ile kapalı.
- I7 ve M2–M10 hâlâ açık (bkz. Adım 14).
- `doctor` ve `rls-check` panelde üç test kullanıcısı bıraktı
  (`bayatlamasavar-...@test.local`); Authentication → Users altından
  silinebilir.

---

## Adım 16 — Veri modeli göçü: raf ömründen son kullanma tarihine (v1 → v2)

**Tarih:** 15 Ekim 2026
**Kapsam kararı:** Yeni özellik eklenmedi. Yalnızca model göçtü ve uygulama
çalışır halde bırakıldı. Form alanları, yeni filtreler ve geçmiş ekranı
bir sonraki adımda.

### Neden göç gerekti
Yeni gereksinim listesi ürünü "son kullanma tarihi" üzerinden tanımlıyor;
mevcut model ise `açılış tarihi + raf ömrü` tutup son kullanma tarihini
**hesaplıyordu**. İkisi aynı sonuca varır ama farklı alanı kaynak kabul eder.
Barkod, kiler ürünleri ve ambalajı hiç açılmamış ürünler ancak SKT merkezli
modelde temsil edilebiliyor.

### Yeni model

| Alan | Not |
| --- | --- |
| `expiresOn` | **Ana alan.** Renk, sıralama ve filtreler bunu kullanır |
| `quantity` + `unit` | Pozitif; ondalık olabilir (0.5 kg) |
| `storagePlace` | Buzdolabı / Dondurucu / Kiler |
| `isOpened` + `openedAt` | Açılmamış üründe `openedAt` her zaman `null` |
| `state` | `active` / `consumed` / `discarded` — kayıt **silinmez** |
| `createdAt` | v1'den gelen kayıtlarda bilinmediği için `null` |

Kategori kümesi 4'ten 7'ye çıktı. Eşleme: `Et/Şarküteri → Et`,
`Sos/Konserve → Diğer`, diğerleri aynı kaldı.

**Renk eşiği değişti:** 3 gün artık `safe` değil `warning`. Tek satırlık bir
değişiklik ama davranış değişikliği; `statusOf` testi bunu kırmızı gösterdi.

### Doğrulamanın hoşgörüsü nerede biter
`parseProduct` artık iki sınıf alan tanıyor:

- **Görünüm alanları** (birim, saklama yeri, miktar, durum): bilinmeyen değer
  makul bir varsayılana düşer. Yanlış birim kullanıcıyı yanıltmaz.
- **Son kullanma tarihi**: bozuksa kayıt **tamamen reddedilir**. Hatalı tarih
  bozulmuş ürünü taze gösterebilir; bu yüzden hoşgörü burada biter.

Bu ayrım yeni değil, v1'deki "bozuk veri sessizce yeşil görünmesin" kuralının
genişletilmiş hali.

### TDD akışı
Her döngüde önce kırmızı görüldü:

| Döngü | Kırmızı kanıtı |
| --- | --- |
| `date.ts` | 14 test düştü; aralarında **"tam 3 gün dikkat eşiğine girer"** — eşik değişikliğinin gerçekten davranış değiştirdiğinin kanıtı |
| `product-schema.ts` | 26 test düştü (yeni alanlar + v1→v2 göçü) |
| `product-api.ts` | 10 test düştü (kolon eşlemesi) |
| `ProductCard` | 13 test düştü |
| `ProductForm` | 9 test düştü |

**Test 198 → 221.** Dörtlü doğrulama yeşil.

### İki testin niyeti korunup yöntemi değişti
- `ProductCard` "kategoriyi gösterir": kategori artık miktarla aynı düğümde
  (`Süt Ürünü · 1 L`), tam metin eşleşmesi yerine desen kullanıldı.
- `product-cache` "bozuk kaydı atar": test `shelfLifeDays`'i bozuyordu, o alan
  artık yok — kayıt geçerli kalıyordu. Bozulan alan `expiresOn` yapıldı, yani
  test tekrar **gerçek** bir reddi sınıyor.

### Formun göstermediğini ezmemesi
`ProductForm` bu adımda yalnızca ad, kategori ve SKT gösteriyor; miktar,
saklama yeri ve açılma bilgisi varsayılanla doluyor. Düzenleme kipinde bu
alanların **olduğu gibi korunması** ayrı bir testle kilitlendi
(`formda olmayan alanları olduğu gibi korur`) — yoksa bir ürünü düzenlemek
görünmeyen alanları sessizce sıfırlardı.

### Varsayılan tarih kaldırıldı
v1'de tarih alanı "bugün" ile doluyordu (açılış tarihi için doğru). SKT için
"bugün" yanlış varsayılan olurdu — her ürün bugün bitiyormuş gibi görünürdü.
Alan şimdilik **boş ve zorunlu**; kategoriye göre öneri Aşama 2'nin işi.
`today` prop'u bu yüzden formdan çıkarıldı.

### Veritabanı
`supabase/migrations/0002_son_kullanma_tarihi.sql`. Mevcut veri kaybolmuyor:
`expires_on = opened_at + shelf_life_days` ile üretiliyor, eski kayıtlar
`is_opened = true` sayılıyor, `consumed_at` dolu olanlar `state = 'consumed'`
oluyor. 0001'de olduğu gibi Türkçe metinler Unicode kaçışıyla yazıldı
(dosyada tek bir ASCII dışı karakter yok).

### Göçte yakalanan hata: bağımlı nesne sırası

İlk denemede panel `42704: index "products_active_idx" does not exist` dedi.
Sebep bir sıra hatasıydı: indeks `0001`'de `where consumed_at is null`
koşuluyla kurulmuştu, yani o kolona **bağlıydı**. Postgres bir kolonu
düşürürken ona bağlı indeksleri de kendiliğinden düşürür; sonraki
`drop index` artık var olmayan bir nesneyi arıyordu.

Düzeltme iki parçalı:

1. İndeks düşürme, kolon düşürmeden **önce**ye alındı.
2. Betiğin tamamı **tekrar çalıştırılabilir** hale getirildi
   (`if exists` / `if not exists` + veri taşıma adımları yalnızca eski
   kolonlar hâlâ duruyorsa koşuyor). Böylece "ilk deneme geri alındı mı"
   sorusunu yanıtlamak gerekmedi; betik iki durumda da doğru sonuca varıyor.

**Ders:** şema göçünde kolon silmeden önce o kolona bağlı indeks, kısıt ve
görünümleri listele. Postgres bunları sessizce temizler ve betiğin geri
kalanı yanlış varsayımla ilerler.

### Canlı doğrulama (15 Ekim 2026)

Göç panelde uygulandı ve sonuç tarayıcıda kontrol edildi:

- 8 ürünün hepsi korundu; son kullanma tarihleri `açılış + raf ömrü` ile
  doğru üretildi (Hindi Füme 5 Eki + 5 gün → 10 Eki).
- Kategori eşlemesi tuttu: `Et/Şarküteri → Et`, `Sos/Konserve → Diğer`.
- Açılma tarihleri korundu, kayıtlar "açılmış" işaretlendi.
- **Eşik değişikliği canlıda doğrulandı:** 3 gün sonrasına eklenen ürün
  "Dikkat" (sarı) çıktı — eski kuralda yeşil olurdu.
- Açılmamış yeni üründe kartta açılma tarihi yazmıyor, yalnızca saklama yeri.

### Açık kalanlar
- Aşama 1'in kalanı: form alanları (miktar+birim, saklama yeri, açıldı mı),
  geçmiş tarih uyarısı, kategori/saklama yeri/durum filtreleri,
  "Çöpe gitti" düğmesi, geçmiş ekranı.
