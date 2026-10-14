"use client";

import { useCallback, useMemo, useState } from "react";
import { Refrigerator, PackageOpen } from "lucide-react";
import AddProductForm from "@/components/AddProductForm";
import ProductCard from "@/components/ProductCard";
import UndoToast from "@/components/UndoToast";
import type { Product } from "@/types/product";
import { useProducts } from "@/lib/storage";
import { useToday } from "@/lib/useToday";
import { daysLeft } from "@/lib/date";

export default function Home() {
  const { products, addProduct, removeProduct, restoreProduct } = useProducts();
  const today = useToday();

  // Silinen kaydı geri alabilmek için kayıt ve eski sırası tutulur
  const [undoable, setUndoable] = useState<{
    product: Product;
    index: number;
  } | null>(null);

  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          daysLeft(a.openedAt, a.shelfLifeDays, today) -
          daysLeft(b.openedAt, b.shelfLifeDays, today),
      ),
    [products, today],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const { removed, index } = removeProduct(id);
      if (removed) setUndoable({ product: removed, index });
    },
    [removeProduct],
  );

  // Yan etki updater'ın içinde olmamalı: StrictMode updater'ları iki kez
  // çağırır ve ürün iki kez geri eklenirdi.
  const handleUndo = useCallback(() => {
    if (!undoable) return;
    restoreProduct(undoable.product, undoable.index);
    setUndoable(null);
  }, [undoable, restoreProduct]);

  const handleDismiss = useCallback(() => setUndoable(null), []);

  // today yalnızca istemcide dolu olur; liste hidrasyondan sonra çizilir
  const ready = today !== "";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Refrigerator size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            BayatlamaSavar
          </h1>
          <p className="text-sm text-slate-400">
            Açtığın gıdaları takip et, israfı önle.
          </p>
        </div>
      </header>

      <AddProductForm today={today} onAdd={addProduct} />

      <section className="mt-8">
        {!ready ? null : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 px-6 py-16 text-center">
            <PackageOpen size={32} className="text-slate-600" />
            <p className="text-sm text-slate-400">
              Henüz takip ettiğin bir ürün yok.
              <br />
              Yukarıdan ilk ürününü ekle.
            </p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-medium text-slate-400">
              Takiptekiler ({sorted.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  today={today}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {undoable ? (
        <UndoToast
          key={undoable.product.id}
          productName={undoable.product.name}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
        />
      ) : null}
    </main>
  );
}
