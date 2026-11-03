// Plan slug in Clerk Billing
export const PRO_PLAN = "pro"

// Feature slugs on the Pro plan in Clerk Billing. Free users have neither.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

// What one Pro subscription period allows. The ledger in usage_events counts
// against these.
export const PRO_LIMITS = {
  // Model cost in millionths of a dollar ($8)
  ai: 8_000_000,
  // Sandbox running time in seconds (50 hours)
  sandbox: 50 * 60 * 60,
}

export const MICROS_PER_DOLLAR = 1_000_000

export const UPGRADE_ERROR = "Bots and sandboxes are part of the Pro plan."
export const USAGE_LIMIT_ERROR =
  "You've used this period's allowance. It resets at the start of your next billing period."

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
