import Stripe from "stripe"

import { isPackSlug, PACKS } from "@/lib/billing"
import { db } from "@/lib/db"
import { creditPurchases } from "@/lib/db/schema"

// Clerk Billing runs the plans but only sells subscriptions, so add-on packs
// are one-time payments through Stripe Checkout directly. In production use
// the keys of the Stripe account connected to Clerk Billing.
let client: Stripe | null = null

// Made on first use, so a build without the key still works
export function stripe() {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    client = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return client
}

// Grants a paid Checkout Session's pack. The session's ID is the purchase's,
// so the webhook and the return page can both call this and only one grants.
// Returns the buyer's Clerk user ID, or null when there's nothing to grant.
export async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id
  const pack = session.metadata?.pack
  if (session.payment_status !== "paid" || !userId || !isPackSlug(pack)) {
    return null
  }

  await db
    .insert(creditPurchases)
    .values({
      id: session.id,
      userId,
      meter: PACKS[pack].meter,
      amount: PACKS[pack].amount,
      pack,
      price: session.amount_total ?? PACKS[pack].price * 100,
    })
    .onConflictDoNothing()
  return userId
}
