"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc";

/** Manual reservation expiry until Phase 6 automates it with the M-Pesa timeout. */
export function ReleaseStale() {
  const trpc = useTRPC();
  const router = useRouter();
  const [minutes, setMinutes] = useState(60);
  const release = useMutation(trpc.admin.releaseStale.mutationOptions({ onSuccess: () => router.refresh() }));
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-body-sm">
      <label htmlFor="stale-minutes" className="sr-only">Older than</label>
      <select id="stale-minutes" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="border border-forest/25 bg-transparent px-2 py-1">
        <option value={30}>Older than 30 min</option>
        <option value={60}>Older than 1 hour</option>
        <option value={360}>Older than 6 hours</option>
        <option value={1440}>Older than 1 day</option>
      </select>
      <button
        type="button"
        disabled={release.isPending}
        onClick={() => release.mutate({ olderThanMinutes: minutes })}
        className="bg-forest px-3 py-1.5 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50"
      >
        {release.isPending ? "Releasing…" : "Release"}
      </button>
      <span role="status" className="opacity-70">
        {release.data ? `${release.data.released} released` : release.error ? release.error.message : ""}
      </span>
    </div>
  );
}
