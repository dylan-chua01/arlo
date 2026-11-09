import { neon } from "@neon/ai-sdk-provider"
import * as Sentry from "@sentry/node"
import { chat } from "@trigger.dev/sdk/ai"
import {
  createUIMessageStream,
  generateText,
  Output,
  stepCountIs,
  type FilePart,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessageStreamOptions,
  type UserModelMessage,
} from "ai"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import {
  PLANS,
  UPGRADE_ERROR,
  USAGE_LIMIT_ERROR,
  type PlanSlug,
} from "@/lib/billing"
import { CHAT_AGENT_VERSION } from "@/lib/chat-agent"
import { createAppSession, getConnectedApps } from "@/lib/composio"
import { db } from "@/lib/db"
import { chatFiles, taskRuns, type Bot, type ChatFile } from "@/lib/db/schema"
import { formatFileSize, isPreviewableImage, parseFileUrl } from "@/lib/files"
import { getUsage, isSpent, recordAiUsage } from "@/lib/usage"

import {
  chatContext,
  createAskBot,
  MAX_RELAYS,
  readMemory,
  sandboxContext,
  saveUploads,
  tools,
  UPLOADS_DIR,
  type ChatUIMessage,
} from "./tools"
import { createTaskTools, TASKS_PROMPT } from "./task-tools"

export const CHAT_MODEL = "claude-sonnet-5"
const ROUTER_MODEL = "claude-haiku-5-5"

// The user whose plan pays for the chat's turns
async function getChatOwner(chatId: string) {
  const chat = await db.query.chats.findFirst({
    where: (chats, { eq }) => eq(chats.id, chatId),
    columns: { userId: true },
  })
  if (!chat) throw new Error(`Chat ${chatId} doesn't exist`)
  return chat.userId
}

// No Clerk session in a run; the server actions already checked ownership
async function getChatBot(chatId: string, botId?: string) {
  const members = await db.query.chatMembers.findMany({
    where: (members, { eq }) => eq(members.chatId, chatId),
    orderBy: (members, { asc }) => [asc(members.joinedAt)],
    with: { bot: true },
  })
  // botId comes from the browser, so it only picks among the chat's own bots.
  // Direct chats have exactly one bot, so they never send it.
  const bots = members.map((member) => member.bot)
  const bot = botId ? bots.find((bot) => bot.id === botId) : bots[0]
  if (!bot) throw new Error(`Chat ${chatId} has no bot ${botId ?? ""}`)
  return { bot, bots }
}

