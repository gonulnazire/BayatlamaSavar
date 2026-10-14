import type { Product } from "@/types/product";
import { parseStoredProducts, serializeProducts } from "@/lib/product-schema";

/**
 * Sunucu verisinin önbelleği. Eski (Supabase öncesi) verinin anahtarından
 * AYRI tutulur: aynı anahtar kullanılsa "aktarılmayı bekleyen eski veri" ile
 * "sunucu verisinin önbelleği" ayırt edilemezdi.
 */
const CACHE_KEY = "bayatlamasavar.cache.v2";

/** Supabase öncesi veri. Salt okunur; yalnızca tek seferlik aktarım için. */
const LEGACY_KEY = "bayatlamasavar.products";

const EMPTY: Product[] = [];

export type ProductCache = {
  read(): Product[];
  /** false = yazılamadı (gizli sekme, dolu kota). Bildirmek çağıranın işi. */
  write(products: Product[]): boolean;
  clear(): void;
  readLegacy(): Product[];
  hasLegacy(): boolean;
  clearLegacy(): void;
};

function readKey(key: string): Product[] {
  try {
    return parseStoredProducts(localStorage.getItem(key));
  } catch {
    return EMPTY;
  }
}

export const productCache: ProductCache = {
  read() {
    return readKey(CACHE_KEY);
  },

  write(products) {
    try {
      localStorage.setItem(CACHE_KEY, serializeProducts(products));
      return true;
    } catch {
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Depolama kullanılamıyorsa yapacak bir şey yok
    }
  },

  readLegacy() {
    return readKey(LEGACY_KEY);
  },

  hasLegacy() {
    try {
      return localStorage.getItem(LEGACY_KEY) !== null;
    } catch {
      return false;
    }
  },

  clearLegacy() {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Depolama kullanılamıyorsa yapacak bir şey yok
    }
  },
};
