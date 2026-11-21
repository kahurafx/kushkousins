import Link from "next/link";
import { SignOutButton } from "@/components/account-client";
import { getSession } from "@/lib/session";

const links = [
  { href: "/account", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
];

// Each page guards itself (requireSession) so sign-in can return to the exact page.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-forest/10 pb-6">
        <div>
          <p className="text-label uppercase opacity-60">Your account</p>
          <h1 className="mt-2 text-display-lg">{session ? `Hello, ${session.user.name.split(" ")[0]}` : "Account"}</h1>
        </div>
        {session && <SignOutButton />}
      </div>
      <nav aria-label="Account" className="mt-6">
        <ul className="flex gap-6">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-label uppercase underline-offset-8 hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-10">{children}</div>
    </main>
  );
}
