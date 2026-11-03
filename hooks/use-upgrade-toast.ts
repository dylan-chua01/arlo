"use client"

import { useRouter } from "next/navigation"

import { toast } from "@/components/ui/toast"
import { UPGRADE_ERROR, USAGE_LIMIT_ERROR } from "@/lib/billing"

// The pricing page isn't in the sidebar; this toast is the way to reach it
export function useUpgradeToast() {
  const router = useRouter()

  return (title: string) =>
    toast.add({
      type: "error",
      title,
      description: UPGRADE_ERROR,
      actionProps: {
        children: "View plans",
        onClick: () => router.push("/pricing"),
      },
    })
}

// For a Pro user who has spent the period's allowance
export function useUsageLimitToast() {
  const router = useRouter()

  return (title: string) =>
    toast.add({
      type: "error",
      title,
      description: USAGE_LIMIT_ERROR,
      actionProps: {
        children: "View usage",
        onClick: () => router.push("/usage"),
      },
    })
}
