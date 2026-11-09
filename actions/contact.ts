"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  contactMessages,
  insertContactMessageSchema,
  type InsertContactMessage,
} from "@/lib/db/schema"

type SendContactMessageResult =
  { success: true } | { success: false; error: string }

// Public: anyone can write in. Signed-in senders are linked to their account.
export async function sendContactMessage(
  input: InsertContactMessage
): Promise<SendContactMessageResult> {
  const { isAuthenticated, userId } = await auth()

  const parsed = insertContactMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: z.prettifyError(parsed.error) }
  }

  try {
    await db.insert(contactMessages).values({
      ...parsed.data,
      userId: isAuthenticated ? userId : null,
    })
  } catch (error) {
    Sentry.captureException(error)
    return {
      success: false,
      error: "Something went wrong sending your message. Please try again.",
    }
  }

  Sentry.logger.info("Contact message received", {
    topic: parsed.data.topic,
    "user.id": isAuthenticated ? userId : undefined,
  })
  return { success: true }
}
