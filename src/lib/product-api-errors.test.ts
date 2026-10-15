import { describe, expect, test } from "vitest";
import { createProductApi } from "@/lib/product-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types/product";

const HOUSEHOLD = "h1";
const USER = "u1";

const product: Product = {
  id: "p1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  quantity: 1,
  unit: "L",
  expiresOn: "2099-01-01",
  storagePlace: "Buzdolabı",
  isOpened: true,
  openedAt: "2026-10-14",
  state: "active",
  createdAt: "2026-10-14",
};

type Resp = { data?: unknown; error?: unknown; status?: number };

/**
 * Asgari zincirleme sahte istemci. Amacı sorgu kurmayı taklit etmek değil,
 * GERÇEK PostgREST yanıt şekillerini (düz hata nesnesi + kardeş status)
 * API katmanına vermek — C1'in doğduğu yer tam burası.
 */
function fakeClient(resp: Resp) {
  const ops: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const op of [
    "select",
    "insert",
    "upsert",
    "update",
    "delete",
    "eq",
    "is",
    "limit",
    "maybeSingle",
  ]) {
    chain[op] = (...args: unknown[]) => {
      ops.push([op, args]);
      return chain;
    };
  }
  chain.then = (onFulfilled: (r: Resp) => unknown) =>
    Promise.resolve({ data: null, error: null, status: 200, ...resp }).then(
      onFulfilled,
    );

  return {
    client: { from: () => chain } as unknown as SupabaseClient,
    ops,
  };
}

describe("product-api — hata çevrimi", () => {
  test("PostgREST hatası gerçek Error'a çevrilir, status ve code korunur", async () => {
    // postgrest-js düz nesne fırlatır ve status'u yanıtın kardeş alanında tutar
    const { client } = fakeClient({
      error: {
        message: "JWT expired",
        details: null,
        hint: null,
        code: "PGRST301",
      },
      status: 401,
    });
    const api = createProductApi(client);

    await expect(
      api.insertProduct(product, HOUSEHOLD, USER),
    ).rejects.toMatchObject({
      message: "JWT expired",
      status: 401,
      code: "PGRST301",
    });

    const thrown = await api
      .insertProduct(product, HOUSEHOLD, USER)
      .catch((e) => e);
    expect(thrown).toBeInstanceOf(Error);
  });

  test("ağ hatasında postgrest'in status 0 işareti korunur", async () => {
    const { client } = fakeClient({
      error: {
        message: "TypeError: Failed to fetch",
        details: "",
        hint: "",
        code: "",
      },
      status: 0,
    });
    const api = createProductApi(client);

    await expect(api.fetchProducts(HOUSEHOLD)).rejects.toMatchObject({
      status: 0,
    });
  });

  test("hint ve details kaybolmaz", async () => {
    const { client } = fakeClient({
      error: {
        message: "new row violates row-level security policy",
        details: "Failing row contains (...)",
        hint: "Check the products_insert policy",
        code: "42501",
      },
      status: 403,
    });
    const api = createProductApi(client);

    await expect(
      api.insertProduct(product, HOUSEHOLD, USER),
    ).rejects.toMatchObject({
      code: "42501",
      hint: "Check the products_insert policy",
      details: "Failing row contains (...)",
    });
  });
});

describe("product-api — yazmanın gerçekten olduğunun doğrulanması", () => {
  test("updateProduct 0 satır etkilediyse FIRLATIR", async () => {
    // RLS engellediğinde PostgREST hata vermez, 204 ve boş veri döner
    const { client } = fakeClient({ data: [], error: null, status: 200 });
    const api = createProductApi(client);

    await expect(api.updateProduct(product)).rejects.toThrow();
  });

  test("updateProduct satır döndüyse fırlatmaz", async () => {
    const { client } = fakeClient({ data: [{ id: "p1" }], status: 200 });
    const api = createProductApi(client);

    await expect(api.updateProduct(product)).resolves.toBeUndefined();
  });

  test("updateProduct etkilenen satırı select ile geri ister", async () => {
    const { client, ops } = fakeClient({ data: [{ id: "p1" }] });
    await createProductApi(client).updateProduct(product);

    expect(ops.map(([op]) => op)).toContain("select");
  });

  test("setState 0 satır etkilediyse FIRLATIR", async () => {
    const { client } = fakeClient({ data: [], error: null, status: 200 });
    const api = createProductApi(client);

    await expect(api.setState("p1", "consumed")).rejects.toThrow();
  });

  test("setState satır döndüyse fırlatmaz", async () => {
    const { client } = fakeClient({ data: [{ id: "p1" }] });
    await expect(
      createProductApi(client).setState("p1", "consumed"),
    ).resolves.toBeUndefined();
  });
});
