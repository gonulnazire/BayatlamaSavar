import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import FilterBar from "@/components/FilterBar";
import type { StatusFilter } from "@/lib/product-filter";

const counts: Record<StatusFilter, number> = {
  all: 5,
  safe: 2,
  warning: 2,
  expired: 1,
};

function setup(query = "", status: StatusFilter = "all") {
  const onQueryChange = vi.fn();
  const onStatusChange = vi.fn();
  render(
    <FilterBar
      query={query}
      status={status}
      counts={counts}
      onQueryChange={onQueryChange}
      onStatusChange={onStatusChange}
    />,
  );
  return { onQueryChange, onStatusChange };
}

describe("FilterBar — arama", () => {
  test("yazılan metni iletir", async () => {
    const { onQueryChange } = setup();
    await userEvent.type(screen.getByLabelText("Ürün ara"), "s");
    expect(onQueryChange).toHaveBeenCalledExactlyOnceWith("s");
  });

  test("sorgu boşken temizle butonu görünmez", () => {
    setup("");
    expect(
      screen.queryByRole("button", { name: "Aramayı temizle" }),
    ).not.toBeInTheDocument();
  });

  test("sorgu varken temizle butonu sorguyu sıfırlar", async () => {
    const { onQueryChange } = setup("süt");
    await userEvent.click(
      screen.getByRole("button", { name: "Aramayı temizle" }),
    );
    expect(onQueryChange).toHaveBeenCalledExactlyOnceWith("");
  });
});

describe("FilterBar — durum düğmeleri", () => {
  test("dört durumu sayılarıyla gösterir", () => {
    setup();
    // Erişilebilir ad doğal okunmalı: "Tümü5" değil "Tümü, 5 ürün"
    expect(
      screen.getByRole("button", { name: "Tümü, 5 ürün" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Güvenli, 2 ürün" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dikkat, 2 ürün" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Süresi Doldu, 1 ürün" }),
    ).toBeInTheDocument();
  });

  test("etkin düğmeyi işaretler", () => {
    setup("", "warning");
    expect(screen.getByRole("button", { name: /Dikkat/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Tümü/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("düğmeye basınca durumu iletir", async () => {
    const { onStatusChange } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Süresi Doldu/ }));
    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("expired");
  });
});
