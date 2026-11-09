import {
  EyeIcon,
  FolderIcon,
  GlobeIcon,
  HandIcon,
  MonitorIcon,
  MousePointer2Icon,
  RotateCwIcon,
  TerminalIcon,
} from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { SectionHeading } from "@/components/marketing/features"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"

const points = [
  {
    icon: EyeIcon,
    title: "Watch live",
    description:
      "The bot's screen sits beside the chat, so you see every click and keystroke as it happens.",
  },
  {
    icon: HandIcon,
    title: "Take over",
    description:
      "Open the screen full size to use the mouse and keyboard yourself, like signing in to a site.",
  },
  {
    icon: FolderIcon,
    title: "Keep what it makes",
    description:
      "Files it saves on its computer come back to the chat, ready to download or share.",
  },
]

// Bar heights, in percent, for the chart on the mock screen
const bars = [38, 52, 46, 61, 58, 72, 80]

function DesktopShowcase() {
  return (
    <section id="desktop" className="scroll-mt-20 py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <SectionHeading
          eyebrow="Its own desktop"
          title="Watch your bot work, right beside the chat"
          description="Every one-on-one chat opens with the bot's desktop next to it. See what it's doing on its computer, and step in whenever you want."
        />
        <ShowcaseWindow />
        <ul className="grid gap-8 md:grid-cols-3">
          {points.map((point) => (
            <li key={point.title} className="flex flex-col gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <point.icon className="size-4.5" />
              </div>
              <h3 className="font-semibold">{point.title}</h3>
              <p className="text-sm text-pretty text-muted-foreground">
                {point.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// A still of a chat with the desktop panel open, laid out like the real page
function ShowcaseWindow() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/10">
      <div className="grid md:grid-cols-[2fr_3fr]">
        {/* The chat */}
        <div className="flex flex-col border-b md:border-e md:border-b-0">
          <div className="flex h-12 items-center gap-2 border-b px-4">
            <ChatAvatar seed="ada-research" className="size-5" />
            <span className="text-sm font-medium">Ada</span>
            <MonitorIcon
              aria-hidden="true"
              className="ms-auto size-4 text-muted-foreground"
            />
          </div>
          <div className="flex flex-1 flex-col gap-5 p-4 text-left">
            <Message align="end">
              <MessageContent>
                <Bubble>
                  <BubbleContent>
                    Find this week&apos;s top posts on our blog and chart the
                    views.
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <Message>
              <MessageAvatar>
                <ChatAvatar seed="ada-research" />
              </MessageAvatar>
              <MessageContent>
                <MessageHeader>Ada · Research analyst</MessageHeader>
                <Bubble variant="muted">
                  <BubbleContent>
                    On it. I&apos;m pulling the numbers from the analytics page
                    now, then I&apos;ll chart them.
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          </div>
        </div>

        {/* The desktop panel */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Ada&apos;s screen</span>
            <RotateCwIcon aria-hidden="true" className="size-4" />
          </div>
          <div className="aspect-4/3 rounded-xl border bg-card p-2">
            <div className="relative flex size-full flex-col overflow-hidden rounded-sm bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand)_35%,var(--muted)),var(--muted))]">
              {/* A browser window */}
              <div className="absolute inset-x-[6%] top-[7%] bottom-[22%] flex flex-col overflow-hidden rounded-md border bg-background shadow-lg">
                <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  <span className="ms-2 flex min-w-0 flex-1 items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    <GlobeIcon aria-hidden="true" className="size-2.5" />
                    <span className="truncate">analytics.example.com/posts</span>
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <span className="text-[11px] font-medium">
                    Views this week
                  </span>
                  <div className="flex flex-1 items-end gap-[6%]">
                    {bars.map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-brand/80"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* The pointer, mid-click */}
              <MousePointer2Icon
                aria-hidden="true"
                className="absolute top-[38%] left-[78%] size-5 fill-foreground text-background drop-shadow"
              />
              {/* The taskbar */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/70 py-1.5 backdrop-blur">
                {[GlobeIcon, TerminalIcon, FolderIcon].map((Icon, i) => (
                  <span
                    key={i}
                    className="flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm"
                  >
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { DesktopShowcase }
