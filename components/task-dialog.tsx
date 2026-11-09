"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"

import {
  createRecurringTask,
  deleteRecurringTask,
  updateRecurringTask,
} from "@/actions/tasks"
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
import { SchedulePicker } from "@/components/schedule-picker"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import { describeSchedule } from "@/lib/cron"
import {
  insertRecurringTaskSchema,
  type Bot,
  type InsertRecurringTask,
  type RecurringTask,
} from "@/lib/db/schema"

type TaskBot = Pick<Bot, "id" | "name">

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Every zone the browser knows, with the person's own and the task's kept in
// even if the list leaves them out
function timezoneOptions(...extra: string[]) {
  return [...new Set([...extra, ...Intl.supportedValuesOf("timeZone")])].sort()
}

// Editing starts from the task as saved; creating starts on weekday mornings
// in the person's time zone
function getDefaultValues(
  bots: TaskBot[],
  task?: RecurringTask
): InsertRecurringTask {
  if (task) {
    return {
      botId: task.botId,
      title: task.title,
      instructions: task.instructions,
      cron: task.cron,
      timezone: task.timezone,
    }
  }
  return {
    botId: bots[0]?.id ?? "",
    title: "",
    instructions: "",
    // Weekdays at 9:00 AM
    cron: "0 9 * * 1-5",
    timezone: browserTimezone(),
  }
}

function TaskDialog({
  bots,
  task,
  children,
}: {
  bots: TaskBot[]
  // Edit this task instead of creating a new one
  task?: RecurringTask
  children: React.ReactElement
}) {
  const [open, setOpen] = React.useState(false)
  const showUpgradeToast = useUpgradeToast()

  const form = useForm({
    resolver: zodResolver(insertRecurringTaskSchema),
    defaultValues: getDefaultValues(bots, task),
  })

  const cron = useWatch({ control: form.control, name: "cron" })
  const timezone = useWatch({ control: form.control, name: "timezone" })
  const summary = describeSchedule(cron)
  const timezones = React.useMemo(
    () => timezoneOptions(browserTimezone(), timezone),
    [timezone]
  )

  async function onSubmit(values: InsertRecurringTask) {
    const result = task
      ? await updateRecurringTask(task.id, values)
      : await createRecurringTask(values)

    if (!result.success) {
      if ("upgradeRequired" in result) {
        showUpgradeToast("Couldn't create task")
        return
      }
      toast.add({
        type: "error",
        title: task ? "Couldn't save task" : "Couldn't create task",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: task
        ? `${result.task.title} is updated`
        : `${result.task.title} is scheduled`,
      description: result.task.scheduleDescription,
    })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => {
        if (!open) form.reset(getDefaultValues(bots, task))
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New recurring task"}</DialogTitle>
          <DialogDescription>
            Your bot does it on schedule, even when the app is closed, and posts
            a report to its chat.
          </DialogDescription>
        </DialogHeader>
        <form id="task-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="botId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-bot">Bot</FieldLabel>
                  <NativeSelect
                    {...field}
                    id="task-bot"
                    className="w-full"
                    // The task's reports live in its bot's chat
                    disabled={!!task}
                    aria-invalid={fieldState.invalid}
                  >
                    {bots.map((bot) => (
                      <NativeSelectOption key={bot.id} value={bot.id}>
                        {bot.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-title">Name</FieldLabel>
                  <Input
                    {...field}
                    id="task-title"
                    placeholder="Morning inbox summary"
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
                  <FieldLabel htmlFor="task-instructions">
                    What to do
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="task-instructions"
                    placeholder="Go through my unread email from the last day and summarize what needs a reply."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="cron"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-schedule">Repeats</FieldLabel>
                  <SchedulePicker
                    id="task-schedule"
                    value={field.value}
                    onChange={(cron) =>
                      form.setValue("cron", cron, { shouldValidate: true })
                    }
                    invalid={fieldState.invalid}
                  />
                  {summary ? (
                    <FieldDescription>
                      Runs {summary.charAt(0).toLowerCase() + summary.slice(1)}.
                    </FieldDescription>
                  ) : (
                    <FieldDescription>
                      Cron: minute, hour, day of month, month, day of week.
                    </FieldDescription>
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="timezone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="task-timezone">Time zone</FieldLabel>
                  <NativeSelect
                    {...field}
                    id="task-timezone"
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    {timezones.map((zone) => (
                      <NativeSelectOption key={zone} value={zone}>
                        {zone.replaceAll("_", " ")}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {task && (
            <DeleteTaskButton task={task} onDeleted={() => setOpen(false)} />
          )}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="task-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            {task ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTaskButton({
  task,
  onDeleted,
}: {
  task: RecurringTask
  onDeleted: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRecurringTask(task.id)
      if (!result.success) {
        toast.add({
          type: "error",
          title: "Couldn't delete task",
          description: result.error,
        })
        return
      }
      toast.add({ type: "success", title: `${result.task.title} is deleted` })
      setOpen(false)
      onDeleted()
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
          <AlertDialogTitle>Delete {task.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            It stops running. Reports it already posted stay in the chat.
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
            Delete task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { TaskDialog }
