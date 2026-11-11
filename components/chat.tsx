"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { createPortal } from "react-dom"
import { useChat } from "@ai-sdk/react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  ListChecksIcon,
  PaperclipIcon,
} from "lucide-react"
import type { FileUIPart, ToolUIPart } from "ai"
import { format, isThisYear, isToday } from "date-fns"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"

import {
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import { uploadChatFile } from "@/actions/files"
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
import { ChatAvatar } from "@/components/chat-avatar"
import { ChatFilesSheet, FileCard } from "@/components/chat-files"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Image } from "@/components/ai-elements/image"
import { Shimmer } from "@/components/ai-elements/shimmer"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  usePromptInputController,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Terminal } from "@/components/ai-elements/terminal"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { VoiceInput } from "@/components/voice-input"
import { useUpgradeToast, useUsageLimitToast } from "@/hooks/use-upgrade-toast"
import {
  BOTS,
  SANDBOXES,
  UPGRADE_ERROR,
  USAGE_LIMIT_ERROR,
} from "@/lib/billing"
import { CHAT_AGENT_VERSION } from "@/lib/chat-agent"
import type { Bot } from "@/lib/db/schema"
import {
  formatFileSize,
  MAX_FILE_SIZE,
  parseFileUrl,
  toFileUrl,
} from "@/lib/files"
import { isAway, notify } from "@/lib/notify"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

type Part = ChatUIMessage["parts"][number]
type ToolPart = Extract<Part, { type: `tool-${string}` }>

// Image wants a GeneratedFile, but only reads base64 and mediaType
const NO_BYTES = new Uint8Array()

type ChatBot = Pick<Bot, "id" | "name" | "avatar">

export function Chat({
  id,
  name,
  bots,
}: {
  id: string
  // Who's replying, for notifications when no bot is picked
  name: string
  // A group chat's bots, to pick who each message is for
  bots?: ChatBot[]
}) {
  const [botId, setBotId] = useState(bots?.[0]?.id)
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Sent with every turn, so the agent answers as the picked bot and a run on
    // stale agent code knows to upgrade
    clientData: {
      botId,
      agentVersion: CHAT_AGENT_VERSION,
      // So "every morning at 9" means the person's 9
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })
  const { messages, isLoading } = useLoadTranscript(id, loadChatTranscript, {
    transport,
  })

  // useChat only reads initial messages on mount, so wait for the transcript
  if (isLoading) return null

  return (
    <ChatView
      id={id}
      name={name}
      transport={transport}
      // The transcript is written by the agent, so it carries its tool parts
      initialMessages={messages as ChatUIMessage[]}
      bots={bots}
      botId={botId}
      onHandoff={setBotId}
      botPicker={
        bots &&
        botId && <BotPicker bots={bots} value={botId} onChange={setBotId} />
      }
    />
  )
}

