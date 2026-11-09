"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CircleCheckIcon } from "lucide-react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"

import { sendContactMessage } from "@/actions/contact"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  insertContactMessageSchema,
  type InsertContactMessage,
} from "@/lib/db/schema"

const topics = [
  { value: "question", label: "A question" },
  { value: "billing", label: "Billing" },
  { value: "support", label: "Help with my account" },
  { value: "feedback", label: "Feedback" },
] as const

function getDefaultValues(
  defaults?: Partial<InsertContactMessage>
): InsertContactMessage {
  return {
    name: defaults?.name ?? "",
    email: defaults?.email ?? "",
    topic: "question",
    message: "",
  }
}

// Signed-in visitors get their name and email filled in
function ContactForm({
  defaults,
}: {
  defaults?: Partial<InsertContactMessage>
}) {
  const [sent, setSent] = React.useState(false)

  const form = useForm({
    resolver: zodResolver(insertContactMessageSchema),
    defaultValues: getDefaultValues(defaults),
  })

  async function onSubmit(values: InsertContactMessage) {
    const result = await sendContactMessage(values)

    if (!result.success) {
      toast.add({
        type: "error",
        title: "Couldn't send your message",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: "Message sent",
      description: "Thanks for writing in. We'll reply by email.",
    })
    form.reset(getDefaultValues(defaults))
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheckIcon className="size-8 text-brand" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Thanks, your message is on its way.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll reply to the email address you gave us.
          </p>
        </div>
        <Button variant="outline" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="topic"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel>What&apos;s it about?</FieldLabel>
              <ToggleGroup
                variant="outline"
                className="flex-wrap"
                aria-label="Topic"
                value={[field.value]}
                onValueChange={([value]) => {
                  if (value) field.onChange(value)
                }}
              >
                {topics.map((topic) => (
                  <ToggleGroupItem key={topic.value} value={topic.value}>
                    {topic.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="contact-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="contact-name"
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="contact-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="contact-email"
                  type="email"
                  placeholder="ada@example.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <Controller
          name="message"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="contact-message">Message</FieldLabel>
              <Textarea
                {...field}
                id="contact-message"
                placeholder="How can we help?"
                className="min-h-36"
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription>
                For account or billing questions, use the email you signed up
                with so we can find your account. We handle your message as
                described in our{" "}
                <Link href="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button
          type="submit"
          form="contact-form"
          size="lg"
          className="self-start"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          Send message
        </Button>
      </FieldGroup>
    </form>
  )
}

export { ContactForm }
