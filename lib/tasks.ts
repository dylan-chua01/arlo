import { schedules, tasks } from "@trigger.dev/sdk"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"

import { describeSchedule } from "@/lib/cron"
import { db } from "@/lib/db"
import {
  recurringTasks,
  taskRuns,
  type RecurringTask,
  type TaskRun,
} from "@/lib/db/schema"
import type { botTask, recurringTask } from "@/trigger/bot-task"

// Used by the server actions and by the bots' own tools in a Trigger.dev run,
// so nothing here reads the Clerk session: callers pass the owner.

const RECURRING_TASK_ID =
  "recurring-task" satisfies (typeof recurringTask)["id"]

type ScheduleFields = Pick<RecurringTask, "cron" | "timezone">

// The schedule calls recurring-task with the task id as its externalId
export async function createRecurringTask(
  values: Pick<
    RecurringTask,
    "userId" | "botId" | "chatId" | "title" | "instructions"
  > &
    ScheduleFields
): Promise<RecurringTask> {
  const id = nanoid()
  const schedule = await schedules.create({
    task: RECURRING_TASK_ID,
    cron: values.cron,
    timezone: values.timezone,
    externalId: id,
    // One schedule per task, even if this is retried
    deduplicationKey: id,
  })
  try {
    const [task] = await db
      .insert(recurringTasks)
      .values({
        ...values,
        id,
        scheduleId: schedule.id,
        scheduleDescription:
          describeSchedule(values.cron) ?? schedule.generator.description,
        nextRunAt: schedule.nextRun ?? null,
      })
      .returning()
    return task
  } catch (error) {
    await schedules.del(schedule.id).catch((deleteError) => {
      console.error("Failed to delete schedule", schedule.id, deleteError)
    })
    throw error
  }
}

// The task must already be known to belong to the caller
export async function updateRecurringTask(
  task: RecurringTask,
  values: Pick<RecurringTask, "title" | "instructions"> & ScheduleFields
): Promise<RecurringTask> {
  const schedule = await schedules.update(task.scheduleId, {
    task: RECURRING_TASK_ID,
    cron: values.cron,
    timezone: values.timezone,
    externalId: task.id,
  })
  const [updated] = await db
    .update(recurringTasks)
    .set({
      ...values,
      scheduleDescription:
        describeSchedule(values.cron) ?? schedule.generator.description,
      nextRunAt: task.active ? (schedule.nextRun ?? null) : null,
    })
    .where(eq(recurringTasks.id, task.id))
    .returning()
  return updated
}

export async function setRecurringTaskActive(
  task: RecurringTask,
  active: boolean
): Promise<RecurringTask> {
  const schedule = active
    ? await schedules.activate(task.scheduleId)
    : await schedules.deactivate(task.scheduleId)
  const [updated] = await db
    .update(recurringTasks)
    .set({ active, nextRunAt: active ? (schedule.nextRun ?? null) : null })
    .where(eq(recurringTasks.id, task.id))
    .returning()
  return updated
}

export async function deleteRecurringTask(task: RecurringTask) {
  await db.delete(recurringTasks).where(eq(recurringTasks.id, task.id))
  // The row is already gone, and a schedule without one deletes itself when
  // it next fires, so a failure here only leaves it until then
  await schedules.del(task.scheduleId).catch((error) => {
    console.error("Failed to delete schedule", task.scheduleId, error)
  })
}

// For a bot or chat about to be deleted: their tasks go with them by cascade,
// but the schedules live in Trigger.dev
export async function deleteSchedulesFor(
  where: { botId: string } | { chatId: string }
) {
  const rows = await db
    .select({ scheduleId: recurringTasks.scheduleId })
    .from(recurringTasks)
    .where(
      "botId" in where
        ? eq(recurringTasks.botId, where.botId)
        : eq(recurringTasks.chatId, where.chatId)
    )
  await Promise.all(
    rows.map(({ scheduleId }) =>
      schedules.del(scheduleId).catch((error) => {
        console.error("Failed to delete schedule", scheduleId, error)
      })
    )
  )
}

// Scoped to the owner, so an id from a client or a model can't reach anyone
// else's task
export async function getOwnedRecurringTask(userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(recurringTasks)
    .where(
      and(eq(recurringTasks.id, taskId), eq(recurringTasks.userId, userId))
    )
  return task ?? null
}

export async function listRecurringTasks(userId: string) {
  return db.query.recurringTasks.findMany({
    where: (tasks, { eq }) => eq(tasks.userId, userId),
    orderBy: (tasks, { asc }) => [asc(tasks.createdAt)],
    with: { bot: { columns: { id: true, name: true, avatar: true } } },
  })
}

// Queues background work for a bot. The run's id doubles as the trigger's
// idempotency key, so a retried caller that passes the same id starts it once.
export async function startTaskRun(
  values: Pick<
    TaskRun,
    "userId" | "botId" | "chatId" | "title" | "instructions"
  > & { id?: string; taskId?: string | null }
): Promise<TaskRun | null> {
  const id = values.id ?? nanoid()
  const [run] = await db
    .insert(taskRuns)
    .values({ ...values, id })
    .onConflictDoNothing()
    .returning()
  // Already queued by an earlier attempt
  if (!run) return null

  try {
    const handle = await tasks.trigger<typeof botTask>(
      "bot-task",
      { taskRunId: id },
      {
        idempotencyKey: `task-run:${id}`,
        // One at a time per bot, since they share its sandbox
        concurrencyKey: values.botId,
        // user: lets the person's browser hear when it finishes
        tags: [
          `user:${values.userId}`,
          `bot:${values.botId}`,
          `chat:${values.chatId}`,
        ],
      }
    )
    const [started] = await db
      .update(taskRuns)
      .set({ triggerRunId: handle.id })
      .where(eq(taskRuns.id, id))
      .returning()
    return started
  } catch (error) {
    await db
      .update(taskRuns)
      .set({
        status: "failed",
        report: "Couldn't start the task.",
        finishedAt: new Date(),
      })
      .where(eq(taskRuns.id, id))
    throw error
  }
}
