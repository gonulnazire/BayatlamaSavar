import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/product";

const sut: Product = {
  id: "p1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  quantity: 1,
  unit: "L",
  expiresOn: "2026-10-17",
  storagePlace: "Buzdolabı",
  isOpened: false,
  openedAt: null,
  state: "active",
  createdAt: "2026-10-14",
};

function renderCard(
  today = "2026-10-14",
  disabled = false,
  product: Product = sut,
) {
  const onEdit = vi.fn();
  const onConsume = vi.fn();
  render(
    <ProductCard
      product={product}
      today={today}
      onEdit={onEdit}
      onConsume={onConsume}
      disabled={disabled}
    />,
  );
  return { onEdit, onConsume };
}

describe("ProductCard", () => {
  test("ürün adını ve kategorisini gösterir", () => {
    renderCard();
    expect(screen.getByText("Sütaş Süt")).toBeInTheDocument();
    expect(screen.getByText(/Süt Ürünü/)).toBeInTheDocument();
  });

  test("miktarı ve birimi gösterir", () => {
    renderCard("2026-10-14", false, { ...sut, quantity: 2, unit: "L" });
    expect(screen.getByText(/2 L/)).toBeInTheDocument();
  });

  test("saklama yerini gösterir", () => {
    renderCard("2026-10-14", false, { ...sut, storagePlace: "Dondurucu" });
    expect(screen.getByText("Dondurucu")).toBeInTheDocument();
  });

  // Eşik değişti: 3 gün artık Güvenli değil, Dikkat.
  test("4 gün kalan üründe Güvenli rozeti gösterir", () => {
    renderCard("2026-10-13");
    expect(screen.getByText("4 gün kaldı")).toBeInTheDocument();
    expect(screen.getByText("Güvenli")).toBeInTheDocument();
  });

  test("3 gün kalan üründe Dikkat rozeti gösterir", () => {
    renderCard("2026-10-14");
    expect(screen.getByText("3 gün kaldı")).toBeInTheDocument();
    expect(screen.getByText("Dikkat")).toBeInTheDocument();
  });

  test("son gününde Süresi Doldu rozeti ve Son gün yazar", () => {
    renderCard("2026-10-17");
    expect(screen.getByText("Son gün")).toBeInTheDocument();
    expect(screen.getByText("Süresi Doldu")).toBeInTheDocument();
  });

  test("süre geçtiğinde kaç gün geçtiğini yazar", () => {
    renderCard("2026-10-19");
    expect(screen.getByText("2 gün geçti")).toBeInTheDocument();
  });

  test("son kullanma tarihini Türkçe yazar", () => {
    renderCard();
    expect(screen.getByText(/17 Eki 2026/)).toBeInTheDocument();
  });

  test("açılmış üründe açılma tarihini de yazar", () => {
    renderCard("2026-10-14", false, {
      ...sut,
      isOpened: true,
      openedAt: "2026-10-12",
    });
    expect(screen.getByText(/12 Eki 2026 tarihinde açıldı/)).toBeInTheDocument();
  });

  test("açılmamış üründe açılma bilgisi yazmaz", () => {
    renderCard();
    expect(screen.queryByText(/tarihinde açıldı/)).not.toBeInTheDocument();
  });

  test("onConsume ürünün id'siyle çağırır", async () => {
    const { onConsume } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /Tükettim/ }));
    expect(onConsume).toHaveBeenCalledExactlyOnceWith("p1");
  });

  test("disabled iken düğmeler devre dışı", () => {
    renderCard("2026-10-14", true);
    expect(screen.getByRole("button", { name: /Tükettim/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /düzenle/i })).toBeDisabled();
  });

  test("düzenle butonu ürünün id'siyle çağırır", async () => {
    const { onEdit } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /düzenle/i }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("p1");
  });
});
