import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cspr-sentinel/core", "@cspr-sentinel/mcp", "@cspr-sentinel/agent"],
  serverExternalPackages: ["@make-software/casper-x402"]
};

export default nextConfig;
