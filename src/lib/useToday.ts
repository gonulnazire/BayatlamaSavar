"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "./date";

/**
 * Bugünün tarihi — yalnızca istemcide. Sunucu/prerender anlık saati
 * hesaplayamayacağı için orada boş string döner; bu aynı zamanda
 * "istemcide hazırız" sinyali olarak kullanılır.
 */
function subscribe(onChange: () => void): () => void {
  // Dakikada bir yoklarız; tarih metni değişmediği sürece React yeniden
  // render etmez, gece yarısı geçilince kalan günler kendiliğinden tazelenir.
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, todayISO, () => "");
}
