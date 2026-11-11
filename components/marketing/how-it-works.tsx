"use client"

import { useRef } from "react"
import { Tabs } from "@base-ui/react/tabs"
import {
  BellIcon,
  CalendarClockIcon,
  CheckIcon,
  FileTextIcon,
  MonitorIcon,
} from "lucide-react"
import { AnimatePresence, motion, useInView } from "motion/react"

import { ChatAvatar } from "@/components/chat-avatar"
import {
  Accent,
  Reveal,
  typed,
  useAutoCycle,
} from "@/components/marketing/motion"
import { SectionHeading } from "@/components/marketing/section-heading"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// Seconds each step plays before moving on to the next
const STEP = 7

const pop = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const

function Field({
  label,
  value,
  active,
  multiline = false,
}: {
  label: string
  value: string
  active: boolean
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        className={cn(
          "rounded-lg border bg-background px-3 py-2 text-sm transition-shadow",
          multiline ? "min-h-16" : "h-9",
          active && "border-ring ring-3 ring-ring/30"
        )}
      >
        {value}
        {active && (
          <span className="ms-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
        )}
      </div>
    </div>
  )
}

const faceSeeds = ["kai-qa", "ivy-design", "rex-sales", "sol-data"]
const NAME = "Nova"
const JOB = "Support lead"
const INSTRUCTIONS =
  "Answer new tickets within the hour. Send refund requests to me."

