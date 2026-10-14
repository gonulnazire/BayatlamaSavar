# Supabase Göçü — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BayatlamaSavar'ın verisini `localStorage`'dan Supabase'e taşımak; tek kullanıcının kendi cihazları arasında senkron ve veri kaybına karşı güvence sağlamak.

**Architecture:** Tarayıcı doğrudan Supabase ile konuşur, güvenlik RLS'te. `lib/storage.ts`'in bugünkü üç işi (önbellek, React köprüsü, yazma) beş modüle ayrılır; `product-store.ts` API ve önbelleği **enjekte alır**, böylece senkron mantığı ağa dokunmadan test edilir. Okuma önbellekten anında, arka planda sunucudan tazelenir; yazma beklemeli ve çevrimiçi gerektirir.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, TypeScript 5, Tailwind CSS 4, `@supabase/supabase-js` v2, Vitest 5 (jsdom) + React Testing Library, lucide-react

**Spec:** `docs/superpowers/specs/2026-10-14-supabase-gocu-design.md`

## Global Constraints

Her task'ın gereksinimleri bu bölümü örtük olarak içerir.

- Node 24+. Paket yöneticisi `npm`.
- **`useEffect` içinde doğrudan `setState` yasak** (`react-hooks/set-state-in-effect`, hata seviyesinde). Abonelik gerektiren her şey `useSyncExternalStore` ile bağlanır.
- **Prerender sırasında `new Date()` yasak** — build'i kırar. Anlık saat yalnızca `useToday()` üzerinden okunur; bileşenler `today`'i prop alır.
- **State updater'ları saf olmalı.** StrictMode updater'ları iki kez çağırır; yan etki olay işleyicisine yazılır.
- Kullanıcıya görünen tüm metin **Türkçe**. Kod, tip ve fonksiyon adları İngilizce (mevcut desen).
- Kategori değerleri tam olarak: `'Süt Ürünü'`, `'Sos/Konserve'`, `'Et/Şarküteri'`, `'Diğer'`.
- `shelf_life_days` aralığı `0`–`365` dahil. Ürün adı kırpıldıktan sonra boş olamaz.
- Tarihler her yerde `YYYY-MM-DD` **metni** olarak taşınır, `Date` nesnesi olarak değil.
- `localStorage` anahtarları tam olarak: eski veri `bayatlamasavar.products`, yeni önbellek `bayatlamasavar.cache.v2`.
- `service_role` anahtarı istemciye **hiç girmez**. Yalnızca `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Testler `src/**/*.test.{ts,tsx}`, ortam jsdom. Çıktı uyarısız olmalı.
- **Her task sonunda dörtlü doğrulama yeşil olmalı:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Review Focus

Spec'in ima ettiği ama hiçbir task'ın testinin kendiliğinden kapsamadığı, kullanıcıyı en çok ısıracak beş durum. Her biri için pinleyen test, o kodu barındıran task'a eklendi.

1. **Oturum süresi dolmuşken yazma denemesi** — kullanıcı "Kaydedilemedi" görüp verisini kaybetmiş sanır. Beklenen: "Oturumun sona erdi" denir ve forma girdiği veri **silinmez**. → Task 4 (store hata sınıflandırması), Task 8 (form girdisinin korunması).
2. **Aynı ürün iki sekmede/cihazda eşzamanlı düzenlenir** — sessizce üzerine yazılır. Beklenen: veri kaybolmasın, bir sonraki tazelemede gerçek durum görünsün; ikinci kez "tüketildi" işaretlemek hata vermesin. → Task 4 (idempotent `setConsumedAt`), Task 2 (çevrim).
3. **`localStorage` yazılamaz** (gizli sekme, kota dolu) — önbellek sessizce boş kalır, çevrimdışıyken kullanıcı boş liste görür ve verisini kaybetmiş sanır. Beklenen: uygulama çalışmaya devam eder, çevrimdışıyken boş liste yerine açık uyarı. → Task 3 (önbellek yazma hatası yutulur ama bildirilir), Task 7 (şerit metni).
4. **Aktarımda çok sayıda ürün** (örn. 500) — tek `insert` çağrısı payload sınırına çarpabilir. Beklenen: parçalı gönderim, yarıda kesilirse tekrar denenebilir. → Task 9 (parçalama + idempotentlik testi).
5. **Cihaz saati farklı saat diliminde** — `opened_at` `date` kolonu ile yerel `today` karışımı gün kaydırabilir. Beklenen: kaydedilen gün, kullanıcının gördüğü gün. → Task 2 (çevrimde saat dilimi testi).

---

## File Structure

**Oluşturulacak:**

| Dosya | Sorumluluğu |
| --- | --- |
| `supabase/migrations/0001_initial_schema.sql` | Tablolar, kısıtlar, indeks, RLS, `is_household_member`, kayıt tetikleyicisi |
| `.env.local.example` | Gereken iki env anahtarının adı (değer yok) |
| `src/lib/supabase/client.ts` | Tarayıcı istemcisi, tek örnek, env doğrulaması |
| `src/lib/product-api.ts` | Sorgular + satır ↔ `Product` çevrimi |
| `src/lib/product-cache.ts` | `localStorage` önbelleği ve eski veri okuma |
| `src/lib/product-store.ts` | Dış kaynak; API ve önbelleği enjekte alır |
| `src/lib/useSession.ts` | Oturum durumu (`useSyncExternalStore`) |
| `src/components/Toast.tsx` | Genel bildirim: mesaj + eylem + isteğe bağlı otomatik kapanma |
| `src/components/ConnectionBanner.tsx` | Çevrimdışı / güncelleniyor / okunamayan kayıt şeridi |
| `src/components/AuthScreen.tsx` | E-posta + şifre, giriş/kayıt kipleri |
| `src/components/ImportPrompt.tsx` | Tek seferlik aktarım şeridi |
| `src/app/page.test.tsx` | Uçtan uca bütünleşme testleri |

**Değiştirilecek:**

| Dosya | Değişiklik |
| --- | --- |
| `src/lib/storage.ts` | İçi boşaltılır; yalnızca `useProducts()` sarmalayıcısı kalır |
| `src/lib/product-list.ts` | `insertAt` silinir; `removeById` kaldırılır (sunucu yapıyor); `replaceById` kalır |
| `src/components/UndoToast.tsx` | `Toast`'ın ince kullanımına döner |
| `src/components/ProductCard.tsx` | `onDelete` → `onConsume`; `disabled` prop'u |
| `src/components/ProductForm.tsx` | `saving` prop'u; gönderim başarısızsa alanlar korunur |
| `src/app/page.tsx` | Oturum kapısı, yükleme/hata durumları, yeni eylem adları |
| `CLAUDE.md`, `README.md`, `MIMARI_KARARI.md`, `GELISTIRME_NOTLARI.md` | Tazeleme |

**Silinecek:** `src/lib/storage.test.ts` (yerini `product-cache.test.ts` ve `product-store.test.ts` alır)

---

## Task 1: Veritabanı şeması ve env iskeleti

**Bu task kullanıcı eylemi gerektirir** — SQL'i Supabase'de uygulamak ve anahtarları girmek plan yürütücüsünün yapabileceği bir şey değil.

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `.env.local.example`

**Interfaces:**
- Consumes: —
- Produces: `public.households`, `public.household_members`, `public.products` tabloları; `public.is_household_member(hid uuid) returns boolean`; `auth.users` üzerinde kayıt tetikleyicisi. Kolon adları ve kısıtlar spec bölüm 4'teki SQL ile birebir.

- [ ] **Step 1: Migration dosyasını yaz**

Spec bölüm 4'teki SQL birebir uygulanır. Üç nokta atlanamaz:
- `is_household_member` **ve** kayıt tetikleyicisi `security definer set search_path = ''` taşır, tablo adları tam nitelikli (`public.household_members`).
- Üç tabloda `enable row level security`.
- `products` üzerinde dört politika (select/insert/update/delete), hepsi tek koşul: `public.is_household_member(household_id)`.

- [ ] **Step 2: `.env.local.example` yaz**

İki satır, değer yok: `NEXT_PUBLIC_SUPABASE_URL=` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

- [ ] **Step 3: Kullanıcı SQL'i uygular**

Supabase panelinde SQL Editor ile migration çalıştırılır. Ardından **Authentication - Sign In / Up - "Confirm email" kapatılır**.

- [ ] **Step 4: Kullanıcı şemayı doğrular**

Panelde `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;` çalıştırılır.
Expected: üç satır (`households`, `household_members`, `products`), hepsinde `rowsecurity = true`.

- [ ] **Step 5: Kullanıcı kayıt tetikleyicisini doğrular**

Panelden bir kullanıcı oluşturulur, sonra `select count(*) from household_members;`
Expected: `1`. Sonuç `0` ise tetikleyici çalışmıyor; devam etmeden düzeltilir.

- [ ] **Step 6: Kullanıcı `.env.local` dosyasını doldurur**

Örnek dosya kopyalanıp iki değer Supabase panelinden (Project Settings - API) girilir. `.env.local` `.gitignore`'da.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_initial_schema.sql .env.local.example
git commit -m "feat: Supabase şeması, RLS politikaları ve kayıt tetikleyicisi"
```

