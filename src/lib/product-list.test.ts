import { describe, expect, test } from "vitest";
import { replaceById } from "@/lib/product-list";
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
