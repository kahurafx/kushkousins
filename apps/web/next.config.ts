import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/db", "@repo/types", "@repo/ui"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
