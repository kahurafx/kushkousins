"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MotionConfig, Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import type { RouterOutputs } from "@repo/api";
import { salePriceCents } from "@repo/types";
import { formatKES, spring } from "@repo/ui";
import { useTRPC } from "@/lib/trpc";

type Data = RouterOutputs["admin"]["curation"]["get"];
type P = Data["products"][number];
type Fav = { id: string; discountPercent: number | null; featured: boolean };

const btn = "border border-forest/30 px-2 py-1 text-label uppercase transition-transform duration-100 active:scale-[0.97] disabled:opacity-30";
const primary = "bg-forest px-5 py-2.5 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50";

function Row({ id, index, total, name, onMove, onRemove, children }: {
  id: string; index: number; total: number; name: string; onMove: (from: number, to: number) => void; onRemove: () => void; children?: React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      transition={{ type: "spring", ...spring.default }}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 32px -12px rgb(28 43 33 / 0.35)" }}
      className="relative flex flex-wrap items-center gap-3 border border-forest/15 bg-canvas p-3"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${name}`}
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none px-1 text-lg leading-none opacity-60 active:cursor-grabbing"
      >
        ⠿
      </button>
      <span className="w-6 text-right text-body-sm tabular-nums opacity-60">{index + 1}</span>
      <span className="min-w-0 flex-1 font-medium">{name}</span>
      {children}
      <div className="flex gap-1">
        <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Move ${name} up`}>↑</button>
        <button type="button" className={btn} disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label={`Move ${name} down`}>↓</button>
        <button type="button" className={btn} onClick={onRemove} aria-label={`Remove ${name}`}>✕</button>
      </div>
    </Reorder.Item>
  );
}

function AddPicker({ options, onAdd, label }: { options: P[]; onAdd: (id: string) => void; label: string }) {
  const [pick, setPick] = useState("");
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <label className="sr-only" htmlFor={`add-${label}`}>{label}</label>
      <select id={`add-${label}`} value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm">
        <option value="">{label}…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.mode === "UPCYCLED" ? " (1-of-1)" : ""}{p.status === "sold" ? " · sold" : ""}</option>
        ))}
      </select>
      <button type="button" className={btn} disabled={!pick} onClick={() => {
          onAdd(pick);
          setPick("");
        }}>Add</button>
    </div>
  );
}

