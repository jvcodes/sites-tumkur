import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/admin',
        destination: 'http://127.0.0.1:8000/admin',
      },
      {
        source: '/dashboard',
        destination: 'http://127.0.0.1:8000/dashboard/',
      },
      {
        source: '/dashboard/:path*',
        destination: 'http://127.0.0.1:8000/dashboard/:path*/',
      },
      {
        source: '/admin/:path*',
        destination: 'http://127.0.0.1:8000/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ]
  },
};

export default nextConfig;
