import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better development warnings
  reactStrictMode: true,

  // Allow images from local uploads and any configured domains
  images: {
    remotePatterns: [],
    // Local uploads served via /api/uploads/[...path]
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  // Experimental features
  experimental: {
    // Server actions for form submissions
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // Webpack configuration for PDF renderer
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
