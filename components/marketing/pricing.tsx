import { Show } from "@clerk/nextjs"
import { CheckIcon } from "lucide-react"
import Link from "next/link"

import { SectionHeading } from "@/components/marketing/features"
import { SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MICROS_PER_DOLLAR, PLANS, type PlanSlug } from "@/lib/billing"
import { cn } from "@/lib/utils"

const RECOMMENDED: PlanSlug = "plus"

const blurbs: Record<PlanSlug, string> = {
  pro: "For trying out a bot or two on everyday jobs.",
  plus: "For a small team of bots you use every day.",
  max: "For heavy use across lots of bots and apps.",
  unlimited: "For bots that run all day, with no limit on computer time.",
}

const included = [
  "Bots with their own computers",
  "One-on-one and group chats",
  "Scheduled and background tasks",
  "File sharing and notifications",
]

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function limitsFor(slug: PlanSlug) {
  const { ai, sandbox, apps } = PLANS[slug].limits
  return [
    `${dollars.format(ai / MICROS_PER_DOLLAR)} of AI usage a month`,
    sandbox === null
      ? "Unlimited computer time"
      : `${sandbox / 3600} hours of computer time a month`,
    apps === null ? "Unlimited connected apps" : `${apps} connected apps`,
  ]
}

function PlanButton({ recommended }: { recommended: boolean }) {
  const variant = recommended ? "default" : "outline"
  return (
    <>
      <Show when="signed-out">
        <Button
          variant={variant}
          className="w-full"
          render={<Link href={SIGN_UP_HREF} />}
          nativeButton={false}
        >
          Get started
        </Button>
      </Show>
      <Show when="signed-in">
        <Button
          variant={variant}
          className="w-full"
          render={<Link href="/pricing" />}
          nativeButton={false}
        >
          Choose plan
        </Button>
      </Show>
    </>
  )
}

function Pricing() {
  const slugs = Object.keys(PLANS) as PlanSlug[]

  return (
    <section id="pricing" className="scroll-mt-20 py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple monthly plans"
          description="Every plan includes everything Arlo does. Bigger plans come with more AI usage, more computer time and more connected apps."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {slugs.map((slug) => {
            const plan = PLANS[slug]
            const recommended = slug === RECOMMENDED
            return (
              <div
                key={slug}
                className={cn(
                  "relative flex flex-col gap-6 rounded-2xl border bg-card p-6",
                  recommended &&
                    "border-brand shadow-lg ring-1 shadow-brand/10 ring-brand"
                )}
              >
                {recommended && (
                  <Badge className="absolute -top-2.5 left-6 bg-brand text-brand-foreground">
                    Recommended
                  </Badge>
                )}
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {blurbs[slug]}
                  </p>
                </div>
                <p className="flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {dollars.format(plan.price)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </p>
                <PlanButton recommended={recommended} />
                <ul className="flex flex-col gap-2.5 text-sm">
                  {limitsFor(slug).map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                      <span className="font-medium">{line}</span>
                    </li>
                  ))}
                  {included.map((line) => (
                    <li key={line} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="text-center text-sm text-pretty text-muted-foreground">
          Usage resets every month. Need a little more? Buy an add-on for much
          less than upgrading, and keep what you don&apos;t use. Upgrade any
          time and keep what you&apos;ve used so far; downgrades start when your
          billing period ends.
        </p>
      </div>
    </section>
  )
}

export { Pricing }
