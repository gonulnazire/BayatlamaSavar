import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, ProductState } from "@/types/product";
import { parseProduct } from "@/lib/product-schema";

export type ProductRow = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expires_on: string;
  storage_place: string;
  is_opened: boolean;
  opened_at: string | null;
  state: string;
  state_changed_at: string | null;
  created_by: string;
  created_at: string;
};

export type ProductInsert = Omit<
  ProductRow,
  "created_at" | "state_changed_at"
>;

/**
 * `created_at` sunucuda timestamptz; modelde yalnızca tarih taşınır.
 * Kullanıcının gördüğü "eklenme tarihi" kendi saat dilimindeki gün olmalı,
 * bu yüzden metni kesmek yerine yerel takvime çevriliyor.
 */
function toLocalDate(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sunucu satırını Product'a çevirir; doğrulamayı parseProduct yapar */
export function toProduct(row: unknown): Product | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  return parseProduct({
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: r.quantity,
    unit: r.unit,
    expiresOn: r.expires_on,
    storagePlace: r.storage_place,
    isOpened: r.is_opened,
    openedAt: r.opened_at,
    state: r.state,
    createdAt: toLocalDate(r.created_at),
  });
}

/**
 * Product'ı sunucu satırına çevirir.
 * Tarihler metin olarak taşınır — `Date` nesnesine çevrilip tekrar metne
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
    quantity: product.quantity,
    unit: product.unit,
    expires_on: product.expiresOn,
    storage_place: product.storagePlace,
    is_opened: product.isOpened,
    opened_at: product.openedAt,
    state: product.state,
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
  setState(id: string, state: ProductState): Promise<void>;
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
        .eq("state", "active");
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
          quantity: product.quantity,
          unit: product.unit,
          expires_on: product.expiresOn,
          storage_place: product.storagePlace,
          is_opened: product.isOpened,
          opened_at: product.openedAt,
        })
        .eq("id", product.id)
        .select("id");
      if (error) throw toApiError(error, status);
      // "Kaydedildi" demenin tek dayanağı bu: oturum gitmişse supabase-js
      // sessizce anon anahtarına düşer, RLS satırı filtreler ve PostgREST
      // hatasız 204 döner — kontrol edilmezse yazılmamış veri kaydedilmiş sanılır.
      assertAffected(data, "Ürün güncellenemedi");
    },

    async setState(id, state) {
      const { data, error, status } = await client
        .from("products")
        .update({
          state,
          // Aktife dönen ürün geçmişten çıkar; damga da temizlenir
          state_changed_at: state === "active" ? null : new Date().toISOString(),
        })
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
    setState: (id, state) => resolve().setState(id, state),
  };
}
