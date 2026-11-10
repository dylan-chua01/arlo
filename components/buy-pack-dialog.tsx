"use client"

import { useState, useTransition } from "react"

import { buyPack } from "@/actions/credits"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import { PACKS, packName, type Meter, type PackSlug } from "@/lib/billing"

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const copy: Record<Meter, { title: string; description: string }> = {
  ai: {
    title: "Buy more AI usage",
    description:
      "For when you need a bit more than your plan this month, for much less than upgrading.",
  },
  sandbox: {
    title: "Buy more sandbox time",
    description:
      "For when your bots need a bit more computer time than your plan this month, for much less than upgrading.",
  },
}

// The packs for one meter, smallest first
function packsFor(meter: Meter) {
  return (Object.keys(PACKS) as PackSlug[]).filter(
    (pack) => PACKS[pack].meter === meter
  )
}

function BuyPackDialog({
  meter,
  children,
}: {
  meter: Meter
  children: React.ReactElement
}) {
  const packs = packsFor(meter)
  const [open, setOpen] = useState(false)
  const [pack, setPack] = useState<PackSlug>(packs[0])
  const [isPending, startTransition] = useTransition()
  const showUpgradeToast = useUpgradeToast()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await buyPack(pack)
      if (result.success) {
        // Off to Stripe; it sends them back to /usage
        window.location.assign(result.url)
        return
      }
      if ("upgradeRequired" in result) {
        showUpgradeToast("Couldn't buy an add-on")
        return
      }
      toast.add({
        type: "error",
        title: "Couldn't buy an add-on",
        description: result.error,
      })
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        if (!open) setPack(packs[0])
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy[meter].title}</DialogTitle>
          <DialogDescription>{copy[meter].description}</DialogDescription>
        </DialogHeader>
        <form id={`buy-${meter}-form`} onSubmit={onSubmit}>
          <ToggleGroup
            variant="outline"
            orientation="vertical"
            className="w-full"
            aria-label="Add-on"
            value={[pack]}
            onValueChange={([value]) => {
              // Clicking the chosen pack again keeps it chosen
              if (value) setPack(value as PackSlug)
            }}
          >
            {packs.map((slug) => (
              <ToggleGroupItem
                key={slug}
                value={slug}
                className="h-auto justify-between py-2.5"
              >
                <span>{packName(slug)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {dollars.format(PACKS[slug].price)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="mt-3 text-xs text-muted-foreground">
            A one-time payment, not a subscription. It&apos;s used only after
            your plan&apos;s monthly allowance runs out, and whatever you
            don&apos;t use carries over to next month.
          </p>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form={`buy-${meter}-form`} disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Continue to payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BuyPackDialog }
