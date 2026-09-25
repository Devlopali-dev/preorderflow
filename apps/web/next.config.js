/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@preorderflow/ui", "@preorderflow/types"],
  reactStrictMode: true,
};

module.exports = nextConfig;
