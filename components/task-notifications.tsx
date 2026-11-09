"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeRunsWithTag } from "@trigger.dev/react-hooks"

import { mintTaskRunsToken } from "@/actions/notifications"
import { toast } from "@/components/ui/toast"
import { isAway, notify } from "@/lib/notify"
import type { botTask } from "@/trigger/bot-task"

// Set by bot-task once it starts working
type RunMetadata = {
  title?: string
  botName?: string
  chatId?: string
  outcome?: "succeeded" | "failed"
}

const RETRY_AFTER = 30_000

// Listens for the person's background tasks finishing, on every page, and
// notifies them with a sound, plus a toast or a desktop notification
export function TaskNotifications() {
  const [token, setToken] = useState<{ tag: string; accessToken: string }>()
  // Bumped to mint a fresh token
  const [attempt, setAttempt] = useState(0)
  // Kept across token refreshes, so a new subscription doesn't renotify
  // runs that finished before the page opened, or were already notified
  const [since] = useState(() => Date.now())
  const [notified] = useState(() => new Set<string>())
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    mintTaskRunsToken()
      .then((result) => setToken(result ?? undefined))
      .catch((error) => {
        console.error("Failed to mint task runs token", error)
        timeout = setTimeout(retry, RETRY_AFTER)
      })
    return () => clearTimeout(timeout)
  }, [attempt, retry])

  if (!token) return null
  return (
    <TaskRunWatcher
      // A new token starts a new subscription
      key={token.accessToken}
      {...token}
      since={since}
      notified={notified}
      onExpired={retry}
    />
  )
}

function TaskRunWatcher({
  tag,
  accessToken,
  since,
  notified,
  onExpired,
}: {
  tag: string
  accessToken: string
  since: number
  notified: Set<string>
  onExpired: () => void
}) {
  const router = useRouter()
  const { runs, error } = useRealtimeRunsWithTag<typeof botTask>(tag, {
    accessToken,
    // Longer than a task can run
    createdAt: "1d",
    skipColumns: ["payload", "output", "error", "costInCents"],
  })

  // The token expired, or the connection dropped for good
  useEffect(() => {
    if (!error) return
    const timeout = setTimeout(onExpired, RETRY_AFTER)
    return () => clearTimeout(timeout)
  }, [error, onExpired])

  useEffect(() => {
    for (const run of runs) {
      if (!run.finishedAt || notified.has(run.id)) continue
      notified.add(run.id)
      if (run.finishedAt.getTime() < since) continue

      const meta = (run.metadata ?? {}) as RunMetadata
      // Skipped before starting: its bot or chat was deleted
      if (!meta.title || !meta.chatId) continue
      // The person stopped it themselves
      if (run.status === "CANCELED") continue

      const failed = !run.isSuccess || meta.outcome === "failed"
      const href = `/chats/${meta.chatId}`
      const title = failed
        ? `${meta.title} didn't finish`
        : `${meta.title} is done`
      const body = `${meta.botName ?? "Your bot"} posted ${failed ? "an update" : "a report"} in your chat.`

      const away = isAway()
      void notify({
        key: `task-run:${run.id}`,
        title,
        body,
        onClick: () => router.push(href),
      })
      // In the app already, so say it in the app too
      if (!away) {
        toast.add({
          type: failed ? "error" : "success",
          title,
          description: body,
          actionProps: {
            children: "Open chat",
            onClick: () => router.push(href),
          },
        })
      }
    }
  }, [runs, since, notified, router])

  return null
}
