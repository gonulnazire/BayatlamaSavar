import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProductForm from "@/components/ProductForm";
import type { Product } from "@/types/product";

const TODAY = "2026-10-14";

const existing: Product = {
  id: "p1",
  name: "Tat Salça",
  category: "Sos/Konserve",
  openedAt: "2026-10-10",
  shelfLifeDays: 7,
};

describe("ProductForm — ekleme kipi", () => {
  test("açılış tarihi varsayılan olarak bugünü gösterir", () => {
    render(<ProductForm today={TODAY} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Açılış Tarihi")).toHaveValue(TODAY);
  });

  test("raf ömrü varsayılan 3 gün gelir", () => {
    render(<ProductForm today={TODAY} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Raf Ömrü (gün)")).toHaveValue(3);
  });

  test("buton Ekle yazar, Vazgeç görünmez", () => {
    render(<ProductForm today={TODAY} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Vazgeç/ }),
    ).not.toBeInTheDocument();
  });

  test("dolu formu gönderince ürünü iletir", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Pınar Labne");
    await userEvent.selectOptions(
      screen.getByLabelText("Kategori"),
      "Sos/Konserve",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Pınar Labne",
      category: "Sos/Konserve",
      openedAt: TODAY,
      shelfLifeDays: 3,
    });
  });

  test("her yeni ürüne kimlik verir", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Süt");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    const id = onSubmit.mock.calls[0][0].id;
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("ürün adının boşluklarını kırpar", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "  Yoğurt  ");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit.mock.calls[0][0].name).toBe("Yoğurt");
  });

  test("boş adla gönderimi reddeder", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("gönderimden sonra formu temizler", async () => {
    render(<ProductForm today={TODAY} onSubmit={vi.fn()} />);
    const name = screen.getByLabelText("Ürün Adı");

    await userEvent.type(name, "Süt");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(name).toHaveValue("");
    expect(screen.getByLabelText("Açılış Tarihi")).toHaveValue(TODAY);
    expect(screen.getByLabelText("Raf Ömrü (gün)")).toHaveValue(3);
  });

  test("kullanıcı tarihi değiştirince onu korur", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} onSubmit={onSubmit} />);

    const date = screen.getByLabelText("Açılış Tarihi");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-10-10");
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Salça");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(onSubmit.mock.calls[0][0].openedAt).toBe("2026-10-10");
  });
});

describe("ProductForm — düzenleme kipi", () => {
  test("alanları mevcut kayıttan doldurur", () => {
    render(<ProductForm today={TODAY} initial={existing} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Ürün Adı")).toHaveValue("Tat Salça");
    expect(screen.getByLabelText("Kategori")).toHaveValue("Sos/Konserve");
    expect(screen.getByLabelText("Açılış Tarihi")).toHaveValue("2026-10-10");
    expect(screen.getByLabelText("Raf Ömrü (gün)")).toHaveValue(7);
  });

  test("hangi ürünün düzenlendiğini yazar", () => {
    render(<ProductForm today={TODAY} initial={existing} onSubmit={vi.fn()} />);
    expect(screen.getByText(/düzenleniyor/)).toBeInTheDocument();
  });

  test("buton Kaydet yazar", () => {
    render(<ProductForm today={TODAY} initial={existing} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();
  });

  test("kaydederken aynı id'yi korur", async () => {
    const onSubmit = vi.fn();
    render(<ProductForm today={TODAY} initial={existing} onSubmit={onSubmit} />);

    const name = screen.getByLabelText("Ürün Adı");
    await userEvent.clear(name);
    await userEvent.type(name, "Tat Salça 700g");
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      id: "p1",
      name: "Tat Salça 700g",
      category: "Sos/Konserve",
      openedAt: "2026-10-10",
      shelfLifeDays: 7,
    });
  });

  test("kaydettikten sonra alanları temizlemez", async () => {
    render(<ProductForm today={TODAY} initial={existing} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    expect(screen.getByLabelText("Ürün Adı")).toHaveValue("Tat Salça");
  });

  test("Vazgeç onCancel çağırır", async () => {
    const onCancel = vi.fn();
    render(
      <ProductForm
        today={TODAY}
        initial={existing}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Vazgeç/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("form etiketi kipe göre değişir", () => {
    const { unmount } = render(
      <ProductForm today={TODAY} onSubmit={vi.fn()} />,
    );
    expect(
      screen.getByRole("form", { name: "Yeni ürün ekle" }),
    ).toBeInTheDocument();
    unmount();

    render(<ProductForm today={TODAY} initial={existing} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("form", { name: "Ürünü düzenle" }),
    ).toBeInTheDocument();
  });
});