export function CurationBoard({ data }: { data: Data }) {
  const trpc = useTRPC();
  const router = useRouter();
  const byId = new Map(data.products.map((p) => [p.id, p]));
  const [line, setLine] = useState(data.hangingLine);
  const [favs, setFavs] = useState<Fav[]>(
    data.fanFavorites.map((id) => ({ id, discountPercent: byId.get(id)!.discountPercent, featured: byId.get(id)!.featured })),
  );
  const [announce, setAnnounce] = useState("");
  const saveLine = useMutation(trpc.admin.curation.setHangingLine.mutationOptions({ onSuccess: () => router.refresh() }));
  const saveFavs = useMutation(trpc.admin.curation.setFanFavorites.mutationOptions({ onSuccess: () => router.refresh() }));

  const lineDirty = line.join() !== data.hangingLine.join();
  const favsDirty =
    favs.map((f) => f.id).join() !== data.fanFavorites.join() ||
    favs.some((f) => f.discountPercent !== byId.get(f.id)!.discountPercent || f.featured !== byId.get(f.id)!.featured);

  const move = <T,>(list: T[], from: number, to: number) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    return next;
  };
  const nameOf = (id: string) => byId.get(id)?.name ?? "Product";

  return (
    <MotionConfig reducedMotion="user">
      <p aria-live="polite" className="sr-only">{announce}</p>
      <div className="grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="hl-title">
          <h2 id="hl-title" className="text-display-sm">The Hanging Line</h2>
          <p className="mt-1 text-body-sm opacity-70">Hero rack on the homepage, left to right. Drag the handle or use the arrows.</p>
          <Reorder.Group axis="y" values={line} onReorder={setLine} className="mt-4 space-y-2">
            {line.map((id, i) => (
              <Row
                key={id}
                id={id}
                index={i}
                total={line.length}
                name={nameOf(id)}
                onMove={(from, to) => {
                  setLine((l) => move(l, from, to));
                  setAnnounce(`${nameOf(id)} moved to position ${to + 1} of ${line.length}`);
                }}
                onRemove={() => {
                  setLine((l) => l.filter((x) => x !== id));
                  setAnnounce(`${nameOf(id)} removed from the Hanging Line`);
                }}
              />
            ))}
          </Reorder.Group>
          {line.length === 0 && <p className="mt-4 text-body-sm opacity-70">The rack is empty; the homepage hero will be blank.</p>}
          <AddPicker label="Add to the rack" options={data.products.filter((p) => !line.includes(p.id))} onAdd={(id) => setLine((l) => [...l, id])} />
          <div className="mt-6 flex items-center gap-4">
            <button type="button" className={primary} disabled={!lineDirty || saveLine.isPending} onClick={() => saveLine.mutate({ ids: line })}>
              {saveLine.isPending ? "Saving…" : "Save rack"}
            </button>
            <span role="status" className="text-body-sm">
              {saveLine.error ? saveLine.error.message : lineDirty ? "Unsaved changes" : saveLine.isSuccess ? "Saved" : ""}
            </span>
          </div>
        </section>

        <section aria-labelledby="ff-title">
          <h2 id="ff-title" className="text-display-sm">Fan Favorites</h2>
          <p className="mt-1 text-body-sm opacity-70">
            Discounts are stored on the product and <strong className="font-medium">apply site-wide</strong>. ★ marks an editor&apos;s pick everywhere it appears.
          </p>
          <Reorder.Group axis="y" values={favs.map((f) => f.id)} onReorder={(ids) => setFavs((fs) => ids.map((id) => fs.find((f) => f.id === id)!))} className="mt-4 space-y-2">
            {favs.map((f, i) => {
              const p = byId.get(f.id)!;
              const set = (patch: Partial<Fav>) => setFavs((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
              return (
                <Row
                  key={f.id}
                  id={f.id}
                  index={i}
                  total={favs.length}
                  name={p.name}
                  onMove={(from, to) => {
                    setFavs((fs) => move(fs, from, to));
                    setAnnounce(`${p.name} moved to position ${to + 1} of ${favs.length}`);
                  }}
                  onRemove={() => {
                    setFavs((fs) => fs.filter((x) => x.id !== f.id));
                    setAnnounce(`${p.name} removed from Fan Favorites`);
                  }}
                >
                  <label className="flex items-center gap-1 text-body-sm">
                    <span className="sr-only">Discount for {p.name}</span>
                    <input
                      value={f.discountPercent ?? ""}
                      inputMode="numeric"
                      placeholder="0"
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, "").slice(0, 2));
                        set({ discountPercent: n ? Math.min(90, n) : null });
                      }}
                      className="w-12 border border-forest/25 bg-transparent px-1.5 py-1 text-right tabular-nums"
                    />
                    % <span className="hidden tabular-nums opacity-60 sm:inline">→ {formatKES(salePriceCents({ priceCents: p.priceCents, discountPercent: f.discountPercent }))}</span>
                  </label>
                  <label className="flex items-center gap-1 text-body-sm">
                    <input type="checkbox" checked={f.featured} onChange={(e) => set({ featured: e.target.checked })} />★<span className="sr-only"> editor&apos;s pick for {p.name}</span>
                  </label>
                </Row>
              );
            })}
          </Reorder.Group>
          <AddPicker
            label="Add a favourite"
            options={data.products.filter((p) => !favs.some((f) => f.id === p.id))}
            onAdd={(id) => setFavs((fs) => [...fs, { id, discountPercent: byId.get(id)!.discountPercent, featured: false }])}
          />
          <div className="mt-6 flex items-center gap-4">
            <button type="button" className={primary} disabled={!favsDirty || saveFavs.isPending} onClick={() => saveFavs.mutate({ items: favs })}>
              {saveFavs.isPending ? "Saving…" : "Save favourites"}
            </button>
            <span role="status" className="text-body-sm">
              {saveFavs.error ? saveFavs.error.message : favsDirty ? "Unsaved changes" : saveFavs.isSuccess ? "Saved" : ""}
            </span>
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
