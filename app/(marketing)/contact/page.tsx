import { currentUser } from "@clerk/nextjs/server"
import {
  CreditCardIcon,
  LifeBuoyIcon,
  MessageCircleQuestionIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ContactForm } from "@/components/contact-form"
import { LANDING_PATH } from "@/components/marketing/site-nav"

export const metadata: Metadata = {
  title: "Contact | Arlo",
  description: "Questions about Arlo, billing or your account? Get in touch.",
}

const shortcuts = [
  {
    icon: MessageCircleQuestionIcon,
    title: "Common questions",
    description: "How computer time, AI usage and connected apps work.",
    href: `${LANDING_PATH}#faq`,
    cta: "Read the FAQ",
  },
  {
    icon: CreditCardIcon,
    title: "Plans and pricing",
    description: "Compare what each plan includes.",
    href: `${LANDING_PATH}#pricing`,
    cta: "See pricing",
  },
  {
    icon: LifeBuoyIcon,
    title: "Your usage",
    description: "Signed in? See what you've used this month.",
    href: "/usage",
    cta: "Open usage",
  },
]

export default async function Page() {
  // Signed-in senders get their name and email filled in
  const user = await currentUser()
  const defaults = user
    ? {
        name: user.fullName ?? "",
        email: user.primaryEmailAddress?.emailAddress ?? "",
      }
    : undefined

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_oklch,var(--brand)_16%,transparent),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-brand">Contact</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance">
              We&apos;d love to hear from you
            </h1>
            <p className="text-pretty text-muted-foreground">
              Questions about Arlo, help with your account, or an idea for what
              bots should do next. Send us a message and we&apos;ll reply by
              email.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {shortcuts.map((shortcut) => (
              <Link
                key={shortcut.title}
                href={shortcut.href}
                className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <shortcut.icon className="size-4.5" />
                </div>
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium">{shortcut.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {shortcut.description}
                  </span>
                  <span className="mt-1 text-sm font-medium text-brand group-hover:underline group-hover:underline-offset-4">
                    {shortcut.cta}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <ContactForm defaults={defaults} />
        </div>
      </div>
    </div>
  )
}
