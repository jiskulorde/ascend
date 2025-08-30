import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  eslint: {
    ignoreDuringBuilds: true, // ✅ Skip ESLint on build
  },
  typescript: {
    ignoreBuildErrors: true, // (optional) skip TS errors too
  },
};

export default nextConfig;
