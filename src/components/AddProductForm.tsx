"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CATEGORIES, type Category, type Product } from "@/types/product";

type Props = {
  /** Varsayılan açılış tarihi (istemcide hesaplanır) */
  today: string;
  onAdd: (product: Product) => void;
};

export default function AddProductForm({ today, onAdd }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  // null = "kullanıcı dokunmadı", bugünün tarihi kullanılsın
  const [openedAtInput, setOpenedAtInput] = useState<string | null>(null);
  const [shelfLifeDays, setShelfLifeDays] = useState("3");

  const openedAt = openedAtInput ?? today;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const days = Number(shelfLifeDays);
    if (!trimmed || !openedAt || !Number.isFinite(days) || days < 0) return;

    onAdd({
      id: crypto.randomUUID(),
      name: trimmed,
      category,
      openedAt,
      shelfLifeDays: Math.floor(days),
    });

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
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="name" className={labelClass}>
            Ürün Adı
          </label>
          <input
            id="name"
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
            type="number"
            min={0}
            max={365}
            value={shelfLifeDays}
            onChange={(e) => setShelfLifeDays(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3 lg:self-end">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Plus size={16} />
            Ekle
          </button>
        </div>
      </div>
    </form>
  );
}
