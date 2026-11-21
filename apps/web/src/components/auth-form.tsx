"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@repo/auth/client";

const field = "mt-1 block w-full border border-forest/25 bg-transparent px-3 py-3 text-body outline-offset-2 outline-forest focus-visible:outline-2";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signUp = mode === "sign-up";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    const { error } = signUp
      ? await authClient.signUp.email({ email, password, name: String(f.get("name")).trim() })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) return setError(error.message ?? "Something went wrong. Please try again.");
    router.replace(next);
    router.refresh();
  }

  const other = `${signUp ? "/account/sign-in" : "/account/sign-up"}?next=${encodeURIComponent(next)}`;
  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate={false}>
      {signUp && (
        <label className="block text-label uppercase">
          Name
          <input name="name" required autoComplete="name" maxLength={120} className={field} />
        </label>
      )}
      <label className="block text-label uppercase">
        Email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className="block text-label uppercase">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={signUp ? "new-password" : "current-password"}
          aria-describedby={signUp ? "pw-hint" : undefined}
          className={field}
        />
        {signUp && (
          <span id="pw-hint" className="mt-1 block normal-case tracking-normal opacity-70">
            At least 8 characters.
          </span>
        )}
      </label>
      {error && (
        <p role="alert" className="text-body-sm text-espresso">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-forest py-4 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50"
      >
        {pending ? "One moment…" : signUp ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-body-sm">
        {signUp ? "Already have an account? " : "New to kushkousins? "}
        <Link href={other} className="underline underline-offset-4">
          {signUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
