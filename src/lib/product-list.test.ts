import { describe, expect, test } from "vitest";
import { insertAt, removeById, replaceById } from "@/lib/product-list";
import type { Product } from "@/types/product";

function make(id: string, name = id): Product {
  return {
    id,
    name,
    category: "Diğer",
    openedAt: "2026-10-14",
    shelfLifeDays: 3,
  };
}

const a = make("a");
const b = make("b");
const c = make("c");

describe("removeById", () => {
  test("kaydı çıkarır ve hangi sırada olduğunu bildirir", () => {
    const result = removeById([a, b, c], "b");
    expect(result.list).toEqual([a, c]);
    expect(result.removed).toEqual(b);
    expect(result.index).toBe(1);
  });

  test("ilk kaydı çıkarırken sırayı 0 bildirir", () => {
    expect(removeById([a, b], "a").index).toBe(0);
  });

  test("bulunmayan id'de listeyi olduğu gibi döner", () => {
    const result = removeById([a, b], "yok");
    expect(result.list).toEqual([a, b]);
    expect(result.removed).toBeNull();
    expect(result.index).toBe(-1);
  });

  test("özgün listeyi değiştirmez", () => {
    const original = [a, b, c];
    removeById(original, "b");
    expect(original).toEqual([a, b, c]);
  });
});

describe("insertAt", () => {
  test("kaydı eski sırasına geri koyar", () => {
    expect(insertAt([a, c], b, 1)).toEqual([a, b, c]);
  });

  test("başa geri koyar", () => {
    expect(insertAt([b, c], a, 0)).toEqual([a, b, c]);
  });

  test("sona geri koyar", () => {
    expect(insertAt([a, b], c, 2)).toEqual([a, b, c]);
  });

  test("liste kısaldıysa sona ekler", () => {
    expect(insertAt([a], c, 5)).toEqual([a, c]);
  });

  test("negatif sırayı başa çevirir", () => {
    expect(insertAt([b], a, -3)).toEqual([a, b]);
  });

  test("özgün listeyi değiştirmez", () => {
    const original = [a, c];
    insertAt(original, b, 1);
    expect(original).toEqual([a, c]);
  });
});

describe("replaceById", () => {
  test("kaydı aynı sırada günceller", () => {
    const updated = { ...b, name: "Yeni Ad" };
    expect(replaceById([a, b, c], updated)).toEqual([a, updated, c]);
  });

  test("ilk kaydı günceller", () => {
    const updated = { ...a, shelfLifeDays: 10 };
    expect(replaceById([a, b], updated)).toEqual([updated, b]);
  });

  test("bulunmayan id'de listeyi değiştirmez", () => {
    expect(replaceById([a, b], make("yok"))).toEqual([a, b]);
  });

  test("özgün listeyi değiştirmez", () => {
    const original = [a, b];
    replaceById(original, { ...b, name: "Yeni Ad" });
    expect(original).toEqual([a, b]);
  });
});