---

## Task 2: Supabase istemcisi ve `product-api`

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/product-api.ts`
- Create: `src/lib/product-api.test.ts`
- Modify: `package.json` (`@supabase/supabase-js` eklenir)

**Interfaces:**
- Consumes: Task 1'in tablo/kolon adları; `Product` (`@/types/product`); `parseProduct` (`@/lib/product-schema`)
- Produces:

```ts
type ProductRow = {
  id: string; household_id: string; name: string; category: string;
  opened_at: string; shelf_life_days: number;
  created_by: string; created_at: string; consumed_at: string | null;
};

function toProduct(row: unknown): Product | null;
function toRow(p: Product, householdId: string, userId: string):
  Omit<ProductRow, "created_at" | "consumed_at">;

type ProductApi = {
  fetchHouseholdId(): Promise<string | null>;
  fetchProducts(householdId: string): Promise<{ products: Product[]; dropped: number }>;
  insertProduct(p: Product, householdId: string, userId: string): Promise<void>;
  insertProducts(ps: Product[], householdId: string, userId: string): Promise<void>;
  updateProduct(p: Product): Promise<void>;
  setConsumedAt(id: string, value: string | null): Promise<void>;
};

function createProductApi(client: SupabaseClient): ProductApi;
```

`ProductApi` tipi Task 4'ün enjeksiyon sözleşmesidir.

**Tasarım kararı:** Sorgu fonksiyonları birim test edilmez — zincirleme bir sahte istemci kurmak kırılgandır ve gerçek değer üretmez. Test edilen şey **çevrim** ve `dropped` sayımı; sorgular ince tutulur ve Task 12'deki elle doğrulamada sınanır.

- [ ] **Step 1: Bağımlılığı kur**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Çevrim testlerini yaz**

```ts
describe("toProduct", () => {
  test("satırı Product'a çevirir")                      // tüm alanlar, snake -> camel
  test("household_id, created_by, created_at taşımaz")
  test("geçersiz satırı reddeder")                      // shelf_life_days: "üç" -> null
  test("bilinmeyen kategoriyi Diğer'e düşürür")
  test("opened_at'i YYYY-MM-DD metni olarak taşır")
});

