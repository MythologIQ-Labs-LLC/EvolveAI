/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Reserved port configuration for EvolveAI
  env: {
    PORT: process.env.PORT || '4000',
  },
  // For Electron, we'll use the standard build
  // output: 'export',
  // trailingSlash: true,
  // distDir: 'out',
}

export default nextConfig
