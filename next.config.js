/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // App Router ist seit 13 stabil – kein experimental.appDir mehr nötig
  reactStrictMode: true,
  // turbopack: {}, // Removed to fallback to stable Webpack if issues arise
  images: {
    domains: [], // trage hier Domains ein, wenn du externe Bilder nutzt
    formats: ['image/avif', 'image/webp'],
  },
  typescript: { ignoreBuildErrors: false },
  compiler: {
    emotion: true, // für MUI + emotion
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws: wss: http: https:;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
