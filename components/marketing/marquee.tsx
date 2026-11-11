import {
  CalendarIcon,
  FileTextIcon,
  FolderIcon,
  GitBranchIcon,
  InboxIcon,
  KanbanIcon,
  MailIcon,
  MessageSquareIcon,
  PenToolIcon,
  TableIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { Accent, Reveal } from "@/components/marketing/motion"
import { cn } from "@/lib/utils"

const bots = [
  { seed: "ada-research", name: "Ada", job: "Research analyst" },
  { seed: "milo-writer", name: "Milo", job: "Writer" },
  { seed: "juno-code", name: "Juno", job: "Code reviewer" },
  { seed: "otto-ops", name: "Otto", job: "Inbox manager" },
  { seed: "nova-support", name: "Nova", job: "Support lead" },
  { seed: "rex-sales", name: "Rex", job: "Sales researcher" },
  { seed: "ivy-design", name: "Ivy", job: "Slide maker" },
  { seed: "sol-data", name: "Sol", job: "Data cleaner" },
  { seed: "pip-social", name: "Pip", job: "Social media manager" },
  { seed: "kai-qa", name: "Kai", job: "QA tester" },
]

const apps = [
  { icon: MailIcon, name: "Gmail" },
  { icon: MessageSquareIcon, name: "Slack" },
  { icon: CalendarIcon, name: "Google Calendar" },
  { icon: GitBranchIcon, name: "GitHub" },
  { icon: FileTextIcon, name: "Notion" },
  { icon: TableIcon, name: "Google Sheets" },
  { icon: FolderIcon, name: "Google Drive" },
  { icon: InboxIcon, name: "Outlook" },
  { icon: KanbanIcon, name: "Linear" },
  { icon: TicketIcon, name: "Jira" },
  { icon: UsersIcon, name: "HubSpot" },
  { icon: PenToolIcon, name: "Figma" },
]

// An endless row: the items are drawn twice and the track slides by half its
// width, so the second copy lands exactly where the first began.
function MarqueeRow({
  children,
  reverse = false,
  duration = "40s",
}: {
  children: React.ReactNode
  reverse?: boolean
  duration?: string
}) {
  return (
    <div className="group flex overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div
        style={{ "--marquee-duration": duration } as React.CSSProperties}
        className={cn(
          "flex w-max shrink-0 animate-marquee gap-3 pe-3 group-hover:[animation-play-state:paused] motion-reduce:animate-none",
          reverse && "[animation-direction:reverse]"
        )}
      >
        {children}
        <div aria-hidden="true" className="contents">
          {children}
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  return (
    <section className="py-16">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-10">
        <p className="px-4 text-center text-xl font-medium tracking-tight text-balance text-muted-foreground sm:text-2xl">
          A teammate for every job,{" "}
          <Accent className="text-foreground">
            in the apps you already use.
          </Accent>
        </p>
        <div className="flex w-full flex-col gap-3">
          <MarqueeRow duration="55s">
            {bots.map((bot) => (
              <div
                key={bot.seed}
                className="flex shrink-0 items-center gap-2.5 rounded-full border bg-card py-1.5 ps-1.5 pe-4 shadow-xs"
              >
                <ChatAvatar seed={bot.seed} />
                <span className="text-sm whitespace-nowrap">
                  <span className="font-medium">{bot.name}</span>{" "}
                  <span className="text-muted-foreground">· {bot.job}</span>
                </span>
              </div>
            ))}
          </MarqueeRow>
          <MarqueeRow reverse duration="45s">
            {apps.map((app) => (
              <div
                key={app.name}
                className="flex shrink-0 items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-sm whitespace-nowrap"
              >
                <app.icon className="size-4 text-muted-foreground" />
                {app.name}
              </div>
            ))}
          </MarqueeRow>
        </div>
      </Reveal>
    </section>
  )
}

export { Marquee }
