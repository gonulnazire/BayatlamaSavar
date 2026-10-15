import { describe, expect, test } from "vitest";
import {
  SCHEMA_VERSION,
  parseProduct,
  parseStoredProducts,
  serializeProducts,
} from "@/lib/product-schema";
import type { Product } from "@/types/product";

/** Her testte tekrar yazmamak için tam ve geçerli bir v2 kaydı */
const gecerli: Product = {
  id: "abc",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  quantity: 1,
  unit: "adet",
  expiresOn: "2026-10-20",
  storagePlace: "Buzdolabı",
  isOpened: false,
  openedAt: null,
  state: "active",
  createdAt: "2026-10-14",
};

const ile = (patch: Record<string, unknown>) => ({ ...gecerli, ...patch });

describe("parseProduct", () => {
  test("geçerli kaydı olduğu gibi kabul eder", () => {
    expect(parseProduct(gecerli)).toEqual(gecerli);
  });

  test("nesne olmayan girdiyi reddeder", () => {
    expect(parseProduct(null)).toBeNull();
    expect(parseProduct("süt")).toBeNull();
    expect(parseProduct(42)).toBeNull();
  });

  test("id'si olmayan kaydı reddeder", () => {
    expect(parseProduct(ile({ id: "" }))).toBeNull();
    expect(parseProduct(ile({ id: 7 }))).toBeNull();
  });

  test("adı boş olan kaydı reddeder", () => {
    expect(parseProduct(ile({ name: "   " }))).toBeNull();
  });

  test("ürün adının baştaki/sondaki boşluğunu kırpar", () => {
    expect(parseProduct(ile({ name: "  Süt  " }))?.name).toBe("Süt");
  });

  test("bilinmeyen kategoriyi Diğer'e çevirir", () => {
    expect(parseProduct(ile({ category: "Uzay Yemeği" }))?.category).toBe(
      "Diğer",
    );
  });

  // Son kullanma tarihi TEK güvenlik kritik alan: bozuksa kayıt reddedilir,
  // çünkü yanlış tarih ürünü olduğundan taze gösterebilir.
  test("geçersiz tarih biçimindeki son kullanma tarihini reddeder", () => {
    expect(parseProduct(ile({ expiresOn: "20/10/2026" }))).toBeNull();
  });

  test("takvimde olmayan son kullanma tarihini reddeder", () => {
    expect(parseProduct(ile({ expiresOn: "2026-02-30" }))).toBeNull();
  });

  test("artık yıl olmayan yılın 29 Şubat'ını reddeder", () => {
    expect(parseProduct(ile({ expiresOn: "2026-02-29" }))).toBeNull();
    expect(parseProduct(ile({ expiresOn: "2028-02-29" }))?.expiresOn).toBe(
      "2028-02-29",
    );
  });

  test("son kullanma tarihi olmayan kaydı reddeder", () => {
    expect(parseProduct({ ...gecerli, expiresOn: undefined })).toBeNull();
  });

  test("geçersiz miktarı 1'e düşürür", () => {
    expect(parseProduct(ile({ quantity: "çok" }))?.quantity).toBe(1);
    expect(parseProduct(ile({ quantity: 0 }))?.quantity).toBe(1);
    expect(parseProduct(ile({ quantity: -3 }))?.quantity).toBe(1);
  });

  test("ondalık miktarı korur", () => {
    expect(parseProduct(ile({ quantity: 0.5, unit: "kg" }))?.quantity).toBe(0.5);
  });

  test("bilinmeyen birimi adet'e düşürür", () => {
    expect(parseProduct(ile({ unit: "düzine" }))?.unit).toBe("adet");
  });

  test("bilinmeyen saklama yerini Buzdolabı'na düşürür", () => {
    expect(parseProduct(ile({ storagePlace: "garaj" }))?.storagePlace).toBe(
      "Buzdolabı",
    );
  });

  test("bilinmeyen durumu aktif sayar", () => {
    expect(parseProduct(ile({ state: "kayıp" }))?.state).toBe("active");
  });

  test("tüketildi ve çöpe gitti durumlarını korur", () => {
    expect(parseProduct(ile({ state: "consumed" }))?.state).toBe("consumed");
    expect(parseProduct(ile({ state: "discarded" }))?.state).toBe("discarded");
  });

  test("boolean olmayan açıldı bilgisini false sayar", () => {
    expect(parseProduct(ile({ isOpened: "evet" }))?.isOpened).toBe(false);
  });

  test("açılmamış üründe açılma tarihini null'lar", () => {
    const sonuc = parseProduct(ile({ isOpened: false, openedAt: "2026-10-14" }));
    expect(sonuc?.openedAt).toBeNull();
  });

  test("açılmış üründe geçerli açılma tarihini korur", () => {
    const sonuc = parseProduct(ile({ isOpened: true, openedAt: "2026-10-14" }));
    expect(sonuc?.openedAt).toBe("2026-10-14");
  });

  test("açılmış üründe geçersiz açılma tarihi null olur", () => {
    const sonuc = parseProduct(ile({ isOpened: true, openedAt: "dün" }));
    expect(sonuc?.openedAt).toBeNull();
  });

  test("geçersiz eklenme tarihi null olur", () => {
    expect(parseProduct(ile({ createdAt: "dün" }))?.createdAt).toBeNull();
  });

  test("fazladan alanları dışarıda bırakır", () => {
    const sonuc = parseProduct(ile({ fiyat: 42, admin: true }));
    expect(sonuc).toEqual(gecerli);
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

  test("güncel sürümü okur", () => {
    const raw = JSON.stringify({ version: SCHEMA_VERSION, products: [gecerli] });
    expect(parseStoredProducts(raw)).toEqual([gecerli]);
  });

  test("gelecekteki bilinmeyen sürümü yok sayar", () => {
    const raw = JSON.stringify({ version: 99, products: [gecerli] });
    expect(parseStoredProducts(raw)).toEqual([]);
  });

  test("bozuk kayıtları atıp geçerlileri korur", () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      products: [gecerli, { id: "x" }, ile({ id: "iki", name: "Peynir" })],
    });
    const sonuc = parseStoredProducts(raw);
    expect(sonuc.map((p) => p.name)).toEqual(["Sütaş Süt", "Peynir"]);
  });
});

