"use client";

import { useSyncExternalStore } from "react";
import { productStore, type StoreSnapshot } from "@/lib/product-store";

/** Prerender'da localStorage ve oturum yok; sabit bir boş durum döner */
const SERVER_SNAPSHOT: StoreSnapshot = {
  products: [],
  status: "loading",
  saving: false,
  error: null,
  dropped: 0,
  cacheWritable: true,
  lastSyncedAt: null,
  legacyCount: 0,
};

function getServerSnapshot(): StoreSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Store'u React'e bağlar. Eylemler store'dan geldiği için referansları
 * zaten kararlı; `useCallback` gerekmez.
 */
export function useProducts() {
  const snapshot = useSyncExternalStore(
    productStore.subscribe,
    productStore.getSnapshot,
    getServerSnapshot,
  );

  return {
    ...snapshot,
    addProduct: productStore.addProduct,
    updateProduct: productStore.updateProduct,
    consumeProduct: productStore.consumeProduct,
    restoreProduct: productStore.restoreProduct,
    retry: productStore.retry,
  };
}
