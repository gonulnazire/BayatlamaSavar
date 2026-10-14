import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import AddProductForm from "@/components/AddProductForm";

const TODAY = "2026-10-14";

describe("AddProductForm", () => {
  test("açılış tarihi varsayılan olarak bugünü gösterir", () => {
    render(<AddProductForm today={TODAY} onAdd={vi.fn()} />);
    expect(screen.getByLabelText("Açılış Tarihi")).toHaveValue(TODAY);
  });

  test("raf ömrü varsayılan 3 gün gelir", () => {
    render(<AddProductForm today={TODAY} onAdd={vi.fn()} />);
    expect(screen.getByLabelText("Raf Ömrü (gün)")).toHaveValue(3);
  });

  test("dolu formu gönderince ürünü iletir", async () => {
    const onAdd = vi.fn();
    render(<AddProductForm today={TODAY} onAdd={onAdd} />);

    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Pınar Labne");
    await userEvent.selectOptions(
      screen.getByLabelText("Kategori"),
      "Sos/Konserve",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd.mock.calls[0][0]).toMatchObject({
      name: "Pınar Labne",
      category: "Sos/Konserve",
      openedAt: TODAY,
      shelfLifeDays: 3,
    });
  });

  test("her ürüne kimlik verir", async () => {
    const onAdd = vi.fn();
    render(<AddProductForm today={TODAY} onAdd={onAdd} />);
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Süt");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    const id = onAdd.mock.calls[0][0].id;
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("ürün adının boşluklarını kırpar", async () => {
    const onAdd = vi.fn();
    render(<AddProductForm today={TODAY} onAdd={onAdd} />);
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "  Yoğurt  ");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onAdd.mock.calls[0][0].name).toBe("Yoğurt");
  });

  test("boş adla gönderimi reddeder", async () => {
    const onAdd = vi.fn();
    render(<AddProductForm today={TODAY} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  test("gönderimden sonra formu temizler", async () => {
    render(<AddProductForm today={TODAY} onAdd={vi.fn()} />);
    const name = screen.getByLabelText("Ürün Adı");

    await userEvent.type(name, "Süt");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(name).toHaveValue("");
    expect(screen.getByLabelText("Açılış Tarihi")).toHaveValue(TODAY);
    expect(screen.getByLabelText("Raf Ömrü (gün)")).toHaveValue(3);
  });

  test("kullanıcı tarihi değiştirince onu korur", async () => {
    const onAdd = vi.fn();
    render(<AddProductForm today={TODAY} onAdd={onAdd} />);

    const date = screen.getByLabelText("Açılış Tarihi");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-10-10");
    await userEvent.type(screen.getByLabelText("Ürün Adı"), "Salça");
    await userEvent.click(screen.getByRole("button", { name: "Ekle" }));

    expect(onAdd.mock.calls[0][0].openedAt).toBe("2026-10-10");
  });
});
