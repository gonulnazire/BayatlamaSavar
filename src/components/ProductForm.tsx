"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { CATEGORIES, type Category, type Product } from "@/types/product";

type Props = {
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

/**
 * Formun henüz göstermediği alanların yeni ürün için varsayılanları.
 * Miktar/birim, saklama yeri ve açılma bilgisi bir sonraki adımda
 * arayüze gelecek; model şimdiden taşıyor.
 */
const VARSAYILANLAR = {
  quantity: 1,
  unit: "adet",
  storagePlace: "Buzdolabı",
  isOpened: false,
  openedAt: null,
  state: "active",
  createdAt: null,
} as const;

export default function ProductForm({
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
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !expiresOn) return;

    try {
      await onSubmit({
        // Düzenleme kipinde formda OLMAYAN alanlar olduğu gibi korunur;
        // yoksa görünmeyen bir alan sessizce varsayılana döner.
        ...(initial ?? { ...VARSAYILANLAR, id: crypto.randomUUID() }),
        name: trimmed,
        category,
        expiresOn,
      });
    } catch {
      // Kaydedilemediyse alanlar KORUNUR: kullanıcı yazdığını kaybetmesin
      return;
    }

    if (isEditing) return; // üst bileşen düzenleme kipini kapatır
    setName("");
    setCategory(CATEGORIES[0]);
    setExpiresOn("");
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
          <label htmlFor="expiresOn" className={labelClass}>
            Son Kullanma Tarihi
          </label>
          <input
            id="expiresOn"
            disabled={saving}
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={`${fieldClass} [color-scheme:dark]`}
            required
          />
        </div>

        <div className="flex gap-3 sm:col-span-2 lg:col-span-4">
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
