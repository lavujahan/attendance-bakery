import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.*"],
  experimental: {
    // Default 1mb is too small for a base64-encoded ID proof PDF (see
    // app/dashboard/employees/idProofActions.ts) -- 5mb file -> ~6.7mb encoded.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
