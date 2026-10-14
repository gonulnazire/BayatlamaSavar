# BayatlamaSavar

Buzdolabında ya da mutfakta **ambalajı açıldıktan sonra** raf ömrü kısalan
gıdaları (süt, yoğurt, salça, soslar) takip eder; hangisinin ne zaman
tükenmesi gerektiğini renklerle gösterip gıda israfını önler.

Veri tarayıcıda (`localStorage`) durur: hesap açmak, sunucu kurmak veya
internete bağlı olmak gerekmez.

## Nasıl çalışır

Her ürün için tek bir hesap yapılır:

```
Kalan Gün = (Açılış Tarihi + Raf Ömrü) − Bugün
```

Kart rengi bu sonuca göre belirlenir:

| Kalan gün | Durum | Renk |
| --- | --- | --- |
| 3 veya daha fazla | Güvenli | 🟢 yeşil |
| 1–2 gün | Dikkat | 🟡 sarı |
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
npm run dev
```

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
npx vitest run -t "negatif raf ömrünü reddeder"
```

## Yığın

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript ·
Vitest + React Testing Library · lucide-react

Sunucu tarafı mantık yoktur; sayfa statik olarak üretilir ve tüm iş tarayıcıda
yapılır.

## Dosyalar

- `src/types/` — veri modeli
- `src/lib/` — iş mantığı ve kalıcılık (React'ten bağımsız saf fonksiyonlar +
  `localStorage` köprüsü)
- `src/components/` — arayüz bileşenleri
- `src/app/` — sayfa, düzen, hata ekranı, manifest

Mimari kararlar, veri sözleşmesi ve bu projeye özgü tuzaklar için
[`CLAUDE.md`](CLAUDE.md); adım adım geliştirme kaydı için
[`GELISTIRME_NOTLARI.md`](GELISTIRME_NOTLARI.md).

## Sırada ne var

Gereksinim dokümanındaki Post-MVP maddeleri: gerçek veritabanı
(Supabase/PostgreSQL), kullanıcı girişi ile çoklu ev arkadaşı desteği,
e-posta veya tarayıcı bildirimleri.
