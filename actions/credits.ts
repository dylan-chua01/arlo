"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  canBuyPack,
  isPackSlug,
  PACKS,
  packName,
  upgradeRequired,
  type UpgradeRequired,
} from "@/lib/billing"
import { fulfillCheckout, stripe } from "@/lib/stripe"
import { getPlan } from "@/lib/usage"

type BuyPackResult =
  | { success: true; url: string }
  | { success: false; error: string }
  | UpgradeRequired

// Starts a Stripe Checkout for an add-on pack. The client sends the browser to
// the returned URL; the webhook (or confirmPackPurchase) grants it once paid.
export async function buyPack(pack: string): Promise<BuyPackResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (!isPackSlug(pack)) {
    return { success: false, error: "That add-on doesn't exist." }
  }
  // Add-ons sit on top of a plan, so free users upgrade first
  const plan = await getPlan(userId)
  if (!plan) return upgradeRequired
  if (!canBuyPack(plan.slug, pack)) {
    return {
      success: false,
      error: "Your plan already has unlimited sandbox time.",
    }
  }

  const origin = (await headers()).get("origin")
  if (!origin) {
    return { success: false, error: "Something went wrong. Please try again." }
  }

  try {
    const user = await currentUser()
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PACKS[pack].price * 100,
            product_data: {
              name: `Arlo add-on: ${packName(pack)}`,
              description:
                "Used once your plan's monthly allowance runs out. Carries over until it's used.",
            },
          },
        },
      ],
      client_reference_id: userId,
      customer_email: user?.primaryEmailAddress?.emailAddress,
      metadata: { pack },
      success_url: `${origin}/usage?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/usage`,
    })
    if (!session.url) throw new Error("Checkout Session has no URL")
    return { success: true, url: session.url }
  } catch (error) {
    Sentry.captureException(error)
    return {
      success: false,
      error: "Couldn't start checkout. Please try again.",
    }
  }
}

type ConfirmPackPurchaseResult =
  { success: true; pack: string } | { success: false; error: string }

// Called when Stripe sends the buyer back, so the pack shows up right away
// even if the webhook hasn't arrived yet (or isn't set up, as in local dev)
export async function confirmPackPurchase(
  sessionId: string
): Promise<ConfirmPackPurchaseResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    // Someone else's session ID grants nothing to this account
    if (session.client_reference_id !== userId) {
      return { success: false, error: "That purchase isn't yours." }
    }
    if (!(await fulfillCheckout(session))) {
      return { success: false, error: "That payment hasn't gone through yet." }
    }
    revalidatePath("/usage")
    const pack = session.metadata?.pack
    return { success: true, pack: isPackSlug(pack) ? packName(pack) : "" }
  } catch (error) {
    Sentry.captureException(error)
    return {
      success: false,
      error: "Couldn't confirm your purchase. Refresh the page in a moment.",
    }
  }
}
