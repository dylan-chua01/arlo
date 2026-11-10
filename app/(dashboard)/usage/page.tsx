import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { formatDistanceToNowStrict } from "date-fns"
import { GaugeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { MICROS_PER_DOLLAR, PLANS } from "@/lib/billing"
import { getConnectedApps } from "@/lib/composio"
import { getUsage } from "@/lib/usage"

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})
const hours = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })
const count = new Intl.NumberFormat("en-US")

// Reached from the user button's menu, not the sidebar
export default async function Page() {
  const { userId } = await auth.protect()
  const [usage, connectedApps] = await Promise.all([
    getUsage(userId),
    // The meter is left out rather than failing the page
    getConnectedApps(userId).catch((error) => {
      console.error("Failed to count connected apps", error)
      return null
    }),
  ])

  if (!usage) {
    return (
      <div className="flex min-h-svh">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>No usage to show</EmptyTitle>
            <EmptyDescription>
              Usage is tracked each month on a paid plan. Upgrade to start using
              bots and sandboxes.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/pricing" />} nativeButton={false}>
              View plans
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const { period } = usage
  const plan = PLANS[usage.plan]

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">
          Resets in{" "}
          <time
            dateTime={period.end.toISOString()}
            title={period.end.toUTCString()}
            className="font-medium text-foreground"
          >
            {formatDistanceToNowStrict(period.end)}
          </time>
          . Switching plans changes your limits right away and keeps what
          you&apos;ve used so far.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{plan.name} plan</CardTitle>
          <CardDescription>What you&apos;ve used this month.</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/pricing" />}
              nativeButton={false}
            >
              {usage.plan === "unlimited" ? "Change plan" : "Get more"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Meter
            label="AI usage"
            description="Spent by your bots' replies and by routing group chat messages."
            used={usage.ai.used / MICROS_PER_DOLLAR}
            limit={usage.ai.limit / MICROS_PER_DOLLAR}
            format={(value) => dollars.format(value)}
          />
          <Meter
            label="Sandbox time"
            description="Counted while a bot's sandbox is running, including while its desktop is open."
            used={usage.sandbox.used / 3600}
            limit={
              usage.sandbox.limit === null ? null : usage.sandbox.limit / 3600
            }
            format={(value) => `${hours.format(value)} hours`}
          />
          {connectedApps && (
            <Meter
              label="Connected apps"
              description="Apps your bots can work in, like Gmail or Slack. Disconnect one on the Apps page to make room."
              used={connectedApps.length}
              limit={plan.limits.apps}
              format={(value) => count.format(value)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Meter({
  label,
  description,
  used,
  limit,
  format,
}: {
  label: string
  description: string
  used: number
  // Null is unlimited
  limit: number | null
  format: (value: number) => string
}) {
  if (limit === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {format(used)} · Unlimited
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    )
  }

  const shown = Math.min(used, limit)

  return (
    <div className="flex flex-col gap-1.5">
      <Progress value={shown} max={limit}>
        <ProgressLabel>{label}</ProgressLabel>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {format(shown)} of {format(limit)}
        </span>
      </Progress>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
