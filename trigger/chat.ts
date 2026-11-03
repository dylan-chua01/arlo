import { neon } from "@neon/ai-sdk-provider"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"
import { z } from "zod"

import { db } from "@/lib/db"
import type { Bot } from "@/lib/db/schema"

import { sandboxContext, tools, type ChatUIMessage } from "./tools"

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

function buildSystemPrompt(bot: Bot, bots: Bot[]) {
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
  ]
  if (bots.length > 1) {
    const others = bots.filter((other) => other.id !== bot.id)
    sections.push(
      `This is a group chat with you and ${others.map((other) => other.name).join(", ")}. Each person's message is addressed to one of you; this one is for you. Earlier replies may have come from the others.`
    )
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
  .withClientData({ schema: z.object({ botId: z.string().optional() }) })
  .agent({
    id: "chat",
    // Declared here too so screenshots reach the model as images on later turns
    tools,
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
      // Read every turn so edits to the bot apply to the next reply
      const { bot, bots } = await getChatBot(chatId, clientData?.botId)
      // Each turn works in the sandbox of the bot it's for
      sandboxContext.sandboxId = bot.sandboxId

      return streamText({
        model: neon("claude-sonnet-5"),
        system: buildSystemPrompt(bot, bots),
        messages,
        tools,
        abortSignal: signal,
        // Room for a long run of look-act-look on the desktop
        stopWhen: stepCountIs(50),
      })
    },
  })
