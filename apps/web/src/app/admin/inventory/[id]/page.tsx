import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { ProductEditor } from "@/components/admin/product-editor";
import { StatusActions } from "@/components/admin/status-actions";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Edit product · Admin" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/inventory/${id}`);
  const trpc = await sessionCaller();
  const [product, categories] = await Promise.all([
    trpc.admin.products.byId({ id }).catch((e) => {
      if (e instanceof TRPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) notFound();
      throw e;
    }),
    trpc.admin.products.categories(),
  ]);

  return (
    <div>
      <p className="text-label uppercase opacity-60">{product.mode === "UPCYCLED" ? "Upcycled 1-of-1" : "New"}</p>
      <h1 className="mt-1 text-display-md">{product.name}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <StatusActions id={product.id} mode={product.mode} status={product.status} />
        {product.status !== "archived" && (
          <Link href={`/product/${product.slug}`} className="text-label uppercase underline underline-offset-4">View in shop</Link>
        )}
      </div>
      <div className="mt-10 max-w-3xl">
        {/* Remount after each save so the editor reloads stock (compare-and-set baseline). */}
        <ProductEditor key={product.updatedAt.toISOString()} product={product} categories={categories} />
      </div>
    </div>
  );
}
