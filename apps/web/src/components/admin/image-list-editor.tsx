"use client";

export type ImageRow = { key: string; url: string; color: string; label: string };

let imageKey = 0;
export const newImageRow = (r: Partial<ImageRow> = {}): ImageRow => ({ key: `i${++imageKey}`, url: "", color: "", label: "", ...r });

const input = "w-full border border-forest/25 bg-transparent px-2 py-1.5 aria-invalid:border-espresso";

/**
 * Photos for a product: add by URL (uploads come later), optionally tag each with a colour so the
 * product page shows it for that colour, reorder (first = the main photo on cards and the rail).
 * `colors` empty = no colour tagging (1-of-1 pieces have a single colour).
 */
export function ImageListEditor({
  rows,
  onChange,
  colors,
  error,
}: {
  rows: ImageRow[];
  onChange: (rows: ImageRow[]) => void;
  colors: string[];
  error: (index: number) => Record<string, unknown>;
}) {
  const patch = (key: string, p: Partial<ImageRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (from: number, to: number) => {
    const next = [...rows];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    onChange(next);
  };
  const btn = "text-label uppercase underline underline-offset-4 disabled:no-underline disabled:opacity-30";

  return (
    <div>
      {rows.length > 0 && (
        <ol className="space-y-3">
          {rows.map((r, i) => {
            const stale = r.color && !colors.some((c) => c.toLowerCase() === r.color.toLowerCase());
            return (
              <li key={r.key} className="grid items-start gap-2 border border-forest/15 p-3 sm:grid-cols-[4rem_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary https URL */}
                {r.url ? <img src={r.url} alt="" className="h-20 w-16 bg-stone object-contain" /> : <span className="h-20 w-16 bg-stone" aria-hidden />}
                <div className="space-y-2">
                  <input aria-label={`Photo ${i + 1} URL`} value={r.url} onChange={(e) => patch(r.key, { url: e.target.value })} placeholder="https://…" className={input} {...error(i)} />
                  <div className="flex flex-wrap items-center gap-2">
                    {colors.length > 0 && (
                      <select aria-label={`Photo ${i + 1} colour`} value={r.color} onChange={(e) => patch(r.key, { color: e.target.value })} className="border border-forest/25 bg-transparent px-2 py-1.5">
                        <option value="">All colours</option>
                        {colors.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {stale && <option value={r.color}>{r.color} (no longer a colour)</option>}
                      </select>
                    )}
                    <input aria-label={`Photo ${i + 1} label`} value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} placeholder="Label (front, back, detail)" maxLength={60} className="min-w-0 flex-1 border border-forest/25 bg-transparent px-2 py-1.5" />
                    <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move photo ${i + 1} up`}>Up</button>
                    <button type="button" className={btn} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move photo ${i + 1} down`}>Down</button>
                    <button type="button" className={btn} onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Remove photo ${i + 1}`}>Remove</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button type="button" onClick={() => onChange([...rows, newImageRow()])} disabled={rows.length >= 12} className={`${btn} mt-3`}>
        Add photo
      </button>
    </div>
  );
}
