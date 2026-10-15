"use client";

import { useSyncExternalStore } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { productStore } from "@/lib/product-store";
import { useStores } from "@/app/providers";

export type SessionState =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "signedIn"; userId: string; email: string };

type SessionUser = { id: string; email?: string | null };
type SessionLike = { user: SessionUser } | null;

/** Testlerde sahtelenebilmesi için Supabase auth'un ihtiyaç duyulan yüzü */
export type SupabaseAuthLike = {
  getSession(): Promise<{ data: { session: SessionLike } }>;
  onAuthStateChange(
    handler: (event: string, session: SessionLike) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
};

export type SessionStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): SessionState;
};

const UNKNOWN: SessionState = { status: "unknown" };
const SIGNED_OUT: SessionState = { status: "signedOut" };

function toState(session: SessionLike): SessionState {
  if (!session) return SIGNED_OUT;
  return {
    status: "signedIn",
    userId: session.user.id,
    email: session.user.email ?? "",
  };
}

export function createSessionStore(
  auth: SupabaseAuthLike,
  /** Oturum herhangi bir sebeple sona erdiğinde çağrılır (yalnızca düğme değil) */
  onSignedOut?: () => void,
): SessionStore {
  let snapshot: SessionState = UNKNOWN;
  const listeners = new Set<() => void>();
  let subscription: { unsubscribe(): void } | null = null;

  function set(next: SessionState): void {
    const wasSignedIn = snapshot.status === "signedIn";
    snapshot = next;
    if (wasSignedIn && next.status === "signedOut") onSignedOut?.();
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);

      // İlk aboneyle başlat: oturumu oku ve auth olaylarını dinle
      if (listeners.size === 1) {
        // .catch şart: reddedilirse (auth-js kilit zaman aşımı, engellenmiş
        // depolama) durum UNKNOWN kalır ve kullanıcı sonsuza kadar iskelet
        // görür — giriş ekranına hiç yol yoktur.
        void auth
          .getSession()
          .then(({ data }) => set(toState(data.session)))
          .catch((error) => {
            console.error("BayatlamaSavar oturum okunamadı:", error);
            set(SIGNED_OUT);
          });
        subscription = auth.onAuthStateChange((_event, session) => {
          set(toState(session));
        }).data.subscription;
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          subscription?.unsubscribe();
          subscription = null;
        }
      };
    },

    getSnapshot() {
      return snapshot;
    },
  };
}

export const sessionStore: SessionStore = createSessionStore(
  {
    getSession: () => getSupabaseClient().auth.getSession(),
    onAuthStateChange: (handler) =>
      getSupabaseClient().auth.onAuthStateChange(handler),
  },
  // Oturum nasıl sona ererse ersin önbellek temizlenir: başka sekmede çıkış
  // ya da yenileme hatası da dahil. Yalnızca düğmeye bağlı olsa, önceki
  // kullanıcının ürünleri yeni hesapta bir an görünebilirdi.
  () => productStore.reset(),
)

function getServerSnapshot(): SessionState {
  return UNKNOWN;
}

export function useSession(): SessionState {
  const { session } = useStores();
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    getServerSnapshot,
  );
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw error;
}

/**
 * Çıkış. Hata fırlatmaz: auth-js yerel oturumu her durumda siliyor, bu yüzden
 * kullanıcı zaten çıkmış olur. Fırlatsaydı çağrı yerinde yüzen bir rejection
 * bırakırdı. Önbellek temizliği `onSignedOut` üzerinden yapılır.
 */
export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) console.error("BayatlamaSavar çıkış hatası:", error);
}