function ChatView({
  id,
  name,
  transport,
  initialMessages,
  bots,
  botId,
  onHandoff,
  botPicker,
}: {
  id: string
  name: string
  transport: TriggerChatTransport
  initialMessages: ChatUIMessage[]
  bots?: ChatBot[]
  // The bot picked in the composer, recorded on each message sent to it
  botId?: string
  // Picks the bot the next message goes to: after a handoff, or an @ tag
  onHandoff?: (botId: string) => void
  botPicker?: React.ReactNode
}) {
  const { has } = useAuth()
  const router = useRouter()
  const [mentionAnchor, setMentionAnchor] = useState<HTMLDivElement | null>(
    null
  )
  const showUpgradeToast = useUpgradeToast()
  const showUsageLimitToast = useUsageLimitToast()
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id,
    transport,
    messages: initialMessages,
    // The agent checks the plan and allowance every turn and fails the turn
    // with one of these messages
    onError: (error) => {
      if (error.message === USAGE_LIMIT_ERROR) {
        showUsageLimitToast("Couldn't send message")
      } else if (error.message === UPGRADE_ERROR) {
        showUpgradeToast("Couldn't send message")
      }
    },
    onFinish: ({ message, isAbort, isError, isDisconnect }) => {
      const { botId, handedFrom } = message.metadata ?? {}
      if (botId && handedFrom) onHandoff?.(botId)
      // A reply that asked another bot is followed by that bot's turn. Not
      // when the person stopped it, or it failed.
      if (isAbort || isError || isDisconnect) return
      const asked = findAskedBot(message)
      if (!asked) {
        // The conversation is done for now, so tell the person if they've
        // looked away while waiting
        if (isAway()) {
          void notify({
            key: `chat-reply:${message.id}`,
            title: `${bots?.find((bot) => bot.id === botId)?.name ?? name} replied`,
            body: replyPreview(message),
            onClick: () => router.push(`/chats/${id}`),
          })
        }
        return
      }
      // useChat is still wrapping up this request when onFinish runs
      setTimeout(() =>
        sendMessage({
          text: `(${bots?.find((bot) => bot.id === botId)?.name ?? "A bot"} asked ${asked.name} to take over)`,
          metadata: { botId: asked.botId, relay: true, createdAt: Date.now() },
        })
      )
    },
  })

  const [uploading, setUploading] = useState(false)

  async function handleSubmit({ text, files }: PromptInputMessage) {
    if (!text.trim() && files.length === 0) return
    if (uploading) throw new Error("Still uploading")
    // The session actions enforce this too, but their errors don't reach the UI
    if (!has?.({ feature: BOTS }) || !has?.({ feature: SANDBOXES })) {
      showUpgradeToast("Couldn't send message")
      // PromptInput keeps the draft when onSubmit throws
      throw new Error(UPGRADE_ERROR)
    }
    const attached = await uploadFiles(id, files, setUploading)
    sendMessage({
      text,
      files: attached,
      metadata: { ...(botId && { botId }), createdAt: Date.now() },
    })
  }

  // The bot is working until its turn ends. Streaming text shows that by
  // itself; otherwise (thinking, running tools, between steps) show a bubble.
  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const lastPart = last?.role === "assistant" ? last.parts.at(-1) : undefined
  const typingInReply =
    busy &&
    last?.role === "assistant" &&
    !(lastPart?.type === "text" && lastPart.state === "streaming")
  // Before the reply's first part arrives
  const typingAlone = busy && last?.role !== "assistant"
  // After a relay, it's already known who answers
  const typingBot = last?.metadata?.relay
    ? bots?.find((bot) => bot.id === last.metadata?.botId)
    : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatFilesSheet messages={messages} bots={bots} />
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Send a message to begin chatting"
            />
          ) : (
            messages.map((message, index) => {
              const typing = typingInReply && index === messages.length - 1
              // Sent by the chat itself; the askBot call above already shows it
              if (message.role === "user" && message.metadata?.relay) {
                return null
              }
              // Posted by a background task as it ends; the report follows
              if (message.role === "user" && message.metadata?.taskRunId) {
                return <TaskNotice key={message.id} message={message} />
              }
              // Only group chats pass bots; a direct chat's header shows its bot
              if (!bots || message.role !== "assistant") {
                const to =
                  message.role === "user" &&
                  bots?.find((bot) => bot.id === message.metadata?.botId)
                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {to && (
                        // Plain text, so the tag sits inline in its first line
                        <p className="wrap-break-word whitespace-pre-wrap">
                          <Badge
                            variant="outline"
                            className="me-1.5 max-w-32 bg-background align-middle"
                          >
                            <ChatAvatar seed={to.avatar} className="size-3.5" />
                            <span className="truncate">{to.name}</span>
                          </Badge>
                          {message.parts
                            .flatMap((part) =>
                              part.type === "text" ? [part.text] : []
                            )
                            .join("\n\n")}
                        </p>
                      )}
                      {message.parts.map((part, i) =>
                        // A tagged message's text is already in the line above
                        to && part.type === "text" ? null : (
                          <MessagePart key={i} part={part} />
                        )
                      )}
                      {typing && <TypingBubble />}
                    </MessageContent>
                    <MessageTime message={message} />
                  </Message>
                )
              }
              const bot = bots.find((bot) => bot.id === message.metadata?.botId)
              const from = bots.find(
                (bot) => bot.id === message.metadata?.handedFrom
              )
              return (
                <Message
                  from={message.role}
                  key={message.id}
                  className="flex-row items-start gap-3"
                >
                  {bot ? (
                    <ChatAvatar seed={bot.avatar} className="mt-0.5" />
                  ) : (
                    // A reply from before replies were tagged with their bot
                    <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <MessageContent>
                    {bot && from && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <ArrowRightIcon className="size-3.5" />
                        Handed from {from.name} to {bot.name}
                      </p>
                    )}
                    {message.parts.map((part, i) => (
                      <MessagePart key={i} part={part} />
                    ))}
                    {typing && <TypingBubble />}
                    <MessageTime message={message} />
                  </MessageContent>
                </Message>
              )
            })
          )}
          {typingAlone && (
            <Message
              from="assistant"
              className={bots ? "flex-row items-start gap-3" : undefined}
            >
              {/* A group chat hasn't picked who answers yet, unless a bot asked one */}
              {bots &&
                (typingBot ? (
                  <ChatAvatar seed={typingBot.avatar} className="mt-0.5" />
                ) : (
                  <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
                ))}
              <MessageContent>
                <TypingBubble />
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="relative mx-auto w-full max-w-3xl p-4 pt-0">
        {/* The mention list renders here, since the input clips its overflow */}
        <div
          ref={setMentionAnchor}
          className="absolute inset-x-6 bottom-full mb-2"
        />
        {/* Controls the text so typing @ can tag a bot */}
        <PromptInputProvider>
          <PromptInput
            onSubmit={handleSubmit}
            multiple
            maxFiles={10}
            maxFileSize={MAX_FILE_SIZE}
            onError={({ code, message }) =>
              toast.add({
                type: "error",
                title: "Couldn't attach file",
                description:
                  code === "max_file_size"
                    ? `Files can be up to ${formatFileSize(MAX_FILE_SIZE)}.`
                    : message,
              })
            }
          >
            <ComposerAttachments />
            <PromptInputBody>
              {bots && onHandoff ? (
                <MentionTextarea
                  bots={bots}
                  onMention={onHandoff}
                  listContainer={mentionAnchor}
                />
              ) : (
                <PromptInputTextarea placeholder="Send a message…" />
              )}
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <AttachButton />
                <VoiceInput />
                {botPicker}
              </PromptInputTools>
              <PromptInputSubmit
                status={uploading ? "submitted" : status}
                // Stopping mid-upload has nothing to stop
                onStop={uploading ? undefined : stop}
              />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  )
}

