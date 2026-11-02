import { neon } from "@neon/ai-sdk-provider"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"

import { db } from "@/lib/db"
import type { Bot } from "@/lib/db/schema"

import { sandboxContext, tools, type ChatUIMessage } from "./tools"

// No Clerk session in a run; the server actions already checked ownership
async function getChatBot(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: (members, { eq }) => eq(members.chatId, chatId),
    orderBy: (members, { asc }) => [asc(members.joinedAt)],
    with: { bot: true },
  })
  // Direct chats have exactly one bot; group chats fall back to the first
  const bot = member?.bot
  if (!bot) throw new Error(`Chat ${chatId} has no bot`)
  return bot
}

function buildSystemPrompt(bot: Bot) {
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
  if (bot.instructions) {
    sections.push(
      `How you go about your job, in the words of the person who made you:\n\n${bot.instructions}`
    )
  }
  return sections.join("\n\n")
}

// The transcript is kept by the default storage, keyed by chat id
export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // Declared here too so screenshots reach the model as images on later turns
  tools,
  onBoot: async ({ chatId }) => {
    const bot = await getChatBot(chatId)
    sandboxContext.init({ sandboxId: bot.sandboxId })
  },
  run: async ({ chatId, messages, tools, signal, streamText }) => {
    // Read every turn so edits to the bot apply to the next reply
    const bot = await getChatBot(chatId)

    return streamText({
      model: neon("claude-sonnet-5"),
      system: buildSystemPrompt(bot),
      messages,
      tools,
      abortSignal: signal,
      // Room for a long run of look-act-look on the desktop
      stopWhen: stepCountIs(50),
    })
  },
})
