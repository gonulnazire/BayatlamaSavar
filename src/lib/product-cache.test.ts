import { afterEach, describe, expect, test, vi } from "vitest";
import { productCache } from "@/lib/product-cache";
import { SCHEMA_VERSION } from "@/lib/product-schema";
import type { Product } from "@/types/product";

const CACHE_KEY = "bayatlamasavar.cache.v2";
const LEGACY_KEY = "bayatlamasavar.products";

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

function wrap(products: unknown[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, products });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("productCache", () => {
  test("yazdığını geri okur", () => {
    expect(productCache.write([milk, sauce])).toBe(true);
    expect(productCache.read()).toEqual([milk, sauce]);
  });

  test("boş depoda boş dizi döner", () => {
    expect(productCache.read()).toEqual([]);
  });

  test("bozuk JSON'da çökmez, boş dizi döner", () => {
    localStorage.setItem(CACHE_KEY, "{bozuk");
    expect(productCache.read()).toEqual([]);
  });

  test("bozuk kaydı atar, sağlamı korur", () => {
    localStorage.setItem(
      CACHE_KEY,
      wrap([milk, { ...sauce, shelfLifeDays: "yedi" }]),
    );
    expect(productCache.read()).toEqual([milk]);
  });

  test("clear önbelleği siler, eski veriye dokunmaz", () => {
    productCache.write([milk]);
    localStorage.setItem(LEGACY_KEY, wrap([sauce]));

    productCache.clear();

    expect(productCache.read()).toEqual([]);
    expect(productCache.readLegacy()).toEqual([sauce]);
  });

  test("readLegacy eski anahtarı okur, önbellek anahtarını okumaz", () => {
    productCache.write([milk]);
    localStorage.setItem(LEGACY_KEY, wrap([sauce]));

    expect(productCache.readLegacy()).toEqual([sauce]);
    expect(productCache.read()).toEqual([milk]);
  });

  test("hasLegacy eski anahtar yokken false döner", () => {
    productCache.write([milk]);
    expect(productCache.hasLegacy()).toBe(false);

    localStorage.setItem(LEGACY_KEY, wrap([sauce]));
    expect(productCache.hasLegacy()).toBe(true);
  });

  test("clearLegacy eski anahtarı siler, önbelleği değiştirmez", () => {
    productCache.write([milk]);
    localStorage.setItem(LEGACY_KEY, wrap([sauce]));

    productCache.clearLegacy();

    expect(productCache.hasLegacy()).toBe(false);
    expect(productCache.read()).toEqual([milk]);
  });

  test("localStorage yazamıyorsa write false döner ve fırlatmaz", () => {
    // Review Focus 3: gizli sekme veya dolu kota
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    expect(() => productCache.write([milk])).not.toThrow();
    expect(productCache.write([milk])).toBe(false);
  });
});
