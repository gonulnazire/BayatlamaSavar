import { CATEGORIES, type Category, type Product } from "@/types/product";

/** Depolanan verinin biçim sürümü. Alan eklendiğinde artırılır. */
export const SCHEMA_VERSION = 1;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hem biçimi hem de takvimde gerçekten var olup olmadığını kontrol eder */
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

/** Bilinmeyen kategori veriyi çöpe atmak yerine "Diğer"e düşer */
function toCategory(value: unknown): Category {
  return (CATEGORIES as readonly unknown[]).includes(value)
    ? (value as Category)
    : "Diğer";
}

/**
 * Dışarıdan gelen (localStorage, elle düzenlenmiş, eski sürümden kalmış)
 * tek bir kaydı doğrular. Güvenilmeyen kayıt için `null` döner — böylece
 * bozuk veri sessizce "güvenli/yeşil" görünmez.
 */
export function parseProduct(value: unknown): Product | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== "string" || raw.id.trim() === "") return null;

  if (typeof raw.name !== "string") return null;
  const name = raw.name.trim();
  if (name === "") return null;

  if (typeof raw.openedAt !== "string" || !isCalendarDate(raw.openedAt)) {
    return null;
  }

  const days = raw.shelfLifeDays;
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0) {
    return null;
  }

  // Yalnızca bilinen alanlar taşınır; fazlalıklar dışarıda kalır
  return {
    id: raw.id,
    name,
    category: toCategory(raw.category),
    openedAt: raw.openedAt,
    shelfLifeDays: Math.floor(days),
  };
}

/** Depodaki ham metni okur; sürümü tanır, bozuk kayıtları atar */
export function parseStoredProducts(raw: string | null): Product[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  let list: unknown;
  if (Array.isArray(parsed)) {
    // Sürümsüz ilk biçim: düz dizi
    list = parsed;
  } else if (
    typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { version?: unknown }).version === SCHEMA_VERSION
  ) {
    list = (parsed as { products?: unknown }).products;
  } else {
    // Tanınmayan sürüm: körlemesine okumak yanlış veri göstermekten kötü
    return [];
  }

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => parseProduct(item))
    .filter((product): product is Product => product !== null);
}

/** Depoya sürüm bilgisiyle yazar */
export function serializeProducts(products: Product[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, products });
}
