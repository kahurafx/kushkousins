import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@repo/auth/redirect";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · kushkousins" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-16">
      <h1 className="text-display-lg">Sign in</h1>
      <AuthForm mode="sign-in" next={next} />
    </main>
  );
}
