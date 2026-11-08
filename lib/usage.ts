import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { addMonths, differenceInCalendarMonths } from "date-fns"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { isPlanSlug, PLANS, type PlanSlug } from "@/lib/billing"
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

export type Plan = { slug: PlanSlug; period: BillingPeriod }

export type Usage = {
  plan: PlanSlug
  period: BillingPeriod
  ai: { used: number; limit: number }
  // A null limit is unlimited
  sandbox: { used: number; limit: number | null }
}

// The month of usage that contains now. Months count from a fixed anchor,
// rather than from Clerk's billing period, because Clerk starts a new period
// when someone switches plans and their usage shouldn't reset with it. It also
// gives yearly plans a monthly allowance.
export function getUsageMonth(anchor: Date, now = new Date()): BillingPeriod {
  // From the anchor each time, so a 31st anchor isn't pulled to the 28th for good
  let months = differenceInCalendarMonths(now, anchor)
  if (addMonths(anchor, months) > now) months--
  return {
    start: addMonths(anchor, months),
    end: addMonths(anchor, months + 1),
  }
}

// The user's paid plan and its current usage month, or null when they're on
// the free plan
export async function getPlan(userId: string): Promise<Plan | null> {
  let subscription
  try {
    subscription = await clerk.billing.getUserBillingSubscription(userId)
  } catch (error) {
    // A user who never subscribed to anything has no subscription
    if ((error as { status?: number }).status === 404) return null
    throw error
  }

  const now = Date.now()
  const live = subscription.subscriptionItems.flatMap((item) => {
    const slug = item.plan?.slug
    return isPlanSlug(slug) &&
      LIVE_STATUSES.has(item.status) &&
      item.periodStart <= now &&
      item.periodEnd !== null &&
      item.periodEnd > now
      ? [{ slug, start: item.periodStart, end: item.periodEnd }]
      : []
  })
  // Right after an upgrade the old plan can still be live (canceled, until its
  // period ends) next to the new one, so the biggest plan wins
  const rank = (slug: PlanSlug) => Object.keys(PLANS).indexOf(slug)
  const best = live.sort((a, b) => rank(b.slug) - rank(a.slug))[0]
  if (!best) return null

  // The subscription outlives plan switches, unlike its items
  return {
    slug: best.slug,
    period: getUsageMonth(new Date(subscription.createdAt)),
  }
}

// The ledger summed over the current usage month, against the plan's limits
export async function getUsage(userId: string): Promise<Usage | null> {
  const plan = await getPlan(userId)
  if (!plan) return null
  const { period } = plan
  const { limits } = PLANS[plan.slug]

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
    plan: plan.slug,
    period,
    ai: { used: used("ai"), limit: limits.ai },
    sandbox: { used: used("sandbox"), limit: limits.sandbox },
  }
}

// Whether a metered allowance is spent. An unlimited one never is.
export function isSpent(usage: Usage, meter: "ai" | "sandbox") {
  const { used, limit } = usage[meter]
  return limit !== null && used >= limit
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
