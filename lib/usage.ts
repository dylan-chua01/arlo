import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { addMonths, differenceInCalendarMonths } from "date-fns"
import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm"

import { isPlanSlug, PLANS, type Meter, type PlanSlug } from "@/lib/billing"
import { db } from "@/lib/db"
import {
  creditPurchases,
  usageEvents,
  usageMonths,
  type NewUsageEvent,
} from "@/lib/db/schema"

// The backend client, not @clerk/nextjs, so Trigger.dev tasks can use this too
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Dollars per million tokens, which is also millionths of a dollar per token.
// What the Neon AI Gateway charges us. Neon lists Sonnet at $4 in / $20 out;
// cache reads (0.1x input) and 5-minute cache writes (1.25x input) follow
// Anthropic's ratios. Haiku is still at Anthropic's list price.
const MODEL_PRICES: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheWrite: number }
> = {
  "claude-sonnet-5": { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 },
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

// used is this month's total. limit is the plan's monthly allowance and credit
// the add-on credit there was to spend this month (carried over plus bought),
// which only goes once used passes limit.
export type MeterUsage = {
  used: number
  // Null is unlimited
  limit: number | null
  credit: number
}

export type Usage = {
  plan: PlanSlug
  period: BillingPeriod
  ai: MeterUsage & { limit: number }
  sandbox: MeterUsage
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
// and any add-on credit
export async function getUsage(userId: string): Promise<Usage | null> {
  const plan = await getPlan(userId)
  if (!plan) return null
  const { period } = plan
  const { limits } = PLANS[plan.slug]

  const [totals, purchases] = await Promise.all([
    db
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
      .groupBy(usageEvents.meter),
    db
      .select({
        meter: creditPurchases.meter,
        amount: creditPurchases.amount,
        createdAt: creditPurchases.createdAt,
      })
      .from(creditPurchases)
      .where(eq(creditPurchases.userId, userId))
      .orderBy(asc(creditPurchases.createdAt)),
    // Kept for working out carried-over credit in later months
    db
      .insert(usageMonths)
      .values({
        userId,
        start: period.start,
        end: period.end,
        aiLimit: limits.ai,
        sandboxLimit: limits.sandbox,
      })
      .onConflictDoUpdate({
        target: [usageMonths.userId, usageMonths.start],
        set: {
          end: period.end,
          aiLimit: limits.ai,
          sandboxLimit: limits.sandbox,
        },
      }),
  ])
  const used = (meter: Meter) =>
    totals.find((row) => row.meter === meter)?.total ?? 0
  const credit = await getCredit(userId, period, purchases)

  return {
    plan: plan.slug,
    period,
    ai: { used: used("ai"), limit: limits.ai, credit: credit.ai },
    sandbox: {
      used: used("sandbox"),
      limit: limits.sandbox,
      credit: credit.sandbox,
    },
  }
}

// The add-on credit there is to spend in the current month: what was bought,
// less what earlier months went over their plan's allowance by. Purchases
// count from the month they're made in.
export async function getCredit(
  userId: string,
  period: BillingPeriod,
  purchases: { meter: Meter; amount: number; createdAt: Date }[]
): Promise<Record<Meter, number>> {
  const balance: Record<Meter, number> = { ai: 0, sandbox: 0 }
  if (purchases.length === 0) return balance

  // Months before the first purchase have nothing to spend, so they're skipped
  const months =
    purchases[0].createdAt < period.start
      ? await db
          .select({
            end: usageMonths.end,
            aiLimit: usageMonths.aiLimit,
            sandboxLimit: usageMonths.sandboxLimit,
            meter: usageEvents.meter,
            total: sql<number>`sum(${usageEvents.amount})`.mapWith(Number),
          })
          .from(usageMonths)
          .innerJoin(
            usageEvents,
            and(
              eq(usageEvents.userId, usageMonths.userId),
              gte(usageEvents.createdAt, usageMonths.start),
              lt(usageEvents.createdAt, usageMonths.end)
            )
          )
          .where(
            and(
              eq(usageMonths.userId, userId),
              lt(usageMonths.start, period.start),
              gt(usageMonths.end, purchases[0].createdAt)
            )
          )
          .groupBy(
            usageMonths.start,
            usageMonths.end,
            usageMonths.aiLimit,
            usageMonths.sandboxLimit,
            usageEvents.meter
          )
          .orderBy(asc(usageMonths.start))
      : []

  let next = 0
  for (const month of months) {
    // Credit bought during a month can be spent in it
    while (next < purchases.length && purchases[next].createdAt < month.end) {
      balance[purchases[next].meter] += purchases[next].amount
      next++
    }
    const limit = month.meter === "ai" ? month.aiLimit : month.sandboxLimit
    if (limit === null) continue
    const over = Math.max(0, month.total - limit)
    balance[month.meter] -= Math.min(balance[month.meter], over)
  }
  for (; next < purchases.length; next++) {
    balance[purchases[next].meter] += purchases[next].amount
  }
  return balance
}

// Whether a metered allowance and its add-on credit are spent. An unlimited
// one never is.
export function isSpent(usage: Usage, meter: Meter) {
  const { used, limit, credit } = usage[meter]
  return limit !== null && used >= limit + credit
}

// The add-on credit still left this month
export function creditLeft({ used, limit, credit }: MeterUsage) {
  if (limit === null) return credit
  return Math.max(0, credit - Math.max(0, used - limit))
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
