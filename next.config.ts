import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Add the allowed external image domain here
    domains: ['lh3.googleusercontent.com'],
  },
};

export default nextConfig;
