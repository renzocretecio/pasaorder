import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the compiler API supported by TypeScript 6 and the ESLint toolchain.
  experimental: {
    useTypeScriptCli: false,
    serverActions: { bodySizeLimit: "6mb" },
  },
  devIndicators: false,
};

export default nextConfig;