// Stores each attachment with the chat and returns parts that point at it.
// The bot reads the bytes from there, so they never travel through the chat.
async function uploadFiles(
  chatId: string,
  files: FileUIPart[],
  setUploading: (uploading: boolean) => void
): Promise<FileUIPart[]> {
  if (files.length === 0) return []
  setUploading(true)
  let results: Awaited<ReturnType<typeof uploadChatFile>>[]
  try {
    results = await Promise.all(
      files.map(async (file) => {
        // PromptInput hands over data: URLs, so turn each back into bytes
        const blob = await (await fetch(file.url)).blob()
        const formData = new FormData()
        formData.set("file", blob, file.filename ?? "file")
        return uploadChatFile(chatId, formData)
      })
    )
  } catch (error) {
    toast.add({
      type: "error",
      title: "Couldn't upload file",
      description: "Check your connection and try again.",
    })
    throw error
  } finally {
    setUploading(false)
  }
  const failed = results.find((result) => !result.success)
  if (failed && !failed.success) {
    toast.add({
      type: "error",
      title: "Couldn't upload file",
      description: failed.error,
    })
    // PromptInput keeps the draft and attachments when onSubmit throws
    throw new Error(failed.error)
  }
  return results.flatMap((result) =>
    result.success
      ? [
          {
            type: "file" as const,
            url: toFileUrl(result.file.id),
            mediaType: result.file.mediaType,
            filename: result.file.name,
          },
        ]
      : []
  )
}

function AttachButton() {
  const attachments = usePromptInputAttachments()
  return (
    <PromptInputButton
      aria-label="Attach files"
      tooltip="Attach files"
      onClick={() => attachments.openFileDialog()}
    >
      <PaperclipIcon />
    </PromptInputButton>
  )
}

