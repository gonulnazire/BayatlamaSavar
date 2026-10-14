import { describe, expect, test } from "vitest";
import { countByStatus, filterProducts } from "@/lib/product-filter";
import type { Product } from "@/types/product";

const TODAY = "2026-10-14";

// TODAY'e göre: milk 3 gün (safe), sauce 1 gün (warning), ham -1 gün (expired)
const milk: Product = {
  id: "m",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};
const sauce: Product = {
  id: "s",
  name: "Tat Salça",
  category: "Sos/Konserve",
  openedAt: "2026-10-08",
  shelfLifeDays: 7,
};
const ham: Product = {
  id: "h",
  name: "Ilık Jambon",
  category: "Et/Şarküteri",
  openedAt: "2026-10-10",
  shelfLifeDays: 3,
};

const all = [milk, sauce, ham];

describe("filterProducts — arama", () => {
  test("boş sorguda hepsini döner", () => {
    expect(filterProducts(all, { query: "", status: "all" }, TODAY)).toEqual(
      all,
    );
  });

  test("ürün adında geçeni bulur", () => {
    expect(
      filterProducts(all, { query: "salça", status: "all" }, TODAY),
    ).toEqual([sauce]);
  });

  test("büyük/küçük harfe duyarsızdır", () => {
    expect(
      filterProducts(all, { query: "SÜTAŞ", status: "all" }, TODAY),
    ).toEqual([milk]);
  });

  test("Türkçe I/ı harfinde doğru eşleşir", () => {
    expect(
      filterProducts(all, { query: "ILIK", status: "all" }, TODAY),
    ).toEqual([ham]);
    expect(
      filterProducts(all, { query: "ılık", status: "all" }, TODAY),
    ).toEqual([ham]);
  });

  test("sorgunun baştaki/sondaki boşluğunu yok sayar", () => {
    expect(
      filterProducts(all, { query: "   süt  ", status: "all" }, TODAY),
    ).toEqual([milk]);
  });

  test("kategoride geçeni de bulur", () => {
    expect(
      filterProducts(all, { query: "şarküteri", status: "all" }, TODAY),
    ).toEqual([ham]);
  });

  test("eşleşme yoksa boş döner", () => {
    expect(filterProducts(all, { query: "zeytin", status: "all" }, TODAY)).toEqual(
      [],
    );
  });
});

describe("filterProducts — durum", () => {
  test("yalnızca güvenli olanları döner", () => {
    expect(filterProducts(all, { query: "", status: "safe" }, TODAY)).toEqual([
      milk,
    ]);
  });

  test("yalnızca dikkat edilecekleri döner", () => {
    expect(
      filterProducts(all, { query: "", status: "warning" }, TODAY),
    ).toEqual([sauce]);
  });

  test("yalnızca süresi dolanları döner", () => {
    expect(
      filterProducts(all, { query: "", status: "expired" }, TODAY),
    ).toEqual([ham]);
  });

  test("arama ve durumu birlikte uygular", () => {
    expect(
      filterProducts(all, { query: "süt", status: "expired" }, TODAY),
    ).toEqual([]);
    expect(
      filterProducts(all, { query: "süt", status: "safe" }, TODAY),
    ).toEqual([milk]);
  });

  test("özgün listeyi değiştirmez", () => {
    filterProducts(all, { query: "süt", status: "safe" }, TODAY);
    expect(all).toEqual([milk, sauce, ham]);
  });
});

describe("countByStatus", () => {
  test("her durumu ve toplamı sayar", () => {
    expect(countByStatus(all, TODAY)).toEqual({
      all: 3,
      safe: 1,
      warning: 1,
      expired: 1,
    });
  });

  test("boş listede hepsi sıfırdır", () => {
    expect(countByStatus([], TODAY)).toEqual({
      all: 0,
      safe: 0,
      warning: 0,
      expired: 0,
    });
  });
});
