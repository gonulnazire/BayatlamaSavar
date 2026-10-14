import type { Product } from "@/types/product";
import { daysLeft, statusOf, type Status } from "@/lib/date";

export type StatusFilter = "all" | Status;

export type Filters = {
  query: string;
  status: StatusFilter;
};

export const STATUS_FILTERS: readonly StatusFilter[] = [
  "all",
  "safe",
  "warning",
  "expired",
];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Tümü",
  safe: "Güvenli",
  warning: "Dikkat",
  expired: "Süresi Doldu",
};

/**
 * Türkçe harf çiftleri (I/ı, İ/i) İngilizce kurallarıyla yanlış eşleşir;
 * tr yerelini vererek "ILIK" ile "Ilık" aynı sayılır.
 */
function fold(value: string): string {
  return value.toLocaleLowerCase("tr");
}

function matchesQuery(product: Product, query: string): boolean {
  if (query === "") return true;
  const needle = fold(query);
  return (
    fold(product.name).includes(needle) ||
    fold(product.category).includes(needle)
  );
}

export function filterProducts(
  products: Product[],
  filters: Filters,
  today: string,
): Product[] {
  const query = filters.query.trim();

  return products.filter((product) => {
    if (!matchesQuery(product, query)) return false;
    if (filters.status === "all") return true;
    const days = daysLeft(product.openedAt, product.shelfLifeDays, today);
    return statusOf(days) === filters.status;
  });
}

/** Filtre düğmelerinde gösterilecek sayılar */
export function countByStatus(
  products: Product[],
  today: string,
): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: products.length,
    safe: 0,
    warning: 0,
    expired: 0,
  };

  for (const product of products) {
    const days = daysLeft(product.openedAt, product.shelfLifeDays, today);
    counts[statusOf(days)] += 1;
  }

  return counts;
}
