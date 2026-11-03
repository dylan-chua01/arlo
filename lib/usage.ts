import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { PRO_LIMITS, PRO_PLAN } from "@/lib/billing"
import { db } from "@/lib/db"
import { usageEvents, type NewUsageEvent } from "@/lib/db/schema"

// The backend client, not @clerk/nextjs, so Trigger.dev tasks can use this too
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Dollars per million tokens, which is also millionths of a dollar per token.
// Anthropic's list prices; cache writes are the 5-minute rate (1.25x input).
const MODEL_PRICES: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
}

// Billing statuses that still grant the plan for the current period
const LIVE_STATUSES = new Set(["active", "canceled", "past_due"])

export type BillingPeriod = { start: Date; end: Date }

export type Usage = {
  period: BillingPeriod
  ai: { used: number; limit: number }
  sandbox: { used: number; limit: number }
}

// The user's current Pro period, or null when they aren't on Pro
export async function getBillingPeriod(
  userId: string
): Promise<BillingPeriod | null> {
  let subscription
  try {
    subscription = await clerk.billing.getUserBillingSubscription(userId)
  } catch (error) {
    // A user who never subscribed to anything has no subscription
    if ((error as { status?: number }).status === 404) return null
    throw error
  }

  const now = Date.now()
  const item = subscription.subscriptionItems.find(
    (item) =>
      item.plan?.slug === PRO_PLAN &&
      LIVE_STATUSES.has(item.status) &&
      item.periodStart <= now &&
      item.periodEnd !== null &&
      item.periodEnd > now
  )
  if (!item?.periodEnd) return null

  return { start: new Date(item.periodStart), end: new Date(item.periodEnd) }
}

// The ledger summed over the current period, against the Pro limits
export async function getUsage(userId: string): Promise<Usage | null> {
  const period = await getBillingPeriod(userId)
  if (!period) return null

  const totals = await db
    .select({
      meter: usageEvents.meter,
      total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)`.mapWith(
        Number
      ),
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        gte(usageEvents.createdAt, period.start),
        lt(usageEvents.createdAt, period.end)
      )
    )
    .groupBy(usageEvents.meter)
  const used = (meter: NewUsageEvent["meter"]) =>
    totals.find((row) => row.meter === meter)?.total ?? 0

  return {
    period,
    ai: { used: used("ai"), limit: PRO_LIMITS.ai },
    sandbox: { used: used("sandbox"), limit: PRO_LIMITS.sandbox },
  }
}

// Whether a metered allowance is spent
export function isSpent(usage: Usage, meter: "ai" | "sandbox") {
  return usage[meter].used >= usage[meter].limit
}

export async function recordUsage(event: NewUsageEvent) {
  await db.insert(usageEvents).values(event).onConflictDoNothing()
}

// What a model call cost, in millionths of a dollar
export function aiCost(model: string, usage: LanguageModelUsage) {
  const price = MODEL_PRICES[model]
  if (!price) throw new Error(`No price for model ${model}`)

  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0
  const uncached =
    usage.inputTokenDetails.noCacheTokens ??
    Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite)
  const output = usage.outputTokens ?? 0

  return Math.ceil(
    uncached * price.input +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite +
      output * price.output
  )
}

// Writes one model call to the ledger and returns what it cost
export async function recordAiUsage(
  event: Pick<NewUsageEvent, "userId" | "botId" | "chatId">,
  model: string,
  usage: LanguageModelUsage
) {
  const amount = aiCost(model, usage)
  await recordUsage({
    ...event,
    meter: "ai",
    amount,
    model,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? null,
    cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens ?? null,
  })
  return amount
}
