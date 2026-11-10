"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { confirmTopUp } from "@/actions/top-up"
import { toast } from "@/components/ui/toast"

// Rendered on /usage when Stripe sends a buyer back with ?checkout=<session>.
// Grants the top-up (if the webhook hasn't yet), reports it and tidies the URL.
function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    // Strict Mode runs effects twice in development
    if (done.current) return
    done.current = true

    confirmTopUp(sessionId).then((result) => {
      toast.add(
        result.success
          ? {
              type: "success",
              title: "Topped up",
              description: `${result.name} added to this month.`,
            }
          : {
              type: "error",
              title: "Couldn't confirm your top-up",
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
