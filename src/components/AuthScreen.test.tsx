import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import AuthScreen from "@/components/AuthScreen";

function setup(overrides: {
  onSignIn?: () => Promise<void>;
  onSignUp?: () => Promise<void>;
} = {}) {
  const onSignIn = vi.fn(overrides.onSignIn ?? (async () => {}));
  const onSignUp = vi.fn(overrides.onSignUp ?? (async () => {}));
  render(<AuthScreen onSignIn={onSignIn} onSignUp={onSignUp} />);
  return { onSignIn, onSignUp };
}

beforeEach(() => {
  // Hata yolu bilinçli olarak console'a yazıyor; test çıktısı kirlenmesin
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("AuthScreen", () => {
  test("varsayılan olarak giriş kipinde açılır", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Giriş yap" }),
    ).toBeInTheDocument();
  });

  test("kayıt kipine geçince buton metni değişir", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Kayıt ol/ }));
    expect(screen.getByRole("button", { name: "Kayıt ol" })).toBeInTheDocument();
  });

  test("e-posta ve şifreyle giriş çağırır", async () => {
    const { onSignIn } = setup();

    await userEvent.type(screen.getByLabelText("E-posta"), "ev@ornek.com");
    await userEvent.type(screen.getByLabelText("Şifre"), "parola123");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(onSignIn).toHaveBeenCalledExactlyOnceWith(
      "ev@ornek.com",
      "parola123",
    );
  });

  test("boş alanla gönderimi reddeder", async () => {
    const { onSignIn } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));
    expect(onSignIn).not.toHaveBeenCalled();
  });

  test("hata mesajını gösterir", async () => {
    setup({
      onSignIn: async () => {
        throw new Error("Invalid login credentials");
      },
    });

    await userEvent.type(screen.getByLabelText("E-posta"), "ev@ornek.com");
    await userEvent.type(screen.getByLabelText("Şifre"), "yanlis");
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  test("gönderim sırasında buton devre dışı", async () => {
    let release: (() => void) | undefined;
    setup({
      onSignIn: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });

    await userEvent.type(screen.getByLabelText("E-posta"), "ev@ornek.com");
    await userEvent.type(screen.getByLabelText("Şifre"), "parola123");
    await userEvent.click(screen.getByRole("button", { name: /Giriş/ }));

    expect(screen.getByRole("button", { name: /Giriş/ })).toBeDisabled();
    release?.();
  });
});
