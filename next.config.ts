import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage (post-media bucket)
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      // AIESEC CDN / GIS profile photos (if ever used)
      { protocol: "https", hostname: "*.aiesec.org" },
      // Placeholder images used in the design-preview dev page only
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
