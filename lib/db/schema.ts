import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

import { CRON_ERROR, isValidCron, isValidTimezone } from "@/lib/cron"

export const bots = pgTable(
  "bots",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    name: text().notNull(),
    // Seed for the bot's face
    avatar: text()
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text().notNull(),
    // How it should go about the job
    instructions: text(),
    // Daytona sandbox, created with the bot and deleted with it
    sandboxId: text("sandbox_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

// Fields a user fills in; id, userId, sandboxId and createdAt are set server-side
export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) =>
    schema
      .trim()
      .min(1, "Give your bot a name.")
      .max(50, "Keep it under 50 characters."),
  avatar: (schema) => schema.min(1),
  job: (schema) =>
    schema
      .trim()
      .min(1, "Give your bot a job.")
      .max(100, "Keep it under 100 characters."),
  instructions: (schema) =>
    schema.trim().max(2000, "Keep it under 2000 characters."),
})
  .pick({ name: true, avatar: true, job: true, instructions: true })
  .required({ avatar: true })

export const chatKind = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    kind: chatKind().notNull().default("direct"),
    // Null for direct chats, which use the bot's name
    name: text(),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

// Fields a user fills in for a group chat; kind, userId and timestamps are set server-side
export const insertGroupChatSchema = createInsertSchema(chats, {
  name: (schema) =>
    schema
      .trim()
      .min(1, "Give the group a name.")
      .max(50, "Keep it under 50 characters."),
})
  .pick({ name: true })
  .required({ name: true })
  // Members live in chat_members, so the bots aren't a column of chats
  .extend({ botIds: z.array(z.string()).min(2, "Pick at least two bots.") })

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

// Who put a file in the chat: the person attaching it, or a bot sharing it
export const chatFileSource = pgEnum("chat_file_source", ["upload", "bot"])

// Files in a chat: the person's attachments and files bots share from their
// sandboxes. The bytes live here so a download works while the sandbox sleeps.
export const chatFiles = pgTable(
  "chat_files",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    // The bot that shared it; null for the person's uploads
    botId: text("bot_id").references(() => bots.id, { onDelete: "set null" }),
    source: chatFileSource().notNull(),
    name: text().notNull(),
    mediaType: text("media_type").notNull(),
    // Bytes, before encoding
    size: integer().notNull(),
    // Base64, so it travels over the HTTP driver as plain text
    data: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chat_files_chat_id_idx").on(table.chatId)]
)

// Work a bot does on a schedule with nobody in the chat. Each time it fires,
// a task run does the work and posts the report to the chat.
export const recurringTasks = pgTable(
  "recurring_tasks",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    // Where the reports go: the bot's own chat, or the group it was set up in
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    title: text().notNull(),
    // What the bot should do each time, in the person's words
    instructions: text().notNull(),
    cron: text().notNull(),
    // IANA time zone the cron is read in
    timezone: text().notNull(),
    // Trigger.dev schedule, created with the task and deleted with it
    scheduleId: text("schedule_id").notNull(),
    // Trigger.dev's wording of the cron, like "At 09:00 AM, Monday through Friday"
    scheduleDescription: text("schedule_description").notNull(),
    active: boolean().notNull().default(true),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("recurring_tasks_user_id_idx").on(table.userId)]
)

// Fields a user fills in; the chat, schedule and timestamps are set server-side
export const insertRecurringTaskSchema = createInsertSchema(recurringTasks, {
  botId: (schema) => schema.min(1, "Pick a bot."),
  title: (schema) =>
    schema
      .trim()
      .min(1, "Give the task a name.")
      .max(80, "Keep it under 80 characters."),
  instructions: (schema) =>
    schema
      .trim()
      .min(1, "Tell the bot what to do.")
      .max(4000, "Keep it under 4000 characters."),
  cron: (schema) => schema.trim().refine(isValidCron, CRON_ERROR),
  timezone: (schema) =>
    schema.min(1, "Pick a time zone.").refine(isValidTimezone, {
      message: "Pick a valid time zone.",
    }),
}).pick({
  botId: true,
  title: true,
  instructions: true,
  cron: true,
  timezone: true,
})

export const taskRunStatus = pgEnum("task_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
])

