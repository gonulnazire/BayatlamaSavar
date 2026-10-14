# Dal İncelemesi — `supabase-gocu`

**14 Ekim 2026** · Taze bağlamlı gözden geçirici (Opus), 11 commit / ~154 KB diff
**Sonuç: BİRLEŞTİRİLMEYE HAZIR DEĞİL.** Düzeltme turu yapılmadı (kullanım limiti).

Yeniden derecelendirmem: **I1 → Critical.** Ölçüt spec'in sessizliği değil
kullanıcının eline geçen sonuç: "kaydedildi" denip hiçbir şey yazılmamış olması
beklemeli yazmanın tüm gerekçesini çürütüyor.

**C1, C2, I1, I2 aynı kök sebebin yüzleri: test edilmemiş API dikişi.**
`createProductApi`, `lazyProductApi` ve `getSupabaseClient` için hiç test yok.

---

## C1 — `classifyError` gerçek hiçbir Supabase hatasını sınıflandıramıyor
`src/lib/product-store.ts:43-55` + `src/lib/product-api.ts:81,92,108,119,132,140`

postgrest-js 2.117.3'ün fırlattığı `error` bir `Error` **değil**, gövdeden
ayrıştırılmış düz nesne (`{message, details, hint, code}`) ve `status`
taşımıyor — `status` yanıtın kardeş alanı, API katmanı onu **atıyor**.

Sonuç: `status === 401` hiç tutmuyor (auth dalı **ölü kod**);
`error instanceof Error` false olduğu için `String(error)` → `"[object Object]"`
ve `/fetch|network/i` eşleşmiyor (network dalı da **ölü**). Her hata
`unknown`'a düşüyor → kullanıcı daima "Beklenmeyen bir hata oluştu." görüyor.

**Review Focus 1'in ilk yarısı tutmuyor.** (İkinci yarısı, alanların
korunması, tutuyor.)

176 test neden kaçırdı: testler `Object.assign(new Error(...), {status:401})`
ve `new TypeError(...)` fırlatıyor — **gerçek API bu şekilleri hiç üretmiyor.**

