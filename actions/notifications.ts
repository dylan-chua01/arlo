"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"

// A read-only token for the person's own task runs, which are tagged with
// their user id, so the browser can tell them when one finishes
export async function mintTaskRunsToken(): Promise<{
  tag: string
  accessToken: string
} | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return null

  const tag = `user:${userId}`
  const accessToken = await triggerAuth.createPublicToken({
    scopes: { read: { tags: [tag] } },
    expirationTime: "12h",
  })
  return { tag, accessToken }
}
