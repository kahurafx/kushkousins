// Usage: pnpm promote-admin <email>   (sign up normally first, then promote)
import { db, eq, schema } from "./index";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: pnpm promote-admin <email>");

  const [updated] = await db
    .update(schema.user)
    .set({ role: "ADMIN" })
    .where(eq(schema.user.email, email))
    .returning({ email: schema.user.email, role: schema.user.role });
  if (!updated) throw new Error(`No user with email ${email}. Sign up first.`);
  console.log(`Promoted ${updated.email} to ${updated.role}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