Düzeltme: API katmanında `status` ve `code` korunsun
(`Object.assign(new Error(error.message), { status, code: error.code, ... })`),
`classifyError` `code` (`PGRST301`, `PGRST302`, `42501`) ve `status`
(postgrest'te `0` = ağ hatası) üzerinden karar versin.

## C2 — Çıkış + aynı hesapla tekrar giriş → uygulama kalıcı kilitleniyor
`src/app/page.tsx:55-61` + `src/lib/product-store.ts:183-190`

`reset()` `userId`/`householdId`'yi null'lıyor ama `Home` unmount olmuyor;
`initializedFor` ref'i eski `userId`'yi tutuyor. Aynı hesapla tekrar girince
guard erken dönüyor → `init()` hiç koşmuyor → sonsuza kadar iskelet kartlar.
"Ekle" **hiçbir mesaj vermeden hiçbir şey yapmıyor** (`addProduct` `write()`'tan
önce fırlıyor, store'a hata yazılmıyor, form yutuyor). `retry()` kurtarmıyor.
Yalnızca sayfa yenilemek çözüyor.

`page.test.tsx` oturumu sabit stub'ladığı için hiç oturum geçişi denenmiyor.

Düzeltme: ref'i bırak, `init`'i store içinde idempotent yap; ya da oturum
`signedIn`'den çıkınca `initializedFor`'u temizle.

## I1 (→ Critical) — UPDATE yazmaları doğrulanmıyor
`src/lib/product-api.ts:122-141` · `.update(...).eq("id",…)` çağrılarında
`.select()` yok. PostgREST satır bulamayınca ya da RLS filtreleyince **204 ve
hatasız** dönüyor. Oturum gidince supabase-js sessizce anon anahtarına düşüyor
→ "kaydedildi" denip liste **ve önbellek** güncelleniyor, sonraki tazelemede
geri dönüyor. "Tükettim"de kart siliniyor ama sunucu satırı aktif kalıyor.
Düzeltme: `.select("id")` ekle, dönen dizi boşsa fırlat.

## I2 — `refresh()` RLS'in filtrelediği boş sonucu doğru kabul edip önbelleği siliyor
`src/lib/product-store.ts:101-118` · Oturum sekme açıkken ölürse `[]` ve hatasız
dönüyor → `status: "ready"`, `cache.write([])`. Uyarısız boş liste, çevrimdışı
önbellek yok oluyor. Kullanıcı eylemi gerekmiyor: `online`/`visibilitychange`
tetikliyor.

## I3 — `getSession()` reddedilirse sonsuza kadar iskelet
`src/lib/useSession.ts:57` — `.catch` yok, giriş ekranına yol yok.
Düzeltme: `.catch(() => set(SIGNED_OUT))`.

## I4 — Çıkış düğmesi dışında sona eren oturumda önceki kullanıcının ürünleri görünebiliyor
Önbellek temizliği yalnızca `signOut()` içinde (`useSession.ts:111-115`).
auth-js kendi `SIGNED_OUT`'unu yayarsa `reset()` koşmuyor. Spec §6 bunu
engellemek istiyordu. Düzeltme: sıfırlamayı oturum geçişine bağla.

## I5 — Teknik detay her yerde yutuluyor, console'a hiçbir şey gitmiyor
Spec §7 "teknik detay yalnızca console'a" diyor. `classifyError` özgün hatayı
atıyor; `page.tsx:115,129,140`, `ProductForm.tsx:59`, `AuthScreen.tsx:29` boş
catch. postgrest'in `hint` alanı sıkça doğrudan SQL çözümünü taşıyor.

## I6 — `void signOut()` yüzen rejection bırakıyor
`src/app/page.tsx:191`. Etkisi sınırlı (auth-js yerel oturumu yine siliyor).

## I7 — RF2 kısmen: eski bir düzenleme yenisini sessizce eziyor
`product-api.ts:122-133` dört sütunu birden gönderiyor → satır düzeyinde
son-yazan-kazanır; `updated_at`/`version` yok. (RF2'nin diğer yarısı tutuyor.)

---

## Minor (ertelendi)

- **M1** `created_by` FK'sinde `on delete` yok → **hesap silme reddediliyor**, ev üyesiz kalıyor
- **M2** Kayıt tetikleyicisi RLS'i politikayla değil sahip-atlamasıyla geçiyor (doğru ama belgesiz)
- **M3** Açık `grant` yok
- **M4** `cacheWritable` iyimser başlıyor; ilk açılış çevrimdışıysa RF3 şeridi çıkamıyor
- **M5** Okuma/yazma hatası aynı metin (C1 durdukça anlamsız)
- **M6** DOM dinleyicileri abone başına; ikinci `useProducts()` N eşzamanlı `refresh()` üretir
- **M7** `AuthScreen` ağ hatasında da "E-postanı ve şifreni kontrol et" diyor
- **M8** `saving` sayaç değil boolean; üst üste binen yazmalarda arayüz erken açılıyor
- **M9** JS'te `shelfLifeDays` üst sınırı yok
- **M10** Env eksikse `error.tsx` çiziliyor ve kurulum mesajı yalnızca console'a düşüyor; ayrıca `error.tsx`'teki "ürünlerin tarayıcında duruyor" metni artık **yanlış**

---

## Doğrulanan iyi haberler

- Prerender güvenliği tasarım gereği sağlam (modül gövdesinde istemci çözülmüyor, `getServerSnapshot`'lar modül sabiti, cache dokunuşları try/catch'li)
- `useSyncExternalStore` sözleşmesi iki store'da da doğru; temizlik StrictMode'un çift çağrısına dayanıyor
- **Review Focus 4 ve 5 tam tutuyor** (parçalı + idempotent aktarım; `opened_at` uçtan uca metin)
- RLS, uygulamanın gerçekten yaptığı işlemler için doğru: `search_path = ''` iki `security definer` nesnesinde de var, adlar tam nitelikli, özyineleme yok
- `providers.tsx` ↔ `useSession.ts` döngüsünü tembel `getDefaults()` gerçekten etkisizleştiriyor

## Süreç dersi

> "'PostgREST'ten gelen 401 gövdesi `auth` olarak sınıflanır' diyen tek bir
> test C1'i gönderilmeden yakalardı."

Düzeltme turu buradan başlamalı: önce `ProductApi` sınırına gerçek yanıt
şekilleriyle test.
