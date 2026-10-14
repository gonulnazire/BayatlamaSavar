"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CloudOff,
  LogOut,
  PackageOpen,
  Refrigerator,
  RotateCcw,
  SearchX,
} from "lucide-react";
import AuthScreen from "@/components/AuthScreen";
import ConnectionBanner from "@/components/ConnectionBanner";
import FilterBar from "@/components/FilterBar";
import ProductCard from "@/components/ProductCard";
import ProductForm from "@/components/ProductForm";
import Toast from "@/components/Toast";
import UndoToast from "@/components/UndoToast";
import type { Product } from "@/types/product";
import { daysLeft } from "@/lib/date";
import {
  countByStatus,
  filterProducts,
  type StatusFilter,
} from "@/lib/product-filter";
import { productStore } from "@/lib/product-store";
import { signIn, signOut, signUp, useSession } from "@/lib/useSession";
import { useProducts } from "@/lib/storage";
import { useToday } from "@/lib/useToday";

export default function Home() {
  const {
    products,
    status: syncStatus,
    saving,
    error,
    dropped,
    cacheWritable,
    lastSyncedAt,
    addProduct,
    updateProduct,
    consumeProduct,
    restoreProduct,
    retry,
  } = useProducts();
  const today = useToday();
  const session = useSession();

  // Oturum hazır olunca store'u bir kez başlat. Bileşen state'i değişmediği
  // için "effect içinde setState" yasağına girmiyor.
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (session.status !== "signedIn") return;
    if (initializedFor.current === session.userId) return;
    initializedFor.current = session.userId;
    void productStore.init(session.userId);
  }, [session]);

  // Geri alma için silinen kaydın kendisi tutulur; soft delete sayesinde
  // sıra numarası gerekmiyor, liste zaten aciliyete göre sıralanıyor.
  const [undoable, setUndoable] = useState<Product | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Listeden türetilir: düzenlenen ürün silinirse kip kendiliğinden kapanır
  const editing = editingId
    ? (products.find((p) => p.id === editingId) ?? null)
    : null;

  const sorted = useMemo(
    () =>
      [...products].sort(
        (a, b) =>
          daysLeft(a.openedAt, a.shelfLifeDays, today) -
          daysLeft(b.openedAt, b.shelfLifeDays, today),
      ),
    [products, today],
  );

  const visible = useMemo(
    () => filterProducts(sorted, { query, status }, today),
    [sorted, query, status, today],
  );

  const counts = useMemo(() => countByStatus(products, today), [products, today]);

  const handleSubmit = useCallback(
    (product: Product) => {
      if (editing) {
        updateProduct(product);
        setEditingId(null);
      } else {
        addProduct(product);
      }
    },
    [editing, updateProduct, addProduct],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const target = products.find((p) => p.id === id) ?? null;
      try {
        await consumeProduct(id);
        setUndoable(target);
      } catch {
        // Hata store durumunda; aşağıdaki Toast gösteriyor
      }
    },
    [products, consumeProduct],
  );

  // Yan etki updater'ın içinde olmamalı: StrictMode updater'ları iki kez
  // çağırır ve ürün iki kez geri eklenirdi.
  const handleUndo = useCallback(async () => {
    if (!undoable) return;
    try {
      await restoreProduct(undoable.id);
      setUndoable(null);
    } catch {
      // Hata store durumunda; aşağıdaki Toast gösteriyor
    }
  }, [undoable, restoreProduct]);

  const handleDismiss = useCallback(() => setUndoable(null), []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatus("all");
  }, []);

  // today yalnızca istemcide dolu olur; liste hidrasyondan sonra çizilir
  const ready = today !== "";
  const isFiltered = query.trim() !== "" || status !== "all";

  if (session.status === "unknown") {
    // Oturum okunurken giriş ekranının bir an parlamasını önler
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="size-11 animate-pulse rounded-xl bg-slate-800" />
          <div className="flex flex-col gap-2">
            <span className="h-6 w-48 animate-pulse rounded bg-slate-800" />
            <span className="h-4 w-64 animate-pulse rounded bg-slate-800/70" />
          </div>
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-slate-900/60" />
      </main>
    );
  }

  if (session.status === "signedOut") {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Refrigerator size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            BayatlamaSavar
          </h1>
          <p className="truncate text-sm text-slate-400">{session.email}</p>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Çıkış</span>
        </button>
      </header>

      <ProductForm
        key={editing?.id ?? "yeni"}
        today={today}
        initial={editing}
        onSubmit={handleSubmit}
        onCancel={() => setEditingId(null)}
        saving={saving}
      />

      <div className="mt-6">
        <ConnectionBanner
          status={syncStatus}
          lastSyncedAt={lastSyncedAt}
          dropped={dropped}
          cacheWritable={cacheWritable}
          onRetry={() => void retry()}
        />
      </div>

      {!ready ? null : products.length === 0 &&
        syncStatus === "loading" &&
        !error ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-slate-900/60"
            />
          ))}
        </div>
      ) : products.length === 0 && error ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 px-6 py-16 text-center">
          <CloudOff size={32} className="text-slate-600" />
          <p className="text-sm text-slate-400">{error.message}</p>
          <button
            type="button"
            onClick={() => void retry()}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <RotateCcw size={15} />
            Tekrar dene
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 px-6 py-16 text-center">
          <PackageOpen size={32} className="text-slate-600" />
          <p className="text-sm text-slate-400">
            Henüz takip ettiğin bir ürün yok.
            <br />
            Yukarıdan ilk ürününü ekle.
          </p>
        </div>
      ) : (
        <section className="mt-8 flex flex-col gap-5">
          <FilterBar
            query={query}
            status={status}
            counts={counts}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
          />

          <h2 className="text-sm font-medium text-slate-400">
            {isFiltered
              ? `${visible.length} / ${products.length} ürün`
              : `Takiptekiler (${products.length})`}
          </h2>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
              <SearchX size={28} className="text-slate-600" />
              <p className="text-sm text-slate-400">
                Bu filtreye uyan ürün yok.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Filtreyi temizle
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  today={today}
                  onEdit={setEditingId}
                  onConsume={handleDelete}
                  disabled={saving}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {error && products.length > 0 ? (
        <Toast
          key={error.message}
          message={error.message}
          actionLabel="Tekrar dene"
          onAction={() => void retry()}
        />
      ) : undoable ? (
        <UndoToast
          key={undoable.id}
          productName={undoable.name}
          onUndo={handleUndo}
          onDismiss={handleDismiss}
        />
      ) : null}
    </main>
  );
}
