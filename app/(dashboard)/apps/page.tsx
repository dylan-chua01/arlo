import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { BlocksIcon, SearchIcon } from "lucide-react"

import { AppButton, ConnectResultToast } from "@/components/app-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { PLANS } from "@/lib/billing"
import { createAppSession, getConnectedApps } from "@/lib/composio"
import { getPlan } from "@/lib/usage"

type Toolkit = Awaited<
  ReturnType<Awaited<ReturnType<typeof createAppSession>>["toolkits"]>
>["items"][number]

// Reached from the user button's menu, not the sidebar
export default async function Page(props: PageProps<"/apps">) {
  const { userId } = await auth.protect()
  const { q, app, status } = await props.searchParams
  const search = typeof q === "string" ? q.trim() : ""

  let connected: Toolkit[]
  let catalog: Toolkit[]
  let plan: Awaited<ReturnType<typeof getPlan>>
  // What counts against the plan, which includes expired connections
  let used: number
  try {
    const session = await createAppSession(userId)
    const [connectedPage, catalogPage, planResult, connectedApps] =
      await Promise.all([
        // 50 is the most Composio returns at once
        session.toolkits({ isConnected: true, limit: 50 }),
        session.toolkits({ search: search || undefined, limit: 30 }),
        getPlan(userId),
        getConnectedApps(userId),
      ])
    connected = connectedPage.items
    plan = planResult
    used = connectedApps.length
    // Composio's own toolkit backs the bot's tools; it isn't an app to connect
    catalog = catalogPage.items.filter((toolkit) => toolkit.slug !== "composio")
  } catch (error) {
    console.error("Failed to load apps", error)
    return (
      <div className="flex min-h-svh">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BlocksIcon />
            </EmptyMedia>
            <EmptyTitle>Couldn&apos;t load your apps</EmptyTitle>
            <EmptyDescription>
              Something went wrong reaching your apps. Try again in a moment.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  // A search covers every app, connected or not
  const connectedSlugs = new Set(connected.map((toolkit) => toolkit.slug))
  const others = search
    ? catalog
    : catalog.filter((toolkit) => !connectedSlugs.has(toolkit.slug))
  const returnedFrom = typeof app === "string" ? app : undefined

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <ConnectResultToast
        name={
          [...connected, ...catalog].find(
            (toolkit) => toolkit.slug === returnedFrom
          )?.name
        }
        status={typeof status === "string" ? status : undefined}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <p className="text-muted-foreground">
          Connect your apps so your bots can work in them for you, like reading
          your email or adding to your calendar. Every bot you make can use
          them.
        </p>
        {plan && <AppAllowance plan={plan.slug} used={used} />}
      </div>

      {!search && connected.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Connected
          </h2>
          <AppList toolkits={connected} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {search ? `Results for “${search}”` : "All apps"}
        </h2>
        {/* A plain GET form, so the search lives in the URL */}
        <form action="/apps">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              name="q"
              type="search"
              defaultValue={search}
              placeholder="Search apps…"
              aria-label="Search apps"
            />
          </InputGroup>
        </form>
        {others.length > 0 ? (
          <AppList toolkits={others} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search ? "No apps match that search." : "No more apps to show."}
          </p>
        )}
      </section>
    </div>
  )
}

function AppAllowance({
  plan,
  used,
}: {
  plan: keyof typeof PLANS
  used: number
}) {
  const { name, limits } = PLANS[plan]

  if (limits.apps === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Your {name} plan lets you connect as many apps as you like.
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground tabular-nums">
        {used} of {limits.apps}
      </span>{" "}
      apps connected on your {name} plan.
      {used >= limits.apps && (
        <>
          {" "}
          <Link href="/pricing" className="underline underline-offset-4">
            Upgrade to connect more
          </Link>
        </>
      )}
    </p>
  )
}

function AppList({ toolkits }: { toolkits: Toolkit[] }) {
  return (
    <ItemGroup className="gap-2">
      {toolkits.map((toolkit) => (
        <AppItem key={toolkit.slug} toolkit={toolkit} />
      ))}
    </ItemGroup>
  )
}

function AppItem({ toolkit }: { toolkit: Toolkit }) {
  const { connection } = toolkit
  const status = connection?.isActive
    ? "connected"
    : connection?.connectedAccount
      ? "expired"
      : "disconnected"

  return (
    <Item variant="outline">
      <ItemMedia>
        <Avatar className="rounded-md after:rounded-md">
          {toolkit.logo && (
            <AvatarImage
              src={toolkit.logo}
              alt=""
              className="rounded-md object-contain"
            />
          )}
          <AvatarFallback className="rounded-md">
            {toolkit.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{toolkit.name}</ItemTitle>
      </ItemContent>
      <ItemActions>
        {toolkit.isNoAuth ? (
          // Works without signing in, so there's nothing to connect
          <Badge variant="secondary">Ready to use</Badge>
        ) : (
          <AppButton
            toolkit={toolkit.slug}
            name={toolkit.name}
            status={status}
          />
        )}
      </ItemActions>
    </Item>
  )
}
