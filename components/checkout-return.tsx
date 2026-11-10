"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { confirmPackPurchase } from "@/actions/credits"
import { toast } from "@/components/ui/toast"

// Rendered on /usage when Stripe sends a buyer back with ?checkout=<session>.
// Grants the pack (if the webhook hasn't yet), reports it and tidies the URL.
function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    // Strict Mode runs effects twice in development
    if (done.current) return
    done.current = true

    confirmPackPurchase(sessionId).then((result) => {
      toast.add(
        result.success
          ? {
              type: "success",
              title: "Add-on bought",
              description: result.pack
                ? `${result.pack} is ready to use.`
                : "It's ready to use.",
            }
          : {
              type: "error",
              title: "Couldn't confirm your purchase",
              description: result.error,
            }
      )
      router.replace("/usage")
      router.refresh()
    })
  }, [sessionId, router])

  return null
}

export { CheckoutReturn }
