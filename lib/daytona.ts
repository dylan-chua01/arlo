import { Daytona } from "@daytona/sdk"

if (!process.env.DAYTONA_API_KEY) {
  throw new Error("DAYTONA_API_KEY is not set")
}

// The endpoint decides where the API key is sent, so it's fixed in code; the
// SDK refuses to take it from a .env file that Next and trigger dev both load
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: "https://app.daytona.io/api",
})

// Where a bot keeps what it should remember across chats. Relative, so it
// resolves against the sandbox's working directory just like the bot's tools.
export const MEMORY_PATH = "MEMORY.md"
