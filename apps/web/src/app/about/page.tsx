import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About us · kushkousins" };

// shortcut: placeholder brand copy; replace with the founders' own words.
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-16 md:px-8">
      <p className="text-label uppercase opacity-60">About us</p>
      <h1 className="mt-4 text-display-lg">Two ways to dress: new, and never again.</h1>
      <div className="mt-10 space-y-6 text-body">
        <p>
          kushkousins makes clothing in Nairobi in two ways. Our <strong className="font-medium">New</strong> line is cut in small
          runs from fabrics we&apos;d wear ourselves. Our <strong className="font-medium">Upcycled</strong> pieces are rebuilt by hand
          from garments and textiles that already lived a life, so each exists exactly once.
        </p>
        <p>Every 1-of-1 carries its provenance: what it was made from, and a note from the hands that remade it.</p>
      </div>
      <div className="mt-12 flex gap-6">
        <Link href="/shop/new" className="text-label uppercase underline underline-offset-4">Shop New</Link>
        <Link href="/shop/upcycled" className="text-label uppercase underline underline-offset-4">Shop Upcycled</Link>
      </div>
    </main>
  );
}
