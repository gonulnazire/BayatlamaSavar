import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ErrorBoundaryScreen from "@/app/error";

// error.tsx hatayı bilinçli olarak console'a yazar; test çıktısı kirlenmesin
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error.tsx", () => {
  test("kullanıcıya anlaşılır bir mesaj gösterir", () => {
    render(<ErrorBoundaryScreen error={new Error("patladı")} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Bir şeyler ters gitti" }),
    ).toBeInTheDocument();
  });

  test("verinin silinmediğini söyleyerek güven verir", () => {
    render(<ErrorBoundaryScreen error={new Error("patladı")} reset={vi.fn()} />);
    expect(screen.getByText(/tarayıcında duruyor, silinmedi/)).toBeInTheDocument();
  });

  test("Tekrar dene butonu reset'i çağırır", async () => {
    const reset = vi.fn();
    render(<ErrorBoundaryScreen error={new Error("patladı")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: /Tekrar dene/ }));
    expect(reset).toHaveBeenCalledOnce();
  });

  test("hatayı console'a bildirir", () => {
    const error = new Error("patladı");
    render(<ErrorBoundaryScreen error={error} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith(
      "BayatlamaSavar hata sınırı:",
      error,
    );
  });

  test("digest varsa hata kodunu gösterir", () => {
    const error = Object.assign(new Error("patladı"), { digest: "abc123" });
    render(<ErrorBoundaryScreen error={error} reset={vi.fn()} />);
    expect(screen.getByText("Hata kodu: abc123")).toBeInTheDocument();
  });

  test("digest yoksa hata kodu satırını göstermez", () => {
    render(<ErrorBoundaryScreen error={new Error("patladı")} reset={vi.fn()} />);
    expect(screen.queryByText(/Hata kodu/)).not.toBeInTheDocument();
  });
});
