"use client"

import { useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"

import { connectApp, disconnectApp } from "@/actions/apps"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"

export function AppButton({
  toolkit,
  name,
  status,
}: {
  toolkit: string
  name: string
  // "expired" is a connection whose sign-in has lapsed
  status: "connected" | "expired" | "disconnected"
}) {
  const [isPending, startTransition] = useTransition()

  function connect() {
    startTransition(async () => {
      const result = await connectApp(toolkit)
      if (!result.success) {
        toast.add({
          type: "error",
          title: `Couldn't connect ${name}`,
          description: result.error,
        })
        return
      }
      // The app's own sign-in, which sends the person back to /apps
      window.location.assign(result.redirectUrl)
      // Keep the spinner until the page goes
      await new Promise(() => {})
    })
  }

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectApp(toolkit)
      toast.add(
        result.success
          ? {
              type: "success",
              title: `Disconnected ${name}`,
              description: "Your bots can no longer use it.",
            }
          : {
              type: "error",
              title: `Couldn't disconnect ${name}`,
              description: result.error,
            }
      )
    })
  }

  if (status === "connected") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={disconnect}
        disabled={isPending}
      >
        {isPending && <Spinner data-icon="inline-start" />}
        Disconnect
      </Button>
    )
  }
  return (
    <Button size="sm" onClick={connect} disabled={isPending}>
      {isPending && <Spinner data-icon="inline-start" />}
      {status === "expired" ? "Reconnect" : "Connect"}
    </Button>
  )
}

// Composio sends the person back with ?app=…&status=success|failed
export function ConnectResultToast({
  name,
  status,
}: {
  name?: string
  status?: string
}) {
  const router = useRouter()
  const shown = useRef(false)

  useEffect(() => {
    if (!status || shown.current) return
    shown.current = true
    const app = name ?? "the app"
    toast.add(
      status === "success"
        ? {
            type: "success",
            title: `Connected ${app}`,
            description: "Your bots can use it now.",
          }
        : {
            type: "error",
            title: `Couldn't connect ${app}`,
            description: "The sign-in didn't finish. Try again.",
          }
    )
    // So a reload doesn't show it again
    router.replace("/apps", { scroll: false })
  }, [name, status, router])

  return null
}