// What shareFile returns, kept so the report can show the same file cards
export type SharedFile = {
  fileId: string
  name: string
  mediaType: string
  size: number
}

// One piece of background work: a recurring task firing, or a one-off the
// person asked a bot for in chat. The report is posted to the chat when it ends.
export const taskRuns = pgTable(
  "task_runs",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    // Null for one-offs, and once the recurring task is deleted
    taskId: text("task_id").references(() => recurringTasks.id, {
      onDelete: "set null",
    }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    // Copied from the task, so editing it doesn't rewrite history
    title: text().notNull(),
    instructions: text().notNull(),
    status: taskRunStatus().notNull().default("queued"),
    // The bot's final message, or why it failed
    report: text(),
    files: jsonb().$type<SharedFile[]>().notNull().default([]),
    // The Trigger.dev run doing the work
    triggerRunId: text("trigger_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("task_runs_user_id_created_at_idx").on(table.userId, table.createdAt),
  ]
)

export const usageMeter = pgEnum("usage_meter", ["ai", "sandbox"])

// Append-only ledger of metered usage. A period's usage is the sum of its
// rows, so nothing is ever reset or decremented.
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    meter: usageMeter().notNull(),
    // ai: model cost in millionths of a dollar; sandbox: running seconds
    amount: integer().notNull(),
    // No foreign keys, so usage outlives a deleted bot or chat
    botId: text("bot_id"),
    chatId: text("chat_id"),
    sandboxId: text("sandbox_id"),
    model: text(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    // Set by the sandbox meter, so a retried run can't charge twice
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_events_user_meter_created_at_idx").on(
      table.userId,
      table.meter,
      table.createdAt
    ),
  ]
)

export const contactTopic = pgEnum("contact_topic", [
  "question",
  "billing",
  "support",
  "feedback",
])

// Sent from the public contact page; userId is set when the sender is signed in
export const contactMessages = pgTable("contact_messages", {
  id: text()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  // Clerk user ID
  userId: text("user_id"),
  name: text().notNull(),
  email: text().notNull(),
  topic: contactTopic().notNull().default("question"),
  message: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Fields the sender fills in; id, userId and createdAt are set server-side
export const insertContactMessageSchema = createInsertSchema(contactMessages, {
  name: (schema) =>
    schema
      .trim()
      .min(1, "Tell us your name.")
      .max(100, "Keep it under 100 characters."),
  email: (schema) =>
    schema
      .trim()
      .max(200, "Keep it under 200 characters.")
      .pipe(z.email("Enter a valid email address.")),
  message: (schema) =>
    schema
      .trim()
      .min(10, "Tell us a little more.")
      .max(5000, "Keep it under 5000 characters."),
})
  .pick({ name: true, email: true, topic: true, message: true })
  .required({ topic: true })

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const recurringTasksRelations = relations(recurringTasks, ({ one }) => ({
  bot: one(bots, { fields: [recurringTasks.botId], references: [bots.id] }),
}))

export const taskRunsRelations = relations(taskRuns, ({ one }) => ({
  bot: one(bots, { fields: [taskRuns.botId], references: [bots.id] }),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, { fields: [chatMembers.chatId], references: [chats.id] }),
  bot: one(bots, { fields: [chatMembers.botId], references: [bots.id] }),
}))

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert
export type InsertBot = z.infer<typeof insertBotSchema>
export type Chat = typeof chats.$inferSelect
export type InsertGroupChat = z.infer<typeof insertGroupChatSchema>
export type NewChat = typeof chats.$inferInsert
export type ChatMember = typeof chatMembers.$inferSelect
export type NewChatMember = typeof chatMembers.$inferInsert
export type ChatFile = typeof chatFiles.$inferSelect
export type NewChatFile = typeof chatFiles.$inferInsert
export type RecurringTask = typeof recurringTasks.$inferSelect
export type InsertRecurringTask = z.infer<typeof insertRecurringTaskSchema>
export type TaskRun = typeof taskRuns.$inferSelect
export type UsageEvent = typeof usageEvents.$inferSelect
export type NewUsageEvent = typeof usageEvents.$inferInsert
export type ContactMessage = typeof contactMessages.$inferSelect
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>
