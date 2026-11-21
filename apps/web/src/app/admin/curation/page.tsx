import type { Metadata } from "next";
import Link from "next/link";
import { CurationBoard } from "@/components/admin/curation-board";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Curation · Admin" };

export default async function CurationPage() {
  await requireAdmin("/admin/curation");
  const data = await (await sessionCaller()).admin.curation.get();
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display-md">Landing page curation</h1>
        <Link href="/" className="text-label uppercase underline underline-offset-4">View homepage</Link>
      </div>
      <div className="mt-8">
        <CurationBoard data={data} />
      </div>
    </div>
  );
}
