import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useProducts } from "@/lib/storage";
import { SCHEMA_VERSION } from "@/lib/product-schema";
import type { Product } from "@/types/product";

const KEY = "bayatlamasavar.products";

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

function seed(products: unknown[]): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ version: SCHEMA_VERSION, products }),
  );
}

function stored(): { version: number; products: Product[] } {
  return JSON.parse(localStorage.getItem(KEY) as string);
}

describe("useProducts — okuma", () => {
  test("boş depoda boş liste verir", () => {
    const { result } = renderHook(() => useProducts());
    expect(result.current.products).toEqual([]);
  });

  test("depodaki ürünleri okur", () => {
    seed([milk, sauce]);
    const { result } = renderHook(() => useProducts());
    expect(result.current.products).toEqual([milk, sauce]);
  });

  test("bozuk kaydı listeye almaz, sağlamları korur", () => {
    seed([milk, { ...sauce, shelfLifeDays: "yedi" }]);
    const { result } = renderHook(() => useProducts());
    expect(result.current.products).toEqual([milk]);
  });

  test("sürümsüz eski biçimi okur", () => {
    localStorage.setItem(KEY, JSON.stringify([milk]));
    const { result } = renderHook(() => useProducts());
    expect(result.current.products).toEqual([milk]);
  });

  test("bozuk JSON'da çökmez", () => {
    localStorage.setItem(KEY, "{bozuk");
    const { result } = renderHook(() => useProducts());
    expect(result.current.products).toEqual([]);
  });

  test("her render'da aynı dizi referansını verir", () => {
    seed([milk]);
    const { result, rerender } = renderHook(() => useProducts());
    const first = result.current.products;
    rerender();
    expect(result.current.products).toBe(first);
  });
});

describe("useProducts — ekleme", () => {
  test("yeni ürünü listenin başına koyar", () => {
    seed([milk]);
    const { result } = renderHook(() => useProducts());

    act(() => result.current.addProduct(sauce));

    expect(result.current.products).toEqual([sauce, milk]);
  });

  test("depoya sürüm bilgisiyle yazar", () => {
    const { result } = renderHook(() => useProducts());

    act(() => result.current.addProduct(milk));

    expect(stored()).toEqual({
      version: SCHEMA_VERSION,
      products: [milk],
    });
  });
});

describe("useProducts — silme ve geri alma", () => {
  test("ürünü listeden ve depodan çıkarır", () => {
    seed([milk, sauce]);
    const { result } = renderHook(() => useProducts());

    act(() => {
      result.current.removeProduct("m1");
    });

    expect(result.current.products).toEqual([sauce]);
    expect(stored().products).toEqual([sauce]);
  });

  test("çıkarılan kaydı ve eski sırasını döner", () => {
    seed([milk, sauce]);
    const { result } = renderHook(() => useProducts());

    let removed: Product | null = null;
    let index = -1;
    act(() => {
      const outcome = result.current.removeProduct("s1");
      removed = outcome.removed;
      index = outcome.index;
    });

    expect(removed).toEqual(sauce);
    expect(index).toBe(1);
  });

  test("bulunmayan id'de depoyu değiştirmez", () => {
    seed([milk]);
    const { result } = renderHook(() => useProducts());

    act(() => {
      result.current.removeProduct("yok");
    });

    expect(result.current.products).toEqual([milk]);
  });

  test("geri alma ürünü eski sırasına koyar", () => {
    seed([milk, sauce]);
    const { result } = renderHook(() => useProducts());

    act(() => {
      result.current.removeProduct("m1");
    });
    expect(result.current.products).toEqual([sauce]);

    act(() => {
      result.current.restoreProduct(milk, 0);
    });
    expect(result.current.products).toEqual([milk, sauce]);
    expect(stored().products).toEqual([milk, sauce]);
  });
});
