"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "@repo/auth/client";
import { useTRPC } from "@/lib/trpc";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      className="text-label uppercase underline-offset-4 hover:underline"
    >
      Sign out
    </button>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const cancel = useMutation(trpc.order.cancel.mutationOptions({ onSuccess: () => router.refresh() }));
  return (
    <button
      type="button"
      disabled={cancel.isPending}
      onClick={() => cancel.mutate({ orderId })}
      className="text-label uppercase underline underline-offset-4 disabled:opacity-50"
    >
      {cancel.isPending ? "Cancelling…" : "Cancel & release items"}
    </button>
  );
}
