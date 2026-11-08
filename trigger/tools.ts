import type { Sandbox } from "@daytona/sdk"
import { chat } from "@trigger.dev/sdk/ai"
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { daytona, MEMORY_PATH } from "@/lib/daytona"
import { db } from "@/lib/db"
import { chatFiles } from "@/lib/db/schema"
import {
  cleanFileName,
  formatFileSize,
  MAX_FILE_SIZE,
  mediaTypeFor,
} from "@/lib/files"

// Set in onBoot from the chat's bot, read by every tool
export const sandboxContext = chat.local<{ sandboxId: string }>({
  id: "sandbox",
})

// The chat and the bot answering this turn, for tools that put files in the chat
export const chatContext = chat.local<{ chatId: string; botId: string }>({
  id: "chat-context",
})

// Where the person's attachments land in the answering bot's sandbox
export const UPLOADS_DIR = "uploads"

// Long outputs would flood the model's context
const MAX_OUTPUT = 20_000

function truncate(text: string) {
  return text.length > MAX_OUTPUT
    ? `${text.slice(0, MAX_OUTPUT)}\n… (truncated ${text.length - MAX_OUTPUT} characters)`
    : text
}

// Sandboxes whose desktop this worker has started since they last booted
const desktopsStarted = new Set<string>()

// The sandbox auto-stops when idle, so wake it before using it
async function getSandbox() {
  const sandbox = await daytona.get(sandboxContext.sandboxId)
  if (sandbox.state === "starting") {
    await sandbox.waitUntilStarted()
  } else if (sandbox.state !== "started") {
    // A fresh boot comes up without the desktop
    desktopsStarted.delete(sandbox.id)
    await sandbox.start()
  }
  return sandbox
}

// The desktop (Xvfb, xfce, VNC) isn't running until asked for
async function getDesktop() {
  const sandbox = await getSandbox()
  if (!desktopsStarted.has(sandbox.id)) {
    const { status } = await sandbox.computerUse.getStatus()
    if (status !== "active") {
      await sandbox.computerUse.start()
    }
    desktopsStarted.add(sandbox.id)
  }
  return sandbox.computerUse
}

async function captureScreen(sandbox: Sandbox["computerUse"]) {
  const [shot, display] = await Promise.all([
    sandbox.screenshot.takeCompressed({
      format: "jpeg",
      quality: 70,
      showCursor: true,
    }),
    sandbox.display.getInfo(),
  ])
  const active =
    display.displays?.find((d) => d.isActive) ?? display.displays?.[0]
  return {
    mediaType: "image/jpeg" as const,
    base64: shot.screenshot ?? "",
    width: active?.width ?? null,
    height: active?.height ?? null,
    cursor: shot.cursorPosition ?? null,
  }
}

// Both screen tools capture the same way; only who sees it differs
function screenTool(description: string) {
  return tool({
    description,
    inputSchema: z.object({}),
    execute: async () => captureScreen(await getDesktop()),
    // The model sees the image itself, not a wall of base64
    toModelOutput: ({ output }) => ({
      type: "content",
      value: [
        {
          type: "text",
          text: `Screen is ${output.width}x${output.height}. Cursor at ${output.cursor ? `${output.cursor.x},${output.cursor.y}` : "unknown"}.`,
        },
        {
          type: "file",
          mediaType: output.mediaType,
          data: { type: "data", data: output.base64 },
        },
      ],
    }),
  })
}

// The memory file is a Markdown list, one note per line
async function loadMemory(sandbox: Sandbox) {
  // cat rather than downloadFile, so a bot made before memory reads as empty
  const { exitCode, result } = await sandbox.process.executeCommand(
    `cat -- ${MEMORY_PATH} 2>/dev/null || true`
  )
  if (exitCode !== 0) throw new Error(`Couldn't read memory: ${result}`)
  return (
    result
      .split("\n")
      // Lenient, so notes written by hand or with the file tools still count
      .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
      .filter((line) => line && !line.startsWith("#"))
  )
}

