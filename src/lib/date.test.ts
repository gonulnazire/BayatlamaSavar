import { describe, expect, test } from "vitest";
import { daysLeft, formatDate, statusOf, todayISO } from "@/lib/date";

describe("daysLeft", () => {
  test("bugün açılan 3 günlük üründe 3 gün kalır", () => {
    expect(daysLeft("2026-10-14", 3, "2026-10-14")).toBe(3);
  });

  test("raf ömrü dolduğu gün 0 döner", () => {
    expect(daysLeft("2026-10-11", 3, "2026-10-14")).toBe(0);
  });

  test("süre aşıldığında negatif döner", () => {
    expect(daysLeft("2026-10-09", 3, "2026-10-14")).toBe(-2);
  });

  test("raf ömrü 0 olan ürün açıldığı gün tükenir", () => {
    expect(daysLeft("2026-10-14", 0, "2026-10-14")).toBe(0);
  });

  test("ay sınırını doğru geçer", () => {
    expect(daysLeft("2026-10-30", 5, "2026-11-02")).toBe(2);
  });

  test("yıl sınırını doğru geçer", () => {
    expect(daysLeft("2026-12-30", 5, "2027-01-02")).toBe(2);
  });

  test("artık yılın 29 Şubat'ını sayar", () => {
    expect(daysLeft("2028-02-28", 3, "2028-03-01")).toBe(1);
  });

  test("yaz saati geçişinde gün kaymaz", () => {
    // 29 Mart 2026: Avrupa'da yaz saatine geçiş. UTC'ye sabitlendiği için
    // sonuç tam gün olmalı, 0.96 güne yuvarlanma olmamalı.
    expect(daysLeft("2026-03-28", 2, "2026-03-29")).toBe(1);
  });
});

describe("statusOf", () => {
  test("3 gün ve üzeri güvenli", () => {
    expect(statusOf(3)).toBe("safe");
    expect(statusOf(10)).toBe("safe");
  });

  test("1-2 gün dikkat", () => {
    expect(statusOf(2)).toBe("warning");
    expect(statusOf(1)).toBe("warning");
  });

  test("0 ve altı süresi dolmuş", () => {
    expect(statusOf(0)).toBe("expired");
    expect(statusOf(-5)).toBe("expired");
  });
});

describe("todayISO", () => {
  test("YYYY-MM-DD biçiminde döner", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("yerel saate göre bugünü verir", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayISO()).toBe(expected);
  });
});

describe("formatDate", () => {
  test("tarihi Türkçe kısa biçimde yazar", () => {
    expect(formatDate("2026-10-14")).toBe("14 Eki 2026");
  });

  test("tek haneli günü sıfırsız yazar", () => {
    expect(formatDate("2026-01-05")).toBe("5 Oca 2026");
  });
});
