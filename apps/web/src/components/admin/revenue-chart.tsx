"use client";

import { useState } from "react";
import { formatKES } from "@repo/ui";

type Day = { day: string; cents: number };

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-KE", opts);
const compactKES = (kes: number) => (kes >= 1000 ? `${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 1 }).format(kes / 1000)}K` : String(kes));

/** Clean ticks (1/2/5 × 10ⁿ) so the axis reads 0 / 10K / 20K, never 0 / 7,333. */
function ticksFor(maxKes: number) {
  if (maxKes <= 0) return [0];
  const rough = maxKes / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  return Array.from({ length: Math.ceil(maxKes / step) + 1 }, (_, i) => i * step);
}

/** Single-series daily revenue. Bars ≤24px, 4px rounded data-end, hover/focus tooltip, table view. */
export function RevenueChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const kes = days.map((d) => d.cents / 100);
  const ticks = ticksFor(Math.max(...kes, 0));
  const top = ticks[ticks.length - 1] || 1;
  const empty = kes.every((v) => v === 0);
  const H = 200;

  const move = (to: number) => setActive(Math.max(0, Math.min(days.length - 1, to)));

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-label uppercase">Revenue, last 30 days</span>
        <span className="text-body-sm opacity-70">Paid, processing, shipped and delivered orders</span>
      </figcaption>

      <div className="relative mt-6 flex gap-3">
        {/* y-axis labels */}
        <div className="relative w-10 shrink-0 text-right text-[0.6875rem] tabular-nums opacity-60" style={{ height: H }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compactKES(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* recessive hairline grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }} aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-forest/10" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>

          <div
            role="application"
            aria-roledescription="bar chart"
            aria-label="Daily revenue. Use left and right arrow keys to read each day."
            tabIndex={0}
            onFocus={() => active === null && setActive(days.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              const to = { ArrowRight: (active ?? -1) + 1, ArrowLeft: (active ?? days.length) - 1, Home: 0, End: days.length - 1 }[e.key];
              if (to === undefined) return;
              e.preventDefault();
              move(to);
            }}
            onPointerLeave={() => setActive(null)}
            className="relative flex items-end outline-offset-4 outline-forest focus-visible:outline-2"
            style={{ height: H }}
          >
            {days.map((d, i) => (
              // The whole column slot is the hit target, not just the painted bar.
              <div
                key={d.day}
                className="flex h-full flex-1 items-end justify-center px-px"
                onPointerEnter={() => setActive(i)}
              >
                <div
                  className={`w-full max-w-6 rounded-t-[4px] transition-colors duration-100 ${active === i ? "bg-espresso" : "bg-forest"}`}
                  style={{ height: kes[i]! > 0 ? `max(2px, ${(kes[i]! / top) * 100}%)` : 0 }}
                />
              </div>
            ))}
            {empty && (
              <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-body-sm opacity-60">No paid orders in the last 30 days.</p>
            )}

            {active !== null && (
              <div
                role="status"
                className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-x-1/2 bg-canvas px-3 py-2 shadow-[0_8px_24px_-8px_rgb(28_43_33/0.35)]"
                style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
              >
                <p className="text-price font-medium tabular-nums">{formatKES(days[active]!.cents)}</p>
                <p className="text-[0.6875rem] opacity-70">{fmtDay(days[active]!.day, { weekday: "short", day: "numeric", month: "short" })}</p>
              </div>
            )}
          </div>

          {/* x-axis: weekly labels + the last day */}
          <div className="relative mt-2 h-4 text-[0.6875rem] opacity-60" aria-hidden>
            {days.map((d, i) =>
              (days.length - 1 - i) % 7 === 0 ? (
                <span key={d.day} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / days.length) * 100}%` }}>
                  {fmtDay(d.day)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-label uppercase opacity-70">Show as table</summary>
        <table className="mt-3 w-full max-w-sm text-body-sm tabular-nums">
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 font-medium">Day</th>
              <th scope="col" className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-forest/10">
                <td className="py-1">{fmtDay(d.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1 text-right">{formatKES(d.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
