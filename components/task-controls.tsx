"use client"

import { useTransition } from "react"
import { PlayIcon } from "lucide-react"

import { runRecurringTaskNow, setRecurringTaskActive } from "@/actions/tasks"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import type { RecurringTask } from "@/lib/db/schema"

export function TaskActiveSwitch({
  task,
}: {
  task: Pick<RecurringTask, "id" | "title" | "active">
}) {
  const [isPending, startTransition] = useTransition()
  const showUpgradeToast = useUpgradeToast()

  return (
    <Switch
      checked={task.active}
      disabled={isPending}
      aria-label={task.active ? `Pause ${task.title}` : `Resume ${task.title}`}
      onCheckedChange={(active) =>
        startTransition(async () => {
          const result = await setRecurringTaskActive(task.id, active)
          if (!result.success) {
            if ("upgradeRequired" in result) {
              showUpgradeToast("Couldn't resume task")
              return
            }
            toast.add({
              type: "error",
              title: active ? "Couldn't resume task" : "Couldn't pause task",
              description: result.error,
            })
            return
          }
          toast.add({
            type: "success",
            title: active
              ? `${task.title} is back on`
              : `${task.title} is paused`,
          })
        })
      }
    />
  )
}

export function RunTaskNowButton({
  task,
}: {
  task: Pick<RecurringTask, "id" | "title">
}) {
  const [isPending, startTransition] = useTransition()
  const showUpgradeToast = useUpgradeToast()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await runRecurringTaskNow(task.id)
          if (!result.success) {
            if ("upgradeRequired" in result) {
              showUpgradeToast("Couldn't run task")
              return
            }
            toast.add({
              type: "error",
              title: "Couldn't run task",
              description: result.error,
            })
            return
          }
          toast.add({
            type: "success",
            title: `${task.title} is running`,
            description: "The report will appear in the bot's chat.",
          })
        })
      }
    >
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PlayIcon data-icon="inline-start" />
      )}
      Run now
    </Button>
  )
}
