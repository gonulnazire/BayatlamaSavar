"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error("BayatlamaSavar hata sınırı:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
        <TriangleAlert size={24} />
      </span>

      <div>
        <h1 className="text-xl font-bold text-slate-50">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-sm text-slate-400">
          Ürün listesi yüklenirken beklenmeyen bir hata oluştu. Kayıtlı
          ürünlerin tarayıcında duruyor, silinmedi.
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
      >
        <RotateCcw size={16} />
        Tekrar dene
      </button>

      {error.digest ? (
        <p className="text-xs text-slate-600">Hata kodu: {error.digest}</p>
      ) : null}
    </main>
  );
}
