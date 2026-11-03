import { SandboxState } from "@daytona/sdk"
import { logger, schedules } from "@trigger.dev/sdk"

import { daytona } from "@/lib/daytona"
import { getUsage, isSpent, recordUsage } from "@/lib/usage"

const INTERVAL_MINUTES = 5

// Daytona bills a sandbox for every second it runs, whether a bot, the desktop
// panel or nothing at all keeps it awake. So rather than timing what we do in
// it, this samples every sandbox's state and charges the running ones to their
// owner for the time since the last sample, then stops the sandboxes of anyone
// past their allowance or off the Pro plan.
export const meterSandboxes = schedules.task({
  id: "meter-sandboxes",
  cron: `*/${INTERVAL_MINUTES} * * * *`,
  // One sample at a time, so two runs never charge the same window
  queue: { concurrencyLimit: 1 },
  run: async ({ timestamp, lastTimestamp }) => {
    // Capped, so a pause in the schedule isn't charged as running time
    const seconds = Math.min(
      Math.round(
        (timestamp.getTime() -
          (lastTimestamp?.getTime() ??
            timestamp.getTime() - INTERVAL_MINUTES * 60_000)) /
          1000
      ),
      INTERVAL_MINUTES * 2 * 60
    )

    // Looked up once per owner, after their first charge in this sample
    const shouldStop = new Map<string, boolean>()
    let charged = 0
    let stopped = 0

    for await (const sandbox of daytona.list({
      states: [SandboxState.STARTED],
    })) {
      // createBot labels every sandbox with its owner
      const userId = sandbox.labels.userId
      if (!userId) continue

      await recordUsage({
        userId,
        meter: "sandbox",
        amount: seconds,
        sandboxId: sandbox.id,
        botId: sandbox.labels.botId ?? null,
        // A retried run charges the same sample once
        idempotencyKey: `sandbox:${sandbox.id}:${timestamp.toISOString()}`,
      })
      charged++

      let stop = shouldStop.get(userId)
      if (stop === undefined) {
        const usage = await getUsage(userId)
        stop = !usage || isSpent(usage, "sandbox")
        shouldStop.set(userId, stop)
      }
      if (stop) {
        try {
          await sandbox.stop()
          stopped++
        } catch (error) {
          logger.error("Failed to stop sandbox", {
            sandboxId: sandbox.id,
            error,
          })
        }
      }
    }

    logger.log("Metered sandboxes", { seconds, charged, stopped })
  },
})
