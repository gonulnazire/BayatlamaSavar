# BayatlamaSavar

Evdeki gıdaları **son kullanma tarihine** göre takip eder; hangisinin ne
zaman tükenmesi gerektiğini renklerle gösterip gıda israfını önler.
Ambalajı açılmış ürünler için açılma tarihi de tutulur.

Veri **hesabına bağlı** olarak Supabase'de durur: telefonda eklediğini
bilgisayarda görürsün, tarayıcı verisi temizlense bile ürünlerin kaybolmaz.
Bağlantı yokken liste yine görünür (son bilinen hali), ama ekleme ve silme
için bağlantı gerekir.

## Nasıl çalışır

Her ürün için tek bir hesap yapılır:

```
Kalan Gün = Son Kullanma Tarihi − Bugün
```

Kart rengi bu sonuca göre belirlenir:

| Kalan gün | Durum | Renk |
| --- | --- | --- |
| 3 günden fazla | Güvenli | 🟢 yeşil |
| 1–3 gün | Dikkat | 🟡 sarı |
| 0 veya geçmiş | Süresi Doldu | 🔴 kırmızı |

Liste her zaman **en acil ürün en üstte** olacak şekilde sıralanır. Sayfa açık
kalırsa gece yarısı geçildiğinde kalan günler kendiliğinden güncellenir.

Bir ürünü tükettiğinde "Tükettim / Sil"e basarsın; yanlış bastıysan altta
6 saniye duran bildirimden **Geri al** ile eski yerine döner.

Kayıtta bir yanlışlık varsa karttaki **Düzenle** ile üstteki form o ürüne
geçer; kaydettiğinde ürün listedeki yerini kaybetmez.

Liste kalabalıklaştığında **arama kutusu** (ürün adı veya kategori, Türkçe
harflere duyarlı) ve **durum düğmeleri** (Tümü / Güvenli / Dikkat / Süresi
Doldu, her birinde kaç ürün olduğu yazılı) işe yarar.

## Başlatma

Node 24 veya üzeri gerekir.

```bash
npm install
cp .env.local.example .env.local   # iki değeri Supabase panelinden doldur
npm run dev
```

**Supabase kurulumu için adım adım rehber: [`KURULUM.md`](KURULUM.md)**
(~10 dakika). Kurulumdan sonra iki komut her şeyi doğrular:

```bash
npm run doctor      # env, şema, "Confirm email", kayıt tetikleyicisi, yazma yolu
npm run rls-check   # güvenlik: iki hesapla veri yalıtımı (atlanamaz)
```

İlk açılışta e-posta ve şifreyle kayıt olup giriş yapılır. Tarayıcıda eski
sürümden kalan ürünler varsa üstte bir şerit çıkar ve tek tıkla hesabına
aktarılır.

Ardından http://localhost:3000 adresini aç.

## Komutlar

| Komut | İşi |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Build'i sunar |
| `npm test` | Testler (Vitest), tek seferlik |
| `npm run test:watch` | Testler, izleme kipinde |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Tip kontrolü |

Tek dosya ya da tek test çalıştırmak için:

```bash
npm test -- src/lib/date.test.ts
npx vitest run -t "tam 3 gün dikkat eşiğine girer"
```

## Yığın

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript ·
Supabase (Postgres + Auth) · Vitest + React Testing Library · lucide-react

Sunucu tarafı mantık yoktur; sayfa statik olarak üretilir, tarayıcı doğrudan
Supabase ile konuşur ve erişim veritabanı seviyesinde (RLS) kısıtlanır.

## Dosyalar

- `src/types/` — veri modeli
- `src/lib/` — iş mantığı, Supabase erişimi ve önbellek (React'ten bağımsız
  saf fonksiyonlar + senkron çekirdeği)
- `supabase/migrations/` — veritabanı şeması ve RLS politikaları
- `src/components/` — arayüz bileşenleri
- `src/app/` — sayfa, düzen, hata ekranı, manifest

Mimari kararlar, veri sözleşmesi ve bu projeye özgü tuzaklar için
[`CLAUDE.md`](CLAUDE.md); adım adım geliştirme kaydı için
[`GELISTIRME_NOTLARI.md`](GELISTIRME_NOTLARI.md).

## Projenin bittiği nokta

Çalışan ve testli olan her şey yukarıda anlatıldı. Dürüst olmak gerekirse
**veri modeli arayüzün bir adım önünde**: aşağıdaki alanlar modelde ve
veritabanında var, ama formda henüz yok ve varsayılanlarıyla kaydediliyor.

| Modelde var, arayüzde yok | Bugünkü varsayılan |
| --- | --- |
| Miktar + birim | 1 adet |
| Saklama yeri | Buzdolabı |
| Açıldı mı + açılma tarihi | açılmamış |
| "Çöpe gitti" durumu | yalnızca "tüketildi" yazılıyor |

Bu bilinçli bir duraktı: model göçü tek başına yapılıp uygulama çalışır
halde bırakıldı. Düzenleme sırasında bu alanların **ezilmediği** ayrı bir
testle kilitli.

## Sırada ne var

1. Yukarıdaki alanların forma eklenmesi, geçmiş tarih uyarısı
2. "Çöpe gitti" düğmesi ve **geçmiş ekranı** — tüketilen/çöpe giden kayıtlar
   silinmiyor, veritabanında duruyor ama henüz gösterilmiyor
3. Kategori / saklama yeri / durum filtreleri
4. Kategoriye göre varsayılan raf ömrü önerisi, bildirimler, istatistik paneli
5. Ev arkadaşı paylaşımı — şema hazır, arayüz yok

Bilinen açık bulgular (gerekçeleriyle):
[`INCELEME_BULGULARI.md`](INCELEME_BULGULARI.md). Adım adım geliştirme kaydı:
[`GELISTIRME_NOTLARI.md`](GELISTIRME_NOTLARI.md).
