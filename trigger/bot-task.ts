import { neon } from "@neon/ai-sdk-provider"
import * as Sentry from "@sentry/node"
import { logger, metadata, schedules, schemaTask } from "@trigger.dev/sdk"
import { AgentChat } from "@trigger.dev/sdk/chat"
import { generateText, stepCountIs } from "ai"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { UPGRADE_ERROR, USAGE_LIMIT_ERROR } from "@/lib/billing"
import { CHAT_AGENT_VERSION } from "@/lib/chat-agent"
import { db } from "@/lib/db"
import {
  recurringTasks,
  taskRuns,
  type SharedFile,
  type TaskRun,
} from "@/lib/db/schema"
import { setRecurringTaskActive, startTaskRun } from "@/lib/tasks"
import { getUsage, isSpent, recordAiUsage } from "@/lib/usage"

import {
  buildSystemPrompt,
  CHAT_MODEL,
  getAppTools,
  type chatAgent,
} from "./chat"
import {
  chatContext,
  readMemory,
  sandboxContext,
  tools,
  type ChatUIMessage,
} from "./tools"

// Far more room than a chat turn's 50 steps, since nobody is waiting on it.
// The AI allowance still stops it sooner if it runs out.
const MAX_STEPS = 200

// The person isn't watching, so the bot only looks at the screen itself
const backgroundTools = Object.fromEntries(
  Object.entries(tools).filter(([name]) => name !== "showScreen")
) as Omit<typeof tools, "showScreen">

function taskPrompt(run: TaskRun, timezone: string | null) {
  const now = new Date().toLocaleString("en-US", {
    timeZone: timezone ?? "UTC",
    dateStyle: "full",
    timeStyle: "short",
  })
  return [
    `You're working on a background task: "${run.title}". ${run.taskId ? "It's a recurring task the person scheduled, and this is one of its runs." : "The person handed it to you to do in the background."} It's ${now} (${timezone ?? "UTC"}).`,
    [
      `How background tasks work:`,
      `- Nobody is watching while you work, and you can't ask questions until you're done. Make sensible choices and carry the task through to the end yourself.`,
      `- When you finish, your final message is posted to your chat with the person as your report. Lead with the outcome, keep it short, and say plainly if something didn't work. Share any files they'll want with shareFile; they appear under the report.`,
      `- Reading and gathering are fine. Only do things others will see or that are hard to undo, like sending an email or message, posting, inviting people, or deleting, when the task's instructions clearly ask for them. Otherwise prepare them and say in your report what's waiting for their go-ahead.`,
      ...(run.taskId
        ? [
            `- This task runs again on its schedule. Use your memory to keep what the next run needs, like what you've already reported, so each report covers what's new.`,
          ]
        : []),
    ].join("\n"),
  ].join("\n\n")
}

// The text of the last step that had any, since a run that ends on a tool
// call has none in its final step
function finalText(steps: { text: string }[]) {
  return steps.findLast((step) => step.text.trim())?.text.trim() ?? ""
}

// Posts a message to the chat that the chat agent answers with the run's
// report, read from the database rather than the message
async function deliverReport(run: TaskRun, status: "succeeded" | "failed") {
  const agent = new AgentChat<typeof chatAgent>({
    agent: "chat",
    id: run.chatId,
    clientData: { botId: run.botId, agentVersion: CHAT_AGENT_VERSION },
  })
  const message: ChatUIMessage = {
    id: nanoid(),
    role: "user",
    parts: [
      {
        type: "text",
        text: `(Background task “${run.title}” ${status === "succeeded" ? "finished" : "didn't finish"})`,
      },
    ],
    metadata: { botId: run.botId, taskRunId: run.id, createdAt: Date.now() },
  }
  const stream = await agent.sendRaw([message])
  // The reply goes to the chat's transcript; nothing here needs to read it.
  // No close() either, which would end the chat's run.
  await stream.cancel()
}

