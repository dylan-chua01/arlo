"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  BOTS,
  SANDBOXES,
  upgradeRequired,
  type UpgradeRequired,
} from "@/lib/billing"
import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertRecurringTaskSchema,
  type InsertRecurringTask,
  type RecurringTask,
  type TaskRun,
} from "@/lib/db/schema"
import {
  createRecurringTask as createTask,
  deleteRecurringTask as deleteTask,
  getOwnedRecurringTask,
  setRecurringTaskActive as setTaskActive,
  startTaskRun,
  updateRecurringTask as updateTask,
} from "@/lib/tasks"

type TaskResult =
  | { success: true; task: RecurringTask }
  | { success: false; error: string }
  | UpgradeRequired

// Trigger.dev rejects a cron or time zone it can't read; that's the person's
// to fix, so it goes back as the error
function scheduleError(error: unknown) {
  console.error("Failed to save schedule", error)
  return {
    success: false as const,
    error: "Couldn't save that schedule. Check the cron and time zone.",
  }
}

export async function createRecurringTask(
  input: InsertRecurringTask
): Promise<TaskResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  // Each run is a bot turn in its sandbox
  if (!has({ feature: BOTS }) || !has({ feature: SANDBOXES })) {
    return upgradeRequired
  }

  const parsed = insertRecurringTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }
  const { botId, ...values } = parsed.data

  // Reports go to the bot's own chat. Scoped to the user's bots.
  const [direct] = await db
    .select({ chatId: chats.id })
    .from(chatMembers)
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(
      and(
        eq(chatMembers.botId, botId),
        eq(bots.userId, userId),
        eq(chats.kind, "direct")
      )
    )
  if (!direct) {
    return { success: false, error: "That bot doesn't exist." }
  }

  let task: RecurringTask
  try {
    task = await createTask({ ...values, userId, botId, chatId: direct.chatId })
  } catch (error) {
    return scheduleError(error)
  }

  Sentry.logger.info("Recurring task created", {
    "user.id": userId,
    taskId: task.id,
    botId,
  })
  revalidatePath("/tasks")
  return { success: true, task }
}

export async function updateRecurringTask(
  taskId: string,
  input: InsertRecurringTask
): Promise<TaskResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  const parsed = insertRecurringTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }
  const task = await getOwnedRecurringTask(userId, taskId)
  if (!task) {
    return { success: false, error: "That task doesn't exist." }
  }

  // The bot stays, since its chat holds the task's reports
  const { title, instructions, cron, timezone } = parsed.data
  let updated: RecurringTask
  try {
    updated = await updateTask(task, { title, instructions, cron, timezone })
  } catch (error) {
    return scheduleError(error)
  }

  Sentry.logger.info("Recurring task updated", { "user.id": userId, taskId })
  revalidatePath("/tasks")
  return { success: true, task: updated }
}

export async function setRecurringTaskActive(
  taskId: string,
  active: boolean
): Promise<TaskResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (active && (!has({ feature: BOTS }) || !has({ feature: SANDBOXES }))) {
    return upgradeRequired
  }
  const task = await getOwnedRecurringTask(userId, taskId)
  if (!task) {
    return { success: false, error: "That task doesn't exist." }
  }

  const updated = await setTaskActive(task, active)

  Sentry.logger.info(
    active ? "Recurring task resumed" : "Recurring task paused",
    {
      "user.id": userId,
      taskId,
    }
  )
  revalidatePath("/tasks")
  return { success: true, task: updated }
}

export async function deleteRecurringTask(taskId: string): Promise<TaskResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  const task = await getOwnedRecurringTask(userId, taskId)
  if (!task) {
    return { success: false, error: "That task doesn't exist." }
  }

  await deleteTask(task)

  Sentry.logger.info("Recurring task deleted", { "user.id": userId, taskId })
  revalidatePath("/tasks")
  return { success: true, task }
}

type RunNowResult =
  | { success: true; run: TaskRun }
  | { success: false; error: string }
  | UpgradeRequired

// Runs a recurring task once now, on top of its schedule
export async function runRecurringTaskNow(
  taskId: string
): Promise<RunNowResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  if (!has({ feature: BOTS }) || !has({ feature: SANDBOXES })) {
    return upgradeRequired
  }
  const task = await getOwnedRecurringTask(userId, taskId)
  if (!task) {
    return { success: false, error: "That task doesn't exist." }
  }

  let run: TaskRun | null
  try {
    run = await startTaskRun({
      taskId: task.id,
      userId,
      botId: task.botId,
      chatId: task.chatId,
      title: task.title,
      instructions: task.instructions,
    })
  } catch (error) {
    console.error("Failed to start task run", taskId, error)
    return { success: false, error: "Couldn't start the task. Try again." }
  }
  if (!run) {
    return { success: false, error: "Couldn't start the task. Try again." }
  }

  Sentry.logger.info("Recurring task run started", {
    "user.id": userId,
    taskId,
    taskRunId: run.id,
  })
  revalidatePath("/tasks")
  return { success: true, run }
}
