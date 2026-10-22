import type { NextConfig } from 'next';
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:5080';
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: {
    localPatterns: [
      { pathname: '/images/**' },
      { pathname: '/api/v1/media/**' },
      { pathname: '/media/foundation/**' },
    ],
  },
  poweredByHeader: false,
  experimental: { proxyClientMaxBodySize: '34mb' },
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.DEV_LAN_ORIGINS?.split(',').filter(Boolean) ?? []),
  ],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