// Does one task run's work in its bot's sandbox and apps, then reports to
// the chat. Not retried, since a retry would repeat whatever it already did
// in the person's apps.
export const botTask = schemaTask({
  id: "bot-task",
  schema: z.object({ taskRunId: z.string() }),
  maxDuration: 2 * 60 * 60,
  retry: { maxAttempts: 1 },
  // With the bot id as the concurrency key, one run at a time per bot
  queue: { name: "bot-tasks", concurrencyLimit: 1 },
  // A crash or timeout skips the catch below, so the run would stay "running"
  onFailure: async ({ payload }) => {
    await db
      .update(taskRuns)
      .set({
        status: "failed",
        report: "Something went wrong and I couldn't finish this task.",
        finishedAt: new Date(),
      })
      .where(eq(taskRuns.id, payload.taskRunId))
  },
  run: async ({ taskRunId }, { ctx, signal }) => {
    const run = await db.query.taskRuns.findFirst({
      where: (runs, { eq }) => eq(runs.id, taskRunId),
      with: { bot: true },
    })
    // Gone with its bot or chat, or already done
    if (!run || run.status !== "queued") return { skipped: true }
    const { bot, ...taskRun } = run

    await db
      .update(taskRuns)
      .set({
        status: "running",
        startedAt: new Date(),
        triggerRunId: ctx.run.id,
      })
      .where(eq(taskRuns.id, taskRunId))

    // Read by the browser to notify the person when it finishes
    metadata
      .set("title", taskRun.title)
      .set("botName", bot.name)
      .set("chatId", taskRun.chatId)

    const task = taskRun.taskId
      ? await db.query.recurringTasks.findFirst({
          where: (tasks, { eq }) => eq(tasks.id, taskRun.taskId!),
        })
      : undefined

    let status: "succeeded" | "failed" = "succeeded"
    let report: string
    let files: SharedFile[] = []
    try {
      const usage = await getUsage(taskRun.userId)
      if (!usage) throw new Error(UPGRADE_ERROR)
      if (isSpent(usage, "ai") || isSpent(usage, "sandbox")) {
        throw new Error(USAGE_LIMIT_ERROR)
      }
      let aiBudget = usage.ai.limit - usage.ai.used

      // The same tools as in chat, which read these
      sandboxContext.init({ sandboxId: bot.sandboxId })
      chatContext.init({ chatId: taskRun.chatId, botId: bot.id })

      const [memory, appTools] = await Promise.all([
        readMemory().catch((error) => {
          console.error("Failed to read memory", bot.sandboxId, error)
          return null
        }),
        getAppTools(taskRun.userId, usage.plan).catch((error) => {
          console.error("Failed to load app tools", error)
          Sentry.captureException(error, { contexts: { task: { taskRunId } } })
          return null
        }),
      ])

      let steps = 0
      const result = await generateText({
        model: neon(CHAT_MODEL),
        system: [
          buildSystemPrompt(bot, [bot], memory, appTools),
          taskPrompt(taskRun, task?.timezone ?? null),
        ].join("\n\n"),
        prompt: taskRun.instructions,
        tools: { ...backgroundTools, ...appTools?.tools },
        abortSignal: signal,
        onStepFinish: async ({ usage: stepUsage }) => {
          aiBudget -= await recordAiUsage(
            { userId: taskRun.userId, chatId: taskRun.chatId, botId: bot.id },
            CHAT_MODEL,
            stepUsage
          )
          metadata.set("steps", ++steps)
        },
        stopWhen: [stepCountIs(MAX_STEPS), () => aiBudget <= 0],
      })

      files = result.steps.flatMap((step) =>
        step.toolResults.flatMap((toolResult) =>
          toolResult.toolName === "shareFile"
            ? [toolResult.output as SharedFile]
            : []
        )
      )
      report = finalText(result.steps) || "Done."
      // Stopped by a limit while it was still working
      if (result.finishReason === "tool-calls") {
        report += `\n\n_I stopped before finishing, because ${aiBudget <= 0 ? "your plan's allowance for this month ran out" : "the task took more steps than a background task allows"}._`
      }
    } catch (error) {
      status = "failed"
      const message = error instanceof Error ? error.message : String(error)
      const billing = message === UPGRADE_ERROR || message === USAGE_LIMIT_ERROR
      report = billing
        ? message === UPGRADE_ERROR
          ? "Background tasks need a paid plan."
          : "Your plan's allowance for this month is used up."
        : "Something went wrong and I couldn't finish this task."
      // A recurring task would keep failing the same way, so pause it rather
      // than post a failure every time it fires
      if (billing && task?.active) {
        await setRecurringTaskActive(task, false).catch((pauseError) => {
          console.error("Failed to pause task", task.id, pauseError)
        })
        report +=
          " I've paused this recurring task. Resume it on the Tasks page when you're ready."
      }
      if (!billing) {
        Sentry.captureException(error, { contexts: { task: { taskRunId } } })
      }
      logger.error("Task run failed", { taskRunId, error: message })
    }

    const [finished] = await db
      .update(taskRuns)
      .set({ status, report, files, finishedAt: new Date() })
      .where(eq(taskRuns.id, taskRunId))
      .returning()
    metadata.set("outcome", status)
    await deliverReport(finished, status)

    Sentry.logger.info("Task run finished", {
      taskRunId,
      botId: bot.id,
      chatId: taskRun.chatId,
      status,
      recurring: !!taskRun.taskId,
    })
    return { status }
  },
})

// Every recurring task's schedule calls this with the task id as externalId
export const recurringTask = schedules.task({
  id: "recurring-task",
  run: async ({ externalId, scheduleId, timestamp, upcoming }) => {
    const task = externalId
      ? await db.query.recurringTasks.findFirst({
          where: (tasks, { eq }) => eq(tasks.id, externalId),
        })
      : undefined
    // Its task was deleted, or its bot or chat with it
    if (!task) {
      await schedules.del(scheduleId).catch((error) => {
        logger.error("Failed to delete orphaned schedule", {
          scheduleId,
          error,
        })
      })
      return { skipped: "deleted" }
    }

    await db
      .update(recurringTasks)
      .set({ nextRunAt: upcoming[0] ?? null })
      .where(eq(recurringTasks.id, task.id))
    if (!task.active) return { skipped: "paused" }

    // From the fire time, so a retry of this run queues the work once
    const run = await startTaskRun({
      id: `${task.id}-${timestamp.getTime()}`,
      taskId: task.id,
      userId: task.userId,
      botId: task.botId,
      chatId: task.chatId,
      title: task.title,
      instructions: task.instructions,
    })
    return { taskRunId: run?.id ?? null }
  },
})
