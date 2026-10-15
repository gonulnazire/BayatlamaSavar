import type { Product } from "@/types/product";

/**
 * Kaydı aynı sırada tutarak günceller; id bulunamazsa liste değişmez.
 *
 * Not: `insertAt` ve `removeById` soft delete'e geçişte kaldırıldı — geri alma
 * artık diziye sıra numarasıyla geri sokmak değil, `consumed_at = null`.
 */
export function replaceById(list: Product[], product: Product): Product[] {
  const index = list.findIndex((item) => item.id === product.id);
  if (index === -1) return list;
  return [...list.slice(0, index), product, ...list.slice(index + 1)];
}
