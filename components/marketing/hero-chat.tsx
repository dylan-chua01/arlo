"use client"

import { useRef } from "react"
import { ArrowUpIcon, BellIcon, FileImageIcon } from "lucide-react"
import { AnimatePresence, motion, useInView } from "motion/react"

import { ChatAvatar } from "@/components/chat-avatar"
import { typed, useElapsed } from "@/components/marketing/motion"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { cn } from "@/lib/utils"

const REQUEST =
  "Can you pull last week's signups and draft the update for Slack?"

// One pass of the conversation, in seconds, before it starts over
const DURATION = 13

const pop = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
} as const

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

function BotMessage({
  seed,
  header,
  typing,
  children,
}: {
  seed: string
  header: string
  typing: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div {...pop}>
      <Message>
        <MessageAvatar>
          <ChatAvatar seed={seed} />
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>{header}</MessageHeader>
          {typing ? (
            <Bubble variant="muted">
              <BubbleContent>
                <TypingDots />
              </BubbleContent>
            </Bubble>
          ) : (
            children
          )}
        </MessageContent>
      </Message>
    </motion.div>
  )
}

// A group chat that plays itself out: the request is typed and sent, then
// two bots answer in turn and a scheduled task finishes in the corner.
function HeroChat() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const t = useElapsed(inView, DURATION, { loop: true })

  const sent = t >= 2.4
  const draft = sent ? "" : typed(REQUEST, t, 0.4, 38)
  const fading = t >= DURATION - 0.6 && t < DURATION

  return (
    <div ref={ref} className="relative mt-8 w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border bg-card text-left shadow-2xl shadow-brand/10">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex -space-x-2">
            <ChatAvatar seed="ada-research" className="ring-2 ring-card" />
            <ChatAvatar seed="milo-writer" className="ring-2 ring-card" />
          </div>
          <div className="grid leading-tight">
            <span className="text-sm font-medium">Weekly growth</span>
            <span className="text-xs text-muted-foreground">Ada and Milo</span>
          </div>
          <span className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            2 bots online
          </span>
        </div>

        <motion.div
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.5 }}
          className="flex h-88 flex-col justify-end gap-5 overflow-hidden p-4 sm:h-96 sm:p-6"
        >
          {sent && (
            <motion.div {...pop}>
              <Message align="end">
                <MessageContent>
                  <Bubble>
                    <BubbleContent>{REQUEST}</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </motion.div>
          )}
          {t >= 2.9 && (
            <BotMessage
              seed="ada-research"
              header="Ada · Research analyst"
              typing={t < 4.4}
            >
              <motion.div {...pop}>
                <Bubble variant="muted">
                  <BubbleContent>
                    Done. 1,284 signups, up 12% on the week before. I made a
                    chart of the daily numbers.
                  </BubbleContent>
                </Bubble>
              </motion.div>
              {t >= 5 && (
                <motion.div
                  {...pop}
                  className="flex w-fit items-center gap-3 rounded-xl border px-3 py-2"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <FileImageIcon className="size-4" />
                  </div>
                  <div className="grid leading-tight">
                    <span className="text-sm font-medium">
                      signups-week-45.png
                    </span>
                    <span className="text-xs text-muted-foreground">84 KB</span>
                  </div>
                </motion.div>
              )}
            </BotMessage>
          )}
          {t >= 5.8 && (
            <BotMessage
              seed="milo-writer"
              header="Milo · Writer"
              typing={t < 7.3}
            >
              <motion.div {...pop}>
                <Bubble variant="muted">
                  <BubbleContent>
                    Here&apos;s a draft for #growth using Ada&apos;s numbers.
                    Want me to post it?
                  </BubbleContent>
                </Bubble>
              </motion.div>
            </BotMessage>
          )}
        </motion.div>

        {/* The composer, where the request is typed out */}
        <div aria-hidden="true" className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                !draft && "text-muted-foreground"
              )}
            >
              {draft || "Message Ada and Milo"}
              {draft && (
                <span className="ms-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
              )}
            </span>
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                draft
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <ArrowUpIcon className="size-4" />
            </span>
          </div>
        </div>
      </div>

      {/* A desktop notification, as if a scheduled task just finished */}
      <AnimatePresence>
        {t >= 8.4 && !fading && (
          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="absolute -right-4 -bottom-6 hidden w-72 items-start gap-3 rounded-xl border bg-popover p-3 text-left shadow-lg sm:flex"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <BellIcon className="size-4" />
            </div>
            <div className="grid gap-0.5 leading-tight">
              <span className="text-sm font-medium">
                Inbox summary is ready
              </span>
              <span className="text-xs text-muted-foreground">
                Every weekday at 9:00 · Otto
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { HeroChat }