describe("toRow", () => {
  test("Product'ı satıra çevirir, household_id ve created_by ekler")
  test("opened_at'e saat veya saat dilimi eklemez")
});
```

Son test **Review Focus 5**'i pinler: `toRow({openedAt: "2026-10-14"}, ...).opened_at` tam olarak `"2026-10-14"` olmalı. `Date` nesnesine çevrilip tekrar metne dönerse cihazın saat diliminde gün kayar.

- [ ] **Step 3: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/lib/product-api.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/product-api"`

- [ ] **Step 4: `supabase/client.ts` yaz — istemci TEMBEL oluşturulmalı**

```ts
function getSupabaseClient(): SupabaseClient;   // ilk çağrıda oluşturur
```

**Modül yüklenirken `createClient` çağrılmaz ve env doğrulaması yapılmaz.**
Sebep: `page.tsx` bu modülü dolaylı olarak içe aktarıyor; doğrulama modül
gövdesinde olursa `next build` sayfayı prerender ederken env yoksa **build
kırılır**. Doğrulama ilk `getSupabaseClient()` çağrısına ertelenir; prerender
hiç çağırmaz, çünkü store yalnızca istemcide oturum hazır olunca başlatılır.

Eksik env'de fırlatılan `Error` mesajı `.env.local.example`'a yönlendirir
(spec bölüm 7: "sessizce patlamaz").

Bu adımın doğrulaması: `.env.local` **olmadan** `npm run build` yeşil geçmeli.

- [ ] **Step 5: `product-api.ts` yaz**

`toProduct` doğrulamayı `parseProduct`'a devreder — kurallar ikinci kez yazılmaz. `fetchProducts` yalnızca `consumed_at is null` satırlarını çeker ve `parseProduct`'ın reddettiklerini sayıp `dropped` olarak bildirir. `setConsumedAt` tek alan günceller.

- [ ] **Step 6: Testleri koştur, yeşil olduğunu gör**

Run: `npm test -- src/lib/product-api.test.ts`
Expected: PASS

- [ ] **Step 7: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/supabase src/lib/product-api.ts src/lib/product-api.test.ts package.json package-lock.json
git commit -m "feat: Supabase istemcisi ve product-api çevrim katmanı"
```

---

## Task 3: `product-cache`

**Files:**
- Create: `src/lib/product-cache.ts`
- Create: `src/lib/product-cache.test.ts`

**Interfaces:**
- Consumes: `parseStoredProducts`, `serializeProducts` (`@/lib/product-schema`)
- Produces:

```ts
type ProductCache = {
  read(): Product[];                      // hata durumunda []
  write(products: Product[]): boolean;    // false = yazılamadı
  clear(): void;
  readLegacy(): Product[];                // bayatlamasavar.products
  hasLegacy(): boolean;
  clearLegacy(): void;
};

const productCache: ProductCache;
```

- [ ] **Step 1: Testleri yaz**

```ts
describe("productCache", () => {
  test("yazdığını geri okur")
  test("boş depoda boş dizi döner")
  test("bozuk JSON'da çökmez, boş dizi döner")
  test("bozuk kaydı atar, sağlamı korur")
  test("clear önbelleği siler, eski veriye dokunmaz")
  test("readLegacy eski anahtarı okur, önbellek anahtarını okumaz")
  test("hasLegacy eski anahtar yokken false döner")
  test("clearLegacy eski anahtarı siler, önbelleği değiştirmez")
  test("localStorage yazamıyorsa write false döner ve fırlatmaz")
});
```

Son test **Review Focus 3**'ü pinler: `vi.spyOn(Storage.prototype, "setItem")` fırlatacak şekilde ayarlanır; `write()` **`false`** dönmeli ve istisna sızdırmamalı. Bu `false`'u kullanıcıya bildirmek çağıranın işi (Task 7).

Anahtar ayrımı testleri kritik: iki anahtarın karışması "aktarılacak eski veri" ile "sunucu önbelleği" ayrımını bozar.

- [ ] **Step 2: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/lib/product-cache.test.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 3: `product-cache.ts` yaz**

Bugünkü `storage.ts`'in `localStorage` kısmı buraya taşınır. Anahtarlar Global Constraints'teki tam metinler. `write` başarıyı `boolean` döner; okuma `parseStoredProducts`'a devreder.

- [ ] **Step 4: Testleri koştur, yeşil olduğunu gör**

Run: `npm test -- src/lib/product-cache.test.ts`
Expected: PASS

- [ ] **Step 5: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/product-cache.ts src/lib/product-cache.test.ts
git commit -m "feat: product-cache — önbellek ve eski veri okuma ayrıldı"
```

