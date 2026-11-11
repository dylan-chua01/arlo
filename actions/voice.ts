"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"

import { BOTS, UPGRADE_ERROR } from "@/lib/billing"
import { formatFileSize } from "@/lib/files"

// Gemini takes audio in through the gateway's OpenAI-compatible endpoint, as
// an audio_url part. The AI SDK provider can't send audio there, so this
// calls the endpoint directly.
const TRANSCRIBE_MODEL = "gemini-3-5-flash-lite"

// Compressed speech runs ~20–40 KB per second, so this covers the client's
// recording cap with room to spare
const MAX_AUDIO_SIZE = 5 * 1024 * 1024

const PROMPT =
  "Transcribe this voice message verbatim, in the language it's spoken in. " +
  "Reply with only the transcript, without quotes or commentary. " +
  "If there's no speech, reply with nothing."

type TranscribeResult =
  { success: true; text: string } | { success: false; error: string }

export async function transcribeAudio(
  formData: FormData
): Promise<TranscribeResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) {
    return { success: false, error: "You need to be signed in." }
  }
  // Voice is a way to chat, and chatting needs a paid plan
  if (!has({ feature: BOTS })) {
    return { success: false, error: UPGRADE_ERROR }
  }

  const audio = formData.get("audio")
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { success: false, error: "The recording was empty." }
  }
  if (audio.size > MAX_AUDIO_SIZE) {
    return {
      success: false,
      error: `Recordings can be up to ${formatFileSize(MAX_AUDIO_SIZE)}.`,
    }
  }
  // Drop codec parameters like ";codecs=opus"
  const mediaType = audio.type.split(";")[0]
  if (!mediaType.startsWith("audio/")) {
    return { success: false, error: "That isn't an audio recording." }
  }

  const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64")
  const host = process.env.NEON_AI_GATEWAY_BASE_URL?.replace(/\/$/, "")

  try {
    const response = await fetch(`${host}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: TRANSCRIBE_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "audio_url",
                audio_url: { url: `data:${mediaType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    })
    if (!response.ok) {
      throw new Error(
        `Gateway returned ${response.status}: ${await response.text()}`
      )
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[]
    }
    const text = data.choices?.[0]?.message?.content?.trim() ?? ""
    if (!text) {
      return { success: false, error: "Didn't catch any speech. Try again." }
    }
    Sentry.logger.info("Voice message transcribed", {
      userId,
      size: audio.size,
    })
    return { success: true, text }
  } catch (error) {
    Sentry.captureException(error)
    return {
      success: false,
      error: "Couldn't transcribe the recording. Try again.",
    }
  }
}
