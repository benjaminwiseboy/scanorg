"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "./brand";
import { PasswordInput } from "./password-input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    const res =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(f.get("name")) });
    setPending(false);
    if (res.error) {
      setError(
        mode === "login"
          ? "Email ou mot de passe incorrect."
          : res.error.message ?? "Inscription impossible.",
      );
      return;
    }
    router.push(mode === "login" ? "/campaigns" : "/onboarding");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <Brand />
      <p className="mt-1 text-sm text-muted">Scanner de Vitalité LF™ — pilote</p>
      <form onSubmit={onSubmit} className="card mt-8 space-y-4">
        <h1 className="font-serif text-xl">{mode === "login" ? "Connexion" : "Créer un compte administrateur"}</h1>
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">Nom</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <PasswordInput
            id="password" name="password" required minLength={10}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && <p className="mt-1 text-xs text-muted">10 caractères minimum.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-critique">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer le compte"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>Pas encore de compte ? <Link className="text-accent underline" href="/register">Créer un compte</Link></>
        ) : (
          <>Déjà inscrit ? <Link className="text-accent underline" href="/login">Se connecter</Link></>
        )}
      </p>
    </main>
  );
}
