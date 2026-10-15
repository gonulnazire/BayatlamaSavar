"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  /** ReactNode: çağıran mesajın bir parçasını vurgulayabilir */
  message: ReactNode;
  actionLabel: string;
  onAction(): void;
  /** Verilmezse bildirim kendiliğinden kapanmaz */
  autoDismissMs?: number;
  onDismiss?(): void;
};

export default function Toast({
  message,
  actionLabel,
  onAction,
  autoDismissMs,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (autoDismissMs === undefined || !onDismiss) return;
    // Geri çağrıda setState değil, doğrudan onDismiss çağrılır
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
    >
      <p className="min-w-0 text-sm text-slate-200">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-slate-600 active:scale-[0.98]"
      >
        {actionLabel}
      </button>
    </div>
  );
}
