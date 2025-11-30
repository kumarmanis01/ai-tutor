import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'i.pravatar.cc',
      'flagcdn.com',
      'ai-tutor-uploads-spinzyacademy-01.s3.eu-north-1.amazonaws.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'ai-tutor-uploads-spinzyacademy-01.s3.eu-north-1.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
