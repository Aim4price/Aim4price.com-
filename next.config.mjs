/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/valuation/report',
          destination: '/api/valuation/report-enhanced',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
