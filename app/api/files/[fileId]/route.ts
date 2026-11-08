import { auth } from "@clerk/nextjs/server"
import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { chatFiles, chats } from "@/lib/db/schema"
import { isPreviewableImage } from "@/lib/files"

// Shows or downloads a file from one of the signed-in user's chats
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/files/[fileId]">
) {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return new Response("Not found", { status: 404 })

  const { fileId } = await ctx.params
  // Joined to the chat, so a file is only served to the chat's owner
  const [file] = await db
    .select({
      name: chatFiles.name,
      mediaType: chatFiles.mediaType,
      data: chatFiles.data,
    })
    .from(chatFiles)
    .innerJoin(chats, eq(chats.id, chatFiles.chatId))
    .where(and(eq(chatFiles.id, fileId), eq(chats.userId, userId)))
  if (!file) return new Response("Not found", { status: 404 })

  // Bots and uploads can produce anything, including HTML or SVG with
  // scripts, so only plain images and PDFs open in the browser
  const inline =
    !request.nextUrl.searchParams.has("download") &&
    (isPreviewableImage(file.mediaType) || file.mediaType === "application/pdf")

  return new Response(Buffer.from(file.data, "base64"), {
    headers: {
      "Content-Type": inline ? file.mediaType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      // Chrome won't open a sandboxed PDF, and PDFs can't run page scripts
      ...(file.mediaType !== "application/pdf" && {
        "Content-Security-Policy": "sandbox",
      }),
      // A file never changes once it's in the chat
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
