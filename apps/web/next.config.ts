import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep the monorepo-relative output layout that OpenNext expects for the
  // apps/web package when it builds the Worker bundle.
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  // Use the compiler API supported by TypeScript 6 and the ESLint toolchain.
  experimental: {
    useTypeScriptCli: false,
    serverActions: { bodySizeLimit: "6mb" },
  },
  devIndicators: false,
};

export default nextConfig;
