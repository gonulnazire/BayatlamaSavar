import { beforeEach, describe, expect, test, vi } from "vitest";
import { createProductStore } from "@/lib/product-store";
import { productCache } from "@/lib/product-cache";
import { SCHEMA_VERSION } from "@/lib/product-schema";
import type { ProductApi } from "@/lib/product-api";
import type { Product } from "@/types/product";

const USER = "22222222-2222-2222-2222-222222222222";
const HOUSEHOLD = "11111111-1111-1111-1111-111111111111";

const milk: Product = {
  id: "m1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};

const sauce: Product = {
  id: "s1",
  name: "Tat Salça",
  category: "Sos/Konserve",
  openedAt: "2026-10-10",
  shelfLifeDays: 7,
};

function fakeApi(overrides: Partial<ProductApi> = {}): ProductApi {
  return {
    fetchHouseholdId: vi.fn(async () => HOUSEHOLD),
    fetchProducts: vi.fn(async () => ({ products: [milk], dropped: 0 })),
    insertProduct: vi.fn(async () => {}),
    insertProducts: vi.fn(async () => {}),
    updateProduct: vi.fn(async () => {}),
    setConsumedAt: vi.fn(async () => {}),
    ...overrides,
  };
}

function seedCache(products: Product[]): void {
  localStorage.setItem(
    "bayatlamasavar.cache.v2",
    JSON.stringify({ version: SCHEMA_VERSION, products }),
  );
}

function seedLegacy(products: Product[]): void {
  localStorage.setItem(
    "bayatlamasavar.products",
    JSON.stringify({ version: SCHEMA_VERSION, products }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("product-store — okuma", () => {
  test("init öncesi önbellekteki ürünleri anında döner", () => {
    seedCache([milk, sauce]);
    const store = createProductStore(fakeApi(), productCache);
    expect(store.getSnapshot().products).toEqual([milk, sauce]);
    expect(store.getSnapshot().status).toBe("loading");
  });

  test("getSnapshot aynı veri için aynı referansı döner", () => {
    seedCache([milk]);
    const store = createProductStore(fakeApi(), productCache);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  test("init başarılıysa listeyi sunucu verisiyle değiştirir ve status ready olur", async () => {
    seedCache([sauce]);
    const api = fakeApi();
    const store = createProductStore(api, productCache);

    await store.init(USER);

    expect(api.fetchProducts).toHaveBeenCalledWith(HOUSEHOLD);
    expect(store.getSnapshot().products).toEqual([milk]);
    expect(store.getSnapshot().status).toBe("ready");
  });

  test("init başarılıysa önbelleği tazeler", async () => {
    seedCache([sauce]);
    const store = createProductStore(fakeApi(), productCache);

    await store.init(USER);

    expect(productCache.read()).toEqual([milk]);
  });

  test("sunucu hata verirse status offline olur ve önbellek korunur", async () => {
    seedCache([sauce]);
    const api = fakeApi({
      fetchProducts: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    const store = createProductStore(api, productCache);

    await store.init(USER);

    expect(store.getSnapshot().status).toBe("offline");
    expect(store.getSnapshot().products).toEqual([sauce]);
    expect(store.getSnapshot().error?.kind).toBe("network");
    expect(productCache.read()).toEqual([sauce]);
  });

  test("lastSyncedAt başarılı tazelemede güncellenir, hatada korunur", async () => {
    const store = createProductStore(fakeApi(), productCache);
    await store.init(USER);
    const first = store.getSnapshot().lastSyncedAt;
    expect(first).not.toBeNull();

    const failing = createProductStore(
      fakeApi({
        fetchProducts: vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }),
      }),
      productCache,
    );
    await failing.init(USER);
    expect(failing.getSnapshot().lastSyncedAt).toBeNull();
  });

  test("fetchHouseholdId null dönerse error.kind setup olur ve sorgu yapılmaz", async () => {
    const api = fakeApi({ fetchHouseholdId: vi.fn(async () => null) });
    const store = createProductStore(api, productCache);

    await store.init(USER);

    expect(store.getSnapshot().error?.kind).toBe("setup");
    expect(api.fetchProducts).not.toHaveBeenCalled();
  });

  test("sunucu bozuk kayıt döndürürse dropped sayısı yansıtılır", async () => {
    const api = fakeApi({
      fetchProducts: vi.fn(async () => ({ products: [milk], dropped: 3 })),
    });
    const store = createProductStore(api, productCache);

    await store.init(USER);

    expect(store.getSnapshot().dropped).toBe(3);
  });

  test("önbellek yazılamıyorsa cacheWritable false olur", async () => {
    const store = createProductStore(fakeApi(), productCache);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    await store.init(USER);

    expect(store.getSnapshot().cacheWritable).toBe(false);
  });

  test("eski anahtarda kayıt varsa legacyCount yansıtılır", () => {
    seedLegacy([milk, sauce]);
    const store = createProductStore(fakeApi(), productCache);
    expect(store.getSnapshot().legacyCount).toBe(2);
  });
});

describe("product-store — yazma", () => {
  test("addProduct başarılıysa listeye ekler ve önbelleğe yazar", async () => {
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);

    await store.addProduct(sauce);

    expect(api.insertProduct).toHaveBeenCalledWith(sauce, HOUSEHOLD, USER);
    expect(store.getSnapshot().products).toContainEqual(sauce);
    expect(productCache.read()).toContainEqual(sauce);
  });

  test("addProduct uçuşta saving true, bitince false olur", async () => {
    let release: (() => void) | undefined;
    const api = fakeApi({
      insertProduct: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);

    const pending = store.addProduct(sauce);
    expect(store.getSnapshot().saving).toBe(true);

    release?.();
    await pending;
    expect(store.getSnapshot().saving).toBe(false);
  });

  test("addProduct hata verirse liste DEĞİŞMEZ ve error.kind network olur", async () => {
    const api = fakeApi({
      insertProduct: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);
    const before = store.getSnapshot().products;

    await expect(store.addProduct(sauce)).rejects.toThrow();

    expect(store.getSnapshot().products).toEqual(before);
    expect(store.getSnapshot().error?.kind).toBe("network");
  });

  test("updateProduct başarılıysa sırayı bozmadan günceller", async () => {
    const api = fakeApi({
      fetchProducts: vi.fn(async () => ({
        products: [milk, sauce],
        dropped: 0,
      })),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);

    const renamed = { ...milk, name: "Süt 1L" };
    await store.updateProduct(renamed);

    expect(store.getSnapshot().products).toEqual([renamed, sauce]);
  });

  test("consumeProduct başarılıysa listeden çıkarır", async () => {
    const api = fakeApi({
      fetchProducts: vi.fn(async () => ({
        products: [milk, sauce],
        dropped: 0,
      })),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);

    await store.consumeProduct("m1");

    expect(api.setConsumedAt).toHaveBeenCalledWith("m1", expect.any(String));
    expect(store.getSnapshot().products).toEqual([sauce]);
  });

  test("restoreProduct başarılıysa consumed_at null yazar ve listeye geri alır", async () => {
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);

    await store.consumeProduct("m1");
    expect(store.getSnapshot().products).toEqual([]);

    await store.restoreProduct("m1");

    expect(api.setConsumedAt).toHaveBeenLastCalledWith("m1", null);
    expect(store.getSnapshot().products).toContainEqual(milk);
  });

  test("aynı id iki kez consume edilirse hata vermez", async () => {
    const store = createProductStore(fakeApi(), productCache);
    await store.init(USER);

    await store.consumeProduct("m1");
    await expect(store.consumeProduct("m1")).resolves.toBeUndefined();
    expect(store.getSnapshot().error).toBeNull();
  });

  test("oturum geçersizse error.kind auth olur", async () => {
    const api = fakeApi({
      insertProduct: vi.fn(async () => {
        throw Object.assign(new Error("JWT expired"), { status: 401 });
      }),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);

    await expect(store.addProduct(sauce)).rejects.toThrow();

    expect(store.getSnapshot().error?.kind).toBe("auth");
  });
});

describe("product-store — yeniden deneme", () => {
  test("retry başarısız tazelemeden sonra tekrar dener", async () => {
    let failOnce = true;
    const api = fakeApi({
      fetchProducts: vi.fn(async () => {
        if (failOnce) {
          failOnce = false;
          throw new TypeError("Failed to fetch");
        }
        return { products: [milk, sauce], dropped: 0 };
      }),
    });
    const store = createProductStore(api, productCache);

    await store.init(USER);
    expect(store.getSnapshot().status).toBe("offline");

    await store.retry();
    expect(store.getSnapshot().status).toBe("ready");
    expect(store.getSnapshot().products).toEqual([milk, sauce]);
  });

  test("online olayı tazelemeyi tetikler", async () => {
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    const unsubscribe = store.subscribe(() => {});
    await store.init(USER);
    const callsBefore = (api.fetchProducts as ReturnType<typeof vi.fn>).mock
      .calls.length;

    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => {
      expect(
        (api.fetchProducts as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(callsBefore);
    });

    unsubscribe();
  });

  test("abonelik çözüldüğünde online dinleyicisi kaldırılır", async () => {
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    const unsubscribe = store.subscribe(() => {});
    await store.init(USER);
    unsubscribe();

    const callsBefore = (api.fetchProducts as ReturnType<typeof vi.fn>).mock
      .calls.length;
    window.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 20));

    expect(
      (api.fetchProducts as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(callsBefore);
  });

  test("reset durumu ve önbelleği temizler", async () => {
    const store = createProductStore(fakeApi(), productCache);
    await store.init(USER);
    expect(store.getSnapshot().products).toEqual([milk]);

    store.reset();

    expect(store.getSnapshot().products).toEqual([]);
    expect(store.getSnapshot().status).toBe("loading");
    expect(productCache.read()).toEqual([]);
  });
});

describe("product-store — bağlamdan bağımsızlık", () => {
  test("eylemler destructure edilince de çalışır", async () => {
    // useProducts eylemleri destructure ediyor; `this`'e bağlı bir metot
    // bağlamı kaybeder ve çağrıldığında çöker.
    const store = createProductStore(fakeApi(), productCache);
    const { init, retry, addProduct } = store;

    await init(USER);
    await retry();
    await addProduct(sauce);

    expect(store.getSnapshot().products).toContainEqual(sauce);
  });
});
