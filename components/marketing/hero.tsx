import { Show } from "@clerk/nextjs"
import { ArrowRightIcon, PlayIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"

import { HeroChat } from "@/components/marketing/hero-chat"
import { Accent, Reveal } from "@/components/marketing/motion"
import { RotatingWord } from "@/components/marketing/rotating-word"
import { SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const chores = [
  "research",
  "inbox",
  "reports",
  "code reviews",
  "follow-ups",
  "busywork",
]

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft brand glows that drift behind the headline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_50%_0%,color-mix(in_oklch,var(--brand)_22%,transparent),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-[10%] -z-10 size-[28rem] animate-drift rounded-full bg-brand/15 blur-3xl motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 right-[5%] -z-10 size-[22rem] animate-drift rounded-full bg-brand/10 blur-3xl [animation-delay:-9s] motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(60%_50%_at_50%_0%,black,transparent)] bg-size-[48px_48px] opacity-60"
      />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <Reveal>
          <Badge variant="outline" className="gap-1.5 bg-background/60">
            <SparklesIcon className="text-brand" />
            AI teammates with their own computers
          </Badge>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
            <span className="sr-only">
              Hand off the work. Arlo&apos;s bots get it done.
            </span>
            <span aria-hidden="true">
              <span className="block">Hand off the</span>
              <span className="block">
                <RotatingWord words={chores} className="text-brand" />.
              </span>
              <span className="block">
                <Accent>Your bots</Accent> get it done.
              </span>
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            Create bots with a name, a job and a memory. Each one gets its own
            computer to run code, browse and make files. Chat with them one on
            one or as a team, connect them to your apps, and schedule work that
            runs while you&apos;re away.
          </p>
        </Reveal>
        <Reveal delay={0.24} className="flex flex-col gap-3 sm:flex-row">
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
            render={<Link href="/demo" />}
            nativeButton={false}
          >
            <PlayIcon data-icon="inline-start" />
            Watch the demo
          </Button>
        </Reveal>
        <Reveal delay={0.32} className="flex w-full justify-center">
          <HeroChat />
        </Reveal>
      </div>
    </section>
  )
}

export { Hero }
