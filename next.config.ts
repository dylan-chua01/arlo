import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs/config"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The SDK loads form-data (for file uploads) with a dynamic require, which
  // the server bundle can't resolve, so load it with Node's own require
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    serverActions: {
      // Chat attachments go through a server action, one file per call, up
      // to MAX_FILE_SIZE (10 MB) plus the form's own overhead
      bodySizeLimit: "11mb",
    },
  },
}

export default withSentryConfig(nextConfig, {
  org: "dylan-chua",
  project: "arlo",

  // Uploads source maps on production builds so stack traces show original code
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,

  // Send browser events through the app so ad blockers don't drop them
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
})
