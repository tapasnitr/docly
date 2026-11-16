import type { NextConfig } from "next";
// Side-effect import: loads the repo-root .env into process.env (see
// packages/config/src/index.ts) before Next.js reads NEXT_PUBLIC_* vars for
// the client bundle and for server-side code (lib/session.ts, lib/api-client.ts).
// Without this, Next only looks for .env files inside apps/web/ (it has
// none) and every NEXT_PUBLIC_* var silently falls back to its hardcoded
// default instead of whatever's actually configured in .env.
import "@docly/config";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  // Workspace packages ship their TypeScript source directly (no build step),
  // so Next needs to transpile them itself rather than treating them as
  // pre-built node_modules dependencies.
  transpilePackages: ['@docly/ui'],
  // Only bundle the icons/animation helpers actually imported; cuts dev
  // compile time and memory for lucide-react and framer-motion.
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Keep compiled pages in memory longer so revisiting a route doesn't recompile.
  onDemandEntries: {
    maxInactiveAge: 5 * 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
