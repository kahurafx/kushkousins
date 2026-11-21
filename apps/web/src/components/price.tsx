import { formatKES } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";

export function Price({ item, className = "" }: { item: Pick<ShowcaseItem, "priceCents" | "salePriceCents">; className?: string }) {
  const discounted = item.salePriceCents < item.priceCents;
  return (
    <p className={`text-price tabular-nums ${className}`}>
      {discounted && (
        <>
          <span className="sr-only">Was </span>
          <s className="mr-2 opacity-60">{formatKES(item.priceCents)}</s>
          <span className="sr-only">now </span>
        </>
      )}
      {formatKES(item.salePriceCents)}
    </p>
  );
}
