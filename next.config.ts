import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The SDK loads form-data (for file uploads) with a dynamic require, which
  // the server bundle can't resolve, so load it with Node's own require
  serverExternalPackages: ["@daytona/sdk"],
}

export default nextConfig
