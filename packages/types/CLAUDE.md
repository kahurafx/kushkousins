# packages/types: shared contract

- zod schemas in `src/index.ts` are the **source of truth** for API shapes shared by web, mobile and db. Export both the schema (`ProductSchema`) and its inferred type (`Product`).
- Const tuples such as `orderStatus` feed Drizzle `pgEnum`s in `packages/db`. Change them here, then run `pnpm db:generate`.
- No runtime dependencies besides `zod`. No React, no DB code.
- Before you change a schema, use the `grep` subagent to list its usages across `apps/*`.
