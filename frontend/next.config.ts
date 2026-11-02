import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  },
};
export default config;

