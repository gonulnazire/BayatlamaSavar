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

const DAY_MS = 86_400_000;

/** Kalan Gün = (Açılış Tarihi + Raf Ömrü) - Bugün */
export function daysLeft(
  openedAt: string,
  shelfLifeDays: number,
  today: string = todayISO(),
): number {
  const expiry = toUTCDay(openedAt) + shelfLifeDays * DAY_MS;
  return Math.round((expiry - toUTCDay(today)) / DAY_MS);
}

export type Status = "safe" | "warning" | "expired";

export function statusOf(days: number): Status {
  if (days <= 0) return "expired";
  if (days <= 2) return "warning";
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
