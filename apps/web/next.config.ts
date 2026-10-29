import type { NextConfig } from 'next';

const vercelHost = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  || process.env.NEXT_PUBLIC_VERCEL_URL
  || process.env.VERCEL_PROJECT_PRODUCTION_URL
  || process.env.VERCEL_URL;

const derivedAppUrl = process.env.NEXT_PUBLIC_APP_URL
  || (vercelHost ? `https://${vercelHost.replace(/^https?:\/\//, '')}` : undefined);

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@slyyce/shared'],
  env: {
    ...(derivedAppUrl ? { NEXT_PUBLIC_APP_URL: derivedAppUrl } : {}),
  },
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ] }];
  },
};
export default config;
