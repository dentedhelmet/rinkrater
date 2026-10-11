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
  // Map the "@/..." import alias to src/ explicitly for webpack builds.
  // Hostinger's npm install skips devDependencies, so webpack can't rely on
  // reading tsconfig.json paths on its own.
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src')
    return config
  },
}

module.exports = nextConfig