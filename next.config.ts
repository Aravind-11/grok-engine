import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "en.wikipedia.org" },
    ],
  },
};

export default nextConfig;
