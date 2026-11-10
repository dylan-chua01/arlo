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

export function isPlanSlug(slug: string | undefined): slug is PlanSlug {
  return !!slug && Object.hasOwn(PLANS, slug)
}

export type Meter = "ai" | "sandbox"

// How much less a top-up costs than the subscription it stands in for
export const TOP_UP_DISCOUNT = 0.3

// A one-time top-up of one meter, bought with Stripe Checkout because Clerk
// Billing only sells subscriptions. Someone picks how much they want; it adds
// to the current usage month's allowance and ends when the month does, like
// the upgrade it stands in for.
//
// A rate prices top-ups for one plan and meter: amount costs price, and other
// amounts cost the same per unit (see topUpPrice).
export type TopUpRate = {
  meter: Meter
  // In the meter's units (see PlanLimits)
  amount: number
  // Whole dollars
  price: number
  // What someone would otherwise pay to get amount more this month, and how,
  // like "upgrading to Plus for $30 more a month"
  instead: { price: number; how: string }
}

// The shown unit of each meter, in its ledger units: dollars of AI and hours
// of sandbox time
export const TOP_UP_UNITS: Record<Meter, number> = {
  ai: MICROS_PER_DOLLAR,
  sandbox: 60 * 60,
}

// How much one top-up can add, in ledger units. The minimums keep Stripe's 30¢
// a payment from eating the margin (Max's AI rate breaks even at $10); the
// maximums catch typos.
export const TOP_UP_BOUNDS: Record<Meter, { min: number; max: number }> = {
  ai: { min: 10 * MICROS_PER_DOLLAR, max: 1000 * MICROS_PER_DOLLAR },
  sandbox: { min: 10 * 60 * 60, max: 1000 * 60 * 60 },
}

// The top-up rate for a plan and meter, or null when the meter is unlimited.
//
// The rate is what the next plan up adds to that meter, for 30% less than
// upgrading to it. Unlimited has no plan above it, so its rate is a second
// month of its AI allowance for 30% less than paying for the plan again.
// Unlimited's sandbox time has no amount, so Max's sandbox rate is Max's hours
// again.
//
// Margins with today's PLANS, after Stripe's 2.9% + 30¢ (see the costs above
// PLANS), at those amounts:
// - Pro: $16 of AI for $21 (19%); 100 hours for $21 (64%). Plus is $30 more.
// - Plus: $28 of AI for $35 (17%); 150 hours for $35 (68%). Max is $50 more.
// - Max: $66 of AI for $70 (2%); 300 hours for $70 (68%). Unlimited is $100
//   more.
// - Unlimited: $122 of AI for $140 (10%). A second Unlimited is $200.
export function getTopUpRate(plan: PlanSlug, meter: Meter): TopUpRate | null {
  const current = PLANS[plan]
  const have = current.limits[meter]
  if (have === null) return null

  const slugs = Object.keys(PLANS) as PlanSlug[]
  const nextSlug = slugs[slugs.indexOf(plan) + 1]
  const next = nextSlug ? PLANS[nextSlug] : null

  // On the biggest plan, the alternative is paying for it again
  const instead = next
    ? {
        price: next.price - current.price,
        how: `upgrading to ${next.name} for $${next.price - current.price} more a month`,
      }
    : {
        price: current.price,
        how: `paying $${current.price} for ${current.name} again`,
      }
  const nextHas = next?.limits[meter]
  const amount = nextHas == null ? have : nextHas - have

  return {
    meter,
    amount,
    price: Math.round(instead.price * (1 - TOP_UP_DISCOUNT)),
    instead,
  }
}

export function isMeter(meter: string | undefined): meter is Meter {
  return meter === "ai" || meter === "sandbox"
}

// What a top-up of amount (in ledger units) costs at a rate, in cents. Rounded
// up, so it never undercuts the rate.
export function topUpPrice(rate: TopUpRate, amount: number) {
  return Math.ceil((amount * rate.price * 100) / rate.amount)
}

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  trailingZeroDisplay: "stripIfInteger",
})
const hours = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

// An amount in ledger units, like "$16" or "100 hours"
export function formatTopUpAmount(meter: Meter, amount: number) {
  const shown = amount / TOP_UP_UNITS[meter]
  return meter === "ai"
    ? dollars.format(shown)
    : `${hours.format(shown)} ${shown === 1 ? "hour" : "hours"}`
}

// "$16 of AI usage" or "100 hours of sandbox time"
export function topUpName(meter: Meter, amount: number) {
  return `${formatTopUpAmount(meter, amount)} of ${meter === "ai" ? "AI usage" : "sandbox time"}`
}

export const UPGRADE_ERROR = "Bots and sandboxes need a paid plan."
export const USAGE_LIMIT_ERROR =
  "You've used your plan's allowance for this month. Top up or upgrade your plan for more, or wait for it to reset."

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
