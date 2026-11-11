import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { formatDistanceToNowStrict } from "date-fns"
import { ListChecksIcon, PencilIcon, PlusIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { RunTaskNowButton, TaskActiveSwitch } from "@/components/task-controls"
import { TaskDialog } from "@/components/task-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { describeSchedule } from "@/lib/cron"
import { db } from "@/lib/db"
import type { TaskRun } from "@/lib/db/schema"
import { listRecurringTasks } from "@/lib/tasks"
import { getBots } from "@/queries/bots"

const RECENT_RUNS = 20

const STATUS = {
  queued: { label: "Queued", variant: "outline" },
  running: { label: "Running", variant: "secondary" },
  succeeded: { label: "Done", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
} as const satisfies Record<
  TaskRun["status"],
  { label: string; variant: "outline" | "secondary" | "destructive" }
>

// Reached from the user button's menu, not the sidebar
export default async function Page() {
  const { userId } = await auth.protect()
  const [bots, tasks, runs] = await Promise.all([
    getBots(),
    listRecurringTasks(userId),
    db.query.taskRuns.findMany({
      where: (runs, { eq }) => eq(runs.userId, userId),
      orderBy: (runs, { desc }) => [desc(runs.createdAt)],
      limit: RECENT_RUNS,
      columns: {
        id: true,
        title: true,
        status: true,
        chatId: true,
        taskId: true,
        createdAt: true,
        finishedAt: true,
      },
      with: { bot: { columns: { name: true, avatar: true } } },
    }),
  ])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 md:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Work your bots do on their own, on a schedule or in the background.
            It keeps going when you close the app, and each report lands in the
            bot&apos;s chat. To start a one-off, just ask a bot to do it in the
            background.
          </p>
        </div>
        {bots.length > 0 && (
          <TaskDialog bots={bots}>
            <Button className="shrink-0 self-start">
              <PlusIcon data-icon="inline-start" />
              New task
            </Button>
          </TaskDialog>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recurring</h2>
        {tasks.length > 0 ? (
          <ItemGroup className="gap-2">
            {tasks.map((task) => (
              <Item key={task.id} variant="outline">
                <ItemMedia>
                  <ChatAvatar seed={task.bot.avatar} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{task.title}</ItemTitle>
                  <ItemDescription>
                    {task.bot.name} ·{" "}
                    {describeSchedule(task.cron) ?? task.scheduleDescription} (
                    {task.timezone.replaceAll("_", " ")})
                    {task.active
                      ? task.nextRunAt &&
                        ` · Next in ${formatDistanceToNowStrict(task.nextRunAt)}`
                      : " · Paused"}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <RunTaskNowButton task={task} />
                  <TaskDialog bots={bots} task={task}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${task.title}`}
                    >
                      <PencilIcon />
                    </Button>
                  </TaskDialog>
                  <TaskActiveSwitch task={task} />
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecksIcon />
              </EmptyMedia>
              <EmptyTitle>No recurring tasks yet</EmptyTitle>
              <EmptyDescription>
                {bots.length > 0
                  ? "Create one here, or ask a bot in chat to do something every morning or every week."
                  : "Make a bot first, then give it something to do on a schedule."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      {runs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Recent runs
          </h2>
          <ItemGroup className="gap-2">
            {runs.map((run) => {
              const status = STATUS[run.status]
              return (
                <Item
                  key={run.id}
                  variant="outline"
                  size="sm"
                  render={<Link href={`/chats/${run.chatId}`} />}
                >
                  <ItemMedia>
                    <ChatAvatar seed={run.bot.avatar} className="size-6" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{run.title}</ItemTitle>
                    <ItemDescription>
                      {run.bot.name} · {run.taskId ? "Scheduled" : "One-off"} ·{" "}
                      {run.finishedAt
                        ? `finished ${formatDistanceToNowStrict(run.finishedAt, { addSuffix: true })}`
                        : `started ${formatDistanceToNowStrict(run.createdAt, { addSuffix: true })}`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </ItemActions>
                </Item>
              )
            })}
          </ItemGroup>
        </section>
      )}
    </div>
  )
}
