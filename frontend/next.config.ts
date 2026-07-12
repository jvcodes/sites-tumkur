import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (isProd ? 'https://sites-tumkur.onrender.com' : 'http://127.0.0.1:8000');

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'sites-tumkur.onrender.com',
        pathname: '/media/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: `${backendUrl}/admin`,
      },
      {
        source: '/admin/:path*',
        destination: `${backendUrl}/admin/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${backendUrl}/media/:path*`,
      },
    ]
  },
};

export default nextConfig;
