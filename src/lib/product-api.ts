import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types/product";
import { parseProduct } from "@/lib/product-schema";

export type ProductRow = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  opened_at: string;
  shelf_life_days: number;
  created_by: string;
  created_at: string;
  consumed_at: string | null;
};

export type ProductInsert = Omit<ProductRow, "created_at" | "consumed_at">;

/** Sunucu satırını Product'a çevirir; doğrulamayı parseProduct yapar */
export function toProduct(row: unknown): Product | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  return parseProduct({
    id: r.id,
    name: r.name,
    category: r.category,
    openedAt: r.opened_at,
    shelfLifeDays: r.shelf_life_days,
  });
}

/**
 * Product'ı sunucu satırına çevirir.
 * `opened_at` metin olarak taşınır — `Date` nesnesine çevrilip tekrar metne
 * dönerse cihazın saat diliminde gün kayar.
 */
export function toRow(
  product: Product,
  householdId: string,
  userId: string,
): ProductInsert {
  return {
    id: product.id,
    household_id: householdId,
    name: product.name,
    category: product.category,
    opened_at: product.openedAt,
    shelf_life_days: product.shelfLifeDays,
    created_by: userId,
  };
}

/**
 * PostgREST hatası bir `Error` DEĞİL, gövdeden ayrıştırılmış düz bir nesnedir
 * (`{message, details, hint, code}`) ve `status` yanıtın kardeş alanındadır.
 * Olduğu gibi fırlatılırsa çağıran taraf ne `instanceof Error` ne `status`
 * görebilir — hata sınıflandırması bu yüzden sessizce çalışmaz hale gelir.
 * Bu yüzden gerçek bir `Error`'a çevirip tüm alanları taşıyoruz.
 */
export type ApiError = Error & {
  status?: number;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export function toApiError(error: unknown, status?: number): ApiError {
  const raw = (error ?? {}) as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const message =
    typeof raw.message === "string" && raw.message
      ? raw.message
      : "Bilinmeyen sunucu hatası";

  return Object.assign(new Error(message), {
    status,
    code: typeof raw.code === "string" ? raw.code : undefined,
    details: typeof raw.details === "string" ? raw.details : null,
    hint: typeof raw.hint === "string" ? raw.hint : null,
  }) as ApiError;
}

/** RLS engellediğinde PostgREST hata vermez, 0 satır etkiler */
function assertAffected(rows: unknown, what: string): void {
  if (Array.isArray(rows) && rows.length > 0) return;
  throw Object.assign(
    new Error(`${what}: hiçbir satır güncellenmedi (yetki veya kayıt yok)`),
    { code: "NO_ROWS_AFFECTED" },
  ) as ApiError;
}

export type ProductApi = {
  fetchHouseholdId(): Promise<string | null>;
  fetchProducts(
    householdId: string,
  ): Promise<{ products: Product[]; dropped: number }>;
  insertProduct(
    product: Product,
    householdId: string,
    userId: string,
  ): Promise<void>;
  insertProducts(
    products: Product[],
    householdId: string,
    userId: string,
  ): Promise<void>;
  updateProduct(product: Product): Promise<void>;
  setConsumedAt(id: string, value: string | null): Promise<void>;
};

export function createProductApi(client: SupabaseClient): ProductApi {
  return {
    async fetchHouseholdId() {
      const { data, error, status } = await client
        .from("household_members")
        .select("household_id")
        .limit(1)
        .maybeSingle();
      if (error) throw toApiError(error, status);
      const row = data as { household_id?: unknown } | null;
      return typeof row?.household_id === "string" ? row.household_id : null;
    },

    async fetchProducts(householdId) {
      const { data, error, status } = await client
        .from("products")
        .select("*")
        .eq("household_id", householdId)
        .is("consumed_at", null);
      if (error) throw toApiError(error, status);

      const products: Product[] = [];
      let dropped = 0;
      for (const row of (data ?? []) as unknown[]) {
        const product = toProduct(row);
        if (product) products.push(product);
        else dropped += 1;
      }
      return { products, dropped };
    },

    async insertProduct(product, householdId, userId) {
      const { error, status } = await client
        .from("products")
        .insert(toRow(product, householdId, userId));
      if (error) throw toApiError(error, status);
    },

    async insertProducts(products, householdId, userId) {
      if (products.length === 0) return;
      const { error, status } = await client
        .from("products")
        .upsert(
          products.map((p) => toRow(p, householdId, userId)),
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (error) throw toApiError(error, status);
    },

    async updateProduct(product) {
      const { data, error, status } = await client
        .from("products")
        .update({
          name: product.name,
          category: product.category,
          opened_at: product.openedAt,
          shelf_life_days: product.shelfLifeDays,
        })
        .eq("id", product.id)
        .select("id");
      if (error) throw toApiError(error, status);
      // "Kaydedildi" demenin tek dayanağı bu: oturum gitmişse supabase-js
      // sessizce anon anahtarına düşer, RLS satırı filtreler ve PostgREST
      // hatasız 204 döner — kontrol edilmezse yazılmamış veri kaydedilmiş sanılır.
      assertAffected(data, "Ürün güncellenemedi");
    },

    async setConsumedAt(id, value) {
      const { data, error, status } = await client
        .from("products")
        .update({ consumed_at: value })
        .eq("id", id)
        .select("id");
      if (error) throw toApiError(error, status);
      assertAffected(data, "Ürün durumu güncellenemedi");
    },
  };
}

/**
 * İstemciyi her çağrıda tembel çözen API.
 *
 * Singleton store'u `createProductApi(getSupabaseClient())` ile kurmak,
 * modül yüklenirken `getSupabaseClient()` çağırmak demekti ve env yokken
 * `next build` prerender sırasında kırılırdı. Bu sarmalayıcı çözümü ilk
 * gerçek kullanıma erteler; `createProductStore(api, cache)` imzası değişmez.
 */
export function lazyProductApi(getClient: () => SupabaseClient): ProductApi {
  const resolve = () => createProductApi(getClient());
  return {
    fetchHouseholdId: () => resolve().fetchHouseholdId(),
    fetchProducts: (householdId) => resolve().fetchProducts(householdId),
    insertProduct: (p, h, u) => resolve().insertProduct(p, h, u),
    insertProducts: (ps, h, u) => resolve().insertProducts(ps, h, u),
    updateProduct: (p) => resolve().updateProduct(p),
    setConsumedAt: (id, value) => resolve().setConsumedAt(id, value),
  };
}
