"use client";

import { Download, Loader2 } from "lucide-react";

type Props = {
  count: number;
  busy: boolean;
  onImport(): void;
};

export default function ImportPrompt({ count, busy, onImport }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-500/30">
      <Download size={15} className="shrink-0" />
      <span>
        Tarayıcında <span className="font-semibold">{count} ürün</span> var.
        Hesabına aktarmak ister misin?
      </span>
      <button
        type="button"
        onClick={onImport}
        disabled={busy}
        className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} />
        )}
        Aktar
      </button>
    </div>
  );
}
