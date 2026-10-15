import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProductForm from "@/components/ProductForm";
import type { Product } from "@/types/product";

const mevcut: Product = {
  id: "p1",
  name: "Pınar Labne",
  category: "Süt Ürünü",
  quantity: 2,
  unit: "paket",
  expiresOn: "2026-10-20",
  storagePlace: "Dondurucu",
  isOpened: true,
  openedAt: "2026-10-12",
  state: "active",
  createdAt: "2026-10-01",
};

function renderForm(props: Partial<React.ComponentProps<typeof ProductForm>> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<ProductForm onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { onSubmit, onCancel };
}

const alanlar = () => ({
  ad: screen.getByLabelText("Ürün Adı"),
  kategori: screen.getByLabelText("Kategori"),
  skt: screen.getByLabelText("Son Kullanma Tarihi"),
});

describe("ProductForm — ekleme kipi", () => {
  test("boş bir form çizer", () => {
    renderForm();
    expect(alanlar().ad).toHaveValue("");
    expect(alanlar().skt).toHaveValue("");
    expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument();
  });

  test("yedi kategoriyi de sunar", () => {
    renderForm();
    expect(screen.getAllByRole("option")).toHaveLength(7);
    expect(screen.getByRole("option", { name: "Sebze" })).toBeInTheDocument();
  });

  test("ad boşken gönderim onSubmit'i çağırmaz", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(alanlar().skt, "2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("son kullanma tarihi boşken gönderim onSubmit'i çağırmaz", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(alanlar().ad, "Süt");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("yeni ürünü varsayılan alanlarla üretir", async () => {
    const { onSubmit } = renderForm();
    await userEvent.type(alanlar().ad, "  Süt  ");
    await userEvent.selectOptions(alanlar().kategori, "Sebze");
    await userEvent.type(alanlar().skt, "2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const gonderilen = onSubmit.mock.calls[0][0] as Product;
    expect(gonderilen).toMatchObject({
      name: "Süt",
      category: "Sebze",
      expiresOn: "2026-10-20",
      quantity: 1,
      unit: "adet",
      storagePlace: "Buzdolabı",
      isOpened: false,
      openedAt: null,
      state: "active",
      createdAt: null,
    });
    expect(gonderilen.id).toBeTruthy();
  });

  test("başarılı gönderimden sonra alanları temizler", async () => {
    renderForm();
    await userEvent.type(alanlar().ad, "Süt");
    await userEvent.type(alanlar().skt, "2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(alanlar().ad).toHaveValue("");
  });

  test("gönderim reddedilirse alanlar korunur", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("ağ yok"));
    render(<ProductForm onSubmit={onSubmit} />);
    await userEvent.type(alanlar().ad, "Süt");
    await userEvent.type(alanlar().skt, "2026-10-20");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(alanlar().ad).toHaveValue("Süt");
  });

  test("saving iken alanlar ve düğme kilitli", () => {
    renderForm({ saving: true });
    expect(alanlar().ad).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ekle" })).toBeDisabled();
  });
});

describe("ProductForm — düzenleme kipi", () => {
  test("alanları mevcut kayıttan doldurur", () => {
    renderForm({ initial: mevcut });
    expect(alanlar().ad).toHaveValue("Pınar Labne");
    expect(alanlar().skt).toHaveValue("2026-10-20");
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
  });

  test("kaydederken id'yi korur", async () => {
    const { onSubmit } = renderForm({ initial: mevcut });
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect((onSubmit.mock.calls[0][0] as Product).id).toBe("p1");
  });

  // Form bu alanları GÖSTERMİYOR; göstermediğini ezmemeli.
  test("formda olmayan alanları olduğu gibi korur", async () => {
    const { onSubmit } = renderForm({ initial: mevcut });
    await userEvent.clear(alanlar().ad);
    await userEvent.type(alanlar().ad, "Labne");
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Labne",
      quantity: 2,
      unit: "paket",
      storagePlace: "Dondurucu",
      isOpened: true,
      openedAt: "2026-10-12",
      state: "active",
      createdAt: "2026-10-01",
    });
  });

  test("Vazgeç onCancel'ı çağırır", async () => {
    const { onCancel } = renderForm({ initial: mevcut });
    await userEvent.click(screen.getByRole("button", { name: /Vazgeç/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
