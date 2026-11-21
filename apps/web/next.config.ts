import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/auth", "@repo/db", "@repo/types"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
