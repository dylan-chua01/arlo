import { Composio } from "@composio/core"
import { VercelProvider } from "@composio/vercel"

// A project key (ak_…) or, failing that, the user key (uak_…) that
// `composio login` creates. Either can act for any of our users.
const apiKey = process.env.COMPOSIO_API_KEY || null
const userApiKey = process.env.COMPOSIO_USER_API_KEY || null

if (!apiKey && !userApiKey) {
  throw new Error("Set COMPOSIO_API_KEY or COMPOSIO_USER_API_KEY")
}
// A Connect consumer key only reaches its owner's own apps, over MCP
if (apiKey?.startsWith("ck_")) {
  throw new Error(
    "COMPOSIO_API_KEY is a consumer key (ck_…), which the SDK can't use. Set a project key (ak_…), or remove it and set COMPOSIO_USER_API_KEY (uak_…)."
  )
}

export const composio = new Composio({
  // null stops the SDK from falling back to keys stored on this machine
  apiKey,
  userApiKey,
  provider: new VercelProvider(),
})

// Connected apps belong to the person, so all their bots share them. The Clerk
// user ID is their Composio user ID.
// Pass toolkits to keep the session to those apps, so a bot can't use or
// connect any other.
export function createAppSession(userId: string, toolkits?: string[]) {
  return composio.create(userId, {
    // Lets the bot hand the person a link when an app isn't connected yet
    manageConnections: true,
    // Bots already have their own sandbox, so skip Composio's
    sandbox: { enable: false },
    ...(toolkits && { toolkits }),
  })
}

// Accounts that take up one of the plan's connected apps. An expired one
// still does, since reconnecting it is free.
const CONNECTED_STATUSES = ["ACTIVE", "EXPIRED"] as const

// Slugs of the apps the person has connected, each once
export async function getConnectedApps(userId: string) {
  const slugs = new Set<string>()
  let cursor: string | null | undefined
  do {
    const page = await composio.connectedAccounts.list({
      userIds: [userId],
      statuses: [...CONNECTED_STATUSES],
      limit: 100,
      cursor,
    })
    for (const account of page.items) slugs.add(account.toolkit.slug)
    cursor = page.nextCursor
  } while (cursor)
  return [...slugs]
}

// Toolkit slugs like "gmail" or "google_calendar"
export const toolkitSlug = /^[a-z0-9_-]{1,64}$/i
