import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin · kushkousins", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 pb-24 pt-8 md:grid-cols-[12rem_minmax(0,1fr)] md:px-8">
      <AdminNav />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