// What's attached to the message being written
function ComposerAttachments() {
  const attachments = usePromptInputAttachments()
  if (attachments.files.length === 0) return null
  return (
    <PromptInputHeader>
      <Attachments variant="inline">
        {attachments.files.map((file) => (
          <Attachment
            key={file.id}
            data={file}
            onRemove={() => attachments.remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo className="max-w-40" />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  )
}

// The bot a reply asked to go next, if any
function findAskedBot(message: ChatUIMessage) {
  if (message.role !== "assistant") return undefined
  const call = message.parts.findLast(
    (part) => part.type === "tool-askBot" && part.state === "output-available"
  )
  return call?.type === "tool-askBot" && call.state === "output-available"
    ? call.output
    : undefined
}

const TYPING_WORDS = [
  "Thinking",
  "Pondering",
  "Churning",
  "Mulling",
  "Brewing",
  "Noodling",
  "Tinkering",
  "Musing",
  "Percolating",
  "Conjuring",
  "Crunching",
  "Scheming",
  "Wrangling",
  "Cooking",
]

function TypingBubble() {
  // Start on a random word so each reply doesn't open the same way
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * TYPING_WORDS.length)
  )
  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % TYPING_WORDS.length),
      2500
    )
    return () => clearInterval(timer)
  }, [])
  const word = TYPING_WORDS[index]

  return (
    <div role="status" className="flex items-center gap-2.5">
      <div
        aria-hidden
        className="flex w-fit items-center gap-1 rounded-2xl bg-secondary px-3.5 py-3"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm"
        >
          <Shimmer as="span" duration={1.5}>{`${word}…`}</Shimmer>
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

type Mention = { start: number; end: number; query: string }

// An "@" being typed right before the caret, at the start or after a space
function findMention(textarea: HTMLTextAreaElement): Mention | null {
  const end = textarea.selectionEnd
  const match = /(?:^|\s)@([^\s@]*)$/.exec(textarea.value.slice(0, end))
  if (!match) return null
  return { start: end - match[1].length - 1, end, query: match[1] }
}

// Typing @ suggests the chat's bots, so names are never mistyped. A mention
// that starts the message addresses it to that bot, and the picker shows the
// tag instead of the text. One later in the message is written in as @Name.
function MentionTextarea({
  bots,
  onMention,
  listContainer,
}: {
  bots: ChatBot[]
  onMention: (botId: string) => void
  // Where the list renders, outside the input's clipped box
  listContainer: HTMLElement | null
}) {
  const { textInput } = usePromptInputController()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [mention, setMention] = useState<Mention | null>(null)
  const [active, setActive] = useState(0)

  const query = mention?.query.toLowerCase()
  const matches =
    query === undefined
      ? []
      : bots.filter((bot) => bot.name.toLowerCase().includes(query))
  const open = matches.length > 0

  function track(textarea: HTMLTextAreaElement) {
    const next = findMention(textarea)
    if (next?.query !== mention?.query) setActive(0)
    setMention(next)
  }

  function pick(bot: ChatBot) {
    if (!mention) return
    const { value } = textInput
    const before = value.slice(0, mention.start)
    const addressing = !before.trim()
    // One space after the name, reusing one that's already there
    const tag = addressing ? "" : `@${bot.name} `
    const rest = value.slice(mention.end).replace(/^ /, "")
    textInput.setInput(before + tag + rest)
    setMention(null)
    if (addressing) onMention(bot.id)
    // Put the caret after the name, once React applies the new value
    const caret = before.length + tag.length
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(caret, caret)
    })
  }

  return (
    <>
      {open &&
        listContainer &&
        createPortal(
          <div
            id={listId}
            role="listbox"
            aria-label="Bots"
            className="absolute bottom-0 left-0 z-10 flex w-full flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md sm:right-auto sm:w-56"
          >
            {matches.map((bot, i) => (
              <div
                key={bot.id}
                id={`${listId}-${bot.id}`}
                role="option"
                aria-selected={i === active}
                className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                // Keep focus in the textarea
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(bot)}
              >
                <ChatAvatar seed={bot.avatar} className="size-5" />
                <span className="truncate">{bot.name}</span>
              </div>
            ))}
          </div>,
          listContainer
        )}
      <PromptInputTextarea
        ref={textareaRef}
        placeholder="Send a message… Type @ to tag a bot"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open ? `${listId}-${matches[active]?.id}` : undefined
        }
        onChange={(e) => track(e.currentTarget)}
        onSelect={(e) => track(e.currentTarget)}
        onBlur={() => setMention(null)}
        onKeyDown={(e) => {
          if (!open || e.nativeEvent.isComposing) return
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            const step = e.key === "ArrowDown" ? 1 : -1
            setActive((i) => (i + step + matches.length) % matches.length)
          } else if (e.key === "Enter" || e.key === "Tab") {
            // Preventing default also stops Enter from sending the message
            e.preventDefault()
            pick(matches[active])
          } else if (e.key === "Escape") {
            e.preventDefault()
            setMention(null)
          }
        }}
      />
    </>
  )
}

