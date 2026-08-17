/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // This app's package-lock.json coexists with the root one (backend) and
  // frontend's — without this, Next.js's build-time workspace-root inference
  // picks whichever it finds first and warns about the ambiguity.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // Uploaded car/document photos (e.g. unblurred originalImages in the
      // Cars review modal) are absolute URLs baked in at upload time — see
      // frontend's lib/api.ts API_ORIGIN. Local/preview deployments without
      // a domain + HTTPS yet serve those over http://, not https://.
      { protocol: 'http', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
