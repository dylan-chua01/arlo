"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { insertBotSchema } from "@/lib/db/schema"

const presets = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Point out bugs first, then readability. Suggest concrete fixes and keep nitpicks short.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten the prose without changing the voice. Explain any change that alters meaning.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step, check understanding with a question, and never just hand over the answer.",
  },
]

function getDefaultValues() {
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

function BotDialog({
  children,
  open: openProp,
  onOpenChange,
}: {
  children?: React.ReactElement
  // Control it from outside when the trigger can't live in the dialog, like a menu item
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const form = useForm({
    resolver: zodResolver(insertBotSchema),
    defaultValues: getDefaultValues(),
  })

  const avatar = useWatch({ control: form.control, name: "avatar" })
  const job = useWatch({ control: form.control, name: "job" })
  const activePreset = presets.find((preset) => preset.job === job)

  async function onSubmit(values: Parameters<typeof createBot>[0]) {
    const result = await createBot(values)

    if (!result.success) {
      toast.add({
        type: "error",
        title: "Couldn't create bot",
        description: result.error,
      })
      return
    }

    toast.add({ type: "success", title: `${result.bot.name} is ready` })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        // Start fresh, with a new face, the next time it opens
        if (!open) form.reset(getDefaultValues())
      }}
    >
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <ToggleGroup
              variant="outline"
              className="flex-wrap"
              aria-label="Presets"
              value={activePreset ? [activePreset.job] : []}
              onValueChange={([value]) => {
                const preset = presets.find((preset) => preset.job === value)
                if (!preset) return
                form.setValue("job", preset.job, { shouldValidate: true })
                form.setValue("instructions", preset.instructions, {
                  shouldValidate: true,
                })
              }}
            >
              {presets.map((preset) => (
                <ToggleGroupItem key={preset.job} value={preset.job}>
                  {preset.job}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Item className="px-0">
              <ItemMedia>
                <ChatAvatar seed={avatar} className="size-10" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Face</ItemTitle>
                <ItemDescription>
                  Shuffle until you find one you like.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.setValue("avatar", nanoid())}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </ItemActions>
            </Item>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
                    placeholder="Ada"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="job"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
                    placeholder="Research assistant"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="instructions"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
                    placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
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
            form="bot-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            Create bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
