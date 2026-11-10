import Stripe from "stripe"

import { isMeter } from "@/lib/billing"
import { db } from "@/lib/db"
import { topUps } from "@/lib/db/schema"

// Clerk Billing runs the plans but only sells subscriptions, so top-ups are
// one-time payments through Stripe Checkout directly. In production use the
// keys of the Stripe account connected to Clerk Billing.
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

// Grants a paid Checkout Session's top-up. The session's ID is the top-up's,
// so the webhook and the return page can both call this and only one grants.
// Returns the buyer's Clerk user ID, or null when there's nothing to grant.
export async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id
  const meter = session.metadata?.meter
  const amount = Number(session.metadata?.amount)
  if (
    session.payment_status !== "paid" ||
    !userId ||
    !isMeter(meter) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return null
  }

  await db
    .insert(topUps)
    .values({
      id: session.id,
      userId,
      meter,
      amount,
      price: session.amount_total ?? 0,
    })
    .onConflictDoNothing()
  return userId
}
