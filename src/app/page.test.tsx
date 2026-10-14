import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Home from "@/app/page";
import { StoresProvider, type Stores } from "@/app/providers";
import { createProductStore } from "@/lib/product-store";
import { productCache } from "@/lib/product-cache";
import { SCHEMA_VERSION } from "@/lib/product-schema";
import type { ProductApi } from "@/lib/product-api";
import type { SessionState, SessionStore } from "@/lib/useSession";
import type { Product } from "@/types/product";

const USER = "u1";
const HOUSEHOLD = "h1";

// Bugüne göre 3 gün kalır (Güvenli)
const milk: Product = {
  id: "m1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};

function fakeApi(overrides: Partial<ProductApi> = {}): ProductApi {
  return {
    fetchHouseholdId: vi.fn(async () => HOUSEHOLD),
    fetchProducts: vi.fn(async () => ({ products: [milk], dropped: 0 })),
    insertProduct: vi.fn(async () => {}),
    insertProducts: vi.fn(async () => {}),
    updateProduct: vi.fn(async () => {}),
    setConsumedAt: vi.fn(async () => {}),
    ...overrides,
  };
}

function stubSession(state: SessionState): SessionStore {
  return {
    subscribe: () => () => {},
    getSnapshot: () => state,
  };
}

function renderHome(
  api: ProductApi = fakeApi(),
  session: SessionState = { status: "signedIn", userId: USER, email: "a@b.c" },
) {
  const stores: Stores = {
    products: createProductStore(api, productCache),
    session: stubSession(session),
  };
  render(
    <StoresProvider value={stores}>
      <Home />
    </StoresProvider>,
  );
  return stores;
}

describe("Ana sayfa — bütünleşme", () => {
  test("oturum yoksa giriş ekranı çizilir", () => {
    renderHome(fakeApi(), { status: "signedOut" });
    expect(screen.getByRole("button", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Ürün Adı")).not.toBeInTheDocument();
  });

  test("oturum varsa ürün listesi çizilir", async () => {
    renderHome();
    expect(await screen.findByText("Sütaş Süt")).toBeInTheDocument();
    expect(screen.getByLabelText("Ürün Adı")).toBeInTheDocument();
  });

  test("ürün ekle akışı: form gönderilir, ürün listede görünür", async () => {
    const api = fakeApi();
    renderHome(api);
    await screen.findByText("Sütaş Süt");

    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Pınar Labne");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(await screen.findByText("Pınar Labne")).toBeInTheDocument();
    expect(api.insertProduct).toHaveBeenCalledOnce();
  });

  test("tüket akışı: ürün listeden çıkar, bildirim görünür", async () => {
    const api = fakeApi();
    renderHome(api);
    await screen.findByText("Sütaş Süt");

    await userEvent.click(screen.getByRole("button", { name: /Tükettim/ }));

    // Ad bildirimde de geçiyor; kartın gittiğini başlıkla kontrol et
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Sütaş Süt" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Geri al" })).toBeInTheDocument();
    expect(api.setConsumedAt).toHaveBeenCalledWith("m1", expect.any(String));
  });

  test("geri al akışı: bildirimden geri alınır, ürün listeye döner", async () => {
    const api = fakeApi();
    renderHome(api);
    await screen.findByText("Sütaş Süt");

    await userEvent.click(screen.getByRole("button", { name: /Tükettim/ }));
    await screen.findByRole("button", { name: "Geri al" });
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }));

    expect(
      await screen.findByRole("heading", { name: "Sütaş Süt" }),
    ).toBeInTheDocument();
    expect(api.setConsumedAt).toHaveBeenLastCalledWith("m1", null);
  });

  test("yazma hatası: liste değişmez, hata bildirimi görünür", async () => {
    const api = fakeApi({
      insertProduct: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    renderHome(api);
    await screen.findByText("Sütaş Süt");

    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Kaşar");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(await screen.findByText(/Bağlantı kurulamadı/)).toBeInTheDocument();
    expect(screen.queryByText("Kaşar")).not.toBeInTheDocument();
    expect(screen.getByText("Sütaş Süt")).toBeInTheDocument();
    // Review Focus 1: kullanıcı yazdığını kaybetmesin
    expect(screen.getByLabelText("Ürün Adı")).toHaveValue("Kaşar");
  });

  test("sunucu hatası ve önbellek doluysa liste çizilir, çevrimdışı şeridi görünür", async () => {
    localStorage.setItem(
      "bayatlamasavar.cache.v2",
      JSON.stringify({ version: SCHEMA_VERSION, products: [milk] }),
    );
    const api = fakeApi({
      fetchProducts: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    renderHome(api);

    expect(await screen.findByText(/Çevrimdışı/)).toBeInTheDocument();
    expect(screen.getByText("Sütaş Süt")).toBeInTheDocument();
  });

  test("eski veri varsa aktarım şeridi görünür, aktarımdan sonra kaybolur", async () => {
    localStorage.setItem(
      "bayatlamasavar.products",
      JSON.stringify({ version: SCHEMA_VERSION, products: [milk] }),
    );
    const api = fakeApi();
    renderHome(api);

    const importButton = await screen.findByRole("button", { name: /Aktar/ });
    expect(screen.getByText(/1 ürün/)).toBeInTheDocument();

    await userEvent.click(importButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Aktar/ }),
      ).not.toBeInTheDocument();
    });
    expect(api.insertProducts).toHaveBeenCalledOnce();
  });
});
