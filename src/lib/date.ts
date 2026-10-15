/** Bugünün tarihi, YYYY-MM-DD (yerel saat) */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Gün kaymalarını (yaz saati vb.) önlemek için UTC gece yarısına sabitler */
function toUTCDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTCDay(ms: number): string {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_MS = 86_400_000;

/**
 * Son kullanma tarihine kalan gün sayısı.
 * Negatif = tarih geçmiş, 0 = bugün son gün.
 */
export function daysUntil(expiresOn: string, today: string = todayISO()): number {
  return Math.round((toUTCDay(expiresOn) - toUTCDay(today)) / DAY_MS);
}

/**
 * Bir tarihe gün ekler (negatif değerle çıkarır), YYYY-MM-DD döner.
 * Raf ömrü önerisinden son kullanma tarihi üretmek için kullanılır.
 */
export function addDays(iso: string, days: number): string {
  return fromUTCDay(toUTCDay(iso) + days * DAY_MS);
}

export type Status = "safe" | "warning" | "expired";

/**
 * Renk eşikleri TEK YER burasıdır; `product-filter` de buradan okur.
 * 3 gün dahil dikkat eşiğindedir — "üç gün kaldı" uyarılmayı hak eder.
 */
export function statusOf(days: number): Status {
  if (days <= 0) return "expired";
  if (days <= 3) return "warning";
  return "safe";
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}
