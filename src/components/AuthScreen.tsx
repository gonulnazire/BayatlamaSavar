"use client";

import { useState } from "react";
import { LogIn, Refrigerator, TriangleAlert, UserPlus } from "lucide-react";

type Props = {
  onSignIn(email: string, password: string): Promise<void>;
  onSignUp(email: string, password: string): Promise<void>;
};

export default function AuthScreen({ onSignIn, onSignUp }: Props) {
  // ProductForm'un ekleme/düzenleme kipiyle aynı desen: tek form, iki kip
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setBusy(true);
    setError(null);
    try {
      if (isSignUp) await onSignUp(trimmedEmail, password);
      else await onSignIn(trimmedEmail, password);
    } catch (caught) {
      // Spec §7: teknik detay yalnızca console'a
      console.error("BayatlamaSavar kimlik hatası:", caught);
      setError(
        isSignUp
          ? "Kayıt olunamadı. E-postanı ve şifreni kontrol et."
          : "Giriş yapılamadı. E-postanı ve şifreni kontrol et.",
      );
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Refrigerator size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            BayatlamaSavar
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Ürünlerin tüm cihazlarında aynı kalsın diye giriş yapman gerekiyor.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
      >
        <div>
          <label htmlFor="email" className={labelClass}>
            E-posta
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Şifre
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
            required
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30"
          >
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSignUp ? <UserPlus size={16} /> : <LogIn size={16} />}
          {isSignUp ? "Kayıt ol" : "Giriş yap"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        {isSignUp ? "Hesabın var mı?" : "Hesabın yok mu?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsSignUp((current) => !current);
            setError(null);
          }}
          className="font-medium text-emerald-400 underline-offset-2 hover:underline"
        >
          {isSignUp ? "Giriş yap" : "Kayıt ol"}
        </button>
      </p>
    </main>
  );
}
