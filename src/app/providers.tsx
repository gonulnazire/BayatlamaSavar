"use client";

import { createContext, useContext, type ReactNode } from "react";
import { productStore, type ProductStore } from "@/lib/product-store";
import { sessionStore, type SessionStore } from "@/lib/useSession";

export type Stores = {
  products: ProductStore;
  session: SessionStore;
};

/**
 * Varsayılan store'lar TEMBEL kurulur.
 *
 * Bu modül ile `useSession.ts` döngüsel olarak birbirini içe aktarıyor
 * (burası `sessionStore`'u, orası `useStores`'u istiyor). Modül gövdesinde
 * sabit bir nesne kurulsa, yükleme sırası ters olduğunda `sessionStore`
 * henüz tanımsız olur ve sessizce `undefined` yakalanırdı. İlk çağrıda
 * kurup saklamak hem bunu önler hem referansı kararlı tutar.
 */
let defaults: Stores | null = null;

function getDefaults(): Stores {
  defaults ??= { products: productStore, session: sessionStore };
  return defaults;
}

const StoresContext = createContext<Stores | null>(null);

/**
 * Store'ları değiştirilebilir kılar. Üretimde sağlayıcı kullanılmaz ve
 * singleton'lara düşülür; testler sahte store enjekte eder.
 */
export function StoresProvider({
  value,
  children,
}: {
  value: Stores;
  children: ReactNode;
}) {
  return (
    <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
  );
}

export function useStores(): Stores {
  return useContext(StoresContext) ?? getDefaults();
}
