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
      const { data, error } = await client
        .from("household_members")
        .select("household_id")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const row = data as { household_id?: unknown } | null;
      return typeof row?.household_id === "string" ? row.household_id : null;
    },

    async fetchProducts(householdId) {
      const { data, error } = await client
        .from("products")
        .select("*")
        .eq("household_id", householdId)
        .is("consumed_at", null);
      if (error) throw error;

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
      const { error } = await client
        .from("products")
        .insert(toRow(product, householdId, userId));
      if (error) throw error;
    },

    async insertProducts(products, householdId, userId) {
      if (products.length === 0) return;
      const { error } = await client
        .from("products")
        .upsert(
          products.map((p) => toRow(p, householdId, userId)),
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },

    async updateProduct(product) {
      const { error } = await client
        .from("products")
        .update({
          name: product.name,
          category: product.category,
          opened_at: product.openedAt,
          shelf_life_days: product.shelfLifeDays,
        })
        .eq("id", product.id);
      if (error) throw error;
    },

    async setConsumedAt(id, value) {
      const { error } = await client
        .from("products")
        .update({ consumed_at: value })
        .eq("id", id);
      if (error) throw error;
    },
  };
}
