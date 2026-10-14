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
  // Hata yolları bilinçli olarak console'a yazıyor; test çıktısı kirlenmesin
  vi.spyOn(console, "error").mockImplementation(() => {});
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

describe("product-store — aktarım", () => {
  test("eski veriyi okuyup insertProducts çağırır ve kimlikleri korur", async () => {
    seedLegacy([milk, sauce]);
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);

    const { imported } = await store.importLegacy();

    expect(imported).toBe(2);
    expect(api.insertProducts).toHaveBeenCalledOnce();
    const sent = (api.insertProducts as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Product[];
    expect(sent.map((p) => p.id)).toEqual(["m1", "s1"]);
  });

  test("başarıda eski anahtar silinir", async () => {
    seedLegacy([milk]);
    const store = createProductStore(fakeApi(), productCache);
    await store.init(USER);
    expect(store.getSnapshot().legacyCount).toBe(1);

    await store.importLegacy();

    expect(productCache.hasLegacy()).toBe(false);
    expect(store.getSnapshot().legacyCount).toBe(0);
  });

  test("hata verirse eski anahtar KORUNUR", async () => {
    seedLegacy([milk]);
    const api = fakeApi({
      insertProducts: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    const store = createProductStore(api, productCache);
    await store.init(USER);

    await expect(store.importLegacy()).rejects.toThrow();

    // Yarıda kesilen aktarım tekrar denenebilir kalmalı
    expect(productCache.hasLegacy()).toBe(true);
  });

  test("200'den fazla ürünü parçalara bölerek gönderir", async () => {
    // Review Focus 4: tek insert çağrısı payload sınırına çarpabilir
    const many: Product[] = Array.from({ length: 500 }, (_, i) => ({
      ...milk,
      id: `p${i}`,
      name: `Ürün ${i}`,
    }));
    seedLegacy(many);
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);

    const { imported } = await store.importLegacy();

    expect(imported).toBe(500);
    expect(
      (api.insertProducts as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(1);
  });

  test("aktarım sonrası liste sunucudan tazelenir", async () => {
    seedLegacy([sauce]);
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);
    const before = (api.fetchProducts as ReturnType<typeof vi.fn>).mock.calls
      .length;

    await store.importLegacy();

    expect(
      (api.fetchProducts as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeGreaterThan(before);
  });
});

describe("product-store — gerçek Supabase hata şekilleri", () => {
  function apiThatThrows(error: unknown): ProductApi {
    return fakeApi({
      insertProduct: vi.fn(async () => {
        throw error;
      }),
    });
  }

  async function errorKindFor(error: unknown) {
    const store = createProductStore(apiThatThrows(error), productCache);
    await store.init(USER);
    await store.addProduct(sauce).catch(() => {});
    return store.getSnapshot().error?.kind;
  }

  test("PGRST301 (JWT expired) auth olarak sınıflanır", async () => {
    expect(
      await errorKindFor(
        Object.assign(new Error("JWT expired"), {
          status: 401,
          code: "PGRST301",
        }),
      ),
    ).toBe("auth");
  });

  test("status taşımayan PGRST301 de auth olarak sınıflanır", async () => {
    expect(
      await errorKindFor(
        Object.assign(new Error("JWT expired"), { code: "PGRST301" }),
      ),
    ).toBe("auth");
  });

  test("42501 (RLS reddi) auth olarak sınıflanır", async () => {
    // Oturum gidince supabase-js sessizce anon anahtarına düşer ve bu kod gelir
    expect(
      await errorKindFor(
        Object.assign(new Error("new row violates row-level security policy"), {
          status: 403,
          code: "42501",
        }),
      ),
    ).toBe("auth");
  });

  test("postgrest'in status 0 ağ işareti network olarak sınıflanır", async () => {
    expect(
      await errorKindFor(
        Object.assign(new Error("TypeError: Failed to fetch"), {
          status: 0,
          code: "",
        }),
      ),
    ).toBe("network");
  });

  test("tanınmayan hata unknown kalır", async () => {
    expect(
      await errorKindFor(
        Object.assign(new Error("duplicate key"), {
          status: 409,
          code: "23505",
        }),
      ),
    ).toBe("unknown");
  });

  test("teknik detay console'a bildirilir", async () => {
    const error = Object.assign(new Error("JWT expired"), {
      status: 401,
      code: "PGRST301",
      hint: "Refresh the token",
    });
    await errorKindFor(error);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), error);
  });
});

describe("product-store — oturum yeniden açıldığında", () => {
  test("reset sonrası AYNI userId ile init tekrar çalışır", async () => {
    // C2: cikis + ayni hesapla tekrar giris uygulamayi kilitliyordu
    const api = fakeApi();
    const store = createProductStore(api, productCache);

    await store.init(USER);
    expect(store.getSnapshot().status).toBe("ready");

    store.reset();
    expect(store.getSnapshot().status).toBe("loading");

    await store.init(USER);
    expect(store.getSnapshot().status).toBe("ready");
    expect(store.getSnapshot().products).toEqual([milk]);
  });

  test("reset sonrası yazma yeniden çalışır", async () => {
    const api = fakeApi();
    const store = createProductStore(api, productCache);
    await store.init(USER);
    store.reset();
    await store.init(USER);

    await expect(store.addProduct(sauce)).resolves.toBeUndefined();
  });
});

describe("product-store — oturum sessizce öldüğünde", () => {
  test("boş liste + ev artık görünmüyorsa auth hatası verir ve önbelleği KORUR", async () => {
    // I2: oturum olmadan sorgu [] ve hatasiz doner; bunu dogru kabul etmek
    // kullaniciya uyarisiz bos liste gosterir ve onbellegi silerdi
    let alive = true;
    const api = fakeApi({
      fetchHouseholdId: vi.fn(async () => (alive ? HOUSEHOLD : null)),
      fetchProducts: vi.fn(async () =>
        alive
          ? { products: [milk, sauce], dropped: 0 }
          : { products: [], dropped: 0 },
      ),
    });
    const store = createProductStore(api, productCache);

    // Oturum canlıyken liste yüklenir ve önbelleğe yazılır
    await store.init(USER);
    expect(productCache.read()).toEqual([milk, sauce]);

    // Oturum sessizce ölür: sorgu hatasız [] döner
    alive = false;
    await store.retry();

    expect(store.getSnapshot().error?.kind).toBe("auth");
    expect(store.getSnapshot().status).toBe("offline");
    expect(productCache.read()).toEqual([milk, sauce]);
  });

  test("gerçekten boş liste (ev görünüyor) ready kabul edilir", async () => {
    const api = fakeApi({
      fetchProducts: vi.fn(async () => ({ products: [], dropped: 0 })),
    });
    const store = createProductStore(api, productCache);

    await store.init(USER);

    expect(store.getSnapshot().status).toBe("ready");
    expect(store.getSnapshot().error).toBeNull();
    expect(store.getSnapshot().products).toEqual([]);
  });
});
