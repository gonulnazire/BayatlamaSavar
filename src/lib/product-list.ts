import type { Product } from "@/types/product";

export type RemoveResult = {
  /** Kayıt çıkarıldıktan sonraki yeni liste */
  list: Product[];
  /** Çıkarılan kayıt; id bulunamadıysa null */
  removed: Product | null;
  /** Çıkarılan kaydın eski sırası; bulunamadıysa -1 */
  index: number;
};

/** Kaydı listeden çıkarır ve geri alma için eski sırasını bildirir */
export function removeById(list: Product[], id: string): RemoveResult {
  const index = list.findIndex((product) => product.id === id);
  if (index === -1) {
    return { list, removed: null, index: -1 };
  }
  return {
    list: [...list.slice(0, index), ...list.slice(index + 1)],
    removed: list[index],
    index,
  };
}

/** Kaydı verilen sıraya geri koyar; sıra listenin dışındaysa sınıra çeker */
export function insertAt(
  list: Product[],
  product: Product,
  index: number,
): Product[] {
  const safeIndex = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, safeIndex), product, ...list.slice(safeIndex)];
}

/** Kaydı aynı sırada tutarak günceller; id bulunamazsa liste değişmez */
export function replaceById(list: Product[], product: Product): Product[] {
  const index = list.findIndex((item) => item.id === product.id);
  if (index === -1) return list;
  return [...list.slice(0, index), product, ...list.slice(index + 1)];
}
