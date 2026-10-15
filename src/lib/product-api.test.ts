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
  quantity: 1,
  unit: "adet",
  expires_on: "2026-10-20",
  storage_place: "Buzdolabı",
  is_opened: true,
  opened_at: "2026-10-14",
  state: "active",
  state_changed_at: null,
  created_by: USER,
  created_at: "2026-10-14T12:00:00.000Z",
};

const product: Product = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  quantity: 1,
  unit: "adet",
  expiresOn: "2026-10-20",
  storagePlace: "Buzdolabı",
  isOpened: true,
  openedAt: "2026-10-14",
  state: "active",
  createdAt: "2026-10-14",
};

describe("toProduct", () => {
  test("satırı Product'a çevirir", () => {
    expect(toProduct(row)).toEqual(product);
  });

  test("sunucuya özel alanları taşımaz", () => {
    const result = toProduct(row);
    expect(result).not.toHaveProperty("household_id");
    expect(result).not.toHaveProperty("created_by");
    expect(result).not.toHaveProperty("state_changed_at");
  });

  test("created_at damgasından yalnızca tarihi alır", () => {
    expect(toProduct(row)?.createdAt).toBe("2026-10-14");
  });

  test("created_at yoksa eklenme tarihi null olur", () => {
    expect(toProduct({ ...row, created_at: null })?.createdAt).toBeNull();
  });

  test("geçersiz satırı reddeder", () => {
    expect(toProduct({ ...row, expires_on: "2026-02-30" })).toBeNull();
    expect(toProduct({ ...row, expires_on: null })).toBeNull();
    expect(toProduct(null)).toBeNull();
  });

  test("bilinmeyen kategoriyi Diğer'e düşürür", () => {
    expect(toProduct({ ...row, category: "Atıştırmalık" })?.category).toBe(
      "Diğer",
    );
  });

  test("expires_on'u YYYY-MM-DD metni olarak taşır", () => {
    expect(toProduct({ ...row, expires_on: "2026-01-05" })?.expiresOn).toBe(
      "2026-01-05",
    );
  });

  test("tüketilmiş satırın durumunu korur", () => {
    expect(toProduct({ ...row, state: "consumed" })?.state).toBe("consumed");
    expect(toProduct({ ...row, state: "discarded" })?.state).toBe("discarded");
  });
});

describe("toRow", () => {
  test("Product'ı satıra çevirir, household_id ve created_by ekler", () => {
    expect(toRow(product, HOUSEHOLD, USER)).toEqual({
      id: product.id,
      household_id: HOUSEHOLD,
      name: "Sütaş Süt",
      category: "Süt Ürünü",
      quantity: 1,
      unit: "adet",
      expires_on: "2026-10-20",
      storage_place: "Buzdolabı",
      is_opened: true,
      opened_at: "2026-10-14",
      state: "active",
      created_by: USER,
    });
  });

  test("tarihlere saat veya saat dilimi eklemez", () => {
    // Date nesnesine çevrilip tekrar metne dönerse cihazın saat diliminde
    // gün kayar; bu yüzden tarihler uçtan uca metin olarak taşınır.
    const satir = toRow(
      { ...product, expiresOn: "2026-01-01", openedAt: "2025-12-31" },
      HOUSEHOLD,
      USER,
    );
    expect(satir.expires_on).toBe("2026-01-01");
    expect(satir.opened_at).toBe("2025-12-31");
  });

  test("açılmamış üründe opened_at null gider", () => {
    const satir = toRow(
      { ...product, isOpened: false, openedAt: null },
      HOUSEHOLD,
      USER,
    );
    expect(satir.is_opened).toBe(false);
    expect(satir.opened_at).toBeNull();
  });
});
