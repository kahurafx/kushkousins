import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { requireSession } from "@/lib/session";
import { toShowcaseItem } from "@/lib/showcase";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Wishlist · kushkousins" };

export default async function WishlistPage() {
  await requireSession("/account/wishlist");
  const products = await (await sessionCaller()).wishlist.list();
  if (products.length === 0) {
    return (
      <p className="text-body">
        Nothing saved yet. Tap the heart on any piece to keep it here.{" "}
        <Link href="/shop/all" className="underline underline-offset-4">Browse</Link>
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard item={toShowcaseItem(p)} />
        </li>
      ))}
    </ul>
  );
}
