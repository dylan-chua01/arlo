import { Show } from "@clerk/nextjs"
import {
  ArrowRightIcon,
  BellIcon,
  FileImageIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"

import { ChatAvatar } from "@/components/chat-avatar"
import { LANDING_PATH, SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand glow behind the headline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_0%,color-mix(in_oklch,var(--brand)_22%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(60%_50%_at_50%_0%,black,transparent)] bg-size-[48px_48px] opacity-60"
      />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <Badge variant="outline" className="gap-1.5 bg-background/60">
          <SparklesIcon className="text-brand" />
          AI teammates with their own computers
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Hand off the work.{" "}
          <span className="text-brand">Arlo&apos;s bots</span> get it done.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          Create bots with a name, a job and a memory. Each one gets its own
          computer to run code, browse and make files. Chat with them one on one
          or as a team, connect them to your apps, and schedule work that runs
          while you&apos;re away.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Show when="signed-out">
            <Button
              size="lg"
              className="h-10 px-5"
              render={<Link href={SIGN_UP_HREF} />}
              nativeButton={false}
            >
              Get started
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </Show>
          <Show when="signed-in">
            <Button
              size="lg"
              className="h-10 px-5"
              render={<Link href="/" />}
              nativeButton={false}
            >
              Open Arlo
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </Show>
          <Button
            size="lg"
            variant="outline"
            className="h-10 bg-background/60 px-5"
            render={<Link href={`${LANDING_PATH}#pricing`} />}
            nativeButton={false}
          >
            See pricing
          </Button>
        </div>
        <HeroChat />
      </div>
    </section>
  )
}

// A still of a group chat, built from the same pieces as the real one
function HeroChat() {
  return (
    <div className="relative mt-8 w-full max-w-3xl">
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
        </div>
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <Message align="end">
            <MessageContent>
              <Bubble>
                <BubbleContent>
                  Can you pull last week&apos;s signups and draft the update for
                  Slack?
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
                  Done. 1,284 signups, up 12% on the week before. I made a chart
                  of the daily numbers.
                </BubbleContent>
              </Bubble>
              <div className="flex w-fit items-center gap-3 rounded-xl border px-3 py-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <FileImageIcon className="size-4" />
                </div>
                <div className="grid leading-tight">
                  <span className="text-sm font-medium">
                    signups-week-45.png
                  </span>
                  <span className="text-xs text-muted-foreground">84 KB</span>
                </div>
              </div>
            </MessageContent>
          </Message>
          <Message>
            <MessageAvatar>
              <ChatAvatar seed="milo-writer" />
            </MessageAvatar>
            <MessageContent>
              <MessageHeader>Milo · Writer</MessageHeader>
              <Bubble variant="muted">
                <BubbleContent>
                  Here&apos;s a draft for #growth using Ada&apos;s numbers. Want
                  me to post it?
                </BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        </div>
      </div>
      {/* A desktop notification, as if a scheduled task just finished */}
      <div className="absolute -right-4 -bottom-6 hidden w-72 items-start gap-3 rounded-xl border bg-popover p-3 text-left shadow-lg sm:flex">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <BellIcon className="size-4" />
        </div>
        <div className="grid gap-0.5 leading-tight">
          <span className="text-sm font-medium">Inbox summary is ready</span>
          <span className="text-xs text-muted-foreground">
            Every weekday at 9:00 · Ada
          </span>
        </div>
      </div>
    </div>
  )
}

export { Hero }
