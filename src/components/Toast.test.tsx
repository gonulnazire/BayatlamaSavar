import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import Toast from "@/components/Toast";

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  test("mesajı ve eylem düğmesini gösterir", () => {
    render(<Toast message="Süt kaldırıldı" actionLabel="Geri al" onAction={vi.fn()} />);
    expect(screen.getByText("Süt kaldırıldı")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Geri al" })).toBeInTheDocument();
  });

  test("role status ve aria-live polite taşır", () => {
    render(<Toast message="Süt kaldırıldı" actionLabel="Geri al" onAction={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  test("eylem düğmesi onAction çağırır", async () => {
    const onAction = vi.fn();
    render(<Toast message="Süt kaldırıldı" actionLabel="Geri al" onAction={onAction} />);
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  test("autoDismissMs verilince süre sonunda onDismiss çağırır", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Süt kaldırıldı"
        actionLabel="Geri al"
        onAction={vi.fn()}
        autoDismissMs={6000}
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("autoDismissMs verilmezse kendiliğinden kapanmaz", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Kaydedilemedi"
        actionLabel="Tekrar dene"
        onAction={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
