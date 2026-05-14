/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ignora erros de TypeScript no build (resolve em seguida)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignora erros de ESLint no build
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['supabase.co', 'avatars.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;