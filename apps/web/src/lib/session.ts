import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@repo/auth/permissions";
import { auth } from "@repo/auth/server";

export const getSession = async () => auth.api.getSession({ headers: await headers() });

/** Server-side guard: unauthenticated visitors go to sign-in and come back to `next`. */
export async function requireSession(next: string) {
  const session = await getSession();
  if (!session) redirect(`/account/sign-in?next=${encodeURIComponent(next)}`);
  return session;
}

/**
 * Admin guard for every admin page (layouts and pages render in parallel, so a layout-only
 * guard isn't enough). Signed out → sign-in; signed in but not admin → 404 (don't reveal /admin).
 */
export async function requireAdmin(next: string) {
  const session = await requireSession(next);
  if (!isAdmin(session.user)) notFound();
  return session;
}
