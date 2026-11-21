"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@repo/auth/client";
import { useTRPC } from "@/lib/trpc";

/** Heart toggle. Signed-out visitors are sent to sign-in and brought back here. */
export function WishlistButton({ productId, name }: { productId: string; name: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const ids = useQuery({ ...trpc.wishlist.ids.queryOptions(), enabled: !!session });
  const toggle = useMutation(
    trpc.wishlist.toggle.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.wishlist.ids.queryKey() }),
    }),
  );
  const saved = ids.data?.includes(productId) ?? false;

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => (session ? toggle.mutate({ productId }) : router.push(`/account/sign-in?next=${encodeURIComponent(pathname)}`))}
      className="flex items-center gap-2 text-label uppercase transition-transform duration-100 active:scale-[0.97] disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6}>
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" strokeLinejoin="round" />
      </svg>
      <span>{saved ? "Saved" : "Save"}</span>
      <span className="sr-only"> {name} to wishlist</span>
    </button>
  );
}
