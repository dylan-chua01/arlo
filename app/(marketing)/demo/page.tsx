import { Show } from "@clerk/nextjs"
import {
  ArrowRightIcon,
  CalendarClockIcon,
  MonitorIcon,
  PlugIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DemoVideo } from "@/components/marketing/demo-video"
import { SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "See Arlo in action",
  description:
    "A 40-second tour of Arlo: connect your apps, watch a bot work on its own computer, and put work on a schedule.",
}

const chapters = [
  {
    icon: PlugIcon,
    title: "Connect your apps",
    description:
      "Sign in to Gmail, Slack, GitHub and more once. Every bot you make can use them.",
  },
  {
    icon: MonitorIcon,
    title: "Watch it work",
    description:
      "Ask in chat and the bot gets to work on its own computer. Its screen sits beside the chat, live.",
  },
  {
    icon: CalendarClockIcon,
    title: "Put it on a schedule",
    description:
      "Turn a job into a task that repeats, like every weekday at 9:00. You get a notification when it's done.",
  },
]

export default function Page() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_40%_at_50%_0%,color-mix(in_oklch,var(--brand)_18%,transparent),transparent)]"
      />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
        <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="bg-background/60">
            40-second tour
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            See <span className="text-brand">Arlo</span> in action
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            Follow Ada, a research bot, as it connects to your apps, works on
            its own computer, and runs a task every morning.
          </p>
        </div>

        <div className="w-full">
          <DemoVideo />
        </div>

        <ol className="grid w-full gap-8 md:grid-cols-3">
          {chapters.map((chapter, index) => (
            <li key={chapter.title} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <chapter.icon className="size-4.5" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h2 className="font-semibold">{chapter.title}</h2>
              <p className="text-sm text-pretty text-muted-foreground">
                {chapter.description}
              </p>
            </li>
          ))}
        </ol>

        <Show when="signed-out">
          <Button
            size="lg"
            className="h-10 px-5"
            render={<Link href={SIGN_UP_HREF} />}
            nativeButton={false}
          >
            Make your first bot
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
      </div>
    </section>
  )
}
