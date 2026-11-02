import type { NextConfig } from "next";
const staticExport = process.env.STATIC_EXPORT === "1";
const config: NextConfig = {
  output: staticExport ? "export" : "standalone",
  distDir: staticExport ? ".next-static" : ".next",
  images: { unoptimized: true },
  trailingSlash: staticExport,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  ...(staticExport ? {} : { async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000"}/api/:path*`,
      },
    ];
  } }),
};
export default config;

