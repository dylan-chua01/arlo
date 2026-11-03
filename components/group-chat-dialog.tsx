"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  insertGroupChatSchema,
  type Bot,
  type Chat,
  type InsertGroupChat,
} from "@/lib/db/schema"

type GroupChat = Pick<Chat, "id" | "name"> & { botIds: string[] }

// Editing starts from the group as saved; creating starts blank
function getDefaultValues(chat?: GroupChat): InsertGroupChat {
  if (chat) return { name: chat.name ?? "", botIds: chat.botIds }
  return { name: "", botIds: [] }
}

function GroupChatDialog({
  chat,
  bots,
  children,
  open: openProp,
  onOpenChange,
}: {
  // Edit this group instead of creating a new one
  chat?: GroupChat
  // The bots that can be picked
  bots: Pick<Bot, "id" | "name" | "avatar">[]
  children?: React.ReactElement
  // Control it from outside when the trigger can't live in the dialog, like a menu item
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const form = useForm({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: getDefaultValues(chat),
  })

  async function onSubmit(values: InsertGroupChat) {
    const result = chat
      ? await updateGroupChat(chat.id, values)
      : await createGroupChat(values)

    if (!result.success) {
      toast.add({
        type: "error",
        title: chat ? "Couldn't save group" : "Couldn't create group",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: chat
        ? `${result.chat.name} is updated`
        : `${result.chat.name} is ready`,
    })
    setOpen(false)
    if (!chat) router.push(`/chats/${result.chat.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        // Start fresh the next time it opens: blank, or the group as saved
        if (!open) form.reset(getDefaultValues(chat))
      }}
    >
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {chat ? "Edit group chat" : "New group chat"}
          </DialogTitle>
          <DialogDescription>
            {chat
              ? "Rename the group or change which bots are in it."
              : "Name the group and pick which bots are in it."}
          </DialogDescription>
        </DialogHeader>
        <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="group-chat-name"
                    placeholder="Weekend plans"
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
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  <FieldGroup data-slot="checkbox-group">
                    {bots.map((bot) => (
                      <Field
                        key={bot.id}
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id={`group-chat-bot-${bot.id}`}
                          name={field.name}
                          checked={field.value.includes(bot.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, bot.id]
                                : field.value.filter((id) => id !== bot.id)
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`group-chat-bot-${bot.id}`}
                          className="font-normal"
                        >
                          <ChatAvatar seed={bot.avatar} className="size-6" />
                          {bot.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {chat && (
            <DeleteGroupChatButton
              chat={chat}
              onDeleted={() => setOpen(false)}
            />
          )}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="group-chat-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {chat ? "Save changes" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGroupChatButton({
  chat,
  onDeleted,
}: {
  chat: GroupChat
  onDeleted: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  function onDelete() {
    startTransition(async () => {
      const result = await deleteGroupChat(chat.id)

      if (!result.success) {
        toast.add({
          type: "error",
          title: "Couldn't delete group chat",
          description: result.error,
        })
        return
      }

      toast.add({ type: "success", title: `${result.chat.name} is deleted` })
      setOpen(false)
      onDeleted()
      // The chat is gone, so leave the page that showed it
      router.replace("/")
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="destructive" className="sm:me-auto" />}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its messages are deleted with it. Its bots and their own chats stay.
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={onDelete}
          >
            {isPending && <Spinner data-icon="inline-start" />}
            Delete group chat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { GroupChatDialog }
