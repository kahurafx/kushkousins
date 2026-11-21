import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

// Shared by admin() on the server and adminClient() on web/mobile so both see the same roles.
export const ac = createAccessControl(defaultStatements);

export const roles = {
  CUSTOMER: ac.newRole(userAc.statements),
  ADMIN: ac.newRole(adminAc.statements),
};

/** Role column is a string and may be comma-separated (admin plugin multi-role). */
export const isAdmin = (user: { role?: string | null } | null | undefined) =>
  !!user?.role?.split(",").map((r) => r.trim()).includes("ADMIN");
