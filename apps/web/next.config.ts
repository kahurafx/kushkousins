import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/auth", "@repo/db", "@repo/types", "@repo/ui"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
