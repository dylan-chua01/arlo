"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  appLimitReached,
  PLANS,
  upgradeRequired,
  type AppLimitReached,
  type UpgradeRequired,
} from "@/lib/billing"
import {
  composio,
  createAppSession,
  getConnectedApps,
  toolkitSlug,
} from "@/lib/composio"
import { getPlan } from "@/lib/usage"

type ConnectAppResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string }
  | UpgradeRequired
  | AppLimitReached

// Starts the app's sign-in; Composio sends the person back to /apps after
export async function connectApp(toolkit: string): Promise<ConnectAppResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (!toolkitSlug.test(toolkit)) {
    return { success: false, error: "That app doesn't exist." }
  }

  // Apps are for bots, which need a paid plan
  const plan = await getPlan(userId)
  if (!plan) return upgradeRequired

  // Server actions always send Origin, so this is the app's own URL
  const origin = (await headers()).get("origin")
  try {
    // Reconnecting an app they already have doesn't take another slot
    const limit = PLANS[plan.slug].limits.apps
    if (limit !== null) {
      const connected = await getConnectedApps(userId)
      if (!connected.includes(toolkit) && connected.length >= limit) {
        Sentry.logger.info("App connection blocked", {
          "user.id": userId,
          toolkit,
          reason: "app_limit_reached",
        })
        return appLimitReached(limit)
      }
    }

    const session = await createAppSession(userId)
    // Composio adds status=success or status=failed to this
    const request = await session.authorize(toolkit, {
      callbackUrl: origin ? `${origin}/apps?app=${toolkit}` : undefined,
    })
    if (!request.redirectUrl) {
      throw new Error(`No redirect URL for ${toolkit}`)
    }
    Sentry.logger.info("App connection started", {
      "user.id": userId,
      toolkit,
    })
    return { success: true, redirectUrl: request.redirectUrl }
  } catch (error) {
    console.error("Failed to start app connection", toolkit, error)
    Sentry.captureException(error, { tags: { toolkit } })
    return { success: false, error: "Couldn't connect that app. Try again." }
  }
}

type DisconnectAppResult = { success: true } | { success: false; error: string }

export async function disconnectApp(
  toolkit: string
): Promise<DisconnectAppResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (!toolkitSlug.test(toolkit)) {
    return { success: false, error: "That app doesn't exist." }
  }

  try {
    // Listed by user, so nobody can remove an account that isn't theirs
    const { items } = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkit],
    })
    // Deleting also revokes the tokens Composio holds
    await Promise.all(
      items.map((account) => composio.connectedAccounts.delete(account.id))
    )
    Sentry.logger.info("App disconnected", {
      "user.id": userId,
      toolkit,
      accounts: items.length,
    })
  } catch (error) {
    console.error("Failed to disconnect app", toolkit, error)
    Sentry.captureException(error, { tags: { toolkit } })
    return { success: false, error: "Couldn't disconnect that app. Try again." }
  }

  revalidatePath("/apps")

  return { success: true }
}
