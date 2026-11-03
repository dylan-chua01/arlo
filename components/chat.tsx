"use client"

import { useId, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { ArrowRightIcon } from "lucide-react"
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
import { ChatAvatar } from "@/components/chat-avatar"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
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
import { Skeleton } from "@/components/ui/skeleton"
import type { Bot } from "@/lib/db/schema"
import type { chatAgent } from "@/trigger/chat"
import type { ChatUIMessage } from "@/trigger/tools"

type Part = ChatUIMessage["parts"][number]
type ToolPart = Extract<Part, { type: `tool-${string}` }>

// Image wants a GeneratedFile, but only reads base64 and mediaType
const NO_BYTES = new Uint8Array()

type ChatBot = Pick<Bot, "id" | "name" | "avatar">

export function Chat({
  id,
  bots,
}: {
  id: string
  // A group chat's bots, to pick who each message is for
  bots?: ChatBot[]
}) {
  const [botId, setBotId] = useState(bots?.[0]?.id)
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Sent with every turn, so the agent answers as the picked bot
    clientData: { botId },
  })
  const { messages, isLoading } = useLoadTranscript(id, loadChatTranscript, {
    transport,
  })

  // useChat only reads initial messages on mount, so wait for the transcript
  if (isLoading) return null

  return (
    <ChatView
      id={id}
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
  transport,
  initialMessages,
  bots,
  botId,
  onHandoff,
  botPicker,
}: {
  id: string
  transport: TriggerChatTransport
  initialMessages: ChatUIMessage[]
  bots?: ChatBot[]
  // The bot picked in the composer, recorded on each message sent to it
  botId?: string
  // Picks the bot the next message goes to: after a handoff, or an @ tag
  onHandoff?: (botId: string) => void
  botPicker?: React.ReactNode
}) {
  const { messages, sendMessage, status, stop } = useChat<ChatUIMessage>({
    id,
    transport,
    messages: initialMessages,
    onFinish: ({ message }) => {
      const { botId, handedFrom } = message.metadata ?? {}
      if (botId && handedFrom) onHandoff?.(botId)
    },
  })

  function handleSubmit({ text }: PromptInputMessage) {
    if (!text.trim()) return
    sendMessage({ text, metadata: botId ? { botId } : undefined })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Send a message to begin chatting"
            />
          ) : (
            messages.map((message) => {
              // Only group chats pass bots; a direct chat's header shows its bot
              if (!bots || message.role !== "assistant") {
                const to =
                  message.role === "user" &&
                  bots?.find((bot) => bot.id === message.metadata?.botId)
                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {to ? (
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
                      ) : (
                        message.parts.map((part, i) => (
                          <MessagePart key={i} part={part} />
                        ))
                      )}
                    </MessageContent>
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
                  </MessageContent>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        {/* Controls the text so typing @ can tag a bot */}
        <PromptInputProvider>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              {bots && onHandoff ? (
                <MentionTextarea bots={bots} onMention={onHandoff} />
              ) : (
                <PromptInputTextarea placeholder="Send a message…" />
              )}
            </PromptInputBody>
            <PromptInputFooter
              className={botPicker ? undefined : "justify-end"}
            >
              {botPicker && <PromptInputTools>{botPicker}</PromptInputTools>}
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
      </div>
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

// Typing @ suggests the chat's bots. Picking one tags it as the bot the
// message is for, and the @ text is removed, since the picker shows the tag.
function MentionTextarea({
  bots,
  onMention,
}: {
  bots: ChatBot[]
  onMention: (botId: string) => void
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
    // Drop the @query and the space after it, if any
    const rest = value.slice(mention.end).replace(/^ /, "")
    textInput.setInput(value.slice(0, mention.start) + rest)
    setMention(null)
    onMention(bot.id)
    // Put the caret back where the tag was, after React applies the new value
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(mention.start, mention.start)
    })
  }

  return (
    <>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Bots"
          className="absolute inset-x-2 bottom-full z-10 mb-2 flex flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md sm:right-auto sm:w-56"
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
        </div>
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
    // The bot's own look at the screen; the person never sees it
    case "tool-viewScreen":
      return null
    case "tool-showScreen":
      return <ShowScreen part={part} />
    case "tool-bash":
      return <BashCall part={part} />
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
      return null
  }
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
      return part.input?.command ? `Ran ${part.input.command}` : "Ran a command"
    case "tool-readFile":
      return `Read ${part.input?.path ?? "a file"}`
    case "tool-writeFile":
      return `Wrote ${part.input?.path ?? "a file"}`
    case "tool-listFiles":
      return `Listed ${part.input?.path ?? "a folder"}`
    case "tool-mouseMove":
      return `Moved the mouse to ${point(part.input)}`
    case "tool-mouseClick":
      return `${part.input?.double ? "Double-clicked" : "Clicked"} at ${point(part.input)}`
    case "tool-mouseDrag":
      return `Dragged from ${point({ x: part.input?.startX, y: part.input?.startY })} to ${point({ x: part.input?.endX, y: part.input?.endY })}`
    case "tool-mouseScroll":
      return `Scrolled ${part.input?.direction ?? ""} at ${point(part.input)}`
    case "tool-keyboardType":
      return "Typed text"
    case "tool-keyboardPress":
      return `Pressed ${[...(part.input?.modifiers ?? []), part.input?.key].filter(Boolean).join("+")}`
    case "tool-viewScreen":
      return "Looked at the screen"
    case "tool-showScreen":
      return "Showed the screen"
  }
}

function point(input?: { x?: number; y?: number }) {
  return input?.x == null || input?.y == null ? "…" : `(${input.x}, ${input.y})`
}
