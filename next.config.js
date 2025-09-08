/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router ist seit 13 stabil – kein experimental.appDir mehr nötig
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [], // trage hier Domains ein, wenn du externe Bilder nutzt
    formats: ['image/avif', 'image/webp'],
  },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
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
};

module.exports = nextConfig;
