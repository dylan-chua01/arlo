"use server"

import { auth } from "@clerk/nextjs/server"
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
