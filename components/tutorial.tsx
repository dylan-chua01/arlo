"use client"

import { cn } from "cn"
import {
  BellIcon,
  BlocksIcon,
  CalendarClockIcon,
  CircleHelpIcon,
  FolderIcon,
  MessageSquareIcon,
  MonitorIcon,
  PaperclipIcon,
  PlusIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"
import { useState, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SidebarMenuButton } from "@/components/ui/sidebar"

const SEEN_KEY = "arlo:tutorial"
const SEEN_EVENT = "arlo:tutorial-change"

function getSeen() {
  return localStorage.getItem(SEEN_KEY) === "seen"
}

function markSeen() {
  localStorage.setItem(SEEN_KEY, "seen")
  window.dispatchEvent(new Event(SEEN_EVENT))
}

// "storage" covers finishing it in another tab
function subscribeToSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

type Step = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  // Where to find it in the app, each with the icon of the button to press
  hints: { icon: React.ComponentType<{ className?: string }>; text: string }[]
}

const steps: Step[] = [
  {
    icon: SparklesIcon,
    title: "Welcome to Arlo",
    description:
      "Arlo bots are AI teammates. Each one has a name, a job, a memory and its own cloud computer, so it can run code, browse the web and make files for you.",
    hints: [
      {
        icon: CircleHelpIcon,
        text: "You can replay this tour any time from How Arlo works in the sidebar.",
      },
    ],
  },
  {
    icon: PlusIcon,
    title: "Create a bot",
    description:
      "Pick a face, give it a name and a job, and describe how it should work. Start from a preset or write your own instructions.",
    hints: [
      {
        icon: PlusIcon,
        text: "Press + at the top of the sidebar, then Create new bot.",
      },
    ],
  },
  {
    icon: MessageSquareIcon,
    title: "Chat with it",
    description:
      "Every bot gets its own chat in the sidebar. Ask for what you need, and share documents, spreadsheets or images for it to work with.",
    hints: [
      { icon: PaperclipIcon, text: "Attach files from the message box." },
      {
        icon: FolderIcon,
        text: "Find every file, image and link from a chat in the header.",
      },
    ],
  },
  {
    icon: MonitorIcon,
    title: "Watch its desktop",
    description:
      "A bot's screen sits beside its chat, so you can see what it's doing as it works. Click the screen to open it full size and take over the mouse and keyboard.",
    hints: [
      {
        icon: MonitorIcon,
        text: "Show or hide the desktop with the screen button in the chat header.",
      },
    ],
  },
  {
    icon: UsersIcon,
    title: "Work as a team",
    description:
      "Put several bots in one group chat. Each message goes to the bot whose job fits it best, and bots can ask each other for help.",
    hints: [
      {
        icon: PlusIcon,
        text: "Press + at the top of the sidebar, then Create group chat.",
      },
    ],
  },
  {
    icon: CalendarClockIcon,
    title: "Connect apps and schedule work",
    description:
      "Connect tools like Gmail, Slack and GitHub so bots can work in them. Ask a bot to do something every weekday at 9:00, or in the background while you're away.",
    hints: [
      { icon: BlocksIcon, text: "Connect apps from Apps in the sidebar." },
      {
        icon: CalendarClockIcon,
        text: "See and edit scheduled work from Tasks in the sidebar.",
      },
    ],
  },
  {
    icon: BellIcon,
    title: "Know when it's done",
    description:
      "A chime plays when a bot replies or a task finishes. Allow desktop notifications to hear about it even when Arlo is in another tab.",
    hints: [
      {
        icon: BellIcon,
        text: "Turn notifications on or off from your account menu.",
      },
    ],
  },
]

// Opens by itself the first time someone signs in, and from the sidebar after
export function Tutorial() {
  const seen = useSyncExternalStore(
    subscribeToSeen,
    getSeen,
    // Seen on the server, so it doesn't flash open before the browser says
    () => true
  )
  const [reopened, setReopened] = useState(false)
  const [index, setIndex] = useState(0)
  const open = reopened || !seen

  const step = steps[index]
  const last = index === steps.length - 1

  function setOpen(next: boolean) {
    setReopened(next)
    if (!next) markSeen()
  }

  return (
    <>
      <SidebarMenuButton tooltip="How Arlo works" onClick={() => setOpen(true)}>
        <CircleHelpIcon />
        <span>How Arlo works</span>
      </SidebarMenuButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(open) => {
          if (!open) setIndex(0)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <step.icon className="size-5" />
          </div>
          <DialogHeader>
            <p className="text-xs text-muted-foreground">
              Step {index + 1} of {steps.length}
            </p>
            <DialogTitle>{step.title}</DialogTitle>
            <DialogDescription className="text-pretty">
              {step.description}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {step.hints.map((hint) => (
              <li
                key={hint.text}
                className="flex items-start gap-2.5 rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground"
              >
                <hint.icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                <span className="text-pretty">{hint.text}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="items-center sm:justify-between">
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "size-1.5 rounded-full bg-muted-foreground/30 transition-all",
                    i === index && "w-4 bg-brand"
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {index > 0 ? (
                <Button variant="outline" onClick={() => setIndex(index - 1)}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Skip
                </Button>
              )}
              <Button
                onClick={() => (last ? setOpen(false) : setIndex(index + 1))}
              >
                {last ? "Get started" : "Next"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
