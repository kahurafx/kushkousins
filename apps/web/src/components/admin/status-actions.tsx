"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { ProductStatus } from "@repo/types";
import { useTRPC } from "@/lib/trpc";

type Props = { id: string; mode: "NEW" | "UPCYCLED"; status: ProductStatus };

export function StatusActions({ id, mode, status }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const set = useMutation(trpc.admin.products.setStatus.mutationOptions({ onSuccess: () => router.refresh() }));

  const actions: { to: ProductStatus; label: string }[] = [
    ...(mode === "UPCYCLED" && status === "active" ? [{ to: "sold" as const, label: "Mark sold" }] : []),
    ...(mode === "UPCYCLED" && status === "sold" ? [{ to: "active" as const, label: "Mark available" }] : []),
    ...(status !== "archived" ? [{ to: "archived" as const, label: "Archive (hide from shop)" }] : [{ to: "active" as const, label: "Restore to shop" }]),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-body-sm">
        Status: <strong className="font-medium capitalize">{status}</strong>
      </span>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={set.isPending}
          onClick={() => set.mutate({ id, status: a.to })}
          className="border border-forest px-3 py-1.5 text-label uppercase transition-transform duration-100 active:scale-[0.97] disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
      {set.error && <p role="alert" className="w-full text-body-sm text-espresso">{set.error.message}</p>}
    </div>
  );
}
