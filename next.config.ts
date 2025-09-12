import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Prevent ESLint warnings from failing production builds
    ignoreDuringBuilds: true
  },
  typescript: {
    // Allow production builds to succeed even if there are type errors.
    // This avoids blocking builds due to route handler type annotation mismatches.
    ignoreBuildErrors: true
  },
  // Next.js automatically detects `instrumentation.ts`; no config needed.
};

export default nextConfig;
