import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Comprime respostas HTTP com gzip (reduz TTFB)
  compress: true,

  // Remove header "X-Powered-By: Next.js"
  poweredByHeader: false,
};

export default nextConfig;
