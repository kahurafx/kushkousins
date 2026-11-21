import { formatKES } from "@repo/ui";

// shortcut: token preview only; replaced by the real landing page in Phase 2.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-24">
      <h1 className="font-display text-display-xl">kushkousins</h1>
      <p className="text-label uppercase">New · One-of-a-kind upcycled</p>
      <div className="flex gap-6">
        <div className="relative h-80 w-60 bg-stone chamfer-md">
          <span className="absolute left-5 top-5 bg-tangerine px-2 py-1 text-label uppercase text-forest">Upcycled</span>
          <p className="absolute bottom-6 left-5 text-price tabular-nums">{formatKES(1250000)}</p>
        </div>
      </div>
    </main>
  );
}
