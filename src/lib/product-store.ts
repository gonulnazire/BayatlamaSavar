import type { Product } from "@/types/product";
import { replaceById } from "@/lib/product-list";
import { lazyProductApi, type ProductApi } from "@/lib/product-api";
import { productCache, type ProductCache } from "@/lib/product-cache";
import { getSupabaseClient } from "@/lib/supabase/client";

export type StoreStatus = "loading" | "ready" | "offline";

export type StoreError =
  | { kind: "network"; message: string }
  | { kind: "auth"; message: string }
  | { kind: "setup"; message: string }
  | { kind: "unknown"; message: string };

export type StoreSnapshot = {
  products: Product[];
  status: StoreStatus;
  saving: boolean;
  error: StoreError | null;
  dropped: number;
  cacheWritable: boolean;
  lastSyncedAt: string | null;
  legacyCount: number;
};

export type ProductStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StoreSnapshot;
  init(userId: string): Promise<void>;
  reset(): void;
  retry(): Promise<void>;
  addProduct(product: Product): Promise<void>;
  updateProduct(product: Product): Promise<void>;
  consumeProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
};

/**
 * Hata sınıflandırması. `auth` ayrımı önemli: kullanıcıya "kaydedilemedi"
 * demek yerine "oturumun sona erdi" diyebilmenin tek yolu bu.
 */
function classifyError(error: unknown): StoreError {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 401 || status === 403) {
    return { kind: "auth", message: "Oturumun sona erdi, tekrar giriş yap." };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError || /fetch|network/i.test(message)) {
    return { kind: "network", message: "Bağlantı kurulamadı." };
  }

  return { kind: "unknown", message: "Beklenmeyen bir hata oluştu." };
}

export function createProductStore(
  api: ProductApi,
  cache: ProductCache,
): ProductStore {
  function emptySnapshot(): StoreSnapshot {
    return {
      products: [],
      status: "loading",
      saving: false,
      error: null,
      dropped: 0,
      cacheWritable: true,
      lastSyncedAt: null,
      legacyCount: cache.readLegacy().length,
    };
  }

  // Önbellek anında okunur: sayfa açılışı ağı beklemez
  let snapshot: StoreSnapshot = { ...emptySnapshot(), products: cache.read() };

  const listeners = new Set<() => void>();
  // Geri alma için: tüketilen kayıt burada tutulur, böylece yeniden sorgu gerekmez
  const consumed = new Map<string, Product>();

  let householdId: string | null = null;
  let userId: string | null = null;

  function emit(): void {
    for (const listener of listeners) listener();
  }

  /** Anlık görüntü yalnızca değişiklikte yeniden üretilir (referans kararlılığı) */
  function set(patch: Partial<StoreSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    emit();
  }

  function commit(products: Product[]): void {
    set({ products, cacheWritable: cache.write(products) });
  }

  async function refresh(): Promise<void> {
    if (!householdId) return;
    try {
      const { products, dropped } = await api.fetchProducts(householdId);
      const written = cache.write(products);
      set({
        products,
        dropped,
        status: "ready",
        error: null,
        cacheWritable: written,
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      // Önbellek korunur: çevrimdışıyken liste hâlâ görünür
      set({ status: "offline", error: classifyError(error) });
    }
  }

  /** Beklemeli yazma: önce sunucu, başarıdan sonra yerel durum */
  async function write(action: () => Promise<void>): Promise<void> {
    set({ saving: true, error: null });
    try {
      await action();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: classifyError(error) });
      throw error;
    }
  }

  async function init(user: string): Promise<void> {
    userId = user;
    set({ legacyCount: cache.readLegacy().length });

    try {
      householdId = await api.fetchHouseholdId();
    } catch (error) {
      set({ status: "offline", error: classifyError(error) });
      return;
    }

    if (!householdId) {
      set({
        status: "offline",
        error: {
          kind: "setup",
          message:
            "Hesap kurulumu tamamlanamadı. Lütfen çıkıp tekrar giriş yap.",
        },
      });
      return;
    }

    await refresh();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);

      // Bağlantı gelince ve sekmeye dönünce kendiliğinden tazele
      const onOnline = () => void refresh();
      const onVisible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      window.addEventListener("online", onOnline);
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        listeners.delete(listener);
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    init,

    reset() {
      householdId = null;
      userId = null;
      consumed.clear();
      cache.clear();
      snapshot = emptySnapshot();
      emit();
    },

    // `this` kullanılmaz: useProducts eylemleri destructure ediyor,
    // bağlam kaybolsa çağrı çökerdi.
    async retry() {
      if (!householdId && userId) return init(userId);
      return refresh();
    },

    async addProduct(product) {
      const household = householdId;
      const user = userId;
      if (!household || !user) {
        throw new Error("Oturum hazır değil.");
      }
      await write(async () => {
        await api.insertProduct(product, household, user);
        commit([product, ...snapshot.products]);
      });
    },

    async updateProduct(product) {
      await write(async () => {
        await api.updateProduct(product);
        commit(replaceById(snapshot.products, product));
      });
    },

    async consumeProduct(id) {
      await write(async () => {
        await api.setConsumedAt(id, new Date().toISOString());
        const target = snapshot.products.find((p) => p.id === id);
        if (target) consumed.set(id, target);
        commit(snapshot.products.filter((p) => p.id !== id));
      });
    },

    async restoreProduct(id) {
      await write(async () => {
        await api.setConsumedAt(id, null);
        const target = consumed.get(id);
        if (!target) {
          // Başka bir sekmede tüketilmişse yerelde kaydı yok; sunucudan al
          await refresh();
          return;
        }
        consumed.delete(id);
        commit([target, ...snapshot.products]);
      });
    },
  };
}

export const productStore: ProductStore = createProductStore(
  lazyProductApi(getSupabaseClient),
  productCache,
);