---

## Task 4: `product-store` — senkron çekirdeği

Planın en önemli task'ı: tüm senkron mantığı burada ve enjeksiyon sayesinde ağsız test ediliyor.

**Files:**
- Create: `src/lib/product-store.ts`
- Create: `src/lib/product-store.test.ts`

**Interfaces:**
- Consumes: `ProductApi` (Task 2), `ProductCache` (Task 3), `replaceById` (`@/lib/product-list`)
- Produces:

```ts
type StoreStatus = "loading" | "ready" | "offline";

type StoreSnapshot = {
  products: Product[];
  status: StoreStatus;
  saving: boolean;
  error: StoreError | null;
  dropped: number;              // sunucudan okunamayan kayıt sayısı
  cacheWritable: boolean;       // false = önbellek yazılamıyor
  lastSyncedAt: string | null;  // ISO
  legacyCount: number;          // aktarılmayı bekleyen eski kayıt sayısı, 0 = yok
};

type StoreError =
  | { kind: "network";  message: string }
  | { kind: "auth";     message: string }   // oturum geçersiz
  | { kind: "setup";    message: string }   // household_id yok
  | { kind: "unknown";  message: string };

type ProductStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot;
  init(userId: string): Promise<void>;      // oturum hazır olunca
  reset(): void;                            // çıkışta: durum + önbellek temizlenir
  retry(): Promise<void>;
  addProduct(p: Product): Promise<void>;
  updateProduct(p: Product): Promise<void>;
  consumeProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
  importLegacy(): Promise<{ imported: number }>;   // Task 9'da yazılır
};

function createProductStore(api: ProductApi, cache: ProductCache): ProductStore;
const productStore: ProductStore;   // createProductApi(supabase) + productCache ile
```

Fabrika testler için, singleton uygulama için. `init` sırası: `fetchHouseholdId()` → yoksa `error.kind = "setup"`; varsa `fetchProducts()`.

- [ ] **Step 1: Okuma yolu testlerini yaz**

```ts
describe("product-store — okuma", () => {
  test("init öncesi önbellekteki ürünleri anında döner")
  test("getSnapshot aynı veri için aynı referansı döner")   // sonsuz render koruması
  test("init başarılıysa listeyi sunucu verisiyle değiştirir ve status ready olur")
  test("init başarılıysa önbelleği tazeler")
  test("sunucu hata verirse status offline olur ve önbellek korunur")
  test("lastSyncedAt başarılı tazelemede güncellenir, hatada korunur")
  test("fetchHouseholdId null dönerse error.kind setup olur ve sorgu yapılmaz")
  test("sunucu bozuk kayıt döndürürse dropped sayısı yansıtılır")
  test("önbellek yazılamıyorsa cacheWritable false olur")
  test("eski anahtarda kayıt varsa legacyCount yansıtılır")
});
```

- [ ] **Step 2: Yazma yolu testlerini yaz**

```ts
describe("product-store — yazma", () => {
  test("addProduct başarılıysa listeye ekler ve önbelleğe yazar")
  test("addProduct uçuşta saving true, bitince false olur")
  test("addProduct hata verirse liste DEĞİŞMEZ ve error.kind network olur")
  test("updateProduct başarılıysa sırayı bozmadan günceller")
  test("consumeProduct başarılıysa listeden çıkarır")
  test("restoreProduct başarılıysa consumed_at null yazar ve listeye geri alır")
  test("aynı id iki kez consume edilirse hata vermez")
  test("oturum geçersizse error.kind auth olur")
});
```

Son iki test Review Focus 1 ve 2'yi pinler: sahte API `{ status: 401 }` benzeri bir hata fırlattığında `kind` **`"auth"`** olmalı (`"network"` değil) — kullanıcıya "oturumun sona erdi" demenin tek yolu bu. İkinci kez `consumeProduct` çağrısı sahte API başarıyla dönse de hata üretmemeli.

- [ ] **Step 3: Yeniden deneme testlerini yaz**

```ts
describe("product-store — yeniden deneme", () => {
  test("retry başarısız tazelemeden sonra tekrar dener")
  test("online olayı tazelemeyi tetikler")
  test("abonelik çözüldüğünde online dinleyicisi kaldırılır")
  test("reset durumu ve önbelleği temizler")
});
```

- [ ] **Step 4: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/lib/product-store.test.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 5: `product-store.ts` yaz**

Modül içi durum + dinleyici kümesi (bugünkü `storage.ts` deseni). `getSnapshot` referans kararlılığı için anlık görüntüyü önbellekler ve yalnızca durum değiştiğinde yeniden üretir. `subscribe` ayrıca `window` `online` ve `visibilitychange` dinler ve çözülürken kaldırır. Hata sınıflandırması tek bir yardımcıda toplanır: HTTP 401/403 ve geçersiz oturum → `auth`, ağ/`fetch` hatası → `network`, diğerleri → `unknown`.

