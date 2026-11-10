"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"

import {
  SANDBOXES,
  upgradeRequired,
  usageLimitReached,
  type UpgradeRequired,
  type UsageLimitReached,
} from "@/lib/billing"
import { daytona } from "@/lib/daytona"
import { db } from "@/lib/db"
import { getUsage, isSpent } from "@/lib/usage"

// noVNC, started by computerUse.start() alongside Xvfb, xfce4 and x11vnc
const NOVNC_PORT = 6080

// Long enough that an open panel doesn't drop out from under the user
const URL_TTL_SECONDS = 60 * 60 * 6

type GetDesktopUrlResult =
  | { success: true; url: string }
  | { success: false; error: string }
  | UpgradeRequired
  | UsageLimitReached

// A browser-loadable noVNC URL for the bot's sandbox desktop, waking both if needed
export async function getDesktopUrl(
  botId: string
): Promise<GetDesktopUrlResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (!has({ feature: SANDBOXES })) {
    return upgradeRequired
  }
  // Opening the desktop wakes the sandbox, and an open panel keeps it awake
  const usage = await getUsage(userId)
  if (!usage) return upgradeRequired
  if (isSpent(usage, "sandbox")) return usageLimitReached

  const bot = await db.query.bots.findFirst({
    where: (bots, { and, eq }) =>
      and(eq(bots.id, botId), eq(bots.userId, userId)),
  })
  if (!bot) {
    return { success: false, error: "That bot doesn't exist." }
  }

  try {
    const sandbox = await daytona.get(bot.sandboxId)
    const startedAt = Date.now()
    const initialState = sandbox.state
    if (sandbox.state === "starting") {
      await sandbox.waitUntilStarted()
    } else if (sandbox.state !== "started") {
      await sandbox.start()
    }

    const { status } = await sandbox.computerUse.getStatus()
    if (status !== "active") {
      await sandbox.computerUse.start()
    }

    // Signed, so the token rides in the hostname instead of a header an iframe can't send
    const { url } = await sandbox.getSignedPreviewUrl(
      NOVNC_PORT,
      URL_TTL_SECONDS
    )
    // The page loads through Arlo's proxy (app/api/desktop), which skips
    // Daytona's preview warning; the screen's WebSocket goes straight to
    // Daytona, since WebSockets never get the warning
    const { host } = new URL(url)
    const params = new URLSearchParams({
      host,
      port: "443",
      encrypt: "true",
      path: "websockify",
      autoconnect: "true",
      reconnect: "true",
      // Scale the remote screen to the frame; "remote" would resize the
      // sandbox's display out from under the bot's pixel coordinates
      resize: "scale",
    })
    Sentry.logger.info("Desktop opened", {
      "user.id": userId,
      botId,
      sandboxId: bot.sandboxId,
      // How long waking the sandbox and its desktop took
      initialState: initialState ?? "unknown",
      durationMs: Date.now() - startedAt,
    })
    return { success: true, url: `/api/desktop/${host}/vnc.html?${params}` }
  } catch (error) {
    console.error("Failed to open desktop", bot.sandboxId, error)
    return { success: false, error: "Couldn't reach the bot's desktop." }
  }
}
