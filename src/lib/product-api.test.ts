import { describe, expect, test } from "vitest";
import { toProduct, toRow } from "@/lib/product-api";
import type { Product } from "@/types/product";

const HOUSEHOLD = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";

const row = {
  id: "33333333-3333-3333-3333-333333333333",
  household_id: HOUSEHOLD,
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  opened_at: "2026-10-14",
  shelf_life_days: 3,
  created_by: USER,
  created_at: "2026-10-14T08:00:00.000Z",
  consumed_at: null,
};

const product: Product = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};

describe("toProduct", () => {
  test("satırı Product'a çevirir", () => {
    expect(toProduct(row)).toEqual(product);
  });

  test("household_id, created_by, created_at taşımaz", () => {
    const result = toProduct(row);
    expect(result).not.toHaveProperty("household_id");
    expect(result).not.toHaveProperty("created_by");
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("consumed_at");
  });

  test("geçersiz satırı reddeder", () => {
    expect(toProduct({ ...row, shelf_life_days: "üç" })).toBeNull();
    expect(toProduct({ ...row, opened_at: "2026-02-30" })).toBeNull();
    expect(toProduct(null)).toBeNull();
  });

  test("bilinmeyen kategoriyi Diğer'e düşürür", () => {
    expect(toProduct({ ...row, category: "Atıştırmalık" })?.category).toBe(
      "Diğer",
    );
  });

  test("opened_at'i YYYY-MM-DD metni olarak taşır", () => {
    expect(toProduct({ ...row, opened_at: "2026-01-05" })?.openedAt).toBe(
      "2026-01-05",
    );
  });
});

describe("toRow", () => {
  test("Product'ı satıra çevirir, household_id ve created_by ekler", () => {
    expect(toRow(product, HOUSEHOLD, USER)).toEqual({
      id: product.id,
      household_id: HOUSEHOLD,
      name: "Sütaş Süt",
      category: "Süt Ürünü",
      opened_at: "2026-10-14",
      shelf_life_days: 3,
      created_by: USER,
    });
  });

  test("opened_at'e saat veya saat dilimi eklemez", () => {
    // Review Focus 5: Date nesnesine çevrilip tekrar metne dönerse
    // cihazın saat diliminde gün kayar.
    expect(toRow(product, HOUSEHOLD, USER).opened_at).toBe("2026-10-14");
    expect(
      toRow({ ...product, openedAt: "2026-01-01" }, HOUSEHOLD, USER).opened_at,
    ).toBe("2026-01-01");
  });
});