// Read at the start of every turn, so the bot never has to think to look
export async function readMemory() {
  return loadMemory(await getSandbox())
}

// Copies the person's attachments into the answering bot's sandbox, so it can
// open, convert or edit them with its tools. Scoped to the chat, since the ids
// come from the browser.
export async function saveUploads(chatId: string, fileIds: string[]) {
  if (fileIds.length === 0) return []
  const files = await db
    .select({ name: chatFiles.name, data: chatFiles.data })
    .from(chatFiles)
    .where(and(eq(chatFiles.chatId, chatId), inArray(chatFiles.id, fileIds)))
  if (files.length === 0) return []
  const sandbox = await getSandbox()
  // uploadFile doesn't create folders
  await sandbox.process.executeCommand(`mkdir -p ${UPLOADS_DIR}`)
  await Promise.all(
    files.map((file) =>
      sandbox.fs.uploadFile(
        Buffer.from(file.data, "base64"),
        `${UPLOADS_DIR}/${file.name}`
      )
    )
  )
  return files.map((file) => `${UPLOADS_DIR}/${file.name}`)
}

const point = {
  x: z.number().int().min(0).describe("Pixels from the left of the screen"),
  y: z.number().int().min(0).describe("Pixels from the top of the screen"),
}

const modifiers = z
  .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
  .optional()
  .describe("Keys held down during the action")

