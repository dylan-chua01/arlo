"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"

import { db } from "@/lib/db"
import { chatFiles } from "@/lib/db/schema"
import {
  cleanFileName,
  formatFileSize,
  MAX_FILE_SIZE,
  mediaTypeFor,
} from "@/lib/files"
import { getChat } from "@/queries/chats"

export type UploadedFile = {
  id: string
  name: string
  mediaType: string
  size: number
}

type UploadChatFileResult =
  { success: true; file: UploadedFile } | { success: false; error: string }

// One file per call, so each request stays under the body size limit
export async function uploadChatFile(
  chatId: string,
  formData: FormData
): Promise<UploadChatFileResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }

  // Only into the user's own chats
  const chat = await getChat(chatId)
  if (!chat) {
    return { success: false, error: "That chat doesn't exist." }
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { success: false, error: "No file was attached." }
  }
  const name = cleanFileName(file.name)
  if (file.size === 0) {
    return { success: false, error: `${name} is empty.` }
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `${name} is over the ${formatFileSize(MAX_FILE_SIZE)} limit.`,
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const [row] = await db
    .insert(chatFiles)
    .values({
      chatId,
      source: "upload",
      name,
      // The browser's type when it knows one, else guessed from the name
      mediaType: mediaTypeFor(name, file.type || undefined),
      size: bytes.byteLength,
      data: bytes.toString("base64"),
    })
    .returning({
      id: chatFiles.id,
      name: chatFiles.name,
      mediaType: chatFiles.mediaType,
      size: chatFiles.size,
    })

  Sentry.logger.info("Chat file uploaded", {
    "user.id": userId,
    chatId,
    fileId: row.id,
    mediaType: row.mediaType,
    size: row.size,
  })

  return { success: true, file: row }
}
