"use client"

import { useRef } from "react"
import {
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GitBranchIcon,
  MailIcon,
} from "lucide-react"
import { motion, useInView } from "motion/react"

import { ChatAvatar } from "@/components/chat-avatar"
import {
  Accent,
  Reveal,
  typed,
  useAutoCycle,
} from "@/components/marketing/motion"
import { SectionHeading } from "@/components/marketing/section-heading"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

// Seconds each teammate's answer plays before the next one takes a turn
const STEP = 7

const teammates = [
  {
    seed: "ada-research",
    name: "Ada",
    job: "Research analyst",
    reply:
      "I read all 312 responses. The top themes are pricing (34%), onboarding (21%) and the mobile app (18%). I charted them for you.",
    output: { icon: FileImageIcon, label: "feedback-themes.png" },
  },
  {
    seed: "milo-writer",
    name: "Milo",
    job: "Writer",
    reply:
      "I wrote a thank-you email for everyone who left feedback, and a short changelog post about the mobile fixes. Both are ready to review.",
    output: { icon: FileTextIcon, label: "drafts.md" },
  },
  {
    seed: "juno-code",
    name: "Juno",
    job: "Code reviewer",
    reply:
      "Six of these are bug reports. I opened a GitHub issue for each one with steps to reproduce, and linked the duplicates together.",
    output: { icon: GitBranchIcon, label: "6 issues opened" },
  },
  {
    seed: "otto-ops",
    name: "Otto",
    job: "Inbox manager",
    reply:
      "I replied to the 18 people who asked a question, and flagged the 3 who sounded upset so you can follow up yourself.",
    output: { icon: MailIcon, label: "18 replies sent" },
  },
]

function Teammates() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const { active, t, select } = useAutoCycle(teammates.length, STEP, inView)
  const bot = teammates[active]

  const reply = typed(bot.reply, t, 1.6, 70)
  const finished = reply.length === bot.reply.length

  return (
    <section className="py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading
          eyebrow="Built around jobs"
          title={
            <>
              One request, <Accent>four different teammates.</Accent>
            </>
          }
          description="A bot's job and instructions shape how it works. Hand the same thing to different bots and each one does what it's there for."
        />
        <Reveal className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6">
          <ToggleGroup
            value={[bot.seed]}
            onValueChange={(value) => {
              const index = teammates.findIndex((b) => b.seed === value[0])
              if (index !== -1) select(index)
            }}
            variant="outline"
            spacing={2}
            className="flex-wrap justify-center"
          >
            {teammates.map((teammate) => (
              <ToggleGroupItem
                key={teammate.seed}
                value={teammate.seed}
                className="h-auto gap-2 rounded-full py-1 ps-1 pe-3 data-pressed:border-brand data-pressed:bg-brand/10"
              >
                <ChatAvatar seed={teammate.seed} className="size-6" />
                {teammate.name}
                <span className="hidden text-muted-foreground sm:inline">
                  · {teammate.job}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div
            ref={ref}
            className="flex h-96 w-full flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-2xl shadow-brand/10 sm:h-80 sm:p-6"
          >
            <div className="flex flex-col items-end gap-2">
              <Bubble className="max-w-[85%]">
                <BubbleContent>
                  Here&apos;s this week&apos;s customer feedback. Take a look.
                </BubbleContent>
              </Bubble>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm">
                <FileSpreadsheetIcon className="size-4 text-brand" />
                feedback.csv
              </div>
            </div>

            <motion.div
              key={bot.seed}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex gap-3"
            >
              <ChatAvatar seed={bot.seed} className="shrink-0" />
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs text-muted-foreground">
                  {bot.name} · {bot.job}
                </span>
                <Bubble variant="muted">
                  <BubbleContent>
                    {reply || (
                      <span className="text-muted-foreground">
                        Working on it…
                      </span>
                    )}
                  </BubbleContent>
                </Bubble>
                {finished && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex w-fit items-center gap-2 rounded-xl border px-3 py-1.5 text-sm"
                  >
                    <bot.output.icon className="size-4 text-brand" />
                    {bot.output.label}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export { Teammates }
