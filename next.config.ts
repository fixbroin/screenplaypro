
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

// Runtime caching for USER PWA
const userRuntimeCaching = [
  {
    urlPattern: /^https:\/\/screenplaypro\.in\/api\/.*/i,
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 },
      
    },
  },
  {
    urlPattern: /\/_next\/image\?url=.*/i,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName: 'next-image',
      expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      
    },
  },
  {
    urlPattern: /\.(png|jpg|jpeg|svg|webp)$/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'images-cache',
      expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 14 },
      
    },
  },
];

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  dynamicStartUrl: false,
  cacheStartUrl: false,

  workboxOptions: {
    importScripts: ['/sw-helper.js'],
    exclude: [
      /googletagmanager\.com/,
      /admin/,
      /chunk-[A-Za-z0-9]+\.js/,
      /\.map$/,
    ],
    runtimeCaching: userRuntimeCaching,
  },

  pwas: {
    admin: {
      dest: 'public/admin',
      sw: 'sw.js',
      scope: '/admin',
      reloadOnOnline: true,
      workboxOptions: {
        importScripts: ['/sw-helper.js'],
        runtimeCaching: [
          {
            urlPattern: /^\/admin.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    },
  },
} as any);

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: false,
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: 'https', hostname: 'screenplaypro.fixbro.in' },
      { protocol: 'https', hostname: '*.fixbro.in' },
      { protocol: 'https', hostname: 'fixbro.in' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.googleusercontent.com' },
    ],
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default withPWA(nextConfig);

