import { test } from "node:test";
import assert from "node:assert/strict";
import type { Session } from "@repo/auth/server";
import { adminProcedure, createCallerFactory, protectedProcedure, router } from "./trpc";

const testRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.session.user.id),
  ping: adminProcedure.query(() => "ok"),
});
const caller = (role: string | null) =>
  createCallerFactory(testRouter)({
    session: role === null ? null : ({ user: { id: "u1", role }, session: {} } as unknown as Session),
  });

test("anonymous is UNAUTHORIZED", async () => {
  await assert.rejects(caller(null).me(), { code: "UNAUTHORIZED" });
  await assert.rejects(caller(null).ping(), { code: "UNAUTHORIZED" });
});

test("CUSTOMER is FORBIDDEN from admin procedures", async () => {
  assert.equal(await caller("CUSTOMER").me(), "u1");
  await assert.rejects(caller("CUSTOMER").ping(), { code: "FORBIDDEN" });
  await assert.rejects(caller("").ping(), { code: "FORBIDDEN" });
});

test("ADMIN passes, including multi-role strings", async () => {
  assert.equal(await caller("ADMIN").ping(), "ok");
  assert.equal(await caller("CUSTOMER, ADMIN").ping(), "ok");
});