export const tools = {
  updateMemory: tool({
    description:
      "Change your memory, the notes you see at the start of every chat you're in. Add notes worth knowing in a later chat, and remove notes that are wrong, stale, or that the person asks you to forget.",
    inputSchema: z.object({
      add: z
        .array(z.string().min(1))
        .optional()
        .describe(
          'New notes, each one self-contained sentence, e.g. "The person\'s dog is named Cooper."'
        ),
      remove: z
        .array(z.string())
        .optional()
        .describe("Notes to delete, copied exactly from your memory"),
    }),
    execute: async ({ add, remove }) => {
      const sandbox = await getSandbox()
      const removed = new Set(remove)
      const notes = [
        ...(await loadMemory(sandbox)).filter((note) => !removed.has(note)),
        // One line per note, or a newline would split it in two
        ...(add ?? []).map((note) => note.replace(/\s+/g, " ").trim()),
      ]
      const content = notes.map((note) => `- ${note}\n`).join("")
      await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), MEMORY_PATH)
      return { notes }
    },
  }),

  bash: tool({
    description:
      "Run a shell command in your sandbox and get its combined output and exit code. Each call starts a fresh shell, so chain dependent steps with && or pass cwd.",
    inputSchema: z.object({
      command: z.string().describe("The command to run"),
      cwd: z
        .string()
        .optional()
        .describe("Directory to run it in; defaults to your home directory"),
      timeout: z
        .number()
        .int()
        .min(1)
        .max(600)
        .optional()
        .describe("Seconds before the command is killed; defaults to 60"),
    }),
    execute: async ({ command, cwd, timeout }) => {
      const sandbox = await getSandbox()
      const { exitCode, result } = await sandbox.process.executeCommand(
        command,
        cwd,
        undefined,
        timeout ?? 60
      )
      return { exitCode, output: truncate(result) }
    },
  }),

  readFile: tool({
    description: "Read a text file from your sandbox.",
    inputSchema: z.object({
      path: z.string().describe("Absolute path, or relative to your home"),
    }),
    execute: async ({ path }) => {
      const sandbox = await getSandbox()
      const buffer = await sandbox.fs.downloadFile(path)
      return { path, content: truncate(buffer.toString("utf8")) }
    },
  }),

  writeFile: tool({
    description:
      "Write a text file in your sandbox, replacing it if it exists. Parent directories must already exist.",
    inputSchema: z.object({
      path: z.string().describe("Absolute path, or relative to your home"),
      content: z.string().describe("The full contents of the file"),
    }),
    execute: async ({ path, content }) => {
      const sandbox = await getSandbox()
      const buffer = Buffer.from(content, "utf8")
      await sandbox.fs.uploadFile(buffer, path)
      return { path, bytes: buffer.byteLength }
    },
  }),

  listFiles: tool({
    description: "List the files and folders in a directory of your sandbox.",
    inputSchema: z.object({
      path: z.string().describe("Absolute path, or relative to your home"),
    }),
    execute: async ({ path }) => {
      const sandbox = await getSandbox()
      const files = await sandbox.fs.listFiles(path)
      return {
        path,
        entries: files.map((file) => ({
          name: file.name,
          isDir: file.isDir,
          size: file.size,
        })),
      }
    },
  }),

  shareFile: tool({
    description: `Give the person a file from your sandbox, like a document, slide deck, spreadsheet, PDF, image, chart or archive you made. It appears in the chat as a card they can download, and in the chat's Files panel. Whenever you create or change a file the person will want, share it with this rather than only telling them the path, which they can't reach. Files up to ${formatFileSize(MAX_FILE_SIZE)}.`,
    inputSchema: z.object({
      path: z.string().describe("Absolute path, or relative to your home"),
      name: z
        .string()
        .optional()
        .describe(
          "The file name the person sees and downloads it as, with its extension; defaults to the file's own name"
        ),
    }),
    execute: async ({ path, name }) => {
      const sandbox = await getSandbox()
      const details = await sandbox.fs.getFileDetails(path)
      if (details.isDir) {
        throw new Error(
          `${path} is a folder. Zip it first, e.g. with bash: zip -r folder.zip ${path}`
        )
      }
      if (details.size > MAX_FILE_SIZE) {
        throw new Error(
          `${path} is ${formatFileSize(details.size)}, over the ${formatFileSize(MAX_FILE_SIZE)} limit. Compress it or split it up.`
        )
      }
      const bytes = await sandbox.fs.downloadFile(path)
      const fileName = cleanFileName(name || path)
      const { chatId, botId } = chatContext
      const [file] = await db
        .insert(chatFiles)
        .values({
          chatId,
          botId,
          source: "bot",
          name: fileName,
          mediaType: mediaTypeFor(fileName),
          size: bytes.byteLength,
          data: bytes.toString("base64"),
        })
        .returning({
          fileId: chatFiles.id,
          name: chatFiles.name,
          mediaType: chatFiles.mediaType,
          size: chatFiles.size,
        })
      return file
    },
  }),

  mouseMove: tool({
    description: "Move the mouse pointer on your sandbox's screen.",
    inputSchema: z.object(point),
    execute: async ({ x, y }) => {
      const desktop = await getDesktop()
      return desktop.mouse.move(x, y)
    },
  }),

  mouseClick: tool({
    description: "Click at a point on your sandbox's screen.",
    inputSchema: z.object({
      ...point,
      button: z.enum(["left", "right", "middle"]).optional(),
      double: z.boolean().optional().describe("Double-click instead"),
      modifiers,
    }),
    execute: async ({ x, y, button, double, modifiers }) => {
      const desktop = await getDesktop()
      return desktop.mouse.click(
        x,
        y,
        button ?? "left",
        double ?? false,
        undefined,
        modifiers
      )
    },
  }),

  mouseDrag: tool({
    description:
      "Press the mouse at one point, drag to another and release, e.g. to select text or move a window.",
    inputSchema: z.object({
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
    }),
    execute: async ({ startX, startY, endX, endY }) => {
      const desktop = await getDesktop()
      return desktop.mouse.drag(startX, startY, endX, endY)
    },
  }),

  mouseScroll: tool({
    description: "Scroll with the mouse over a point on your sandbox's screen.",
    inputSchema: z.object({
      ...point,
      direction: z.enum(["up", "down", "left", "right"]),
      amount: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Scroll steps; defaults to 3"),
    }),
    execute: async ({ x, y, direction, amount }) => {
      const desktop = await getDesktop()
      const scrolled = await desktop.mouse.scroll(x, y, direction, amount ?? 3)
      return { scrolled }
    },
  }),

  keyboardType: tool({
    description:
      "Type text into whatever has focus on your sandbox's screen. Click the target first.",
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => {
      const desktop = await getDesktop()
      await desktop.keyboard.type(text)
      return { typed: text.length }
    },
  }),

  keyboardPress: tool({
    description:
      "Press a single key or shortcut on your sandbox's screen, e.g. Return, Tab, Escape, BackSpace, Up, or 't' with ctrl.",
    inputSchema: z.object({
      key: z.string().describe("The key to press, as an X11 key name"),
      modifiers,
    }),
    execute: async ({ key, modifiers }) => {
      const desktop = await getDesktop()
      await desktop.keyboard.press(key, modifiers)
      return { pressed: [...(modifiers ?? []), key].join("+") }
    },
  }),

  viewScreen: screenTool(
    "Look at your sandbox's screen yourself, to find what to click or to check what an action did. The person does not see this screenshot."
  ),

  showScreen: screenTool(
    "Show the person what's on your sandbox's screen right now. Use this when they ask to see the screen; it appears in the chat for them."
  ),
}

