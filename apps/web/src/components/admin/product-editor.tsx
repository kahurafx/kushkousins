"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { RouterOutputs } from "@repo/api";
import { AdminProductCreateSchema, AdminProductUpdateSchema, salePriceCents, slugify } from "@repo/types";
import { formatKES } from "@repo/ui";
import { useTRPC } from "@/lib/trpc";

type Product = RouterOutputs["admin"]["products"]["byId"];
type Category = RouterOutputs["admin"]["products"]["categories"][number];
type Row = { key: string; id?: string; size: string; color: string; stock: number; expectedStock?: number };

const field = "mt-1 block w-full border border-forest/25 bg-transparent px-3 py-2 text-body aria-invalid:border-espresso";
const label = "block text-label uppercase";
const hint = "mt-1 block text-[0.75rem] normal-case tracking-normal opacity-70";
let rowKey = 0;
const newRow = (r: Partial<Row> = {}): Row => ({ key: `r${++rowKey}`, size: "", color: "", stock: 0, ...r });

export function ProductEditor({ product, categories }: { product?: Product; categories: Category[] }) {
  const trpc = useTRPC();
  const router = useRouter();
  const editing = !!product;
  const upVariant = product?.mode === "UPCYCLED" ? product.variants[0] : undefined;

  const [mode, setMode] = useState<"NEW" | "UPCYCLED">(product?.mode ?? "NEW");
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceKes, setPriceKes] = useState(product ? String(product.priceCents / 100) : "");
  const [discount, setDiscount] = useState(product?.discountPercent ? String(product.discountPercent) : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [images, setImages] = useState(product?.images.join("\n") ?? "");
  const [rows, setRows] = useState<Row[]>(
    product?.mode === "NEW"
      ? product.variants.map((v) => newRow({ id: v.id, size: v.size, color: v.color, stock: v.stock, expectedStock: v.stock }))
      : [newRow({ size: "M" })],
  );
  const [size, setSize] = useState(upVariant?.size ?? "");
  const [color, setColor] = useState(upVariant?.color ?? "");
  const [originalMaterial, setOriginalMaterial] = useState(product?.originalMaterial ?? "");
  const [artisanNotes, setArtisanNotes] = useState(product?.artisanNotes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reserved = new Set(product?.reservedVariantIds ?? []);
  const create = useMutation(trpc.admin.products.create.mutationOptions());
  const update = useMutation(trpc.admin.products.update.mutationOptions());
  const pending = create.isPending || update.isPending;

  const priceCents = Math.round(Number(priceKes || "0") * 100);
  const discountPercent = discount ? Number(discount) : null;

  function payload() {
    const base = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      priceCents,
      discountPercent: discountPercent || null,
      categoryId: categoryId || null,
      images: images.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const variantRows = rows.map(({ id, size, color, stock, expectedStock }) => ({ id, size: size.trim(), color: color.trim(), stock, expectedStock }));
    return mode === "NEW"
      ? { ...base, mode, variants: variantRows }
      : { ...base, mode, size: size.trim(), color: color.trim(), originalMaterial: originalMaterial.trim(), artisanNotes: artisanNotes.trim() };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const data = editing ? { ...payload(), id: product!.id } : payload();
    const parsed = (editing ? AdminProductUpdateSchema : AdminProductCreateSchema).safeParse(data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[i.path.join(".")] ??= i.message;
      setErrors(next);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setErrors({});
    try {
      if (editing) {
        await update.mutateAsync(parsed.data as never);
        router.refresh();
        setFormError(null);
      } else {
        const created = await create.mutateAsync(parsed.data as never);
        router.push(`/admin/inventory/${created.id}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  const err = (path: string) => (errors[path] ? { "aria-invalid": true as const, "aria-describedby": `${path}-err` } : {});
  const errText = (path: string) =>
    errors[path] ? <span id={`${path}-err`} className="mt-1 block text-[0.75rem] normal-case tracking-normal text-espresso">{errors[path]}</span> : null;

  return (
    <form onSubmit={save} noValidate className="space-y-10">
      {!editing && (
        <fieldset>
          <legend className={label}>Inventory type</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["NEW", "New", "Size × colour variants with multi-unit stock."],
                ["UPCYCLED", "Upcycled 1-of-1", "A single piece with provenance. Marked sold when paid."],
              ] as const
            ).map(([value, title, text]) => (
              <label key={value} className="flex cursor-pointer gap-3 border border-forest/20 p-4 has-[:checked]:border-forest has-[:checked]:bg-stone/60">
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                <span>
                  <span className="font-medium">{title}</span>
                  <span className="block text-body-sm opacity-70">{text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section className="grid gap-5 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>
          Name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={field}
            {...err("name")}
          />
          {errText("name")}
        </label>
        <label className={`${label} sm:col-span-2`}>
          URL slug
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={field}
            {...err("slug")}
          />
          {errText("slug") ??
            (editing && slug !== product!.slug ? (
              <span className={`${hint} text-espresso opacity-100`}>Changing the slug changes this product&apos;s URL; old links will 404.</span>
            ) : (
              <span className={hint}>/product/{slug || "…"}</span>
            ))}
        </label>
        <label className={`${label} sm:col-span-2`}>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={field} {...err("description")} />
          {errText("description")}
        </label>
        <label className={label}>
          Price (KES)
          <input value={priceKes} onChange={(e) => setPriceKes(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={field} {...err("priceCents")} />
          {errText("priceCents") ?? <span className={hint}>Customers pay {formatKES(salePriceCents({ priceCents, discountPercent }))}</span>}
        </label>
        <label className={label}>
          Discount %
          <input value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="None" className={field} {...err("discountPercent")} />
          {errText("discountPercent") ?? <span className={hint}>0–90. Applies everywhere the product appears.</span>}
        </label>
        <label className={label}>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={`${label} sm:col-span-2`}>
          Image URLs
          <textarea value={images} onChange={(e) => setImages(e.target.value)} rows={3} placeholder="https://…  (one per line)" className={field} {...err("images")} />
          {errText("images") ?? errText("images.0") ?? <span className={hint}>One https URL per line, first is the main image. Uploads come later; empty shows the placeholder.</span>}
        </label>
      </section>

      {mode === "NEW" ? (
        <section>
          <h2 className={label}>Variants</h2>
          <p className={hint}>Stock saves only if nobody ordered while you were editing; otherwise you&apos;ll be asked to reload.</p>
          {errText("variants")}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-body-sm">
              <thead>
                <tr className="text-left text-label uppercase opacity-70">
                  <th scope="col" className="pb-2 font-medium">Size</th>
                  <th scope="col" className="pb-2 font-medium">Colour</th>
                  <th scope="col" className="pb-2 font-medium">Stock</th>
                  <th scope="col" className="pb-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const set = (patch: Partial<Row>) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
                  const held = !!r.id && reserved.has(r.id);
                  return (
                    <tr key={r.key} className="border-t border-forest/10">
                      <td className="py-1.5 pr-2">
                        <input aria-label={`Size, row ${i + 1}`} value={r.size} onChange={(e) => set({ size: e.target.value })} className="w-full border border-forest/25 bg-transparent px-2 py-1.5" {...err(`variants.${i}.size`)} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input aria-label={`Colour, row ${i + 1}`} value={r.color} onChange={(e) => set({ color: e.target.value })} className="w-full border border-forest/25 bg-transparent px-2 py-1.5" {...err(`variants.${i}.color`)} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input aria-label={`Stock, row ${i + 1}`} value={r.stock} inputMode="numeric" onChange={(e) => set({ stock: Number(e.target.value.replace(/\D/g, "") || 0) })} className="w-24 border border-forest/25 bg-transparent px-2 py-1.5 tabular-nums" />
                        {held && <span className="ml-2 text-[0.75rem] text-espresso">reserved</span>}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          disabled={rows.length === 1 || held}
                          title={held ? "Held by an unpaid order. Set stock to 0 instead." : undefined}
                          onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))}
                          className="text-label uppercase underline underline-offset-4 disabled:no-underline disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setRows((all) => [...all, newRow()])} className="mt-3 text-label uppercase underline underline-offset-4">
            Add variant
          </button>
        </section>
      ) : (
        <section className="grid gap-5 bg-stone/60 p-5 sm:grid-cols-2">
          <h2 className={`${label} sm:col-span-2`}>The piece</h2>
          <label className={label}>
            Size
            <input value={size} onChange={(e) => setSize(e.target.value)} className={field} {...err("size")} />
            {errText("size")}
          </label>
          <label className={label}>
            Colour
            <input value={color} onChange={(e) => setColor(e.target.value)} className={field} {...err("color")} />
            {errText("color")}
          </label>
          <label className={`${label} sm:col-span-2`}>
            Original material
            <input value={originalMaterial} onChange={(e) => setOriginalMaterial(e.target.value)} placeholder="e.g. Three pairs of second-hand Levi's 501s" className={field} {...err("originalMaterial")} />
            {errText("originalMaterial")}
          </label>
          <label className={`${label} sm:col-span-2`}>
            Artisan notes
            <textarea value={artisanNotes} onChange={(e) => setArtisanNotes(e.target.value)} rows={3} className={field} {...err("artisanNotes")} />
            {errText("artisanNotes")}
          </label>
          <p className={`${hint} sm:col-span-2`}>A 1-of-1 has exactly one unit. Use the status actions to mark it sold or available.</p>
        </section>
      )}

      {formError && (
        <p role="alert" className="bg-espresso p-4 text-body-sm text-canvas">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="bg-forest px-6 py-3 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50">
          {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
        </button>
        {update.isSuccess && !pending && <span role="status" className="text-body-sm">Saved.</span>}
        <Link href="/admin/inventory" className="text-label uppercase underline underline-offset-4">Back to inventory</Link>
      </div>
    </form>
  );
}
