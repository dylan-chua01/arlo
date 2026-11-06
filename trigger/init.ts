import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"

// Trigger.dev loads this file before every task runs
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  // Trigger.dev already traces runs and handles uncaught errors, so skip
  // Sentry's auto-instrumentation and report failures from the hook below
  defaultIntegrations: false,
  // Logs are always on in SDK v11; this also forwards console.warn and
  // console.error, which Trigger.dev keeps in the run's logs too
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
})

// Logs are sent in batches, so send them before the worker suspends or exits
tasks.onWait(async () => {
  await Sentry.flush(2000)
})
tasks.onComplete(async () => {
  await Sentry.flush(2000)
})

// Fires once a run has used up its retries
tasks.onFailure(async ({ error, ctx }) => {
  Sentry.captureException(error, {
    tags: {
      "trigger.task": ctx.task.id,
      "trigger.environment": ctx.environment.slug,
    },
    // The payload is left out because chat runs carry users' messages
    contexts: {
      trigger: {
        runId: ctx.run.id,
        attempt: ctx.attempt.number,
        machine: ctx.machine?.name,
        version: ctx.deployment?.version,
      },
    },
  })
  // The worker can exit right after the hook, so send the event now
  await Sentry.flush(2000)
})