// Bot-to-bot handoffs in a row before the person has to step in, so two bots
// can't keep asking each other forever
export const MAX_RELAYS = 6

// Group chats only: lets a bot ask another bot in the chat to take a turn.
// The asked bot answers right after this reply ends, as its own message.
export function createAskBot({
  others,
  relaysLeft,
}: {
  // The chat's other bots
  others: { id: string; name: string }[]
  relaysLeft: number
}) {
  let asked: { botId: string; name: string } | undefined
  const askBot = tool({
    description:
      "Ask another bot in this group chat to do something. Your reply ends after this call, and they answer next in the chat, as their own message, in front of the person. They see the whole chat, including your reply, but not your sandbox. Use it only when the task needs them: their job covers it, they have information or work you don't, or the person asked you to involve them.",
    inputSchema: z.object({
      bot: z.string().describe("Their name, as listed in the group"),
      request: z
        .string()
        .min(1)
        .describe(
          "What you need from them, in a sentence or two. Anything they need from your sandbox (numbers, file contents) goes in your reply or here, since they can't see it."
        ),
    }),
    execute: async ({ bot }) => {
      const name = bot.replace(/^@/, "").trim().toLowerCase()
      const other = others.find((other) => other.name.toLowerCase() === name)
      if (!other) {
        throw new Error(
          `There's no other bot named ${bot} here. The others are: ${others.map((other) => other.name).join(", ")}.`
        )
      }
      if (asked) {
        throw new Error(
          `You already asked ${asked.name}. Only one bot can go next; end your reply.`
        )
      }
      if (relaysLeft <= 0) {
        throw new Error(
          "The bots have handed this back and forth too many times in a row. Answer the person yourself, and say what's still left for another bot to do."
        )
      }
      asked = { botId: other.id, name: other.name }
      return asked
    },
  })
  return {
    askBot,
    // Set once the call succeeds, so the reply can stop there
    hasAsked: () => asked !== undefined,
  }
}

type ChatTools = typeof tools & {
  askBot: ReturnType<typeof createAskBot>["askBot"]
}

// For group chats. On a user message, botId is the bot it was addressed to,
// and relay marks the message the chat sends by itself when a bot calls
// askBot, which the asked bot answers. On an assistant message, botId is the
// bot that wrote it, and handedFrom is the bot the person addressed when it was
// handed over automatically.
export type ChatUIMessage = UIMessage<
  { botId?: string; handedFrom?: string; relay?: boolean },
  UIDataTypes,
  InferUITools<ChatTools>
>
