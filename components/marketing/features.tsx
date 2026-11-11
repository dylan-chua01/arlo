import {
  BellIcon,
  BrainIcon,
  CalendarClockIcon,
  CalendarIcon,
  FileTextIcon,
  GitBranchIcon,
  MailIcon,
  MessageSquareIcon,
  MonitorIcon,
  PaperclipIcon,
  PlugIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { Accent, Reveal } from "@/components/marketing/motion"
import { SectionHeading } from "@/components/marketing/section-heading"
import { cn } from "@/lib/utils"

function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
  delay = 0,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  className?: string
  delay?: number
  children?: React.ReactNode
}) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "flex flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-6 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/5",
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="size-4.5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      {children && <div className="mt-auto">{children}</div>}
    </Reveal>
  )
}

const faces = [
  { seed: "ada-research", name: "Ada", job: "Research analyst" },
  { seed: "milo-writer", name: "Milo", job: "Writer" },
  { seed: "juno-code", name: "Juno", job: "Code reviewer" },
  { seed: "otto-ops", name: "Otto", job: "Inbox manager" },
]

const apps = [
  { icon: MailIcon, name: "Gmail" },
  { icon: MessageSquareIcon, name: "Slack" },
  { icon: CalendarIcon, name: "Calendar" },
  { icon: GitBranchIcon, name: "GitHub" },
  { icon: FileTextIcon, name: "Notion" },
  { icon: TableIcon, name: "Sheets" },
]

function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              More than a chatbot. <Accent>A team that does the work.</Accent>
            </>
          }
          description="Every Arlo bot is a teammate with its own personality, memory and computer, so it can finish jobs instead of just talking about them."
        />
        <div className="grid gap-4 md:grid-cols-6">
          <FeatureCard
            icon={BrainIcon}
            title="A face, a name and a job"
            description="Give each bot a role and tell it how to work. It keeps notes as it goes and remembers what matters across conversations."
            className="md:col-span-3"
          >
            <div className="grid grid-cols-2 gap-2">
              {faces.map((face) => (
                <div
                  key={face.seed}
                  className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2"
                >
                  <ChatAvatar seed={face.seed} />
                  <div className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-medium">
                      {face.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {face.job}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard
            icon={MonitorIcon}
            title="Its own computer"
            description="Every bot gets a private cloud computer. It runs code, uses a browser and makes real files. Open its desktop to watch it work, or take over."
            className="md:col-span-3"
            delay={0.1}
          >
            <div className="overflow-hidden rounded-xl border bg-background font-mono text-xs">
              <div className="flex items-center gap-1.5 border-b px-3 py-2">
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="size-2.5 rounded-full bg-muted-foreground/30" />
                <span className="ms-2 text-muted-foreground">
                  ada — sandbox
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 leading-relaxed">
                <span>
                  <span className="text-brand">$</span> python chart.py
                  signups.csv
                </span>
                <span className="text-muted-foreground">
                  Read 1,284 rows from signups.csv
                </span>
                <span className="text-muted-foreground">
                  Saved signups-week-45.png
                </span>
                <span>
                  <span className="text-brand">$</span>{" "}
                  <span className="inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-foreground" />
                </span>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard
            icon={UsersIcon}
            title="Group chats"
            description="Put several bots in one chat. Each message goes to the bot whose job fits it best, and bots can ask each other for help."
            className="md:col-span-2"
          >
            <div className="flex flex-col gap-2 text-xs">
              <div className="self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                Can someone review this pull request?
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                <ChatAvatar seed="juno-code" className="size-5" />
                <span>
                  <span className="font-medium">Juno</span>{" "}
                  <span className="text-muted-foreground">picked this up</span>
                </span>
              </div>
            </div>
          </FeatureCard>
          <FeatureCard
            icon={PlugIcon}
            title="Works in your apps"
            description="Connect the tools you already use, so bots can read, write and send things there for you."
            className="md:col-span-2"
            delay={0.1}
          >
            <div className="flex flex-wrap gap-1.5">
              {apps.map((app) => (
                <span
                  key={app.name}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
                >
                  <app.icon className="size-3.5 text-muted-foreground" />
                  {app.name}
                </span>
              ))}
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-muted-foreground">
                and many more
              </span>
            </div>
          </FeatureCard>
          <FeatureCard
            icon={CalendarClockIcon}
            title="Work on a schedule"
            description="Set a task to repeat, like every weekday at 9:00, or send one off to run in the background while you do something else."
            className="md:col-span-2"
            delay={0.2}
          >
            <div className="flex flex-col gap-1.5">
              {[
                { name: "Summarize my inbox", when: "Weekdays at 9:00" },
                { name: "Check for broken links", when: "Every Monday" },
              ].map((task) => (
                <div
                  key={task.name}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs"
                >
                  <span className="truncate font-medium">{task.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {task.when}
                  </span>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard
            icon={PaperclipIcon}
            title="Share files both ways"
            description="Drop documents, spreadsheets and images into a chat. Bots send back the reports, charts and slides they make."
            className="md:col-span-3"
          />
          <FeatureCard
            icon={BellIcon}
            title="Know when it's done"
            description="A chime and a desktop notification let you know when a bot replies or a task finishes, so you can step away."
            className="md:col-span-3"
            delay={0.1}
          />
        </div>
      </div>
    </section>
  )
}

export { Features }
