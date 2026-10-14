"use client";

import { useEffect } from "react";
import { Undo2 } from "lucide-react";

const DISMISS_MS = 6000;

type Props = {
  productName: string;
  onUndo: () => void;
  onDismiss: () => void;
};

export default function UndoToast({ productName, onUndo, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
    >
      <p className="min-w-0 truncate text-sm text-slate-200">
        <span className="font-medium">{productName}</span> listeden kaldırıldı
      </p>
      <button
        type="button"
        onClick={onUndo}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-slate-600 active:scale-[0.98]"
      >
        <Undo2 size={15} />
        Geri al
      </button>
    </div>
  );
}