// The router only needs the gist of each message
function excerpt(message: ChatUIMessage, max: number) {
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// Hands a group message to the bot whose job fits it best. The bot the person
// picked keeps it unless another's job fits clearly better.
async function routeMessage(
  picked: Bot,
  bots: Bot[],
  signal: AbortSignal,
  // Records the routing call against the chat owner's allowance
  onUsage: (usage: LanguageModelUsage) => Promise<unknown>
) {
  const history = chat.history.all() as ChatUIMessage[]
  const latest = history.at(-1)
  if (latest?.role !== "user") return picked

  const nameOf = (botId?: string) =>
    bots.find((bot) => bot.id === botId)?.name ?? "A bot"
  const recent = history
    .slice(-7, -1)
    .map((message) => {
      const text = excerpt(message, 500)
      if (!text) return null
      const speaker =
        message.role === "user" ? "Person" : nameOf(message.metadata?.botId)
      return `${speaker}: ${text}`
    })
    .filter(Boolean)
  const lastReply = history.findLast((message) => message.role === "assistant")

  try {
    const { output, usage } = await generateText({
      model: neon(ROUTER_MODEL),
      output: Output.choice({ options: bots.map((bot) => bot.id) }),
      system: [
        `You route each message in a group chat to the one bot that should answer it. Answer with that bot's id.`,
        [
          `The bots:`,
          ...bots.map((bot) => `- ${bot.name}, id ${bot.id}. Job: ${bot.job}.`),
        ].join("\n"),
        [
          `Rules, in order:`,
          `1. If the message names a bot or asks a specific bot to do it, pick that bot.`,
          `2. A follow-up on work a bot is in the middle of stays with that bot, because the work lives in its sandbox.${lastReply ? ` The last reply was from ${nameOf(lastReply.metadata?.botId)}.` : ""}`,
          `3. Otherwise pick the bot whose job best fits what the message actually asks for. Judge by the task, not by shared keywords.`,
          `4. The person addressed this message to ${picked.name}. Keep it with ${picked.name} unless another bot's job fits it clearly better; when it's close, or nobody's job fits, keep it with ${picked.name}.`,
        ].join("\n"),
      ].join("\n\n"),
      prompt: [
        recent.length > 0 && `Recent conversation:\n${recent.join("\n")}`,
        `Message to route:\n${excerpt(latest, 2000) || "(no text)"}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      abortSignal: signal,
    })
    await onUsage(usage)
    return bots.find((bot) => bot.id === output) ?? picked
  } catch (error) {
    // Routing is a nicety; the picked bot can always answer
    if (signal.aborted) throw error
    console.error("Failed to route message", error)
    return picked
  }
}

type Relay = { from: Bot; to: Bot; request: string }

// A relay is the message the chat sends by itself after a bot calls askBot.
// The flag comes from the browser, so who answers is read from the askBot call
// in the reply before it, never from the message.
function findRelay(history: ChatUIMessage[], bots: Bot[]): Relay | null {
  const latest = history.at(-1)
  const previous = history.at(-2)
  if (latest?.role !== "user" || !latest.metadata?.relay) return null
  if (previous?.role !== "assistant") return null
  const from = bots.find((bot) => bot.id === previous.metadata?.botId)
  const call = previous.parts.findLast(
    (part) => part.type === "tool-askBot" && part.state === "output-available"
  )
  if (!from || call?.type !== "tool-askBot") return null
  if (call.state !== "output-available") return null
  const to = bots.find((bot) => bot.id === call.output.botId)
  if (!to) return null
  return { from, to, request: call.input.request }
}

// Relays in a row since the person last wrote
function countRelays(history: ChatUIMessage[]) {
  let count = 0
  for (const message of history.toReversed()) {
    if (message.role !== "user") continue
    if (!message.metadata?.relay) break
    count++
  }
  return count
}

// Text files up to this size are read to the model in full
const MAX_INLINE_TEXT = 100_000

function isTextFile(mediaType: string) {
  return (
    mediaType.startsWith("text/") ||
    ["application/json", "application/xml", "application/yaml"].includes(
      mediaType
    )
  )
}

// The file id behind an attachment, or null for any other file part
function attachmentId(part: FilePart) {
  const { data } = part
  const url =
    data instanceof URL
      ? data
      : typeof data === "object" && "type" in data && data.type === "url"
        ? data.url
        : null
  return url ? parseFileUrl(url.href) : null
}

type UserPart = Exclude<UserModelMessage["content"], string>[number]

// One attachment, as the model should see it
function resolveAttachment(file: ChatFile | undefined): UserPart[] {
  if (!file) {
    return [{ type: "text", text: "[An attached file that no longer exists]" }]
  }
  const note: UserPart = {
    type: "text",
    text: `[The person attached ${file.name} (${file.mediaType}, ${formatFileSize(file.size)}). A copy was saved to ${UPLOADS_DIR}/${file.name} in the sandbox of the bot that answered this message.]`,
  }
  if (
    isPreviewableImage(file.mediaType) ||
    file.mediaType === "application/pdf"
  ) {
    return [
      note,
      {
        type: "file",
        mediaType: file.mediaType,
        filename: file.name,
        data: { type: "data", data: file.data },
      },
    ]
  }
  if (isTextFile(file.mediaType) && file.size <= MAX_INLINE_TEXT) {
    const text = Buffer.from(file.data, "base64").toString("utf8")
    return [note, { type: "text", text: `${file.name}:\n\n${text}` }]
  }
  return [note]
}

// Attachments reach the agent as arlo-file: ids. Swap each for something the
// model can read: images and PDFs as themselves, text inline, and a note
// pointing to the sandbox copy for everything else (Word, PowerPoint, …).
async function resolveAttachments(chatId: string, messages: ModelMessage[]) {
  const ids = messages.flatMap((message) =>
    message.role === "user" && Array.isArray(message.content)
      ? message.content.flatMap((part) =>
          part.type === "file" ? (attachmentId(part) ?? []) : []
        )
      : []
  )
  if (ids.length === 0) return messages

  // Scoped to the chat, since the ids come from the browser
  const rows = await db
    .select()
    .from(chatFiles)
    .where(and(eq(chatFiles.chatId, chatId), inArray(chatFiles.id, ids)))
  const files = new Map(rows.map((row) => [row.id, row]))

  return messages.map((message): ModelMessage => {
    if (message.role !== "user" || typeof message.content === "string") {
      return message
    }
    return {
      ...message,
      content: message.content.flatMap((part): UserPart[] => {
        const id = part.type === "file" ? attachmentId(part) : null
        return id ? resolveAttachment(files.get(id)) : [part]
      }),
    }
  })
}

// The ids of the files attached to the latest message, if the person sent it
function latestAttachments(history: ChatUIMessage[]) {
  const latest = history.at(-1)
  if (latest?.role !== "user") return []
  return latest.parts.flatMap((part) =>
    part.type === "file" ? (parseFileUrl(part.url) ?? []) : []
  )
}

// The person's connected apps, as tools: Composio's meta tools find the right
// app action, run it, and start a connection when an app isn't linked yet.
// Once the plan's connected apps are all in use, the session only covers
// those, so the bot can't connect another.
export async function getAppTools(userId: string, plan: PlanSlug) {
  const limit = PLANS[plan].limits.apps
  const connected = limit === null ? null : await getConnectedApps(userId)
  const full = limit !== null && connected !== null && connected.length >= limit
  const session = await createAppSession(userId, full ? connected : undefined)
  return {
    tools: await session.tools(),
    full: full ? { limit, connected } : null,
  }
}

type AppAccess = Awaited<ReturnType<typeof getAppTools>>

export function buildSystemPrompt(
  bot: Bot,
  bots: Bot[],
  memory: string[] | null,
  // Null when the apps couldn't be loaded this turn
  apps: AppAccess | null,
  handedFrom?: Bot,
  relay?: Relay
) {
  const sections = [
    `You are ${bot.name}. Your job: ${bot.job}.`,
    `You exist to help the person you're chatting with. Your job is your specialty and colors how you work, but it is not a limit: when they ask for something else, especially something you can do in your sandbox, just do it. Stay in character as ${bot.name}.`,
    `You have your own sandbox: an isolated Linux machine, hosted by Daytona, that belongs to you alone. Nobody else's work runs in it, and it stays yours from one conversation to the next. It sleeps when idle and wakes when you use it.`,
    [
      `You work in the sandbox through your tools:`,
      `- bash, readFile, writeFile and listFiles for the shell and the file system. Prefer these whenever a task can be done without the screen.`,
      `- The sandbox also has a desktop. Use viewScreen to look at it, then mouseMove, mouseClick, mouseDrag, mouseScroll, keyboardType and keyboardPress to work it. Coordinates are pixels from the top-left of the screen.`,
      `- After an action on the desktop, call viewScreen again before relying on the result. Don't guess what the screen looks like.`,
      `- viewScreen is for your eyes only; the person never sees it. When they ask to see the screen or for a screenshot, call showScreen, which shows it to them in the chat.`,
      `- Carry multi-step tasks through to the end yourself, e.g. opening a browser, searching, and dismissing cookie banners or other popups along the way. Don't stop to ask unless you're truly stuck.`,
    ].join("\n"),
    [
      `Files between you and the person:`,
      `- The person can't reach your sandbox. When you make or change a file they'll want, like a Word document, PowerPoint deck, spreadsheet, PDF, image or chart, call shareFile with its path, and they get a download in the chat. Make real files in the right format (e.g. .docx or .pptx with python-docx or python-pptx) rather than pasting long content into the chat, when that's what they asked for.`,
      `- Files the person attaches are copied to ${UPLOADS_DIR}/ in your sandbox when their message reaches you, and you also see images, PDFs and text files directly. Work on the copy, then share the result.`,
    ].join("\n"),
    [
      `Your memory is a list of notes that stays with you across every chat you're in, private or group. Each chat only shows its own history, so your memory is the only way something said in one chat reaches you in another.`,
      `- When the person tells you something worth knowing later, save it with updateMemory in the same turn: facts about them, their preferences, decisions, plans, things they ask you to remember, and the state of ongoing work. Skip small talk and anything you can easily look up again.`,
      `- Write each note as a self-contained sentence about the person, e.g. "The person's dog is named Cooper." Remove notes that are wrong or stale, or that they ask you to forget.`,
      `- Your memory is shown to you below on every turn. Before saying you don't know or don't remember something, check it, and read the person's question in its light: a vague follow-up like "how about you?" may be asking what you remember.`,
      `- Don't announce routine saves. Mention them only when the person asks you to remember or forget something.`,
      `- Change your memory only with updateMemory, never with the file tools.`,
    ].join("\n"),
    apps
      ? [
          `You can also work in the person's own apps, like Gmail, Google Calendar, GitHub, Slack or Notion, through Composio. Your tools whose names start with COMPOSIO_ find the right action in an app, run it, and manage the person's app connections.`,
          ...(apps.full
            ? [
                `- The person's plan includes ${apps.full.limit} connected apps, and they're all in use: ${apps.full.connected.join(", ")}. You can only use those. If they ask for another app, tell them their plan's connected apps are all in use, and that they can disconnect one on the Apps page or upgrade their plan to connect more. Don't try to connect it.`,
              ]
            : []),
          `- When a task involves one of their apps, use these tools rather than the sandbox's browser. Search for the action first instead of guessing its name or inputs.`,
          `- If an app isn't connected yet, call COMPOSIO_MANAGE_CONNECTIONS with that app right away rather than only telling the person to connect it. The chat shows them a Connect button for each link it returns, so you don't need to paste the URL. Tell them to use the button and to let you know once they've connected, then check the connection and carry on. Links expire after 10 minutes, so if they come back later, get a fresh one. They can also connect and disconnect apps on the Apps page, which is in the menu under their name.`,
          `- These act on the person's real accounts. Reading is fine, but before anything others will see or that's hard to undo, like sending an email or message, posting, inviting people, or deleting, confirm the details with the person first, unless they've already asked for exactly that.`,
          `- The person's apps are shared by all their bots, so an app connected in one chat works in every chat.`,
        ].join("\n")
      : `The person's apps (Gmail, Calendar, GitHub and so on) can't be reached this turn. If they ask for something in one of their apps, say you can't reach their apps right now.`,
    memory === null
      ? `Your memory couldn't be loaded this turn. If the person asks about something from before, say you can't reach your memory right now rather than that you don't know.`
      : memory.length > 0
        ? [`Your memory:`, ...memory.map((note) => `- ${note}`)].join("\n")
        : `Your memory is empty so far.`,
  ]
  if (bots.length > 1) {
    sections.push(
      [
        `This is a group chat. You're one of several bots talking with the same person:`,
        ...bots.map(
          (member) =>
            `- ${member.name}${member.id === bot.id ? " (you)" : ""}, id ${member.id}. Job: ${member.job}.`
        ),
      ].join("\n"),
      [
        `How the group works:`,
        `- Each message goes to the bot whose job fits it best: the person addresses one, and it's handed to another automatically when that bot's job fits clearly better. This message reached you, so it's yours: do your part of it yourself rather than pointing the person to another bot.`,
        `- You can work with the other bots. When a task needs another bot, because their job covers part of it, they have information or work you don't, or the person asked you to involve them, call askBot with their name and what you need. Your reply ends there, and they answer next, in front of the person. Writing their name or @name in your reply doesn't reach them; only askBot does.`,
        `- Use askBot only when it's needed to get the person's task done. Don't use it to say thanks, to confirm, to chat, or to send results nobody is waiting for. When you can do it all yourself, just do it.`,
        `- When you ask, first write what you need to say in your reply, then call askBot with a short request. The other bot sees your reply but not your sandbox, so put the numbers, text or file contents they need in your reply.`,
        `- Answer as ${bot.name}, and refer to the others by name, never by id.`,
        `- Every bot's replies appear in the history as your own assistant messages, so they all look alike. Don't assume an earlier reply was yours.`,
        `- Each bot has its own sandbox. Commands, files and screenshots in another bot's replies happened in their sandbox, not yours, so their files aren't in yours.`,
        `- Your private chat with the person isn't in this history, but your memory carries what you saved from it, so use it when they bring up something they told you before. Each bot has its own memory, so you only know what you saved yourself, not what they told another bot.`,
        `- The person can't watch your desktop live here, so call showScreen when they'd want to see it.`,
      ].join("\n")
    )
    if (relay) {
      sections.push(
        [
          `${relay.from.name} asked you to take this turn, with the request: "${relay.request}". The latest message in the history was sent for them by the chat; there's nothing new from the person. Answer ${relay.from.name}'s request in front of the person, using what's been said so far.`,
          `When you're done, hand the turn back to ${relay.from.name} with askBot only if they're waiting on your answer to finish the person's task, e.g. they asked you for information they need. If your answer finishes it, don't.`,
        ].join("\n")
      )
    } else if (handedFrom) {
      sections.push(
        `The person addressed their latest message to ${handedFrom.name}, but it was handed to you because it fits your job better. The chat already shows the handoff, so just pick it up and answer it.`
      )
    }
  }
  if (bot.instructions) {
    sections.push(
      `How you go about your job, in the words of the person who made you:\n\n${bot.instructions}`
    )
  }
  return sections.join("\n\n")
}

// The message a finished task run posts to its chat. Its text and files are
// read from the run, never from the message, which could come from a browser.
function findTaskReport(history: ChatUIMessage[]) {
  const latest = history.at(-1)
  if (latest?.role !== "user") return null
  return latest.metadata?.taskRunId ?? null
}

// Answers with a task run's report as the bot's message, without a model call.
// Shaped like a streamText result, so the agent pipes and saves it the same way.
async function reportTaskRun(chatId: string, taskRunId: string) {
  const [run] = await db
    .select()
    .from(taskRuns)
    .where(and(eq(taskRuns.id, taskRunId), eq(taskRuns.chatId, chatId)))
  const finished =
    run && (run.status === "succeeded" || run.status === "failed")
  const text = finished
    ? (run.report ?? "Done.")
    : "That background task isn't finished yet."
  const files = finished ? run.files : []

  return {
    toUIMessageStream: (options: UIMessageStreamOptions<ChatUIMessage> = {}) =>
      createUIMessageStream<ChatUIMessage>({
        originalMessages: options.originalMessages,
        generateId: options.generateMessageId,
        onFinish: options.onFinish,
        onError: options.onError,
        execute: ({ writer }) => {
          writer.write({
            type: "start",
            messageMetadata: {
              botId: run?.botId,
              taskRunId,
              createdAt: Date.now(),
            },
          })
          writer.write({ type: "text-start", id: "report" })
          writer.write({ type: "text-delta", id: "report", delta: text })
          writer.write({ type: "text-end", id: "report" })
          // The same parts shareFile makes in chat, so the files show as cards
          for (const file of files) {
            const toolCallId = `share-${file.fileId}`
            writer.write({
              type: "tool-input-available",
              toolCallId,
              toolName: "shareFile",
              input: { path: file.name, name: file.name },
            })
            writer.write({
              type: "tool-output-available",
              toolCallId,
              output: file,
            })
          }
          writer.write({ type: "finish", finishReason: "stop" })
        },
      }),
  }
}

// The transcript is kept by the default storage, keyed by chat id
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  // The bot a group chat's message is for, picked in the composer each turn
  .withClientData({
    schema: z.object({
      botId: z.string().optional(),
      // The CHAT_AGENT_VERSION the client was built with
      agentVersion: z.number().optional(),
      // The person's IANA time zone, for scheduling tasks
      timezone: z.string().optional(),
    }),
  })
  .agent({
    id: "chat",
    // Declared here too so screenshots reach the model as images on later turns
    tools,
    // A newer client means this run is on stale code, so hand the chat to the
    // latest version, which answers the same message. Only newer: an older
    // client would land back on this version and loop.
    onTurnStart: async ({ clientData }) => {
      if ((clientData?.agentVersion ?? 0) > CHAT_AGENT_VERSION) {
        chat.requestUpgrade()
      }
    },
    onTurnComplete: async ({
      error,
      chatId,
      turn,
      runId,
      ctx,
      responseMessage,
      finishReason,
      stopped,
      usage,
    }) => {
      const message =
        error === undefined
          ? undefined
          : error instanceof Error
            ? error.message
            : String(error)
      // The billing errors are expected refusals, not failures
      const blocked = message === UPGRADE_ERROR || message === USAGE_LIMIT_ERROR
      const outcome = blocked
        ? "blocked"
        : error !== undefined
          ? "errored"
          : stopped
            ? "stopped"
            : "ok"

      // One log per turn, with everything needed to follow it later
      const attributes: Record<string, string | number | boolean> = {
        chatId,
        turn,
        runId,
        outcome,
        stopped,
      }
      const botId = responseMessage?.metadata?.botId
      const handedFrom = responseMessage?.metadata?.handedFrom
      if (botId) attributes.botId = botId
      if (handedFrom) attributes.handedFrom = handedFrom
      if (finishReason) attributes.finishReason = finishReason
      if (usage?.inputTokens !== undefined) {
        attributes["gen_ai.usage.input_tokens"] = usage.inputTokens
      }
      if (usage?.outputTokens !== undefined) {
        attributes["gen_ai.usage.output_tokens"] = usage.outputTokens
      }
      if (blocked) attributes.reason = message
      if (outcome === "errored") {
        Sentry.logger.error("Chat turn failed", attributes)
      } else {
        Sentry.logger.info("Chat turn completed", attributes)
      }

      // A turn that throws only ends that turn, so the run never fails and the
      // global onFailure hook never sees it. Report it here instead.
      if (outcome === "errored") {
        Sentry.captureException(error, {
          tags: {
            "trigger.task": ctx.task.id,
            "trigger.environment": ctx.environment.slug,
          },
          contexts: { chat: { chatId, turn, runId } },
        })
      }
      // The run can be suspended while it waits for the next message
      await Sentry.flush(2000)
    },
    onBoot: async ({ chatId, clientData }) => {
      const { bot } = await getChatBot(chatId, clientData?.botId)
      sandboxContext.init({ sandboxId: bot.sandboxId })
      chatContext.init({ chatId, botId: bot.id })
    },
    // Runs on every path that builds a prompt, so attachments always resolve
    prepareMessages: ({ chatId, messages }) =>
      resolveAttachments(chatId, messages),
    run: async ({
      chatId,
      clientData,
      messages,
      tools,
      signal,
      streamText,
    }) => {
      // A finished background task reporting in. It only replays what's
      // already done, so it's free and skips the plan checks.
      const taskRunId = findTaskReport(chat.history.all() as ChatUIMessage[])
      if (taskRunId) return reportTaskRun(chatId, taskRunId)

      // Every turn runs a model and can use a sandbox, so it needs Pro and
      // both allowances. A thrown message reaches the client as the turn's error.
      const userId = await getChatOwner(chatId)
      const usage = await getUsage(userId)
      if (!usage) throw new Error(UPGRADE_ERROR)
      if (isSpent(usage, "ai") || isSpent(usage, "sandbox")) {
        throw new Error(USAGE_LIMIT_ERROR)
      }
      // What this turn may still spend; checked between steps so a long tool
      // loop stops once the allowance runs out
      let aiBudget = usage.ai.limit - usage.ai.used

      // Read every turn so edits to the bot apply to the next reply
      const { bot: picked, bots } = await getChatBot(chatId, clientData?.botId)
      const history = chat.history.all() as ChatUIMessage[]
      const relay = bots.length > 1 ? findRelay(history, bots) : null
      // A relay goes to the bot that was asked, so it skips the router
      const bot = relay
        ? relay.to
        : bots.length > 1
          ? await routeMessage(picked, bots, signal, async (routerUsage) => {
              aiBudget -= await recordAiUsage(
                { userId, chatId, botId: picked.id },
                ROUTER_MODEL,
                routerUsage
              )
            })
          : picked
      const handedFrom = relay || bot.id === picked.id ? undefined : picked
      const askBot =
        bots.length > 1
          ? createAskBot({
              others: bots.filter((other) => other.id !== bot.id),
              relaysLeft: MAX_RELAYS - countRelays(history),
            })
          : null
      // Each turn works in the sandbox of the bot that answers it
      sandboxContext.sandboxId = bot.sandboxId
      chatContext.botId = bot.id
      // One after the other, so only one call wakes a sleeping sandbox
      const sandboxSetup = (async () => {
        const memory = await readMemory().catch((error) => {
          if (signal.aborted) throw error
          // A reply without memory beats no reply
          console.error("Failed to read memory", bot.sandboxId, error)
          return null
        })
        await saveUploads(chatId, latestAttachments(history)).catch((error) => {
          if (signal.aborted) throw error
          // The bot still sees images and PDFs; it just can't edit the copy
          console.error("Failed to copy attachments", bot.sandboxId, error)
          Sentry.captureException(error, { contexts: { chat: { chatId } } })
        })
        return memory
      })()
      const [memory, appTools] = await Promise.all([
        sandboxSetup,
        getAppTools(userId, usage.plan).catch((error) => {
          if (signal.aborted) throw error
          // A reply without apps beats no reply
          console.error("Failed to load app tools", error)
          Sentry.captureException(error, { contexts: { chat: { chatId } } })
          return null
        }),
      ])
      // Tags the reply with its bot, so a group chat can show who wrote it,
      // and with when it started
      const createdAt = Date.now()
      chat.setUIMessageStreamOptions({
        messageMetadata: () => ({
          botId: bot.id,
          handedFrom: handedFrom?.id,
          createdAt,
        }),
      })

      const taskTools = createTaskTools({
        userId,
        chatId,
        bot,
        timezone: clientData?.timezone,
      })

      return streamText({
        model: neon(CHAT_MODEL),
        system: [
          buildSystemPrompt(
            bot,
            bots,
            memory,
            appTools,
            handedFrom,
            relay ?? undefined
          ),
          TASKS_PROMPT,
        ].join("\n\n"),
        messages,
        tools: {
          ...tools,
          ...appTools?.tools,
          ...taskTools,
          ...(askBot && { askBot: askBot.askBot }),
        },
        abortSignal: signal,
        // Each step is its own model call, so each is written to the ledger
        onStepFinish: async ({ usage: stepUsage }) => {
          aiBudget -= await recordAiUsage(
            { userId, chatId, botId: bot.id },
            CHAT_MODEL,
            stepUsage
          )
        },
        // Room for a long run of look-act-look on the desktop, within the allowance
        // A reply ends once it asks another bot, which answers next
        stopWhen: [
          stepCountIs(50),
          () => aiBudget <= 0,
          () => askBot?.hasAsked() ?? false,
        ],
      })
    },
  })
