// Feature slugs on the Pro plan in Clerk Billing. Free users have neither.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

export const UPGRADE_ERROR = "Bots and sandboxes are part of the Pro plan."

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
