"use server"

import { auth } from "@clerk/nextjs/server"
import { sessions, auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  type Chat,
  type InsertGroupChat,
} from "@/lib/db/schema"
import { getChat } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// chatId comes from the browser, so every action checks the user owns it
async function assertChatOwner(chatId: string) {
  const owned = await getChat(chatId)
  if (!owned) throw new Error("That chat doesn't exist.")
}

// Creates the session and its first run; idempotent per chat id
export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertChatOwner(params.chatId)
  return start(params)
}

// The transport calls this to refresh an expired token
export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadChatTranscript(params: {
  chatId: string
  limit?: number
}) {
  await assertChatOwner(params.chatId)
  return load(params)
}

type CreateGroupChatResult =
  { success: true; chat: Chat } | { success: false; error: string }

export async function createGroupChat(
  input: InsertGroupChat
): Promise<CreateGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }

  const { name } = parsed.data
  const botIds = [...new Set(parsed.data.botIds)]

  // Only the user's own bots can join
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))
  if (owned.length !== botIds.length) {
    return { success: false, error: "One of those bots doesn't exist." }
  }

  const chatId = nanoid()
  const [[chat]] = await db.batch([
    db
      .insert(chats)
      .values({ id: chatId, userId, kind: "group", name })
      .returning(),
    db.insert(chatMembers).values(botIds.map((botId) => ({ chatId, botId }))),
  ])

  revalidatePath("/", "layout")

  return { success: true, chat }
}

type DeleteGroupChatResult =
  { success: true; chat: Chat } | { success: false; error: string }

export async function deleteGroupChat(
  chatId: string
): Promise<DeleteGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  // Direct chats go with their bot, so only groups are deleted on their own.
  // Members cascade; the bots and their sandboxes stay.
  const [chat] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning()
  if (!chat) {
    return { success: false, error: "That group chat doesn't exist." }
  }

  // The chat is already gone, so a failure here only leaves its session open
  // until it expires. A chat with no messages yet has no session.
  try {
    await sessions.close(chatId, { reason: "Chat deleted" })
  } catch (error) {
    console.error("Failed to close chat session", chatId, error)
  }

  revalidatePath("/", "layout")

  return { success: true, chat }
}