// v1 modeli "açılış tarihi + raf ömrü" tutuyordu; v2 "son kullanma tarihi".
// Göç ikisini toplar, çünkü eski veride son kullanma tarihi HİÇ yoktu.
describe("v1 -> v2 göçü", () => {
  const v1 = {
    id: "eski",
    name: "Açılmış Süt",
    category: "Süt Ürünü",
    openedAt: "2026-10-10",
    shelfLifeDays: 5,
  };

  const v1Raw = JSON.stringify({ version: 1, products: [v1] });

  test("açılış tarihi + raf ömrü son kullanma tarihine dönüşür", () => {
    expect(parseStoredProducts(v1Raw)[0].expiresOn).toBe("2026-10-15");
  });

  test("eski kayıtlar açılmış sayılır ve açılma tarihi korunur", () => {
    const [urun] = parseStoredProducts(v1Raw);
    expect(urun.isOpened).toBe(true);
    expect(urun.openedAt).toBe("2026-10-10");
  });

  test("yeni alanlar makul varsayılanlarla dolar", () => {
    const [urun] = parseStoredProducts(v1Raw);
    expect(urun.quantity).toBe(1);
    expect(urun.unit).toBe("adet");
    expect(urun.storagePlace).toBe("Buzdolabı");
    expect(urun.state).toBe("active");
  });

  test("eklenme tarihi bilinmediği için null kalır", () => {
    expect(parseStoredProducts(v1Raw)[0].createdAt).toBeNull();
  });

  test("Et/Şarküteri kategorisi Et'e eşlenir", () => {
    const raw = JSON.stringify({
      version: 1,
      products: [{ ...v1, category: "Et/Şarküteri" }],
    });
    expect(parseStoredProducts(raw)[0].category).toBe("Et");
  });

  test("Sos/Konserve kategorisi Diğer'e eşlenir", () => {
    const raw = JSON.stringify({
      version: 1,
      products: [{ ...v1, category: "Sos/Konserve" }],
    });
    expect(parseStoredProducts(raw)[0].category).toBe("Diğer");
  });

  test("sürümsüz düz dizi de v1 sayılıp göç eder", () => {
    const raw = JSON.stringify([v1]);
    expect(parseStoredProducts(raw)[0].expiresOn).toBe("2026-10-15");
  });

  test("raf ömrü geçersiz olan v1 kaydı atılır", () => {
    const raw = JSON.stringify({
      version: 1,
      products: [{ ...v1, shelfLifeDays: -1 }],
    });
    expect(parseStoredProducts(raw)).toEqual([]);
  });
});

describe("serializeProducts", () => {
  test("sürüm bilgisiyle birlikte yazar", () => {
    const yazilan = JSON.parse(serializeProducts([gecerli]));
    expect(yazilan.version).toBe(SCHEMA_VERSION);
    expect(yazilan.products).toHaveLength(1);
  });

  test("yazdığını geri okuyabilir", () => {
    expect(parseStoredProducts(serializeProducts([gecerli]))).toEqual([gecerli]);
  });
});
