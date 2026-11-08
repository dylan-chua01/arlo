// Feature slugs in Clerk Billing. Every paid plan has both; free users have neither.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

export const MICROS_PER_DOLLAR = 1_000_000

// What a plan allows each month of usage (see getUsageMonth in lib/usage.ts).
// The ledger in usage_events counts against ai and sandbox; apps is how many
// apps can be connected at once. null means unlimited.
export type PlanLimits = {
  // Model cost in millionths of a dollar
  ai: number
  // Sandbox running time in seconds
  sandbox: number | null
  // Connected apps
  apps: number | null
}

// Paid plans in Clerk Billing, by slug, from smallest to largest. Each one
// must exist in Clerk with the same slug and both features above.
//
// Prices are set for about a 30% margin when a plan's allowance is fully
// used. Costs per period: AI at model list price, sandbox time at Daytona's
// $0.0666/hour for our 1 vCPU / 1 GiB sandboxes, and Clerk Billing's 0.7% plus
// Stripe's 2.9% + 30¢ on each payment. App connections cost us next to nothing
// (Composio's first 1,000 are free, then 10¢ once), so apps is a plan perk;
// the actions bots take in apps are paid for by the AI allowance that drives them.
export const PLANS = {
  // $20/month. Full use costs $8 + $3.33 + $1.02 fees, about a 38% margin.
  pro: {
    name: "Pro",
    limits: { ai: 8_000_000, sandbox: 50 * 60 * 60, apps: 3 },
  },
  // $50/month. Full use costs $22 + $9.99 + $2.10 fees, about a 32% margin.
  plus: {
    name: "Plus",
    limits: { ai: 22_000_000, sandbox: 150 * 60 * 60, apps: 10 },
  },
  // $100/month. Full use costs $45 + $19.98 + $3.90 fees, about a 31% margin.
  max: {
    name: "Max",
    limits: { ai: 45_000_000, sandbox: 300 * 60 * 60, apps: 25 },
  },
  // $200/month. AI is the one cost that grows without bound, so it keeps an
  // allowance. Sandbox time is unlimited because sandboxes stop after 10 idle
  // minutes and their work is driven by the capped AI. At a heavy 450 hours a
  // month it costs $100 + $29.97 + $7.50 fees, about a 31% margin.
  unlimited: {
    name: "Unlimited",
    limits: { ai: 100_000_000, sandbox: null, apps: null },
  },
} satisfies Record<string, { name: string; limits: PlanLimits }>

export type PlanSlug = keyof typeof PLANS

export function isPlanSlug(slug: string | undefined): slug is PlanSlug {
  return !!slug && Object.hasOwn(PLANS, slug)
}

export const UPGRADE_ERROR = "Bots and sandboxes need a paid plan."
export const USAGE_LIMIT_ERROR =
  "You've used your plan's allowance for this month. Upgrade your plan for more, or wait for it to reset."

// Returned by actions a free user can't run, so the client can point them to /pricing
export type UpgradeRequired = {
  success: false
  error: string
  upgradeRequired: true
}

export const upgradeRequired: UpgradeRequired = {
  success: false,
  error: UPGRADE_ERROR,
  upgradeRequired: true,
}

// Returned when the period's allowance is spent, so the client can point them to /usage
export type UsageLimitReached = {
  success: false
  error: string
  usageLimitReached: true
}

export const usageLimitReached: UsageLimitReached = {
  success: false,
  error: USAGE_LIMIT_ERROR,
  usageLimitReached: true,
}

// Returned when the plan's connected apps are all in use, so the client can
// point them to /pricing
export type AppLimitReached = {
  success: false
  error: string
  appLimitReached: true
}

export function appLimitReached(limit: number): AppLimitReached {
  return {
    success: false,
    error: `Your plan includes ${limit} connected apps. Disconnect one, or upgrade your plan to connect more.`,
    appLimitReached: true,
  }
}
