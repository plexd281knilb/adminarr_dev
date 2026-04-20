/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows the dev server to accept HMR (Hot Module Replacement) 
  // connections from your specific network IP.
  allowedDevOrigins: ['192.168.10.130', 'localhost:3000'],
  
  // Essential for your Unraid Docker deployment
  output: 'standalone',

  // Next.js 16 handles linting and type-checking via CLI flags 
  // in the build command now, so we keep this config lean.
};

module.exports = nextConfig;