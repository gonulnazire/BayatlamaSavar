import { describe, expect, test } from "vitest";
import {
  SCHEMA_VERSION,
  parseProduct,
  parseStoredProducts,
  serializeProducts,
} from "@/lib/product-schema";
import type { Product } from "@/types/product";

const valid: Product = {
  id: "a1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};

describe("parseProduct", () => {
  test("geçerli kaydı olduğu gibi kabul eder", () => {
    expect(parseProduct(valid)).toEqual(valid);
  });

  test("nesne olmayan girdiyi reddeder", () => {
    expect(parseProduct(null)).toBeNull();
    expect(parseProduct("süt")).toBeNull();
    expect(parseProduct(42)).toBeNull();
  });

  test("id'si olmayan kaydı reddeder", () => {
    expect(parseProduct({ ...valid, id: "" })).toBeNull();
    expect(parseProduct({ ...valid, id: undefined })).toBeNull();
  });

  test("adı boş olan kaydı reddeder", () => {
    expect(parseProduct({ ...valid, name: "   " })).toBeNull();
  });

  test("ürün adının baştaki/sondaki boşluğunu kırpar", () => {
    expect(parseProduct({ ...valid, name: "  Labne  " })?.name).toBe("Labne");
  });

  test("bilinmeyen kategoriyi Diğer'e çevirir", () => {
    expect(parseProduct({ ...valid, category: "Atıştırmalık" })?.category).toBe(
      "Diğer",
    );
  });

  test("geçersiz tarih biçimini reddeder", () => {
    expect(parseProduct({ ...valid, openedAt: "14/10/2026" })).toBeNull();
    expect(parseProduct({ ...valid, openedAt: "2026-10" })).toBeNull();
  });

  test("takvimde olmayan tarihi reddeder", () => {
    expect(parseProduct({ ...valid, openedAt: "2026-02-30" })).toBeNull();
    expect(parseProduct({ ...valid, openedAt: "2026-13-01" })).toBeNull();
  });

  test("artık yıl olmayan yılın 29 Şubat'ını reddeder", () => {
    expect(parseProduct({ ...valid, openedAt: "2026-02-29" })).toBeNull();
    expect(parseProduct({ ...valid, openedAt: "2028-02-29" })).not.toBeNull();
  });

  test("raf ömrü sayı değilse reddeder", () => {
    expect(parseProduct({ ...valid, shelfLifeDays: "üç" })).toBeNull();
    expect(parseProduct({ ...valid, shelfLifeDays: null })).toBeNull();
  });

  test("raf ömrü NaN ise reddeder", () => {
    // Asıl hata buradaydı: NaN kalan günü NaN yapar ve statusOf(NaN)
    // yanlışlıkla "safe" (yeşil) döndürür.
    expect(parseProduct({ ...valid, shelfLifeDays: NaN })).toBeNull();
    expect(parseProduct({ ...valid, shelfLifeDays: Infinity })).toBeNull();
  });

  test("negatif raf ömrünü reddeder", () => {
    expect(parseProduct({ ...valid, shelfLifeDays: -1 })).toBeNull();
  });

  test("ondalık raf ömrünü aşağı yuvarlar", () => {
    expect(parseProduct({ ...valid, shelfLifeDays: 3.7 })?.shelfLifeDays).toBe(
      3,
    );
  });

  test("fazladan alanları dışarıda bırakır", () => {
    const result = parseProduct({ ...valid, saldirgan: "<script>" });
    expect(result).toEqual(valid);
    expect(result).not.toHaveProperty("saldirgan");
  });
});

describe("parseStoredProducts", () => {
  test("boş depolamada boş dizi döner", () => {
    expect(parseStoredProducts(null)).toEqual([]);
    expect(parseStoredProducts("")).toEqual([]);
  });

  test("bozuk JSON'da boş dizi döner", () => {
    expect(parseStoredProducts("{bozuk")).toEqual([]);
  });

  test("sürümlü biçimi okur", () => {
    const raw = JSON.stringify({ version: SCHEMA_VERSION, products: [valid] });
    expect(parseStoredProducts(raw)).toEqual([valid]);
  });

  test("sürümsüz eski biçimi (düz dizi) okur", () => {
    expect(parseStoredProducts(JSON.stringify([valid]))).toEqual([valid]);
  });

  test("gelecekteki bilinmeyen sürümü yok sayar", () => {
    const raw = JSON.stringify({ version: 99, products: [valid] });
    expect(parseStoredProducts(raw)).toEqual([]);
  });

  test("bozuk kayıtları atıp geçerlileri korur", () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      products: [valid, { ...valid, id: "a2", shelfLifeDays: NaN }, null],
    });
    expect(parseStoredProducts(raw)).toEqual([valid]);
  });
});

describe("serializeProducts", () => {
  test("sürüm bilgisiyle birlikte yazar", () => {
    expect(JSON.parse(serializeProducts([valid]))).toEqual({
      version: SCHEMA_VERSION,
      products: [valid],
    });
  });

  test("yazdığını geri okuyabilir", () => {
    expect(parseStoredProducts(serializeProducts([valid]))).toEqual([valid]);
  });
});
