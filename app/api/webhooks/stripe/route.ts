import * as Sentry from "@sentry/nextjs"
import type Stripe from "stripe"

import { fulfillCheckout, stripe } from "@/lib/stripe"

// Grants top-ups once Stripe has the money. Subscribe the endpoint to
// checkout.session.completed and checkout.session.async_payment_succeeded
// (the second covers payment methods that settle later).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return new Response("STRIPE_WEBHOOK_SECRET is not set", { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = await stripe().webhooks.constructEventAsync(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      secret
    )
  } catch {
    return new Response("Invalid signature", { status: 400 })
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    try {
      const userId = await fulfillCheckout(event.data.object)
      if (userId) {
        Sentry.logger.info("Top-up bought", {
          meter: event.data.object.metadata?.meter,
          "user.id": userId,
        })
      }
    } catch (error) {
      Sentry.captureException(error)
      // A non-2xx makes Stripe retry, and granting twice is safe
      return new Response("Failed to grant top-up", { status: 500 })
    }
  }

  return new Response("OK")
}
