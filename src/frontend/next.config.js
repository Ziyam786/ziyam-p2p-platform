/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // This app's package-lock.json coexists with the root one (backend) and
  // admin's — without this, Next.js's build-time workspace-root inference
  // picks whichever it finds first and warns about the ambiguity.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // The live deployment currently runs on a plain IP with no domain/SSL
      // yet, so uploaded image URLs (baked in as absolute URLs at upload
      // time — see lib/api.ts's API_ORIGIN) are http://, not https://.
      // Safe to drop once a real domain + HTTPS is set up.
      { protocol: 'http', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
