import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ImportPrompt from "@/components/ImportPrompt";

describe("ImportPrompt", () => {
  test("ürün sayısını mesajda gösterir", () => {
    render(<ImportPrompt count={12} busy={false} onImport={vi.fn()} />);
    expect(screen.getByText(/12 ürün/)).toBeInTheDocument();
  });

  test("Aktar düğmesi onImport çağırır", async () => {
    const onImport = vi.fn();
    render(<ImportPrompt count={3} busy={false} onImport={onImport} />);
    await userEvent.click(screen.getByRole("button", { name: /Aktar/ }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  test("busy iken düğme devre dışı", () => {
    render(<ImportPrompt count={3} busy onImport={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Aktar/ })).toBeDisabled();
  });
});
