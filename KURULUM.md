# Kurulum — Supabase bağlantısı

Bu dosyadaki işlerin tamamı **senin Supabase hesabında** yapılıyor; bu yüzden
benim yerine senin yapman gerekiyor. Doğrulama kısmını otomatikleştirdim:
elle kontrol listesi yerine iki komut çalıştıracaksın.

Toplam süre: ~10 dakika. Üç şeyi kopyalayıp yapıştıracaksın, gerisi betiklerde.

---

## 1. Supabase projesi aç

1. <https://supabase.com> → **Start your project** → GitHub veya e-posta ile giriş
2. **New project**
   - **Name:** `bayatlamasavar` (önemi yok)
   - **Database Password:** güçlü bir şifre üret ve **bir yere kaydet**
     (bu şifre uygulamada kullanılmıyor, ama veritabanına doğrudan bağlanmak
     istersen gerekir)
   - **Region:** `Central EU (Frankfurt)` — Türkiye'ye en yakını
   - **Plan:** Free
3. **Create new project** → proje hazırlanırken ~2 dakika bekle

---

## 2. Şemayı uygula

1. Sol menüde **SQL Editor** → **New query**
2. Bu depodaki `supabase/migrations/0001_initial_schema.sql` dosyasını aç,
   **tamamını** kopyala, editöre yapıştır
3. **Run** (veya `Ctrl+Enter`)

Beklenen: `Success. No rows returned`

> Kırmızı hata alırsan: büyük olasılıkla dosyanın bir kısmı eksik kopyalanmıştır.
> Dosyanın **ilk satırından son satırına kadar** hepsini al.

Bu adım üç tablo, dört RLS politikası, bir yardımcı fonksiyon ve kayıt
tetikleyicisini kurar.

---

## 3. E-posta onayını kapat

1. Sol menüde **Authentication** → **Sign In / Providers**
2. **Email** sağlayıcısını aç
3. **Confirm email** anahtarını **kapat** → **Save**

Açık kalırsa kayıt olduktan sonra onay maili beklemen gerekir ve uygulama
seni içeri almaz. (Kişisel kullanım için kapatmak uygun; herkese açık bir
ürüne dönerse tekrar açılmalı.)

---

## 4. Anahtarları `.env.local` dosyasına gir

1. Sol menüde **Project Settings** (dişli) → **API**
2. İki değeri kopyala:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable / anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Proje kökündeki **`.env.local`** dosyasını aç (hazır duruyor, boş) ve doldur:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> **`service_role` anahtarını ASLA bu dosyaya koymayın.** O anahtar RLS'i
> tamamen atlar ve `NEXT_PUBLIC_` ile başlayan her değer tarayıcıya gönderilir.
> Uygulamanın ihtiyacı olan tek şey `anon` anahtarı.

`.env.local` `.gitignore`'da; commit edilmez.

---

## 5. Kurulumu doğrula

```bash
npm run doctor
```

Sırayla şunları kontrol eder ve ilk hatada ne yapılacağını söyler:

| Kontrol | Hata verirse |
| --- | --- |
| `.env.local` okunabiliyor mu | 4. adım |
| Bağlantı kuruluyor ve `products` tablosu var mı | 2. adım |
| Oturumsuz sorgu boş dönüyor mu (RLS açık mı) | 2. adım |
| Kayıtta oturum dönüyor mu ("Confirm email" kapalı mı) | 3. adım |
| Kayıt tetikleyicisi kişisel ev açıyor mu | 2. adım |
| Ürün ekleme gerçekten çalışıyor mu | 2. adım |

Beklenen son satır: `Kurulum tamam. Simdi: npm run rls-check`

---

## 6. Güvenliği doğrula (atlanamaz)

```bash
npm run rls-check
```

Bu uygulamada **RLS tek güvenlik sınırı** — route koruması ve middleware yok.
Yanlış bir politika, başka birinin verisini görünür kılar. Betik iki test
hesabı açıp şunları dener:

- B hesabı A'nın ürünlerini **göremiyor** mu
- B, A'nın evine ürün **ekleyemiyor** mu
- B, A'nın ürününü **değiştiremiyor** mu (ve ürün gerçekten değişmemiş mi)
- B, A'nın ürününü **silemiyor** mu (ve ürün hâlâ duruyor mu)
- İki hesabın evleri **ayrı** mı
- Anahtarsız istek **reddediliyor** mu

Beklenen: `TUM RLS KONTROLLERI GECTI`

Herhangi biri başarısızsa göç tamamlanmış sayılmaz: şemayı tekrar uygula ve
betiği yeniden çalıştır.

> **Not:** Engellenen bir `UPDATE`/`DELETE` Postgres'te hata vermez, yalnızca
> 0 satır etkiler. Betik bu yüzden "hata geldi mi" değil, "satır etkilendi mi
> **ve** veri gerçekten değişmemiş mi" diye bakıyor — yanlış bir güvence
> vermemesi için.

---

## 7. Uygulamayı çalıştır

```bash
npm run dev
```

<http://localhost:3000> → e-posta ve şifreyle **Kayıt ol** → giriş.

Tarayıcında eski sürümden ürünler kaldıysa üstte bir şerit çıkar:
**"Tarayıcında N ürün var. Hesabına aktar."** Aktar'a basman yeterli; kimlikler
korunduğu için yarıda kalsa tekrar basmak ürünleri çoğaltmaz.

---

## Temizlik

`doctor` ve `rls-check` gerçek test kullanıcıları oluşturur (adları
`bayatlamasavar-...@test.local`). Panelde **Authentication → Users** altından
silebilirsin; silmesen de uygulamayı etkilemez.

---

## Sorun giderme

| Belirti | Sebep |
| --- | --- |
| `Supabase yapılandırması eksik` hatası | `.env.local` yok ya da boş → 4. adım. Dosyayı değiştirdiysen `npm run dev`'i yeniden başlat |
| Kayıt oluyor ama giriş yapılmıyor | "Confirm email" açık → 3. adım |
| Giriş sonrası `Hesap kurulumu tamamlanamadı` | Kayıt tetikleyicisi çalışmamış → şemayı tekrar uygula |
| Liste boş ve `Çevrimdışı` şeridi var | Bağlantı yok ya da proje duraklatılmış (Free plan uzun süre kullanılmayan projeleri duraklatır; panelden **Restore** et) |
| `rls-check` bir kontrolde başarısız | O politika eksik/yanlış → `supabase/migrations/0001_initial_schema.sql`'i tekrar uygula |
