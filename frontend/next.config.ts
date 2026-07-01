import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  trailingSlash: true,
  images: {
    remotePatterns: [
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
    ],
  },
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: 'https://sites-tumkur.onrender.com/admin',
      },
      {
        source: '/admin/:path*',
        destination: 'https://sites-tumkur.onrender.com/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'https://sites-tumkur.onrender.com/api/:path*/',
      },
      {
        source: '/media/:path*',
        destination: 'https://sites-tumkur.onrender.com/media/:path*',
      },
    ]
  },
};

export default nextConfig;