function BotPicker({
  bots,
  value,
  onChange,
}: {
  bots: ChatBot[]
  value: string
  onChange: (botId: string) => void
}) {
  return (
    <PromptInputSelect
      value={value}
      onValueChange={(value) => {
        if (typeof value === "string") onChange(value)
      }}
    >
      <PromptInputSelectTrigger aria-label="Bot to talk to">
        <PromptInputSelectValue>
          {(value: string) => {
            const bot = bots.find((bot) => bot.id === value)
            return bot && <BotOption bot={bot} />
          }}
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent alignItemWithTrigger={false} side="top">
        {bots.map((bot) => (
          <PromptInputSelectItem key={bot.id} value={bot.id}>
            <BotOption bot={bot} />
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}

function BotOption({ bot }: { bot: ChatBot }) {
  return (
    <>
      <ChatAvatar seed={bot.avatar} className="size-4" />
      {bot.name}
    </>
  )
}

function MessagePart({ part }: { part: Part }) {
  switch (part.type) {
    case "text":
      return <MessageResponse>{part.text}</MessageResponse>
    case "file": {
      // Attachments are stored with the chat; other files aren't sent
      const fileId = parseFileUrl(part.url)
      return fileId ? (
        <FileCard
          file={{
            fileId,
            name: part.filename ?? "Attachment",
            mediaType: part.mediaType,
          }}
        />
      ) : null
    }
    case "tool-shareFile":
      return <ShareFile part={part} />
    // The bot's own look at the screen; the person never sees it
    case "tool-viewScreen":
      return null
    case "tool-showScreen":
      return <ShowScreen part={part} />
    case "tool-askBot":
      return <AskBot part={part} />
    case "tool-bash":
      return <BashCall part={part} />
    case "tool-startBackgroundTask":
    case "tool-scheduleTask":
    case "tool-listTasks":
    case "tool-manageTask":
    case "tool-updateMemory":
    case "tool-readFile":
    case "tool-writeFile":
    case "tool-listFiles":
    case "tool-mouseMove":
    case "tool-mouseClick":
    case "tool-mouseDrag":
    case "tool-mouseScroll":
    case "tool-keyboardType":
    case "tool-keyboardPress":
      return <ToolCall part={part} />
    default:
      // The person's app tools come from Composio at run time, so they aren't
      // among ChatUIMessage's tools
      return String(part.type).startsWith(APP_TOOL_PREFIX) ? (
        <AppToolCall part={part as unknown as ToolUIPart} />
      ) : null
  }
}

const APP_TOOL_PREFIX = "tool-COMPOSIO_"

function AppToolCall({ part }: { part: ToolUIPart }) {
  const links = getConnectLinks(part)
  return (
    <>
      <AppToolCard part={part} />
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Button
              key={link.toolkit}
              size="sm"
              nativeButton={false}
              render={
                <a href={link.url} target="_blank" rel="noopener noreferrer" />
              }
            >
              Connect {humanizeSlug(link.toolkit)}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          ))}
          <span className="text-xs text-muted-foreground">
            Links expire after 10 minutes
          </span>
        </div>
      )}
    </>
  )
}

