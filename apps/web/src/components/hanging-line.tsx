"use client";

import Link from "next/link";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { hangingLine, partingOffset, spring, swingImpulse } from "@repo/ui";
import { availabilityLabel, type ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";
import { Price } from "./price";

type LineItem = ShowcaseItem & { category: string | null };

const transition = { type: "spring", ...spring.default } as const;
const snappy = { type: "spring", ...spring.snappy } as const;

/** Wall-mounted metal rail: a lit cylinder (sheen on top, rim light below) between two brackets. */
function Rail() {
  const bracket =
    "absolute -top-2.5 h-[26px] w-[7px] rounded-[2px] bg-[linear-gradient(to_right,var(--color-graphite),color-mix(in_srgb,var(--color-steel)_55%,var(--color-graphite))_45%,var(--color-graphite))] shadow-[2px_6px_8px_-3px_rgb(28_43_33/0.4)]";
  return (
    <li aria-hidden className="pointer-events-none absolute inset-x-3 top-10 z-10 md:inset-x-8">
      <div className="h-[6px] rounded-full bg-[linear-gradient(to_bottom,var(--color-steel)_0%,var(--color-graphite)_38%,var(--color-graphite)_78%,color-mix(in_srgb,var(--color-steel)_45%,var(--color-graphite))_100%)] shadow-[0_9px_10px_-6px_rgb(28_43_33/0.45)]" />
      <div className={`${bracket} left-0`} />
      <div className={`${bracket} right-0`} />
    </li>
  );
}

/** One garment on the rail. Its <li> and button never rotate, so a swinging hem can't steal hover. */
function Slot({
  item,
  index,
  count,
  active,
  select,
  reduce,
  handSpeed,
}: {
  item: LineItem;
  index: number;
  count: number;
  active: number | null;
  select: (i: number) => void;
  reduce: boolean;
  handSpeed: RefObject<number>;
}) {
  const isActive = active === index;
  const rotate = useMotionValue(0);

  // Push the hanger: the kick adds to whatever swing is live, so a second brush never restarts it.
  const kick = (clientX: number, target: Element, speed: number) => {
    if (reduce) return;
    const box = target.getBoundingClientRect();
    const impulse = swingImpulse(clientX, box.left + box.width / 2, speed);
    animate(rotate, 0, { type: "spring", ...hangingLine.swing, velocity: rotate.getVelocity() + impulse });
  };

  const badge = availabilityLabel(item) ?? (item.mode === "UPCYCLED" ? "1-of-1" : null);

  return (
    <li
      // self-start: the slot is its own garment's height, so the tag hangs from this hem, not the row's.
      className="relative w-32 shrink-0 self-start sm:w-36 lg:w-40"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        select(index);
        kick(e.clientX, e.currentTarget, handSpeed.current);
      }}
      // Focus (keyboard, or the focus a click brings) dims and tags but never swings.
      onFocus={() => select(index)}
    >
      <motion.div
        animate={{
          x: reduce ? 0 : partingOffset(index, active),
          opacity: active !== null && !isActive ? hangingLine.dimOpacity : 1,
        }}
        transition={{ x: transition, opacity: reduce ? { duration: 0.15 } : snappy }}
      >
        <button
          type="button"
          aria-expanded={isActive}
          aria-controls={`hl-tag-${item.id}`}
          aria-label={`${item.name}, ${item.mode === "UPCYCLED" ? "one of a kind" : "new"}`}
          // A tap is a gentle nudge (slowest kick); pointerdown runs before focus selects it.
          onPointerDown={(e) => e.pointerType !== "mouse" && !isActive && kick(e.clientX, e.currentTarget, 0)}
          // Click selects (never toggles): a tap fires pointerenter→click, toggling would close it.
          onClick={() => select(index)}
          // Photos are cropped with the hook tip at the top edge: lift it so the hook rests on the rod.
          className="block w-full -translate-y-0.5 cursor-pointer outline-offset-4 outline-forest focus-visible:outline-2"
        >
          {/* Pivot at the hook (top-centre of every cut-out). */}
          <motion.div className="pointer-events-none" style={{ rotate, transformOrigin: "50% 0%" }}>
            <GarmentArt item={item} hanger className="h-auto w-full drop-shadow-[0_18px_16px_rgb(28_43_33/0.16)]" />
          </motion.div>
        </button>
      </motion.div>

      {/* Hang-tag under the hem. It follows the swing's lead by a beat and leaves at once. */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            id={`hl-tag-${item.id}`}
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0.15 } : { ...snappy, delay: 0.06 } }}
            exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.12 } }}
            // Edge tags align inward so the rack's scroll edge never clips them.
            className={`absolute inset-x-0 top-full z-20 flex flex-col ${
              index === 0 ? "items-start" : index === count - 1 ? "items-end" : "items-center"
            }`}
          >
            <span aria-hidden className="h-3 w-px self-center bg-forest/30" />
            <Link
              href={`/product/${item.slug}`}
              className="w-max bg-stone px-3.5 py-2.5 chamfer-sm outline-offset-4 outline-forest focus-visible:outline-2"
            >
              <span className="sr-only">{item.name}: </span>
              <span className="flex items-center gap-1.5 text-label uppercase">
                {item.category}
                {item.category && badge && <span aria-hidden>·</span>}
                {badge && <span className={item.mode === "UPCYCLED" ? "bg-tangerine px-1 text-forest" : ""}>{badge}</span>}
              </span>
              <Price item={item} className="mt-1" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * The Hanging Line hero. Hover brushes a garment: it swings on its hook, the rest dim and part,
 * and its hang-tag appears. Keyboard focus and tap select the same way (see DESIGN.md › Motion).
 */
export function HangingLine({ items }: { items: LineItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion() ?? false;
  const rackRef = useRef<HTMLDivElement>(null);
  // Signed horizontal hand velocity (px/s) across the rack, sampled on move: pointerenter's own movementX is unreliable.
  const handSpeed = useRef(0);
  const lastMove = useRef<{ x: number; t: number } | null>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    const onDown = (e: PointerEvent) => {
      if (!rackRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [active]);

  return (
    <section aria-label="The Hanging Line" className="w-full">
      <div
        ref={rackRef}
        onPointerMove={(e) => {
          const prev = lastMove.current;
          if (prev && e.timeStamp > prev.t) handSpeed.current = ((e.clientX - prev.x) / (e.timeStamp - prev.t)) * 1000;
          lastMove.current = { x: e.clientX, t: e.timeStamp };
        }}
        // Clear only when the mouse leaves the whole rack, so crossing gaps never flickers the tag.
        onPointerLeave={(e) => {
          lastMove.current = null;
          handSpeed.current = 0;
          if (e.pointerType === "mouse") setActive(null);
        }}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setActive(null)}
        className="overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {/* pt/pb reserve room for the swing and the hang-tag: overflow-x clips the y axis too */}
        <ul className="relative mx-auto flex w-max gap-4 px-8 pt-10 pb-32 sm:gap-6 md:px-16">
          <Rail />
          {items.map((item, i) => (
            <Slot
              key={item.id}
              item={item}
              index={i}
              count={items.length}
              active={active}
              select={setActive}
              reduce={reduce}
              handSpeed={handSpeed}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
