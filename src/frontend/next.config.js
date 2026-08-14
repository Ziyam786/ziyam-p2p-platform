/** @type {import('next').NextConfig} */
const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:5000';

const nextConfig = {
  // In production, Nginx proxies /api/ to the backend directly (see devops/nginx.conf),
  // so this rewrite only takes effect in local dev where Next and Express run on separate ports.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
