const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Local dev (`npm run dev`) uses Turbopack, which reads the "@/..." alias
  // from tsconfig.json on its own — nothing extra needed here. This empty
  // block just tells Next.js the webpack section below is intentional.
  turbopack: {},
  // Production build (`next build --webpack`) on Hostinger: map "@/..." to
  // src/ explicitly, since Hostinger's install skips devDependencies.
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src')
    return config
  },
}

module.exports = nextConfig