import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  serverExternalPackages: ['ioredis', 'pg', 'bcryptjs'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
