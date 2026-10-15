"use client";

import { CloudOff, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import type { StoreStatus } from "@/lib/product-store";

type Props = {
  status: StoreStatus;
  lastSyncedAt: string | null;
  dropped: number;
  cacheWritable: boolean;
  onRetry(): void;
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ConnectionBanner({
  status,
  lastSyncedAt,
  dropped,
  cacheWritable,
  onRetry,
}: Props) {
  const isOffline = status === "offline";
  const isLoading = status === "loading";
  const hasDropped = dropped > 0;
  const cacheBroken = !cacheWritable;

  if (!isOffline && !isLoading && !hasDropped && !cacheBroken) return null;

  const rowClass =
    "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1";

  return (
    <div className="flex flex-col gap-2">
      {isOffline ? (
        <div
          className={`${rowClass} bg-amber-500/10 text-amber-300 ring-amber-500/30`}
        >
          <CloudOff size={15} className="shrink-0" />
          <span>
            Çevrimdışı
            {lastSyncedAt ? ` — son güncelleme ${formatTime(lastSyncedAt)}` : ""}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25"
          >
            <RotateCcw size={13} />
            Tekrar dene
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div
          className={`${rowClass} bg-slate-800/60 text-slate-400 ring-slate-700`}
        >
          <Loader2 size={15} className="shrink-0 animate-spin" />
          <span>Güncelleniyor…</span>
        </div>
      ) : null}

      {hasDropped ? (
        <div
          className={`${rowClass} bg-red-500/10 text-red-300 ring-red-500/30`}
        >
          <TriangleAlert size={15} className="shrink-0" />
          <span>{dropped} kayıt okunamadı ve listeye alınmadı.</span>
        </div>
      ) : null}

      {cacheBroken ? (
        <div
          className={`${rowClass} bg-amber-500/10 text-amber-300 ring-amber-500/30`}
        >
          <TriangleAlert size={15} className="shrink-0" />
          <span>
            Tarayıcı depolaması kullanılamıyor; uygulama çevrimdışıyken listeni
            gösteremeyebilir.
          </span>
        </div>
      ) : null}
    </div>
  );
}
