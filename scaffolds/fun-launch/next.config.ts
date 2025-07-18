/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    // ✅ Safe frontend variables
    NEXT_PUBLIC_POOL_CONFIG_KEY: process.env.POOL_CONFIG_KEY,
    NEXT_PUBLIC_RPC_URL: process.env.RPC_URL,

    // ✅ Safe for frontend but optional
    NEXT_PUBLIC_R2_BUCKET: process.env.R2_BUCKET,
    NEXT_PUBLIC_R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  },
};

module.exports = nextConfig;