- [ ] **Step 6: Testleri koştur, yeşil olduğunu gör**

Run: `npm test -- src/lib/product-store.test.ts`
Expected: PASS

- [ ] **Step 7: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/product-store.ts src/lib/product-store.test.ts
git commit -m "feat: product-store — enjekte edilebilir senkron çekirdeği"
```

---

## Task 5: `useProducts` yeniden yazımı ve `product-list` sadeleştirmesi

**Files:**
- Modify: `src/lib/storage.ts` (içi boşaltılır)
- Delete: `src/lib/storage.test.ts`
- Modify: `src/lib/product-list.ts` (`insertAt` ve `removeById` silinir)
- Modify: `src/lib/product-list.test.ts` (ilgili testler silinir)

**Interfaces:**
- Consumes: `productStore` (Task 4)
- Produces:

```ts
function useProducts(): StoreSnapshot & Pick<ProductStore,
  "addProduct" | "updateProduct" | "consumeProduct" | "restoreProduct"
  | "retry" | "importLegacy">;
```

- [ ] **Step 1: `product-list.test.ts`'ten `insertAt` ve `removeById` testlerini sil**

`insertAt` (6 test) ve `removeById` (4 test) bölümleri kaldırılır. `replaceById` (4 test) kalır. Gerekçe: soft delete ile sıra numarası taklidine gerek kalmadı, silme sunucuda.

- [ ] **Step 2: Testleri koştur, `replaceById`'nin hâlâ yeşil olduğunu gör**

Run: `npm test -- src/lib/product-list.test.ts`
Expected: PASS, 4 test

- [ ] **Step 3: `product-list.ts`'ten `insertAt`, `removeById` ve `RemoveResult`'ı sil**

- [ ] **Step 4: `storage.test.ts`'i sil**

Yerini Task 3 ve Task 4'ün testleri aldı.

- [ ] **Step 5: `storage.ts`'i yeniden yaz**

İçeriği yalnızca `useSyncExternalStore(productStore.subscribe, productStore.getSnapshot, getServerSnapshot)` ve eylemlerin döndürülmesi. Sunucu anlık görüntüsü sabit bir boş durum döner (prerender'da `localStorage` yok). Eylemler store'dan geldiği için `useCallback` gerekmez — referansları zaten kararlı.

- [ ] **Step 6: Dörtlü doğrulama**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: Hepsi yeşil. `page.tsx` henüz eski imzayı kullandığı için tip hataları çıkarsa Task 8'e bırakılmaz — bu task'ta geçici olarak `page.tsx` yeni adlara uyarlanır (tam yükleme/hata arayüzü Task 8'de).

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/lib/product-list.ts src/lib/product-list.test.ts src/app/page.tsx
git rm src/lib/storage.test.ts
git commit -m "refactor: useProducts store üzerine taşındı, insertAt kaldırıldı"
```

---

## Task 6: Oturum ve giriş ekranı

**Files:**
- Create: `src/lib/useSession.ts`
- Create: `src/lib/useSession.test.ts`
- Create: `src/components/AuthScreen.tsx`
- Create: `src/components/AuthScreen.test.tsx`
- Modify: `src/app/page.tsx` (oturum kapısı)

**Interfaces:**
- Consumes: `supabase` (Task 2)
- Produces:

```ts
type SessionState =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "signedIn"; userId: string; email: string };

function createSessionStore(auth: SupabaseAuthLike): SessionStore;  // test için
function useSession(): SessionState;
function signOut(): Promise<void>;   // productStore.reset() de çağırır

// AuthScreen
type AuthScreenProps = {
  onSignIn(email: string, password: string): Promise<void>;
  onSignUp(email: string, password: string): Promise<void>;
};
```

- [ ] **Step 1: `useSession` testlerini yaz**

```ts
describe("session store", () => {
  test("başlangıçta status unknown")
  test("oturum yoksa signedOut olur")
  test("oturum varsa signedIn olur ve userId taşır")
  test("auth olayı geldiğinde durumu günceller")
  test("abonelik çözüldüğünde auth dinleyicisi kaldırılır")
});
```

Sahte `auth` nesnesi: `getSession()` ve `onAuthStateChange(cb)` metotları olan düz bir obje.

- [ ] **Step 2: `AuthScreen` testlerini yaz**

```ts
describe("AuthScreen", () => {
  test("varsayılan olarak giriş kipinde açılır")
  test("kayıt kipine geçince buton metni değişir")
  test("e-posta ve şifreyle giriş çağırır")
  test("boş alanla gönderimi reddeder")
  test("hata mesajını gösterir")                 // onSignIn reject
  test("gönderim sırasında buton devre dışı")
});
```

