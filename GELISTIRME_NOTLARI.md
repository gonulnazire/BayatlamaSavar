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