// MANAGE_CONNECTIONS answers { data: { results: { gmail: { redirect_url } } } }
// for each app that still needs connecting
function getConnectLinks(part: ToolUIPart) {
  if (part.type !== `${APP_TOOL_PREFIX}MANAGE_CONNECTIONS`) return []
  if (part.state !== "output-available") return []
  const output = part.output as {
    data?: { results?: Record<string, { redirect_url?: unknown }> }
  } | null
  return Object.entries(output?.data?.results ?? {}).flatMap(
    ([toolkit, result]) => {
      const url = result?.redirect_url
      // Only Composio's own https links, since the output reaches an href
      return typeof url === "string" && url.startsWith("https://")
        ? [{ toolkit, url }]
        : []
    }
  )
}

function AppToolCard({ part }: { part: ToolUIPart }) {
  return (
    <Tool>
      <ToolHeader
        type={part.type}
        state={part.state}
        title={describeAppTool(part)}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          output={part.state === "output-available" ? part.output : undefined}
          errorText={part.errorText}
        />
      </ToolContent>
    </Tool>
  )
}

// e.g. GMAIL_SEND_EMAIL -> "Gmail send email"
function humanizeSlug(slug: string) {
  const words = slug.toLowerCase().split("_").filter(Boolean).join(" ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Input is partial while it streams, and its shape is Composio's, so read it loosely
function describeAppTool(part: ToolUIPart): string {
  const name = part.type.slice(APP_TOOL_PREFIX.length)
  switch (name) {
    case "SEARCH_TOOLS":
      return "Searched your apps"
    case "GET_TOOL_SCHEMAS":
      return "Checked how to use an app"
    case "MANAGE_CONNECTIONS": {
      const apps = getConnectLinks(part).map((link) =>
        humanizeSlug(link.toolkit)
      )
      return apps.length > 0
        ? `Asked you to connect ${apps.join(", ")}`
        : "Checked your app connections"
    }
    case "MULTI_EXECUTE_TOOL": {
      const input = part.input as { tools?: { tool_slug?: unknown }[] }
      const slugs = (input?.tools ?? []).flatMap((tool) =>
        typeof tool?.tool_slug === "string"
          ? [humanizeSlug(tool.tool_slug)]
          : []
      )
      return slugs.length > 0 ? `Used ${slugs.join(", ")}` : "Used your apps"
    }
    default:
      return "Used your apps"
  }
}

// A bot asking another to go next. A failed ask is the bot's to sort out.
function AskBot({ part }: { part: Extract<Part, { type: "tool-askBot" }> }) {
  if (part.state === "output-error") return null
  const name =
    part.state === "output-available" ? part.output.name : part.input?.bot
  return (
    <p className="flex items-start gap-1.5 text-muted-foreground">
      <ArrowRightIcon className="mt-1 size-3.5 shrink-0" />
      <span>
        {part.state === "output-available" ? "Asked" : "Asking"}{" "}
        {name ?? "another bot"}
        {part.input?.request && `: ${part.input.request}`}
      </span>
    </p>
  )
}

function ShareFile({
  part,
}: {
  part: Extract<Part, { type: "tool-shareFile" }>
}) {
  if (part.state === "output-available") return <FileCard file={part.output} />
  return <ToolCall part={part} />
}

function ShowScreen({
  part,
}: {
  part: Extract<Part, { type: "tool-showScreen" }>
}) {
  if (part.state === "output-available") {
    return (
      <Image
        alt="The bot's screen"
        base64={part.output.base64}
        mediaType={part.output.mediaType}
        uint8Array={NO_BYTES}
        className="border"
      />
    )
  }
  if (part.state === "output-error") {
    return <ToolCall part={part} />
  }
  return <Skeleton className="aspect-video w-full" />
}

function BashCall({ part }: { part: Extract<Part, { type: "tool-bash" }> }) {
  const command = part.input?.command ?? ""
  const output =
    part.state === "output-available"
      ? `$ ${command}\n${part.output.output}${part.output.exitCode === 0 ? "" : `\n[exit ${part.output.exitCode}]`}`
      : `$ ${command}`

  return (
    <Tool>
      <ToolHeader
        type={part.type}
        state={part.state}
        title={describeTool(part)}
      />
      <ToolContent>
        {part.state === "output-error" ? (
          <ToolOutput output={undefined} errorText={part.errorText} />
        ) : (
          <Terminal
            output={output}
            isStreaming={part.state === "input-available"}
          />
        )}
      </ToolContent>
    </Tool>
  )
}

function ToolCall({ part }: { part: ToolPart }) {
  return (
    <Tool>
      <ToolHeader
        type={part.type}
        state={part.state}
        title={describeTool(part)}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          output={part.state === "output-available" ? part.output : undefined}
          errorText={part.errorText}
        />
      </ToolContent>
    </Tool>
  )
}

// Input is partial while it streams, so every field may be missing
function describeTool(part: ToolPart): string {
  switch (part.type) {
    case "tool-updateMemory":
      return part.input?.remove?.length && !part.input.add?.length
        ? "Forgot something"
        : "Saved to memory"
    case "tool-bash":
      // The bot's own plain words; replies from before it wrote them get a
      // generic title rather than the command
      return part.input?.description?.trim() || "Worked on its computer"
    case "tool-readFile":
      return `Read ${fileName(part.input?.path) ?? "a file"}`
    case "tool-writeFile":
      return `Saved ${fileName(part.input?.path) ?? "a file"}`
    case "tool-listFiles":
      return "Looked through its files"
    case "tool-mouseMove":
      return "Moved the mouse"
    case "tool-mouseClick":
      return part.input?.double
        ? "Double-clicked on the screen"
        : "Clicked on the screen"
    case "tool-mouseDrag":
      return "Dragged on the screen"
    case "tool-mouseScroll":
      return part.input?.direction
        ? `Scrolled ${part.input.direction}`
        : "Scrolled"
    case "tool-keyboardType":
      return "Typed text"
    case "tool-keyboardPress":
      return `Pressed ${[...(part.input?.modifiers ?? []), keyName(part.input?.key)].filter(Boolean).join(" + ")}`
    case "tool-viewScreen":
      return "Looked at the screen"
    case "tool-showScreen":
      return "Showed the screen"
    case "tool-askBot":
      return `Asked ${part.input?.bot ?? "another bot"}`
    case "tool-shareFile":
      return `Shared ${part.input?.name || part.input?.path || "a file"}`
    case "tool-startBackgroundTask":
      return `Started in the background: ${part.input?.title ?? "a task"}`
    case "tool-scheduleTask":
      return part.state === "output-available"
        ? `Scheduled ${part.output.title}: ${part.output.schedule}`
        : `Scheduled ${part.input?.title ?? "a task"}`
    case "tool-listTasks":
      return "Checked your recurring tasks"
    case "tool-manageTask":
      return part.input?.action === "delete"
        ? "Deleted a recurring task"
        : part.input?.action === "resume"
          ? "Resumed a recurring task"
          : "Paused a recurring task"
  }
}

// Messages from before they were stamped show no time
function MessageTime({ message }: { message: ChatUIMessage }) {
  const createdAt = message.metadata?.createdAt
  if (!createdAt) return null
  const date = new Date(createdAt)
  const label = isToday(date)
    ? format(date, "h:mm a")
    : isThisYear(date)
      ? format(date, "MMM d, h:mm a")
      : format(date, "MMM d, yyyy, h:mm a")
  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPPP 'at' h:mm a")}
      className="text-xs text-muted-foreground group-[.is-user]:ml-auto"
    >
      {label}
    </time>
  )
}

function TaskNotice({ message }: { message: ChatUIMessage }) {
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    // Wrapped in parentheses for the bot's history, not for the person
    .replace(/^\((.*)\)$/, "$1")
  return (
    <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
      <ListChecksIcon className="size-3.5" />
      {text}
      {message.metadata?.createdAt && (
        <span>· {format(message.metadata.createdAt, "MMM d, h:mm a")}</span>
      )}
    </p>
  )
}

// The last part of a path, which is what the person would recognize
function fileName(path?: string) {
  return path?.split("/").filter(Boolean).at(-1)
}

// X11 key names, as they're printed on a keyboard
const KEY_NAMES: Record<string, string> = {
  Return: "Enter",
  BackSpace: "Backspace",
  Escape: "Esc",
  Prior: "Page Up",
  Next: "Page Down",
}

function keyName(key?: string) {
  return key && (KEY_NAMES[key] ?? key)
}

// The start of a reply's text, short enough for a desktop notification
function replyPreview(message: ChatUIMessage) {
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .replace(/[#*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 120 ? `${text.slice(0, 117)}…` : text || undefined
}
