import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/product";

const sut: Product = {
  id: "p1",
  name: "Sütaş Süt",
  category: "Süt Ürünü",
  openedAt: "2026-10-14",
  shelfLifeDays: 3,
};

function renderCard(today = "2026-10-14") {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <ProductCard
      product={sut}
      today={today}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );
  return { onEdit, onDelete };
}

describe("ProductCard", () => {
  test("ürün adını ve kategorisini gösterir", () => {
    renderCard();
    expect(screen.getByText("Sütaş Süt")).toBeInTheDocument();
    expect(screen.getByText("Süt Ürünü")).toBeInTheDocument();
  });

  test("3 gün kalan üründe Güvenli rozeti gösterir", () => {
    renderCard("2026-10-14");
    expect(screen.getByText("3 gün kaldı")).toBeInTheDocument();
    expect(screen.getByText("Güvenli")).toBeInTheDocument();
  });

  test("2 gün kalan üründe Dikkat rozeti gösterir", () => {
    renderCard("2026-10-15");
    expect(screen.getByText("2 gün kaldı")).toBeInTheDocument();
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

  test("açılış tarihini ve raf ömrünü Türkçe yazar", () => {
    renderCard();
    expect(
      screen.getByText(/14 Eki 2026 tarihinde açıldı · 3 günlük/),
    ).toBeInTheDocument();
  });

  test("sil butonu ürünün id'siyle çağırır", async () => {
    const { onDelete } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /Tükettim/ }));
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("p1");
  });

  test("düzenle butonu ürünün id'siyle çağırır", async () => {
    const { onEdit } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: /düzenle/i }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("p1");
  });
});
