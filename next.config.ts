import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
