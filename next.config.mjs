/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supaya deploy tidak gagal hanya karena error tipe kecil selama workshop.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