- [ ] **Step 3: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/lib/useSession.test.ts src/components/AuthScreen.test.tsx`
Expected: FAIL — modüller bulunamadı

- [ ] **Step 4: `useSession.ts` yaz**

`onAuthStateChange` bir abonelik olduğu için yine `useSyncExternalStore`. Sunucu anlık görüntüsü `{ status: "unknown" }`. `signOut` önce `supabase.auth.signOut()`, sonra `productStore.reset()` çağırır.

- [ ] **Step 5: `AuthScreen.tsx` yaz**

Tek form, iki kip — `ProductForm`'un ekleme/düzenleme deseniyle aynı. Alan etiketleri `E-posta` ve `Şifre`. Kip değişimi `useState`, effect yok.

- [ ] **Step 6: `page.tsx`'e oturum kapısı ekle**

`useSession()` sonucuna göre: `unknown` → iskelet, `signedOut` → `AuthScreen`, `signedIn` → mevcut uygulama. `signedIn` olunca `productStore.init(userId)` bir kez çağrılır — **effect içinde `setState` yasağına dikkat**: çağrı store'a yapılır, bileşen state'i değişmez, bu yüzden kural ihlal edilmez.

- [ ] **Step 7: Testleri koştur, yeşil olduğunu gör + dörtlü doğrulama**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: Hepsi yeşil

- [ ] **Step 8: Commit**

```bash
git add src/lib/useSession.ts src/lib/useSession.test.ts src/components/AuthScreen.tsx src/components/AuthScreen.test.tsx src/app/page.tsx
git commit -m "feat: oturum durumu ve e-posta/şifre giriş ekranı"
```

---

## Task 7: `Toast` genelleştirmesi ve `ConnectionBanner`

**Files:**
- Create: `src/components/Toast.tsx`, `src/components/Toast.test.tsx`
- Create: `src/components/ConnectionBanner.tsx`, `src/components/ConnectionBanner.test.tsx`
- Modify: `src/components/UndoToast.tsx` (ince kullanıma döner)

**Interfaces:**
- Produces:

```ts
type ToastProps = {
  message: string;
  actionLabel: string;
  onAction(): void;
  autoDismissMs?: number;     // verilmezse kendiliğinden kapanmaz
  onDismiss?(): void;
};

type ConnectionBannerProps = {
  status: StoreStatus;
  lastSyncedAt: string | null;
  dropped: number;
  cacheWritable: boolean;
  onRetry(): void;
};
```

- [ ] **Step 1: `Toast` testlerini yaz**

```ts
describe("Toast", () => {
  test("mesajı ve eylem düğmesini gösterir")
  test("role status ve aria-live polite taşır")
  test("eylem düğmesi onAction çağırır")
  test("autoDismissMs verilince süre sonunda onDismiss çağırır")
  test("autoDismissMs verilmezse kendiliğinden kapanmaz")
});
```

Son testte 60 saniye ilerletilir ve `onDismiss` çağrılmamış olmalı.

- [ ] **Step 2: `ConnectionBanner` testlerini yaz**

```ts
describe("ConnectionBanner", () => {
  test("status ready ve sorun yokken hiçbir şey çizmez")
  test("status offline iken son güncelleme saatini gösterir")
  test("status offline iken Tekrar dene onRetry çağırır")
  test("status loading iken güncelleniyor göstergesi çizer")
  test("dropped sıfırdan büyükken kaç kaydın okunamadığını yazar")
  test("cacheWritable false iken çevrimdışı uyarısı gösterir")
});
```

Son test **Review Focus 3**'ün kullanıcıya görünen yarısı: önbellek yazılamıyorsa kullanıcı bunu boş liste olarak değil açık bir uyarı olarak görmeli.

- [ ] **Step 3: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/components/Toast.test.tsx src/components/ConnectionBanner.test.tsx`
Expected: FAIL — modüller bulunamadı

- [ ] **Step 4: `Toast.tsx` yaz**

Bugünkü `UndoToast`'ın işaretlemesi taşınır. `autoDismissMs` verilmişse effect içinde `setTimeout` kurulur ve çözülürken temizlenir; geri çağrıda `setState` değil doğrudan `onDismiss` çağrılır.

- [ ] **Step 5: `UndoToast.tsx`'i `Toast` üzerine indir**

Prop'ları değişmez (`productName`, `onUndo`, `onDismiss`), böylece 5 testi olduğu gibi geçmeye devam eder. İçeride `Toast` `autoDismissMs={6000}` ve `actionLabel="Geri al"` ile çağrılır.

- [ ] **Step 6: `ConnectionBanner.tsx` yaz**

Dört durumu tek şeritte birleştirir; hiçbir koşul yoksa `null` döner.

- [ ] **Step 7: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/components/Toast.tsx src/components/Toast.test.tsx src/components/ConnectionBanner.tsx src/components/ConnectionBanner.test.tsx src/components/UndoToast.tsx
git commit -m "feat: genel Toast ve bağlantı şeridi; UndoToast ince kullanıma indi"
```

---

## Task 8: Sayfa bağlantısı — yükleme, hata, bekleyen yazma

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ProductCard.tsx` ve `.test.tsx`
- Modify: `src/components/ProductForm.tsx` ve `.test.tsx`

**Interfaces:**
- Consumes: `useProducts` (Task 5), `useSession` (Task 6), `ConnectionBanner` + `Toast` (Task 7)
- Produces: `ProductCardProps.onConsume(id: string)`, `ProductCardProps.disabled?: boolean`, `ProductFormProps.saving?: boolean`; `ProductFormProps.onSubmit` artık `Promise<void>` döndürebilir

