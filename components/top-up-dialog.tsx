"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { buyTopUp } from "@/actions/top-up"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import {
  formatTopUpAmount,
  TOP_UP_BOUNDS,
  TOP_UP_UNITS,
  topUpName,
  topUpPrice,
  type TopUpRate,
} from "@/lib/billing"
import { insertTopUpSchema, type InsertTopUp } from "@/lib/db/schema"

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  trailingZeroDisplay: "stripIfInteger",
})

const copy = {
  ai: { title: "Top up AI usage", label: "AI usage" },
  sandbox: { title: "Top up sandbox time", label: "Sandbox time" },
}

// Quick picks, in dollars or hours
const presets = {
  ai: [10, 25, 50, 100],
  sandbox: [10, 25, 50, 100],
}

// Starts at the amount the upgrade would add, which is what the saving is
// worked out on
function getDefaultValues(rate: TopUpRate): InsertTopUp {
  return { meter: rate.meter, amount: rate.amount }
}

// Takes how much to top up, then sends the browser to Stripe Checkout
function TopUpDialog({
  rate,
  resetsIn,
  children,
}: {
  rate: TopUpRate
  // When the usage month ends, like "12 days"
  resetsIn: string
  children: React.ReactElement
}) {
  const { meter } = rate
  const unit = TOP_UP_UNITS[meter]
  const { min, max } = TOP_UP_BOUNDS[meter]
  const formId = `top-up-${meter}-form`

  const [open, setOpen] = useState(false)
  const showUpgradeToast = useUpgradeToast()
  const form = useForm<InsertTopUp>({
    resolver: zodResolver(insertTopUpSchema),
    defaultValues: getDefaultValues(rate),
  })
  const amount = useWatch({ control: form.control, name: "amount" })
  const valid = amount >= min && amount <= max
  const price = valid ? topUpPrice(rate, amount) : null

  async function onSubmit(values: InsertTopUp) {
    const result = await buyTopUp(values)
    if (result.success) {
      // Off to Stripe; it sends them back to /usage. The form stays pending
      // until the page goes.
      window.location.assign(result.url)
      await new Promise(() => {})
      return
    }
    if ("upgradeRequired" in result) {
      showUpgradeToast("Couldn't top up")
      return
    }
    toast.add({
      type: "error",
      title: "Couldn't top up",
      description: result.error,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        if (!open) form.reset(getDefaultValues(rate))
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy[meter].title}</DialogTitle>
          <DialogDescription>
            Top-ups cost 30% less than {rate.instead.how}:{" "}
            {topUpName(meter, rate.amount)} is{" "}
            {dollars.format(topUpPrice(rate, rate.amount) / 100)} instead of{" "}
            {dollars.format(rate.instead.price)}.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-amount`}>
                    {copy[meter].label}
                  </FieldLabel>
                  <ToggleGroup
                    variant="outline"
                    className="w-full"
                    aria-label="Quick amounts"
                    value={[String(field.value / unit)]}
                    onValueChange={([value]) => {
                      // Clicking the chosen amount again keeps it
                      if (value) {
                        form.setValue("amount", Number(value) * unit, {
                          shouldValidate: true,
                        })
                      }
                    }}
                  >
                    {presets[meter].map((preset) => (
                      <ToggleGroupItem
                        key={preset}
                        value={String(preset)}
                        className="flex-1"
                      >
                        {formatTopUpAmount(meter, preset * unit)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <InputGroup>
                    {meter === "ai" && (
                      <InputGroupAddon>
                        <InputGroupText>$</InputGroupText>
                      </InputGroupAddon>
                    )}
                    <InputGroupInput
                      id={`${formId}-amount`}
                      type="number"
                      inputMode="decimal"
                      min={min / unit}
                      max={max / unit}
                      step="any"
                      aria-invalid={fieldState.invalid}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ? field.value / unit : ""}
                      onChange={(event) => {
                        const shown = event.target.valueAsNumber
                        // Empty reads as 0, which fails the minimum
                        field.onChange(
                          Number.isFinite(shown) ? Math.round(shown * unit) : 0
                        )
                      }}
                    />
                    {meter === "sandbox" && (
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>hours</InputGroupText>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                  <FieldDescription>
                    Between {formatTopUpAmount(meter, min)} and{" "}
                    {formatTopUpAmount(meter, max)}. A one-time payment that
                    adds to this month&apos;s allowance and ends when your usage
                    resets in {resetsIn}.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {price === null ? "Pay" : `Pay ${dollars.format(price / 100)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { TopUpDialog }
