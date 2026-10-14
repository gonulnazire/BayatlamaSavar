"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Product } from "@/types/product";
import { parseStoredProducts, serializeProducts } from "@/lib/product-schema";

const STORAGE_KEY = "bayatlamasavar.products";
const EMPTY: Product[] = [];

// useSyncExternalStore her render'da aynı referansı görmeli; ham metni önbellekleriz
let cachedRaw: string | null = null;
let cachedValue: Product[] = EMPTY;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Diğer sekmelerdeki değişiklikleri de yakala
  window.addEventListener("storage", emit);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", emit);
  };
}

function getSnapshot(): Product[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStoredProducts(raw);
  }
  return cachedValue;
}

function getServerSnapshot(): Product[] {
  return EMPTY;
}

function write(next: Product[]): void {
  const raw = serializeProducts(next);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Depolama kullanılamıyorsa (gizli sekme, dolu kota) sessizce geç
  }
  cachedRaw = raw;
  // Doğrulamadan geçirerek yazarız: ekranda görünen ile depoda duran
  // ve yeniden okunduğunda elde edilecek veri birebir aynı olsun.
  cachedValue = parseStoredProducts(raw);
  emit();
}

export function useProducts() {
  const products = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const addProduct = useCallback((product: Product) => {
    write([product, ...getSnapshot()]);
  }, []);

  const removeProduct = useCallback((id: string) => {
    write(getSnapshot().filter((p) => p.id !== id));
  }, []);

  return { products, addProduct, removeProduct };
}