- [ ] **Step 1: Bileşen testlerini genişlet**

```ts
// ProductCard.test.tsx — onDelete testinin yerine
test("onConsume ürünün id'siyle çağırır")
test("disabled iken düğmeler devre dışı")

// ProductForm.test.tsx
test("saving iken buton devre dışı ve alanlar kilitli")
test("gönderim başarısız olursa alanlar korunur")
```

Son test **Review Focus 1**'in ikinci yarısı: `onSubmit` reject ederse form temizlenmemeli, kullanıcı yazdığını kaybetmemeli.

- [ ] **Step 2: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/components/ProductCard.test.tsx src/components/ProductForm.test.tsx`
Expected: FAIL — `onConsume`, `saving`, `disabled` tanımsız

- [ ] **Step 3: İki bileşeni güncelle**

`ProductForm.handleSubmit` artık `await onSubmit(...)` eder ve **yalnızca başarıdan sonra** ekleme kipinde alanları temizler; hata yukarı fırlatılır.

- [ ] **Step 4: `page.tsx`'i bağla**

`status` ve `error`'a göre: önbellek boş + hata → tam ekran "Bağlantı kurulamadı" + Tekrar dene; önbellek dolu → liste + `ConnectionBanner`. Yazma hatası → otomatik kapanmayan `Toast`. `error.kind === "auth"` ise mesaj "Oturumun sona erdi, tekrar giriş yap". İskelet kartlar yalnızca `status === "loading"` ve önbellek boşken çizilir.

Geçersiz oturumda giriş ekranına dönüş ayrıca kodlanmaz: Supabase `SIGNED_OUT`
olayını yayar, Task 6'daki oturum deposu `signedOut`'a geçer ve sayfa zaten
`AuthScreen` çizer. `error.kind === "auth"` mesajı, olay gelmeden önceki kısa
aralık için.

- [ ] **Step 5: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/app/page.tsx src/components/ProductCard.tsx src/components/ProductCard.test.tsx src/components/ProductForm.tsx src/components/ProductForm.test.tsx
git commit -m "feat: yükleme, hata ve bekleyen yazma durumları sayfaya bağlandı"
```

---

## Task 9: Mevcut verinin aktarımı

**Files:**
- Create: `src/components/ImportPrompt.tsx`, `src/components/ImportPrompt.test.tsx`
- Modify: `src/lib/product-store.ts` ve `.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces:

```ts
// product-store.ts
importLegacy(): Promise<{ imported: number }>;   // başarıda eski anahtarı siler

type ImportPromptProps = { count: number; busy: boolean; onImport(): void };
```

- [ ] **Step 1: Store aktarım testlerini yaz**

```ts
describe("product-store — aktarım", () => {
  test("eski veriyi okuyup insertProducts çağırır ve kimlikleri korur")
  test("başarıda eski anahtar silinir")
  test("hata verirse eski anahtar KORUNUR")
  test("200'den fazla ürünü parçalara bölerek gönderir")
  test("aktarım sonrası liste sunucudan tazelenir")
});
```

Dördüncü test **Review Focus 4**'ü pinler: 500 ürünlü eski veride `insertProducts` çağrı sayısı 1'den büyük olmalı (parça boyutu 200). Üçüncü test idempotentliği korur — yarıda kesilen aktarım tekrar denenebilir kalmalı.

- [ ] **Step 2: `ImportPrompt` testlerini yaz**

```ts
describe("ImportPrompt", () => {
  test("ürün sayısını mesajda gösterir")
  test("Aktar düğmesi onImport çağırır")
  test("busy iken düğme devre dışı")
});
```

- [ ] **Step 3: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/lib/product-store.test.ts src/components/ImportPrompt.test.tsx`
Expected: FAIL — `importLegacy` ve modül tanımsız

- [ ] **Step 4: `importLegacy` ve `ImportPrompt` yaz**

`importLegacy`: `cache.readLegacy()` → 200'lük parçalar → `api.insertProducts(...)` → başarıda `cache.clearLegacy()` → tazeleme. `insertProducts` `upsert(..., { ignoreDuplicates: true })` kullanır; kimlikler korunduğu için işlem tekrarlanabilir.

- [ ] **Step 5: `page.tsx`'e şeridi ekle**

Şerit `legacyCount > 0` iken gösterilir — **sayfa `productCache`'e doğrudan
dokunmaz**, bilgiyi store anlık görüntüsünden okur. Aktarım bitince store
`legacyCount`'u sıfırlar (eski anahtar silindiği için) ve şerit kaybolur.
Bu, Task 10'daki context enjeksiyonunun çalışması için zorunlu: sayfa
singleton bir önbelleğe bağlıysa sahte store ile test edilemez.

