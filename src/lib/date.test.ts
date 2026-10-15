import { describe, expect, test } from "vitest";
import { addDays, daysUntil, formatDate, statusOf, todayISO } from "@/lib/date";

describe("daysUntil", () => {
  test("son kullanma tarihi bugün olan üründe 0 döner", () => {
    expect(daysUntil("2026-10-14", "2026-10-14")).toBe(0);
  });

  test("yarın bitiyorsa 1 döner", () => {
    expect(daysUntil("2026-10-15", "2026-10-14")).toBe(1);
  });

  test("tarih geçmişse negatif döner", () => {
    expect(daysUntil("2026-10-12", "2026-10-14")).toBe(-2);
  });

  test("ay sınırını doğru geçer", () => {
    expect(daysUntil("2026-11-04", "2026-11-02")).toBe(2);
  });

  test("yıl sınırını doğru geçer", () => {
    expect(daysUntil("2027-01-04", "2026-12-30")).toBe(5);
  });

  test("artık yılın 29 Şubat'ını sayar", () => {
    expect(daysUntil("2028-03-02", "2028-02-28")).toBe(3);
  });

  test("yaz saati geçişinde gün kaymaz", () => {
    // 29 Mart 2026: Avrupa'da yaz saatine geçiş. UTC'ye sabitlendiği için
    // sonuç tam gün olmalı, 0.96 güne yuvarlanma olmamalı.
    expect(daysUntil("2026-03-30", "2026-03-29")).toBe(1);
  });
});

describe("statusOf", () => {
  test("3 günden fazlası güvenli", () => {
    expect(statusOf(4)).toBe("safe");
    expect(statusOf(10)).toBe("safe");
  });

  test("tam 3 gün dikkat eşiğine girer", () => {
    expect(statusOf(3)).toBe("warning");
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

describe("addDays", () => {
  test("gün ekler", () => {
    expect(addDays("2026-10-14", 3)).toBe("2026-10-17");
  });

  test("sıfır gün aynı tarihi döner", () => {
    expect(addDays("2026-10-14", 0)).toBe("2026-10-14");
  });

  test("ay sınırını aşar", () => {
    expect(addDays("2026-10-30", 5)).toBe("2026-11-04");
  });

  test("yıl sınırını aşar", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  test("artık yılda 29 Şubat'ı atlamaz", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  test("negatif gün geriye gider", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
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
