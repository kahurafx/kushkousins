"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bagDrawer, useCartCount } from "@/lib/cart";
import { BagIcon } from "./product-card";

const nav = [
  { href: "/shop/new", label: "New Arrivals" },
  { href: "/shop/upcycled", label: "Upcycled" },
  { href: "/shop/all", label: "Collections" },
  { href: "/about", label: "About Us" },
];

const iconButton =
  "grid size-10 place-items-center outline-offset-2 outline-forest transition-transform duration-100 active:scale-[0.97] focus-visible:outline-2";

export function SiteHeader() {
  const count = useCartCount();
  const pathname = usePathname();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  return (
    <header className="sticky top-0 z-40 bg-canvas/80 backdrop-blur-md [@media(prefers-reduced-transparency:reduce)]:bg-canvas [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-20 md:px-8">
        <nav aria-label="Main" className="flex items-center">
          <button
            type="button"
            className={`${iconButton} md:hidden`}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 8h16M4 16h16"} />
            </svg>
          </button>
          <ul className="hidden gap-6 md:flex lg:gap-8">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={pathname === n.href ? "page" : undefined}
                  className="text-label uppercase underline-offset-[6px] hover:underline aria-[current=page]:underline"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/" className="font-display text-display-sm md:text-display-md" aria-label="kushkousins, home">
          kushkousins
        </Link>

        <div className="flex items-center justify-end gap-1">
          {searching ? (
            <form
              role="search"
              className="flex items-center"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchRef.current?.value.trim();
                setSearching(false);
                router.push(q ? `/shop/all?q=${encodeURIComponent(q)}` : "/shop/all");
              }}
            >
              <label htmlFor="site-search" className="sr-only">
                Search products
              </label>
              <input
                id="site-search"
                ref={searchRef}
                type="search"
                placeholder="Search"
                onKeyDown={(e) => e.key === "Escape" && setSearching(false)}
                onBlur={(e) => !e.currentTarget.value && setSearching(false)}
                className="w-32 border-b border-forest bg-transparent py-1 text-body-sm outline-none sm:w-48"
              />
            </form>
          ) : (
            <button type="button" className={iconButton} onClick={() => setSearching(true)}>
              <span className="sr-only">Search</span>
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <Link href="/account" className={`${iconButton} max-sm:hidden`}>
            <span className="sr-only">Account</span>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/account/wishlist" className={`${iconButton} max-sm:hidden`}>
            <span className="sr-only">Wishlist</span>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" strokeLinejoin="round" />
            </svg>
          </Link>
          <button type="button" className={`${iconButton} relative`} onClick={bagDrawer.open}>
            <span className="sr-only">Bag, {count} {count === 1 ? "item" : "items"}</span>
            <BagIcon className="size-5" />
            {count > 0 && (
              <span aria-hidden className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-tangerine px-1 text-[0.625rem] font-medium leading-4 text-forest tabular-nums">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-forest/10 px-4 pb-6 md:hidden">
          <ul className="flex flex-col">
            {[...nav, { href: "/account", label: "Account" }, { href: "/account/wishlist", label: "Wishlist" }].map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setMenuOpen(false)} className="block py-3 text-label uppercase">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {/* Scroll-edge fade instead of a hard divider */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-canvas/70 to-transparent" />
    </header>
  );
}
