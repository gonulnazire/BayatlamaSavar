"use client";

import { useSyncExternalStore } from "react";
import { type StoreSnapshot } from "@/lib/product-store";
import { useStores } from "@/app/providers";

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
  const { products: store } = useStores();

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    getServerSnapshot,
  );

  return {
    ...snapshot,
    addProduct: store.addProduct,
    updateProduct: store.updateProduct,
    consumeProduct: store.consumeProduct,
    restoreProduct: store.restoreProduct,
    retry: store.retry,
    importLegacy: store.importLegacy,
  };
}
