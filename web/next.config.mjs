/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@robinmarkets/shared"],
  webpack: (config) => {
    // wagmi/walletconnect pull in optional native deps we don't use.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
