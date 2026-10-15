export const CATEGORIES = [
  "Süt Ürünü",
  "Et",
  "Sebze",
  "Meyve",
  "Ekmek",
  "İçecek",
  "Diğer",
] as const;

export const UNITS = ["adet", "g", "kg", "ml", "L", "paket"] as const;

export const STORAGE_PLACES = ["Buzdolabı", "Dondurucu", "Kiler"] as const;

/** aktif = listede · tüketildi / çöpe gitti = geçmişte (kayıt SİLİNMEZ) */
export const PRODUCT_STATES = ["active", "consumed", "discarded"] as const;

export const PRODUCT_STATE_LABELS: Record<ProductState, string> = {
  active: "Aktif",
  consumed: "Tüketildi",
  discarded: "Çöpe gitti",
};

export type Category = (typeof CATEGORIES)[number];
export type Unit = (typeof UNITS)[number];
export type StoragePlace = (typeof STORAGE_PLACES)[number];
export type ProductState = (typeof PRODUCT_STATES)[number];

export type Product = {
  id: string;
  name: string;
  category: Category;
  /** Pozitif; ondalık olabilir (0.5 kg) */
  quantity: number;
  unit: Unit;
  /**
   * Son kullanma tarihi, YYYY-MM-DD. Modelin ana alanı budur:
   * renk, sıralama ve filtreler bunun üzerinden hesaplanır.
   */
  expiresOn: string;
  storagePlace: StoragePlace;
  isOpened: boolean;
  /** YYYY-MM-DD; açılmamış üründe her zaman null */
  openedAt: string | null;
  state: ProductState;
  /** YYYY-MM-DD; v1'den göç eden kayıtlarda bilinmediği için null */
  createdAt: string | null;
};
