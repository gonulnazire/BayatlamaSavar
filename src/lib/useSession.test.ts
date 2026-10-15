import { describe, expect, test, vi } from "vitest";
import { createSessionStore, type SupabaseAuthLike } from "@/lib/useSession";

const USER = { id: "u1", email: "ev@ornek.com" };

type Handler = Parameters<SupabaseAuthLike["onAuthStateChange"]>[0];

function fakeAuth(session: { user: typeof USER } | null) {
  const handlers: Handler[] = [];
  const unsubscribe = vi.fn();

  const auth: SupabaseAuthLike = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: (handler) => {
      handlers.push(handler);
      return { data: { subscription: { unsubscribe } } };
    },
  };

  return { auth, handlers, unsubscribe };
}

describe("session store", () => {
  test("başlangıçta status unknown", () => {
    const { auth } = fakeAuth(null);
    const store = createSessionStore(auth);
    expect(store.getSnapshot().status).toBe("unknown");
  });

  test("oturum yoksa signedOut olur", async () => {
    const { auth } = fakeAuth(null);
    const store = createSessionStore(auth);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedOut");
    });
  });

  test("oturum varsa signedIn olur ve userId taşır", async () => {
    const { auth } = fakeAuth({ user: USER });
    const store = createSessionStore(auth);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot()).toEqual({
        status: "signedIn",
        userId: "u1",
        email: "ev@ornek.com",
      });
    });
  });

  test("auth olayı geldiğinde durumu günceller", async () => {
    const { auth, handlers } = fakeAuth({ user: USER });
    const store = createSessionStore(auth);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedIn");
    });

    handlers[0]("SIGNED_OUT", null);
    expect(store.getSnapshot().status).toBe("signedOut");
  });

  test("abonelik çözüldüğünde auth dinleyicisi kaldırılır", async () => {
    const { auth, unsubscribe } = fakeAuth({ user: USER });
    const store = createSessionStore(auth);
    const dispose = store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedIn");
    });

    dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("session store — dayanıklılık", () => {
  test("getSession reddedilirse signedOut olur, iskelette kalmaz", async () => {
    // I3: .catch yoktu; uygulama sonsuza kadar iskelet gösteriyordu
    const auth: SupabaseAuthLike = {
      getSession: vi.fn(async () => {
        throw new Error("Acquiring an exclusive Navigator LockManager failed");
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    };
    const store = createSessionStore(auth);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedOut");
    });
  });

  test("SIGNED_OUT olayında onSignedOut çağrılır", async () => {
    // I4: onbellek temizligi yalnizca Cikis dugmesindeydi; auth-js kendi
    // basina SIGNED_OUT yayarsa onceki kullanicinin urunleri kaliyordu
    const { auth, handlers } = fakeAuth({ user: USER });
    const onSignedOut = vi.fn();
    const store = createSessionStore(auth, onSignedOut);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedIn");
    });

    handlers[0]("SIGNED_OUT", null);

    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  test("signedIn kalırken onSignedOut çağrılmaz", async () => {
    const { auth, handlers } = fakeAuth({ user: USER });
    const onSignedOut = vi.fn();
    const store = createSessionStore(auth, onSignedOut);
    store.subscribe(() => {});

    await vi.waitFor(() => {
      expect(store.getSnapshot().status).toBe("signedIn");
    });

    handlers[0]("TOKEN_REFRESHED", { user: USER });

    expect(onSignedOut).not.toHaveBeenCalled();
  });
});
