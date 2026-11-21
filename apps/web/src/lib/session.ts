import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@repo/auth/server";

export const getSession = async () => auth.api.getSession({ headers: await headers() });

/** Server-side guard: unauthenticated visitors go to sign-in and come back to `next`. */
export async function requireSession(next: string) {
  const session = await getSession();
  if (!session) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
  return session;
}
