import { Show } from "@clerk/nextjs"
import { ArrowRightIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { LogoMark } from "@/components/logo"
import { DesktopShowcase } from "@/components/marketing/desktop-showcase"
import { Faq } from "@/components/marketing/faq"
import { Features, HowItWorks } from "@/components/marketing/features"
import { Hero } from "@/components/marketing/hero"
import { Pricing } from "@/components/marketing/pricing"
import { SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Arlo: AI teammates with their own computers",
  description:
    "Create AI bots with a name, a job, a memory and their own computer. Chat with them, connect your apps, and schedule work that runs while you're away.",
}

// Shown at / to signed-out visitors (see proxy.ts) and at /welcome to everyone
export default function Page() {
  return (
    <>
      <Hero />
      <Features />
      <DesktopShowcase />
      <HowItWorks />
      <Pricing />
      <Faq />
      <CallToAction />
    </>
  )
}

function CallToAction() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl bg-brand px-6 py-16 text-center text-brand-foreground">
        <LogoMark
          aria-hidden="true"
          className="absolute -right-16 -bottom-20 size-72 text-brand-foreground/10"
        />
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Meet your first bot today
        </h2>
        <p className="max-w-lg text-pretty text-brand-foreground/85">
          Create an account, pick a plan, and have a bot working on its own
          computer in a couple of minutes.
        </p>
        <Show when="signed-out">
          <Button
            size="lg"
            variant="secondary"
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
            variant="secondary"
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
