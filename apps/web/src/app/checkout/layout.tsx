import { requireSession } from "@/lib/session";

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  await requireSession("/checkout");
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-10 md:px-8">{children}</main>;
}