function CreateBot({ t }: { t: number }) {
  // The face shuffles a few times before settling, like pressing "shuffle"
  const seed =
    t < 1.6 ? faceSeeds[Math.floor(t / 0.4) % faceSeeds.length] : "nova-support"
  const name = typed(NAME, t, 1.8, 12)
  const job = typed(JOB, t, 2.3, 30)
  const instructions = typed(INSTRUCTIONS, t, 3, 45)
  const created = t >= 5

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <motion.div
          key={seed}
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          <ChatAvatar seed={seed} className="size-14" />
        </motion.div>
        <div className="grid leading-tight">
          <span className="font-medium">{name || "New bot"}</span>
          <span className="text-sm text-muted-foreground">
            {job || "Pick a face, a name and a job"}
          </span>
        </div>
      </div>
      <Field label="Name" value={name} active={t >= 1.8 && t < 2.3} />
      <Field label="Job" value={job} active={t >= 2.3 && t < 3} />
      <Field
        label="How it should work"
        value={instructions}
        active={t >= 3 && !created}
        multiline
      />
      <div className="flex items-center justify-end gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <motion.span
              key="done"
              {...pop}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <CheckIcon className="size-3" />
              </span>
              Nova is ready. Its computer is on.
            </motion.span>
          ) : (
            <motion.span
              key="create"
              {...pop}
              className={cn(
                "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-transform",
                t >= 4.7 && "scale-95"
              )}
            >
              Create bot
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const checklist = [
  { label: "Opened the help desk", at: 1.4 },
  { label: "Read 214 tickets from this week", at: 2.3 },
  { label: "Grouped them by topic", at: 3.2 },
]

function GiveTask({ t }: { t: number }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      {t >= 0.3 && (
        <motion.div {...pop} className="flex justify-end">
          <Bubble className="max-w-[85%]">
            <BubbleContent>
              Go through this week&apos;s support tickets and tell me
              what&apos;s trending.
            </BubbleContent>
          </Bubble>
        </motion.div>
      )}
      {t >= 1 && (
        <motion.div {...pop} className="flex gap-3">
          <ChatAvatar seed="nova-support" className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
              {checklist.map(
                (item) =>
                  t >= item.at && (
                    <motion.div
                      key={item.label}
                      {...pop}
                      className="flex items-center gap-2 text-sm"
                    >
                      {t >= item.at + 0.8 ? (
                        <CheckIcon className="size-4 text-emerald-500" />
                      ) : (
                        <Spinner className="size-4 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          t < item.at + 0.8 && "text-muted-foreground"
                        )}
                      >
                        {item.label}
                      </span>
                    </motion.div>
                  )
              )}
            </div>
            {t >= 4.4 && (
              <motion.div {...pop}>
                <Bubble variant="muted">
                  <BubbleContent>
                    Billing questions doubled this week, mostly about the new
                    invoice layout. Details are in the file.
                  </BubbleContent>
                </Bubble>
              </motion.div>
            )}
            {t >= 5.1 && (
              <motion.div
                {...pop}
                className="flex w-fit items-center gap-3 rounded-xl border px-3 py-2"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <FileTextIcon className="size-4" />
                </div>
                <div className="grid leading-tight">
                  <span className="text-sm font-medium">ticket-trends.md</span>
                  <span className="text-xs text-muted-foreground">6 KB</span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

const schedule = [
  { name: "Summarize my inbox", when: "Weekdays at 9:00", seed: "otto-ops" },
  { name: "Check for broken links", when: "Every Monday", seed: "kai-qa" },
  {
    name: "Post the weekly report",
    when: "Fridays at 17:00",
    seed: "milo-writer",
  },
]

function LetItRun({ t }: { t: number }) {
  const running = t >= 0.8 && t < 3.4
  const done = t >= 3.4
  const progress = Math.min(1, Math.max(0, (t - 0.8) / 2.6))

  return (
    <div className="relative flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClockIcon className="size-4" />
        Scheduled tasks
      </div>
      {schedule.map((task, i) => (
        <motion.div
          key={task.name}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.12, duration: 0.35 }}
          className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-background px-3 py-2.5"
        >
          <ChatAvatar seed={task.seed} className="size-6 shrink-0" />
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{task.name}</span>
            <span className="text-xs text-muted-foreground">{task.when}</span>
          </div>
          {i === 0 ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs">
              {running && <Spinner className="size-3.5" />}
              {done && <CheckIcon className="size-3.5 text-emerald-500" />}
              {running ? "Running" : done ? "Done" : "Next: 9:00"}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              Waiting
            </span>
          )}
          {i === 0 && running && (
            <span
              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
              style={{ transform: `scaleX(${progress})` }}
            />
          )}
        </motion.div>
      ))}
      <div className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <MonitorIcon className="size-3.5" />
        You&apos;re away. Otto&apos;s computer is doing the work.
      </div>
      <AnimatePresence>
        {t >= 3.8 && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mt-auto flex items-start gap-3 self-end rounded-xl border bg-popover p-3 shadow-lg"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <BellIcon className="size-4" />
            </div>
            <div className="grid gap-0.5 leading-tight">
              <span className="text-sm font-medium">
                Inbox summary is ready
              </span>
              <span className="text-xs text-muted-foreground">
                12 new emails, 2 need you · Otto
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const steps = [
  {
    title: "Create a bot",
    description:
      "Pick a face, give it a name and a job, and describe how it should work. Start from a preset or write your own.",
    Visual: CreateBot,
  },
  {
    title: "Give it something to do",
    description:
      "Ask in chat, share files, or connect your apps. Add more bots to a group chat when the work needs a team.",
    Visual: GiveTask,
  },
  {
    title: "Let it run",
    description:
      "Watch it work on its desktop, or schedule the task and come back to the results. You'll get a notification when it's done.",
    Visual: LetItRun,
  },
]

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const { active, t, auto, select } = useAutoCycle(steps.length, STEP, inView)
  const { Visual } = steps[active]

  return (
    <section className="border-y bg-muted/40 py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Up and running <Accent>in minutes.</Accent>
            </>
          }
          description="No setup or servers to manage. Each bot's computer is ready the moment you create it."
        />
        <Reveal>
          <Tabs.Root
            ref={ref}
            value={active}
            onValueChange={(value) => select(value as number)}
            className="grid items-center gap-8 md:grid-cols-[2fr_3fr]"
          >
            <Tabs.List className="flex flex-col gap-2">
              {steps.map((step, index) => (
                <Tabs.Tab
                  key={step.title}
                  value={index}
                  className="group relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border border-transparent p-4 text-left transition-colors outline-none hover:bg-background/60 focus-visible:ring-3 focus-visible:ring-ring/50 data-active:border-border data-active:bg-background data-active:shadow-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground transition-colors group-data-active:bg-brand group-data-active:text-brand-foreground">
                      {index + 1}
                    </span>
                    <span className="font-semibold">{step.title}</span>
                  </span>
                  <span className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-data-active:grid-rows-[1fr]">
                    <span className="overflow-hidden ps-10 text-sm text-pretty text-muted-foreground">
                      {step.description}
                    </span>
                  </span>
                  {index === active && (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full origin-left bg-brand"
                        style={{
                          transform: `scaleX(${auto ? t / STEP : 1})`,
                        }}
                      />
                    </span>
                  )}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel
              value={active}
              className="h-112 overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/10 outline-none"
            >
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="h-full"
              >
                <Visual t={t} />
              </motion.div>
            </Tabs.Panel>
          </Tabs.Root>
        </Reveal>
      </div>
    </section>
  )
}

export { HowItWorks }
