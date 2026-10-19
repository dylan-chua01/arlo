import { google } from "@ai-sdk/google"
import { chat } from "@trigger.dev/sdk/ai"

// The transcript is kept by the default storage, keyed by chat id
export const chatAgent = chat.agent({
  id: "chat",
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: google("gemini-3.8-flash"),
      messages,
      abortSignal: signal,
    }),
})
