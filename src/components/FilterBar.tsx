"use client";

import { Search, X } from "lucide-react";
import {
  STATUS_FILTERS,
  STATUS_FILTER_LABELS,
  type StatusFilter,
} from "@/lib/product-filter";

const ACTIVE_STYLES: Record<StatusFilter, string> = {
  all: "bg-slate-700 text-slate-100 ring-slate-500",
  safe: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40",
  warning: "bg-amber-500/20 text-amber-300 ring-amber-500/40",
  expired: "bg-red-500/20 text-red-300 ring-red-500/40",
};

type Props = {
  query: string;
  status: StatusFilter;
  counts: Record<StatusFilter, number>;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: StatusFilter) => void;
};

export default function FilterBar({
  query,
  status,
  counts,
  onQueryChange,
  onStatusChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ürün veya kategori ara"
          aria-label="Ürün ara"
          className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-2 pr-10 pl-9 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Aramayı temizle"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/*
        Sayı ayrı bir span olduğu için erişilebilir ad "Tümü5" diye
        okunuyordu; her düğmeye açık aria-label verilerek doğal cümleye
        çevrildi ve görsel metin aria-hidden yapıldı.
      */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => {
          const isActive = option === status;
          const label = STATUS_FILTER_LABELS[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => onStatusChange(option)}
              aria-pressed={isActive}
              aria-label={`${label}, ${counts[option]} ürün`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                isActive
                  ? ACTIVE_STYLES[option]
                  : "bg-slate-900/60 text-slate-400 ring-slate-800 hover:text-slate-200"
              }`}
            >
              <span aria-hidden="true">{label}</span>
              <span aria-hidden="true" className="ml-1.5 text-slate-500">
                {counts[option]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
