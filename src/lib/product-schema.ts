import {
  CATEGORIES,
  PRODUCT_STATES,
  STORAGE_PLACES,
  UNITS,
  type Category,
  type Product,
  type ProductState,
  type StoragePlace,
  type Unit,
} from "@/types/product";
import { addDays } from "@/lib/date";

/**
 * Depolanan verinin biçim sürümü.
 *
 * 1 → 2: model "açılış tarihi + raf ömrü"nden "son kullanma tarihi"ne geçti;
 * miktar/birim, saklama yeri, açıldı mı, durum ve eklenme tarihi eklendi.
 * Alan eklendiğinde bu sayı artırılır ve aşağıya bir göç yolu yazılır.
 */
export const SCHEMA_VERSION = 2;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hem biçimi hem de takvimde gerçekten var olup olmadığını kontrol eder */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
}

/**
 * Bilinmeyen değeri listedeki bir varsayılana düşürür.
 *
 * Bu hoşgörü yalnızca GÖRÜNÜM alanları için geçerli: yanlış birim ya da
 * yanlış saklama yeri kullanıcıyı yanıltmaz. Son kullanma tarihi böyle
 * değildir — o bozuksa kayıt tamamen reddedilir, çünkü hatalı bir tarih
 * bozulmuş ürünü taze gösterebilir.
 */
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly unknown[]).includes(value)
    ? (value as T)
    : fallback;
}

function toQuantity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

/**
 * Dışarıdan gelen (önbellek, sunucu, elle düzenlenmiş) tek bir kaydı
 * doğrular. Güvenilmeyen kayıt için `null` döner.
 */
export function parseProduct(value: unknown): Product | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== "string" || raw.id.trim() === "") return null;

  if (typeof raw.name !== "string") return null;
  const name = raw.name.trim();
  if (name === "") return null;

  if (!isCalendarDate(raw.expiresOn)) return null;

  const isOpened = raw.isOpened === true;
  const openedAt =
    isOpened && isCalendarDate(raw.openedAt) ? raw.openedAt : null;

  // Yalnızca bilinen alanlar taşınır; fazlalıklar dışarıda kalır
  return {
    id: raw.id,
    name,
    category: oneOf<Category>(raw.category, CATEGORIES, "Diğer"),
    quantity: toQuantity(raw.quantity),
    unit: oneOf<Unit>(raw.unit, UNITS, "adet"),
    expiresOn: raw.expiresOn,
    storagePlace: oneOf<StoragePlace>(
      raw.storagePlace,
      STORAGE_PLACES,
      "Buzdolabı",
    ),
    isOpened,
    openedAt,
    state: oneOf<ProductState>(raw.state, PRODUCT_STATES, "active"),
    createdAt: isCalendarDate(raw.createdAt) ? raw.createdAt : null,
  };
}

/** v1'in 4 kategorisi v2'nin 7 kategorisine nasıl düşer */
const V1_CATEGORY_MAP: Record<string, Category> = {
  "Süt Ürünü": "Süt Ürünü",
  "Et/Şarküteri": "Et",
  "Sos/Konserve": "Diğer",
  Diğer: "Diğer",
};

/**
 * v1 kaydını v2 biçimine çevirir.
 *
 * v1'de son kullanma tarihi HİÇ yoktu; `açılış tarihi + raf ömrü` ile
 * hesaplanıyordu. Göç bu hesabı bir kez yapıp sonucu kalıcı hale getirir.
 * Eski model yalnızca "ambalajı açılmış" ürünleri takip ettiği için
 * göç eden her kayıt `isOpened: true` sayılır.
 */
function migrateV1(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const raw = value as Record<string, unknown>;

  const days = raw.shelfLifeDays;
  if (
    !isCalendarDate(raw.openedAt) ||
    typeof days !== "number" ||
    !Number.isFinite(days) ||
    days < 0
  ) {
    // Son kullanma tarihi üretilemiyor; parseProduct bunu reddedecek
    return raw;
  }

  return {
    ...raw,
    expiresOn: addDays(raw.openedAt, Math.floor(days)),
    category:
      typeof raw.category === "string"
        ? (V1_CATEGORY_MAP[raw.category] ?? "Diğer")
        : "Diğer",
    isOpened: true,
    state: "active",
    createdAt: null,
  };
}

/** Depodaki ham metni okur; sürümü tanır, gerekirse göç eder */
export function parseStoredProducts(raw: string | null): Product[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  let list: unknown;
  let migrate: (value: unknown) => unknown = (value) => value;

  if (Array.isArray(parsed)) {
    // Sürümsüz ilk biçim: düz dizi, v1 sayılır
    list = parsed;
    migrate = migrateV1;
  } else if (typeof parsed === "object" && parsed !== null) {
    const version = (parsed as { version?: unknown }).version;
    if (version === SCHEMA_VERSION) {
      list = (parsed as { products?: unknown }).products;
    } else if (version === 1) {
      list = (parsed as { products?: unknown }).products;
      migrate = migrateV1;
    } else {
      // Tanınmayan sürüm: körlemesine okumak yanlış veri göstermekten kötü
      return [];
    }
  } else {
    return [];
  }

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => parseProduct(migrate(item)))
    .filter((product): product is Product => product !== null);
}

/** Depoya sürüm bilgisiyle yazar */
export function serializeProducts(products: Product[]): string {
  return JSON.stringify({ version: SCHEMA_VERSION, products });
}
