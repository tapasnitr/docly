import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  // Workspace packages ship their TypeScript source directly (no build step),
  // so Next needs to transpile them itself rather than treating them as
  // pre-built node_modules dependencies.
  transpilePackages: ['@docly/ui'],
};

export default nextConfig;
