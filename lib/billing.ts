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
// Prices are set for about a 20% margin when a plan's allowance is fully
// used, which few people do. Prompt caching (CACHE_OPTIONS in trigger/chat.ts)
// makes each dollar of AI go several times further than full-price input would.
//
// Costs per period: AI at the Neon AI Gateway's price (MODEL_PRICES in lib/usage.ts), sandbox time at Daytona's
// $0.0666/hour for our 1 vCPU / 1 GiB sandboxes, and Clerk Billing's 0.7% plus
// Stripe's 2.9% + 30¢ on each payment. App connections cost us next to nothing
// (Composio's first 1,000 are free, then 10¢ once), so apps is a plan perk;
// the actions bots take in apps are paid for by the AI allowance that drives them.
export const PLANS = {
  // $20/month. Full use costs $12 + $3.33 + $1.02 fees, about an 18% margin.
  pro: {
    price: 20,
    name: "Pro",
    limits: { ai: 12_000_000, sandbox: 50 * 60 * 60, apps: 3 },
  },
  // $50/month. Full use costs $28 + $9.99 + $2.10 fees, about a 20% margin.
  plus: {
    price: 50,
    name: "Plus",
    limits: { ai: 28_000_000, sandbox: 150 * 60 * 60, apps: 10 },
  },
  // $100/month. Full use costs $56 + $19.98 + $3.90 fees, about a 20% margin.
  max: {
    price: 100,
    name: "Max",
    limits: { ai: 56_000_000, sandbox: 300 * 60 * 60, apps: 25 },
  },
  // $200/month. AI is the one cost that grows without bound, so it keeps an
  // allowance. Sandbox time is unlimited because sandboxes stop after 10 idle
  // minutes and their work is driven by the capped AI. At a heavy 450 hours a
  // month it costs $122 + $29.97 + $7.50 fees, about a 20% margin.
  unlimited: {
    price: 200,
    name: "Unlimited",
    limits: { ai: 122_000_000, sandbox: null, apps: null },
  },
} satisfies Record<
  string,
  // price is in dollars a month and must match the plan's price in Clerk
  { price: number; name: string; limits: PlanLimits }
>

export type PlanSlug = keyof typeof PLANS

export type Meter = "ai" | "sandbox"

// One-time add-on packs, bought with Stripe Checkout (Clerk Billing only sells
// subscriptions). A pack is spent only after the month's plan allowance runs
// out, and whatever's left carries over to later months.
//
// Each pack keeps about a 20% margin after Stripe's 2.9% + 30¢, the same as the
// plans, so per unit it costs about what a plan does. What makes it cheaper is
// that it's sized to the gap: every pack costs at least 30% less than the
// cheapest upgrade that would cover the same amount for one month, on every
// plan that can buy it. Against the upgrades (price difference → extra AI,
// extra hours): Pro → Plus $30 → $16, 100h; Pro → Max $80 → $44, 250h;
// Plus → Max $50 → $28, 150h; Max → Unlimited $100 → $66, unlimited hours.
export const PACKS = {
  // Costs $5 + $0.50 fees, a 21% margin. Upgrading costs $30 or more: 77% less.
  "ai-5": { meter: "ai", amount: 5_000_000, price: 7 },
  // Costs $12 + $0.76 fees, a 20% margin. Pro → Plus is $30: 47% less.
  "ai-12": { meter: "ai", amount: 12_000_000, price: 16 },
  // Costs $25 + $1.26 fees, a 20% margin. Plus → Max is $50: 34% less, and
  // Pro → Max is $80: 59% less.
  "ai-25": { meter: "ai", amount: 25_000_000, price: 33 },
  // Costs $1.67 + $0.39 fees, a 32% margin. Upgrading costs $30 or more: 90% less.
  "sandbox-25": { meter: "sandbox", amount: 25 * 60 * 60, price: 3 },
  // Costs $6.66 + $0.56 fees, a 20% margin. Pro → Plus is $30: 70% less.
  "sandbox-100": { meter: "sandbox", amount: 100 * 60 * 60, price: 9 },
  // Costs $16.65 + $0.94 fees, a 20% margin. Pro → Max is $80: 73% less, and
  // Plus or Max → Unlimited is $100 or more: 78% less.
  "sandbox-250": { meter: "sandbox", amount: 250 * 60 * 60, price: 22 },
} satisfies Record<
  string,
  // amount is in the meter's units (see PlanLimits); price is in dollars
  { meter: Meter; amount: number; price: number }
>

export type PackSlug = keyof typeof PACKS

export function isPackSlug(slug: string | undefined): slug is PackSlug {
  return !!slug && Object.hasOwn(PACKS, slug)
}

// Unlimited sandbox time has nothing to add to
export function canBuyPack(plan: PlanSlug, pack: PackSlug) {
  return PLANS[plan].limits[PACKS[pack].meter] !== null
}

const packDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function packName(pack: PackSlug) {
  const { meter, amount } = PACKS[pack]
  return meter === "ai"
    ? `${packDollars.format(amount / MICROS_PER_DOLLAR)} of AI usage`
    : `${amount / 3600} hours of sandbox time`
}

export function isPlanSlug(slug: string | undefined): slug is PlanSlug {
  return !!slug && Object.hasOwn(PLANS, slug)
}

export const UPGRADE_ERROR = "Bots and sandboxes need a paid plan."
export const USAGE_LIMIT_ERROR =
  "You've used your plan's allowance for this month. Buy an add-on or upgrade your plan for more, or wait for it to reset."

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
