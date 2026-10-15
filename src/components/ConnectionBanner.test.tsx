import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ConnectionBanner from "@/components/ConnectionBanner";
import type { StoreStatus } from "@/lib/product-store";

function setup(
  overrides: {
    status?: StoreStatus;
    lastSyncedAt?: string | null;
    dropped?: number;
    cacheWritable?: boolean;
  } = {},
) {
  const onRetry = vi.fn();
  const { container } = render(
    <ConnectionBanner
      status={overrides.status ?? "ready"}
      lastSyncedAt={
        overrides.lastSyncedAt === undefined
          ? "2026-10-14T11:32:00.000Z"
          : overrides.lastSyncedAt
      }
      dropped={overrides.dropped ?? 0}
      cacheWritable={overrides.cacheWritable ?? true}
      onRetry={onRetry}
    />,
  );
  return { onRetry, container };
}

describe("ConnectionBanner", () => {
  test("status ready ve sorun yokken hiçbir şey çizmez", () => {
    const { container } = setup();
    expect(container).toBeEmptyDOMElement();
  });

  test("status offline iken son güncelleme saatini gösterir", () => {
    setup({ status: "offline" });
    expect(screen.getByText(/Çevrimdışı/)).toBeInTheDocument();
    expect(screen.getByText(/son güncelleme/)).toBeInTheDocument();
  });

  test("status offline iken Tekrar dene onRetry çağırır", async () => {
    const { onRetry } = setup({ status: "offline" });
    await userEvent.click(screen.getByRole("button", { name: /Tekrar dene/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("status loading iken güncelleniyor göstergesi çizer", () => {
    setup({ status: "loading" });
    expect(screen.getByText(/Güncelleniyor/)).toBeInTheDocument();
  });

  test("dropped sıfırdan büyükken kaç kaydın okunamadığını yazar", () => {
    setup({ dropped: 3 });
    expect(screen.getByText(/3 kayıt okunamadı/)).toBeInTheDocument();
  });

  test("cacheWritable false iken çevrimdışı uyarısı gösterir", () => {
    // Review Focus 3: önbellek yazılamıyorsa kullanıcı bunu boş liste
    // olarak değil, açık bir uyarı olarak görmeli.
    setup({ cacheWritable: false });
    expect(
      screen.getByText(/çevrimdışıyken listeni gösteremeyebilir/i),
    ).toBeInTheDocument();
  });
});
