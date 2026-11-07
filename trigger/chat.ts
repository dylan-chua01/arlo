import { neon } from "@neon/ai-sdk-provider"
import * as Sentry from "@sentry/node"
import { chat } from "@trigger.dev/sdk/ai"
import { generateText, Output, stepCountIs, type LanguageModelUsage } from "ai"
import { z } from "zod"

import { UPGRADE_ERROR, USAGE_LIMIT_ERROR } from "@/lib/billing"
import { CHAT_AGENT_VERSION } from "@/lib/chat-agent"
import { createAppSession } from "@/lib/composio"
import { db } from "@/lib/db"
import type { Bot } from "@/lib/db/schema"
import { getUsage, isSpent, recordAiUsage } from "@/lib/usage"

import { readMemory, sandboxContext, tools, type ChatUIMessage } from "./tools"

const CHAT_MODEL = "claude-sonnet-5"
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

// The person's connected apps, as tools: Composio's meta tools find the right
// app action, run it, and start a connection when an app isn't linked yet
async function getAppTools(userId: string) {
  const session = await createAppSession(userId)
  return session.tools()
}

function buildSystemPrompt(
  bot: Bot,
  bots: Bot[],
  memory: string[] | null,
  appsAvailable: boolean,
  handedFrom?: Bot
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
      `Your memory is a list of notes that stays with you across every chat you're in, private or group. Each chat only shows its own history, so your memory is the only way something said in one chat reaches you in another.`,
      `- When the person tells you something worth knowing later, save it with updateMemory in the same turn: facts about them, their preferences, decisions, plans, things they ask you to remember, and the state of ongoing work. Skip small talk and anything you can easily look up again.`,
      `- Write each note as a self-contained sentence about the person, e.g. "The person's dog is named Cooper." Remove notes that are wrong or stale, or that they ask you to forget.`,
      `- Your memory is shown to you below on every turn. Before saying you don't know or don't remember something, check it, and read the person's question in its light: a vague follow-up like "how about you?" may be asking what you remember.`,
      `- Don't announce routine saves. Mention them only when the person asks you to remember or forget something.`,
      `- Change your memory only with updateMemory, never with the file tools.`,
    ].join("\n"),
    appsAvailable
      ? [
          `You can also work in the person's own apps, like Gmail, Google Calendar, GitHub, Slack or Notion, through Composio. Your tools whose names start with COMPOSIO_ find the right action in an app, run it, and manage the person's app connections.`,
          `- When a task involves one of their apps, use these tools rather than the sandbox's browser. Search for the action first instead of guessing its name or inputs.`,
          `- If an app isn't connected yet, get a connection link with the connection tool and give it to the person as a Markdown link. Ask them to tell you once they've connected, then carry on. They can also connect and disconnect apps on the Apps page, which is in the menu under their name.`,
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
        `- Each message goes to the bot whose job fits it best: the person addresses one, and it's handed to another automatically when that bot's job fits clearly better. This message reached you, so it's yours: answer it yourself rather than pointing the person to another bot.`,
        `- Answer as ${bot.name}, and refer to the others by name, never by id.`,
        `- Every bot's replies appear in the history as your own assistant messages, so they all look alike. Don't assume an earlier reply was yours.`,
        `- Each bot has its own sandbox. Commands, files and screenshots in another bot's replies happened in their sandbox, not yours, so their files aren't in yours.`,
        `- Your private chat with the person isn't in this history, but your memory carries what you saved from it, so use it when they bring up something they told you before. Each bot has its own memory, so you only know what you saved yourself, not what they told another bot.`,
        `- The person can't watch your desktop live here, so call showScreen when they'd want to see it.`,
      ].join("\n")
    )
    if (handedFrom) {
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

// The transcript is kept by the default storage, keyed by chat id
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  // The bot a group chat's message is for, picked in the composer each turn
  .withClientData({
    schema: z.object({
      botId: z.string().optional(),
      // The CHAT_AGENT_VERSION the client was built with
      agentVersion: z.number().optional(),
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
    },
    run: async ({
      chatId,
      clientData,
      messages,
      tools,
      signal,
      streamText,
    }) => {
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
      const bot =
        bots.length > 1
          ? await routeMessage(picked, bots, signal, async (routerUsage) => {
              aiBudget -= await recordAiUsage(
                { userId, chatId, botId: picked.id },
                ROUTER_MODEL,
                routerUsage
              )
            })
          : picked
      const handedFrom = bot.id === picked.id ? undefined : picked
      // Each turn works in the sandbox of the bot that answers it
      sandboxContext.sandboxId = bot.sandboxId
      const [memory, appTools] = await Promise.all([
        readMemory().catch((error) => {
          if (signal.aborted) throw error
          // A reply without memory beats no reply
          console.error("Failed to read memory", bot.sandboxId, error)
          return null
        }),
        getAppTools(userId).catch((error) => {
          if (signal.aborted) throw error
          // A reply without apps beats no reply
          console.error("Failed to load app tools", error)
          Sentry.captureException(error, { contexts: { chat: { chatId } } })
          return null
        }),
      ])
      // Tags the reply with its bot, so a group chat can show who wrote it
      chat.setUIMessageStreamOptions({
        messageMetadata: () => ({ botId: bot.id, handedFrom: handedFrom?.id }),
      })

      return streamText({
        model: neon(CHAT_MODEL),
        system: buildSystemPrompt(bot, bots, memory, !!appTools, handedFrom),
        messages,
        tools: { ...tools, ...appTools },
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
        stopWhen: [stepCountIs(50), () => aiBudget <= 0],
      })
    },
  })
