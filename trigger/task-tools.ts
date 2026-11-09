import { tool } from "ai"
import { z } from "zod"

import { CRON_ERROR, isValidCron, isValidTimezone } from "@/lib/cron"
import type { Bot } from "@/lib/db/schema"
import {
  createRecurringTask,
  deleteRecurringTask,
  getOwnedRecurringTask,
  listRecurringTasks,
  setRecurringTaskActive,
  startTaskRun,
} from "@/lib/tasks"

export const TASKS_PROMPT = [
  `You can also work in the background, which keeps going when the person closes the app or turns off their computer:`,
  `- startBackgroundTask hands a task to a background run of you, with far more room than a chat reply. Use it when the person asks for something to be done in the background, or when a task will clearly take a long time, like deep research across many sources, a long build, or working through a big batch of files or emails. Quick things you just do in your reply. When you start one, tell the person you'll post the result in this chat when it's done, then end your reply.`,
  `- scheduleTask sets up a recurring task, like a morning briefing or a weekly report. Each time it runs, you do the work in the background and post a report here. listTasks shows the person's recurring tasks, and manageTask pauses, resumes or deletes one. They can also manage them on the Tasks page, in the menu under their name.`,
  `- A background run doesn't see this chat, only the instructions you write, your memory, your sandbox and the person's apps. So write instructions that stand on their own: the goal, every detail the person gave, where things are, and what the report should contain.`,
  `- Background runs do things others will see, like sending emails or posting, only when the instructions say so. Include those steps only when the person has asked for them.`,
].join("\n")

const taskFields = {
  title: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe(
      'A short name the person will recognize, like "Morning inbox summary"'
    ),
  instructions: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .describe(
      "Everything the background run needs, since it can't see this chat: the goal, the details the person gave, and what the report should cover"
    ),
}

// Tools for the bot answering this turn. Work they start belongs to the chat's
// owner and reports back to this chat as this bot.
export function createTaskTools({
  userId,
  chatId,
  bot,
  timezone,
}: {
  userId: string
  chatId: string
  bot: Bot
  // From the person's browser; checked before use
  timezone?: string
}) {
  const defaultTimezone =
    timezone && isValidTimezone(timezone) ? timezone : "UTC"

  return {
    startBackgroundTask: tool({
      description:
        "Start a task that runs in the background, without the chat open, and posts its report to this chat when it's done. For long or slow work, or when the person asks for it to run in the background.",
      inputSchema: z.object(taskFields),
      execute: async ({ title, instructions }) => {
        const run = await startTaskRun({
          userId,
          botId: bot.id,
          chatId,
          title,
          instructions,
        })
        return { taskRunId: run?.id ?? null, title }
      },
    }),

    scheduleTask: tool({
      description:
        "Set up a recurring task that runs in the background on a schedule and posts a report to this chat each time. At most once an hour.",
      inputSchema: z.object({
        ...taskFields,
        cron: z
          .string()
          .describe(
            "Five-field cron (minute hour day-of-month month day-of-week) with a single number for the minute, e.g. 0 9 * * 1-5 for weekdays at 9:00"
          ),
        timezone: z
          .string()
          .optional()
          .describe(
            `IANA time zone the cron is read in; defaults to the person's, ${defaultTimezone}`
          ),
      }),
      execute: async ({ title, instructions, cron, timezone }) => {
        if (!isValidCron(cron)) throw new Error(CRON_ERROR)
        const zone = timezone ?? defaultTimezone
        if (!isValidTimezone(zone)) {
          throw new Error(
            `${zone} isn't a time zone. Use an IANA name like Europe/London.`
          )
        }
        const task = await createRecurringTask({
          userId,
          botId: bot.id,
          chatId,
          title,
          instructions,
          cron: cron.trim(),
          timezone: zone,
        })
        return {
          taskId: task.id,
          title: task.title,
          schedule: task.scheduleDescription,
          timezone: task.timezone,
          nextRunAt: task.nextRunAt?.toISOString() ?? null,
        }
      },
    }),

    listTasks: tool({
      description:
        "List the person's recurring tasks, across all their bots, with their schedules and whether they're paused.",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await listRecurringTasks(userId)
        return {
          tasks: tasks.map((task) => ({
            taskId: task.id,
            title: task.title,
            bot: task.bot.name,
            schedule: task.scheduleDescription,
            timezone: task.timezone,
            active: task.active,
            nextRunAt: task.nextRunAt?.toISOString() ?? null,
            instructions: task.instructions,
          })),
        }
      },
    }),

    manageTask: tool({
      description:
        "Pause, resume or delete one of the person's recurring tasks. Get its id from listTasks. Confirm with the person before deleting.",
      inputSchema: z.object({
        taskId: z.string(),
        action: z.enum(["pause", "resume", "delete"]),
      }),
      execute: async ({ taskId, action }) => {
        const task = await getOwnedRecurringTask(userId, taskId)
        if (!task) throw new Error(`There's no task with id ${taskId}.`)
        if (action === "delete") {
          await deleteRecurringTask(task)
          return { taskId, title: task.title, action }
        }
        const updated = await setRecurringTaskActive(task, action === "resume")
        return {
          taskId,
          title: updated.title,
          action,
          nextRunAt: updated.nextRunAt?.toISOString() ?? null,
        }
      },
    }),
  }
}

export type TaskTools = ReturnType<typeof createTaskTools>
