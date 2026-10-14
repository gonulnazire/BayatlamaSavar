import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import UndoToast from "@/components/UndoToast";

afterEach(() => {
  vi.useRealTimers();
});

describe("UndoToast", () => {
  test("hangi ürünün kaldırıldığını yazar", () => {
    render(
      <UndoToast productName="Sütaş Süt" onUndo={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText("Sütaş Süt")).toBeInTheDocument();
    expect(screen.getByText(/listeden kaldırıldı/)).toBeInTheDocument();
  });

  test("ekran okuyuculara bildirir", () => {
    render(<UndoToast productName="Süt" onUndo={vi.fn()} onDismiss={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  test("Geri al'a basınca onUndo çağrılır", async () => {
    const onUndo = vi.fn();
    render(<UndoToast productName="Süt" onUndo={onUndo} onDismiss={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Geri al/ }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  test("6 saniyeden önce kendini kapatmaz", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast productName="Süt" onUndo={vi.fn()} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test("6 saniye sonra kendini kapatır", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<UndoToast productName="Süt" onUndo={vi.fn()} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
