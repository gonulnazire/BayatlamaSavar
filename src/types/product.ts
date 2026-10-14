export const CATEGORIES = [
  "Süt Ürünü",
  "Sos/Konserve",
  "Et/Şarküteri",
  "Diğer",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Product = {
  id: string;
  name: string;
  category: Category;
  /** Açılış tarihi, YYYY-MM-DD */
  openedAt: string;
  /** Raf ömrü, gün cinsinden */
  shelfLifeDays: number;
};
