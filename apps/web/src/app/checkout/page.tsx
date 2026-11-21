import type { Metadata } from "next";
import { CheckoutFlow } from "@/components/checkout-flow";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Checkout · kushkousins" };

export default async function CheckoutPage() {
  const addresses = await (await sessionCaller()).address.list();
  return (
    <>
      <h1 className="text-display-lg">Checkout</h1>
      <div className="mt-10">
        <CheckoutFlow addresses={addresses} mockPayments={process.env.MOCK_PAYMENTS === "true"} />
      </div>
    </>
  );
}
