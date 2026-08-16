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
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

module.exports = nextConfig;
