"use client";

import { Trash2, CalendarDays, Pencil } from "lucide-react";
import type { Product } from "@/types/product";
import { daysLeft, formatDate, statusOf, type Status } from "@/lib/date";

type Props = {
  product: Product;
  /** Bugünün tarihi, YYYY-MM-DD */
  today: string;
  onEdit: (id: string) => void;
  onConsume: (id: string) => void;
  /** Yazma uçuştayken düğmeler kilitlenir */
  disabled?: boolean;
};

const STATUS_STYLES: Record<
  Status,
  { card: string; badge: string; label: string }
> = {
  safe: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    label: "Güvenli",
  },
  warning: {
    card: "border-amber-500/40 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    label: "Dikkat",
  },
  expired: {
    card: "border-red-500/50 bg-red-500/10",
    badge: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    label: "Süresi Doldu",
  },
};

function remainingText(days: number): string {
  if (days > 0) return `${days} gün kaldı`;
  if (days === 0) return "Son gün";
  return `${Math.abs(days)} gün geçti`;
}

export default function ProductCard({
  product,
  today,
  onEdit,
  onConsume,
  disabled = false,
}: Props) {
  const days = daysLeft(product.openedAt, product.shelfLifeDays, today);
  const status = statusOf(days);
  const styles = STATUS_STYLES[status];

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-100">
            {product.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">{product.category}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles.badge}`}
        >
          {styles.label}
        </span>
      </div>

      <p className="text-2xl font-bold text-slate-100">
        {remainingText(days)}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <CalendarDays size={14} />
        <span>
          {formatDate(product.openedAt)} tarihinde açıldı ·{" "}
          {product.shelfLifeDays} günlük
        </span>
      </div>

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(product.id)}
          disabled={disabled}
          aria-label={`${product.name} ürününü düzenle`}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil size={15} />
          Düzenle
        </button>

        <button
          type="button"
          onClick={() => onConsume(product.id)}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={15} />
          Tükettim / Sil
        </button>
      </div>
    </article>
  );
}
