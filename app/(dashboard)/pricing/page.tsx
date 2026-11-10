import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

// Reached from the upgrade toasts and the usage page, not the sidebar
export default async function Page() {
  await auth.protect()

  return (
    <div className="flex min-h-svh flex-col items-center gap-8 px-4 py-16">
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a plan</h1>
        <p className="text-muted-foreground">
          Every paid plan unlocks bots and their sandboxes: create bots, chat
          with them, and watch them work on their own desktop. Bigger plans come
          with more AI usage, more sandbox time and more connected apps each
          month.
        </p>
        <p className="text-sm text-muted-foreground">
          Upgrades start right away and keep what you&apos;ve used this month.
          Downgrades start when your current billing period ends.
        </p>
      </div>
      <div className="w-full max-w-6xl">
        <PricingTable newSubscriptionRedirectUrl="/" />
      </div>
    </div>
  )
}
