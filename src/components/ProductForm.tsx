"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { CATEGORIES, type Category, type Product } from "@/types/product";

type Props = {
  /** Varsayılan açılış tarihi (istemcide hesaplanır) */
  today: string;
  /**
   * Doluysa form düzenleme kipindedir ve alanlar bu kayıttan dolar.
   * Üst bileşen `key` ile formu yeniden kurar; bu sayede alanları
   * prop'tan doldurmak için effect içinde setState'e gerek kalmaz.
   */
  initial?: Product | null;
  onSubmit: (product: Product) => void | Promise<void>;
  onCancel?: () => void;
  /** Yazma uçuşta: alanlar kilitli, buton devre dışı */
  saving?: boolean;
};

export default function ProductForm({
  today,
  initial,
  onSubmit,
  onCancel,
  saving = false,
}: Props) {
  const isEditing = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>(
    initial?.category ?? CATEGORIES[0],
  );
  // null = "kullanıcı dokunmadı", bugünün tarihi kullanılsın
  const [openedAtInput, setOpenedAtInput] = useState<string | null>(
    initial?.openedAt ?? null,
  );
  const [shelfLifeDays, setShelfLifeDays] = useState(
    String(initial?.shelfLifeDays ?? 3),
  );

  const openedAt = openedAtInput ?? today;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const days = Number(shelfLifeDays);
    if (!trimmed || !openedAt || !Number.isFinite(days) || days < 0) return;

    try {
      await onSubmit({
        id: initial?.id ?? crypto.randomUUID(),
        name: trimmed,
        category,
        openedAt,
        shelfLifeDays: Math.floor(days),
      });
    } catch {
      // Kaydedilemediyse alanlar KORUNUR: kullanıcı yazdığını kaybetmesin
      return;
    }

    if (isEditing) return; // üst bileşen düzenleme kipini kapatır
    setName("");
    setCategory(CATEGORIES[0]);
    setOpenedAtInput(null);
    setShelfLifeDays("3");
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label={isEditing ? "Ürünü düzenle" : "Yeni ürün ekle"}
      className={`rounded-2xl border p-4 transition sm:p-5 ${
        isEditing
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-slate-800 bg-slate-900/50"
      }`}
    >
      {isEditing ? (
        <p className="mb-4 text-sm text-emerald-300">
          <span className="font-semibold">{initial?.name}</span> düzenleniyor
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Ürün Adı
          </label>
          <input
            id="name"
            disabled={saving}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Sütaş Süt"
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Kategori
          </label>
          <select
            id="category"
            disabled={saving}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={fieldClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="openedAt" className={labelClass}>
            Açılış Tarihi
          </label>
          <input
            id="openedAt"
            disabled={saving}
            type="date"
            value={openedAt}
            onChange={(e) => setOpenedAtInput(e.target.value)}
            className={`${fieldClass} [color-scheme:dark]`}
            required
          />
        </div>

        <div>
          <label htmlFor="shelfLife" className={labelClass}>
            Raf Ömrü (gün)
          </label>
          <input
            id="shelfLife"
            disabled={saving}
            type="number"
            min={0}
            max={365}
            value={shelfLifeDays}
            onChange={(e) => setShelfLifeDays(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div className="flex gap-3 sm:col-span-2 lg:col-span-3 lg:self-end">
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEditing ? <Check size={16} /> : <Plus size={16} />}
            {isEditing ? "Kaydet" : "Ekle"}
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <X size={16} />
              Vazgeç
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
