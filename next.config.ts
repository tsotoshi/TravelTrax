import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone on the same Wi-Fi open `npm run dev` via the Mac's network IP.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*"],
};

export default nextConfig;
