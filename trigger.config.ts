import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import { additionalPackages } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_zkyvgorqkhilrtqtggdb",
  runtime: "node-24",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    extensions: [
      // Daytona loads these at runtime with require(), where the bundler can't
      // see them, so install them in the image. Marking @daytona/sdk external
      // doesn't work: Trigger.dev finds its cjs/package.json, which has no
      // name, and bundles it anyway. Keep the versions in step with
      // `npm ls --depth=1` under @daytona/sdk.
      additionalPackages({
        packages: [
          "busboy@1.6.0", // downloading files
          "form-data@4.0.6", // uploading files
          "tar@7.5.22",
          "fast-glob@3.3.1",
          "expand-tilde@2.0.2",
          "@iarna/toml@2.2.5",
        ],
      }),
      // Uploads source maps on deploy so task stack traces show original code
      esbuildPlugin(
        sentryEsbuildPlugin({
          org: "dylan-chua",
          project: "arlo",
          authToken: process.env.SENTRY_AUTH_TOKEN,
        }),
        { placement: "last", target: "deploy" }
      ),
    ],
  },
});
