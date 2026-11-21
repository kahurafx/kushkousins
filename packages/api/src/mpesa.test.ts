import { test } from "node:test";
import assert from "node:assert/strict";
import { darajaTimestamp, mpesaConfig, resetMpesaToken, stkPassword, stkPush, stkQuery } from "./mpesa";

const env = {
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret",
  MPESA_SHORTCODE: "174379",
  MPESA_PASSKEY: "pass",
  MPESA_CALLBACK_URL: "https://shop.example/",
  MPESA_CALLBACK_SECRET: "s3cret",
};

test("darajaTimestamp is yyyyMMddHHmmss in Nairobi time (UTC+3)", () => {
  assert.equal(darajaTimestamp(new Date("2026-11-21T22:05:09Z")), "20261122010509");
});

test("stkPassword is base64(shortcode + passkey + timestamp)", () => {
  assert.equal(Buffer.from(stkPassword("174379", "pk", "20261122010509"), "base64").toString(), "174379pk20261122010509");
});

test("mpesaConfig fails closed when anything is missing, defaults to sandbox", () => {
  assert.equal(mpesaConfig({ ...env, MPESA_PASSKEY: "" }), null);
  const cfg = mpesaConfig(env)!;
  assert.equal(cfg.baseUrl, "https://sandbox.safaricom.co.ke");
  assert.equal(cfg.callbackUrl, "https://shop.example/api/payments/callback/s3cret");
  assert.equal(cfg.partyB, "174379");
  assert.equal(mpesaConfig({ ...env, MPESA_ENV: "production" })!.baseUrl, "https://api.safaricom.co.ke");
});

test("stkPush sends the Daraja payload and caches the token; stkQuery maps processing to pending", async (t) => {
  resetMpesaToken();
  const calls: { url: string; body?: Record<string, unknown>; auth?: string }[] = [];
  let query: object = { errorCode: "500.001.1001", errorMessage: "The transaction is being processed" };
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit = {}) => {
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    calls.push({ url, auth, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes("/oauth/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: "3599" }));
    if (url.includes("/stkpushquery/")) return new Response(JSON.stringify(query));
    return new Response(JSON.stringify({ ResponseCode: "0", CheckoutRequestID: "ws_CO_1", MerchantRequestID: "m" }));
  });
  const cfg = mpesaConfig(env)!;
  const r = await stkPush(cfg, { phone: "0712 345 678", amountKes: 1400, reference: "ABCDEF1234567", description: "kushkousins shop" });
  assert.deepEqual(r, { checkoutRequestId: "ws_CO_1", msisdn: "254712345678" });
  const push = calls.find((c) => c.url.endsWith("/processrequest"))!;
  assert.equal(push.auth, "Bearer tok");
  assert.equal(push.body!.Amount, 1400);
  assert.equal(push.body!.PartyA, "254712345678");
  assert.equal(push.body!.AccountReference, "ABCDEF123456");
  assert.equal((push.body!.TransactionDesc as string).length, 13);
  assert.equal(push.body!.CallBackURL, "https://shop.example/api/payments/callback/s3cret");

  assert.deepEqual(await stkQuery(cfg, "ws_CO_1"), { state: "pending" });
  query = { ResponseCode: "0", ResultCode: "1032", ResultDesc: "Request cancelled by user" };
  assert.deepEqual(await stkQuery(cfg, "ws_CO_1"), { state: "done", resultCode: 1032, resultDesc: "Request cancelled by user" });
  assert.equal(calls.filter((c) => c.url.includes("/oauth/")).length, 1); // token reused
});

test("stkPush rejects a refused request", async (t) => {
  resetMpesaToken();
  t.mock.method(globalThis, "fetch", async (url: string) =>
    new Response(JSON.stringify(url.includes("/oauth/") ? { access_token: "tok", expires_in: 3599 } : { errorCode: "400.002.02", errorMessage: "Bad Request - Invalid PhoneNumber" })),
  );
  await assert.rejects(stkPush(mpesaConfig(env)!, { phone: "0712345678", amountKes: 1, reference: "x", description: "y" }), /Invalid PhoneNumber/);
});
