import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/product-editor";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "New product · Admin" };

export default async function NewProductPage() {
  await requireAdmin("/admin/inventory/new");
  const categories = await (await sessionCaller()).admin.products.categories();
  return (
    <div>
      <h1 className="text-display-md">New product</h1>
      <div className="mt-8 max-w-3xl">
        <ProductEditor categories={categories} />
      </div>
    </div>
  );
}
