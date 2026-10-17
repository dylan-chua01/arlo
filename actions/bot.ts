"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  type Bot,
  type Chat,
  type InsertBot,
} from "@/lib/db/schema"

type CreateBotResult =
  { success: true; bot: Bot; chat: Chat } | { success: false; error: string }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }

  const { instructions, ...values } = parsed.data

  // IDs up front so the member row can reference both in the same batch
  const botId = nanoid()
  const chatId = nanoid()

  // neon-http has no interactive transactions; a batch runs as one transaction
  const [[bot], [chat]] = await db.batch([
    db
      .insert(bots)
      .values({
        ...values,
        id: botId,
        instructions: instructions || null,
        userId,
      })
      .returning(),
    db.insert(chats).values({ id: chatId, userId, kind: "direct" }).returning(),
    db.insert(chatMembers).values({ chatId, botId }),
  ])

  revalidatePath("/")

  return { success: true, bot, chat }
}

type UpdateBotResult =
  { success: true; bot: Bot } | { success: false; error: string }

export async function updateBot(
  botId: string,
  input: InsertBot
): Promise<UpdateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }

  const { instructions, ...values } = parsed.data

  // Scoped to the user so nobody can edit a bot that isn't theirs
  const [bot] = await db
    .update(bots)
    .set({ ...values, instructions: instructions || null })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()
  if (!bot) {
    return { success: false, error: "That bot doesn't exist." }
  }

  revalidatePath("/", "layout")

  return { success: true, bot }
}

type DeleteBotResult =
  { success: true; bot: Bot } | { success: false; error: string }

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  // Its direct chats go with it; members cascade from both chats and bots
  const [, [bot]] = await db.batch([
    db
      .delete(chats)
      .where(
        and(
          eq(chats.userId, userId),
          eq(chats.kind, "direct"),
          inArray(
            chats.id,
            db
              .select({ chatId: chatMembers.chatId })
              .from(chatMembers)
              .where(eq(chatMembers.botId, botId))
          )
        )
      ),
    db
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning(),
  ])
  if (!bot) {
    return { success: false, error: "That bot doesn't exist." }
  }

  revalidatePath("/", "layout")

  return { success: true, bot }
}