- [ ] **Step 6: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/components/ImportPrompt.tsx src/components/ImportPrompt.test.tsx src/lib/product-store.ts src/lib/product-store.test.ts src/app/page.tsx
git commit -m "feat: tarayıcıdaki mevcut verinin tek seferlik aktarımı"
```

---

## Task 10: Sayfa bütünleşme testleri

Adım 8'de kayda geçen "`page.tsx` için uçtan uca test yok" boşluğunu kapatır.

**Files:**
- Create: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `createProductStore` (Task 4), `createSessionStore` (Task 6)

**Not:** `page.tsx` singleton'ları içe aktarıyor. Test edilebilmesi için store ve session React context üzerinden geçirilir: `src/app/providers.tsx` içinde `StoresProvider` tanımlanır, varsayılan değerleri singleton'lar olur, testler sahte olanları enjekte eder. Bu, Task 5 ve 6'daki `useProducts`/`useSession` imzalarını değiştirmez — yalnızca kaynağını değiştirir.

- [ ] **Step 1: `StoresProvider`'ı ekle ve `page.tsx`'i ona bağla**

`useProducts` ve `useSession` artık context'ten okur; sağlayıcı verilmezse singleton'lara düşer.

- [ ] **Step 2: Bütünleşme testlerini yaz**

```ts
describe("Ana sayfa — bütünleşme", () => {
  test("oturum yoksa giriş ekranı çizilir")
  test("oturum varsa ürün listesi çizilir")
  test("ürün ekle akışı: form gönderilir, ürün listede görünür")
  test("tüket akışı: ürün listeden çıkar, bildirim görünür")
  test("geri al akışı: bildirimden geri alınır, ürün listeye döner")
  test("yazma hatası: liste değişmez, hata bildirimi görünür")
  test("sunucu hatası ve önbellek doluysa liste çizilir, çevrimdışı şeridi görünür")
  test("eski veri varsa aktarım şeridi görünür, aktarımdan sonra kaybolur")
});
```

- [ ] **Step 3: Testleri koştur, kırmızı olduğunu gör**

Run: `npm test -- src/app/page.test.tsx`
Expected: FAIL

- [ ] **Step 4: Testleri geçirecek düzeltmeleri yap**

Bu aşamada kod çoğunlukla hazır; kırmızılar genellikle eksik `aria-label` veya erişilebilir ad sorunlarıdır. **Erişilebilirlik kusuru bulunursa test gevşetilmez, bileşen düzeltilir** (Adım 11'deki "Tümü5" olayının dersi).

- [ ] **Step 5: Dörtlü doğrulama + commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/app/page.test.tsx src/app/providers.tsx src/app/page.tsx src/lib/storage.ts src/lib/useSession.ts
git commit -m "test: ana sayfa uçtan uca bütünleşme testleri"
```

---

## Task 11: Dokümantasyon tazelemesi

Göç sonrası dört doküman **yanlış** hale gelir. Yanlış dokümantasyon, dokümantasyon olmamasından kötüdür.

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `MIMARI_KARARI.md`, `GELISTIRME_NOTLARI.md`

- [ ] **Step 1: `CLAUDE.md`'yi güncelle**

Mimari şeması (yeni beş modül), `localStorage` sözleşmesi yerine **Supabase + önbellek** sözleşmesi, yeni test tablosu ve sayıları, env anahtarları. Yeni tuzak ekle: *"Yazma çevrimiçi gerektirir; store'a yan etki eklerken `getSnapshot` referans kararlılığını bozmayın."* Eski "tek kalıcılık localStorage" ifadesi silinir.

- [ ] **Step 2: `README.md`'yi güncelle**

Kurulum artık `.env.local` gerektiriyor; giriş ekranı, çok cihaz senkronu ve çevrimdışı davranış anlatılır. "Veri tarayıcıda durur" cümlesi **artık yanlış**, değiştirilir.

- [ ] **Step 3: `MIMARI_KARARI.md`'yi güncelle**

Durum satırı "uygulandı" olur; bölüm 7'deki açık sorular cevaplarıyla kapatılır.

- [ ] **Step 4: `GELISTIRME_NOTLARI.md`'ye adım notu ekle**

Ne yapıldı, hangi kararlar, nasıl doğrulandı, yol boyunca çıkan hatalar — mevcut dosyadaki biçimle aynı.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md MIMARI_KARARI.md GELISTIRME_NOTLARI.md
git commit -m "docs: Supabase göçü sonrası dokümantasyon tazelendi"
```

---

## Task 12: Elle RLS doğrulaması

**Bu task kullanıcı eylemi gerektirir.** Spec bölüm 9: RLS otomatik test edilmiyor ve route koruması yok, yani **RLS tek güvenlik sınırı.**

- [ ] **Step 1: İki hesap aç** (A ve B)
- [ ] **Step 2:** A ile ürün ekle, B ile gir → **A'nın ürünleri görünmemeli**
- [ ] **Step 3:** B oturumuyla A'nın `household_id`'sine `insert` dene → **reddedilmeli**
- [ ] **Step 4:** B oturumuyla A'nın bir ürün `id`'sini `update` dene → **reddedilmeli**
- [ ] **Step 5:** Yeni hesap aç → `households` ve `household_members` satırlarının oluştuğunu doğrula
- [ ] **Step 6:** `anon` anahtarı olmadan istek at → **reddedilmeli**
- [ ] **Step 7:** Sonuçları `GELISTIRME_NOTLARI.md`'ye yaz

Herhangi bir adım beklenenden farklı sonuç verirse **göç tamamlanmış sayılmaz**; politika düzeltilip adım yeniden koşulur.
