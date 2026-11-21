import type { Metadata } from "next";
import { AddressBook } from "@/components/address-book";
import { requireSession } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Addresses · kushkousins" };

export default async function AddressesPage() {
  await requireSession("/account/addresses");
  const addresses = await (await sessionCaller()).address.list();
  return <AddressBook addresses={addresses} />;
}
