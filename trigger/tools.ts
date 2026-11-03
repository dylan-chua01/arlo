import type { Sandbox } from "@daytona/sdk"
import { chat } from "@trigger.dev/sdk/ai"
import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai"
import { z } from "zod"

import { daytona } from "@/lib/daytona"

// Set in onBoot from the chat's bot, read by every tool
export const sandboxContext = chat.local<{ sandboxId: string }>({
  id: "sandbox",
})

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

const point = {
  x: z.number().int().min(0).describe("Pixels from the left of the screen"),
  y: z.number().int().min(0).describe("Pixels from the top of the screen"),
}

const modifiers = z
  .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
  .optional()
  .describe("Keys held down during the action")

export const tools = {
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

// For group chats. On a user message, botId is the bot it was addressed to.
// On an assistant message, it's the bot that wrote it, and handedFrom is the
// bot the person addressed when it was handed over automatically.
export type ChatUIMessage = UIMessage<
  { botId?: string; handedFrom?: string },
  UIDataTypes,
  InferUITools<typeof tools>
>
