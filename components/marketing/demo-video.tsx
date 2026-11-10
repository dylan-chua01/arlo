"use client"

import { memo, useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUpIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  FileTextIcon,
  GitBranchIcon,
  GlobeIcon,
  MailIcon,
  Maximize2Icon,
  MessageSquareIcon,
  MousePointer2Icon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  SunIcon,
  TerminalIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { ChatAvatar } from "@/components/chat-avatar"
import { LogoMark } from "@/components/logo"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

// The demo is drawn on a fixed 960×540 canvas and scaled to fit, so every
// position below is in canvas pixels and the "video" looks the same at any size.
const WIDTH = 960
const HEIGHT = 540

const scenes = [
  { id: "intro", start: 0, end: 3.5, label: "Hello" },
  { id: "apps", start: 3.5, end: 11, label: "Apps" },
  { id: "desktop", start: 11, end: 24.5, label: "Desktop" },
  { id: "tasks", start: 24.5, end: 36.5, label: "Tasks" },
  { id: "outro", start: 36.5, end: 41, label: "That's Arlo" },
] as const

type SceneId = (typeof scenes)[number]["id"]

const DURATION = scenes[scenes.length - 1].end

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// The part of `text` typed so far, at `cps` characters a second from `start`
function typed(text: string, t: number, start: number, cps = 30) {
  return text.slice(0, Math.max(0, Math.floor((t - start) * cps)))
}

// A pointer path: arrive at (x, y) at time t, gliding there over `glide` seconds
type Waypoint = { t: number; x: number; y: number; glide?: number }

function pointerAt(path: Waypoint[], t: number) {
  let { x, y } = path[0]
  for (const point of path) {
    const glide = point.glide ?? 0.8
    if (t >= point.t) {
      x = point.x
      y = point.y
      continue
    }
    if (t > point.t - glide) {
      const k = easeInOut((t - (point.t - glide)) / glide)
      x += (point.x - x) * k
      y += (point.y - y) * k
    }
    break
  }
  return { x, y }
}

const Avatar = memo(ChatAvatar)

// --- Pointer paths and click times for each scene (canvas pixels) ---

const appsPath: Waypoint[] = [
  { t: 3.6, x: 860, y: 500, glide: 0 },
  { t: 5.0, x: 678, y: 232 },
  { t: 6.9, x: 678, y: 294 },
  { t: 8.6, x: 678, y: 356 },
  { t: 10.0, x: 820, y: 470 },
]
const appsClicks = [5.1, 7.0, 8.7]

const desktopPath: Waypoint[] = [
  { t: 11.2, x: 520, y: 500, glide: 0 },
  { t: 11.8, x: 180, y: 476 },
  { t: 14.2, x: 336, y: 476, glide: 0.5 },
  { t: 15.6, x: 700, y: 330, glide: 1 },
  { t: 23.6, x: 760, y: 360, glide: 2 },
]
const desktopClicks = [11.9, 14.3]

// Ada's own pointer, inside her screen (screen pixels, not canvas pixels)
const adaPath: Waypoint[] = [
  { t: 15.9, x: 420, y: 300, glide: 0 },
  { t: 16.6, x: 160, y: 34 },
  { t: 18.4, x: 200, y: 112 },
  { t: 18.9, x: 210, y: 148, glide: 0.4 },
  { t: 19.4, x: 190, y: 184, glide: 0.4 },
  { t: 19.9, x: 220, y: 220, glide: 0.4 },
  { t: 20.6, x: 330, y: 260 },
]
const adaClicks = [16.7, 20.7]

const tasksPath: Waypoint[] = [
  { t: 24.7, x: 480, y: 480, glide: 0 },
  { t: 25.7, x: 704, y: 107 },
  { t: 26.4, x: 470, y: 189 },
  { t: 27.5, x: 470, y: 266, glide: 0.6 },
  { t: 29.3, x: 523, y: 341 },
  { t: 30.1, x: 600, y: 424, glide: 0.6 },
  { t: 31.2, x: 860, y: 490 },
]
const tasksClicks = [25.8, 26.5, 27.6, 29.4, 30.2]

const pointers: Partial<
  Record<SceneId, { path: Waypoint[]; clicks: number[] }>
> = {
  apps: { path: appsPath, clicks: appsClicks },
  desktop: { path: desktopPath, clicks: desktopClicks },
  tasks: { path: tasksPath, clicks: tasksClicks },
}

const captions: Partial<Record<SceneId, string>> = {
  apps: "1 · Connect your apps",
  desktop: "2 · Watch it work on its own computer",
  tasks: "3 · Put work on a schedule",
}

// --- The player ---

function DemoVideo() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scale, setScale] = useState(1)
  const timeRef = useRef(0)
  const frameRef = useRef<HTMLDivElement>(null)
  const autoplayedRef = useRef(false)

  const seek = useCallback((time: number) => {
    timeRef.current = clamp(time, 0, DURATION)
    setT(timeRef.current)
  }, [])

  const play = useCallback(() => {
    if (timeRef.current >= DURATION) seek(0)
    setPlaying(true)
  }, [seek])

  // Advance the clock while playing
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) / 1000
      last = now
      if (next >= DURATION) {
        seek(DURATION)
        setPlaying(false)
        return
      }
      seek(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, seek])

  // Scale the canvas to the frame's width
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / WIDTH)
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  // Start the first time it scrolls into view, unless motion is reduced
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !autoplayedRef.current) {
          autoplayedRef.current = true
          setPlaying(true)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const scene = scenes.find((s) => t < s.end) ?? scenes[scenes.length - 1]
  const ended = t >= DURATION

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/10"
      >
        <div
          className="absolute top-0 left-0 origin-top-left overflow-hidden"
          style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }}
          aria-hidden="true"
        >
          <Stage t={t} scene={scene.id} />
        </div>

        {/* Click anywhere to pause or play, like a video */}
        <button
          type="button"
          onClick={() => (playing ? setPlaying(false) : play())}
          className={cn(
            "group absolute inset-0 flex justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            // Below the closing title, so it stays readable
            ended ? "items-end pb-[10%]" : "items-center"
          )}
          aria-label={
            playing ? "Pause demo" : ended ? "Replay demo" : "Play demo"
          }
        >
          {!playing && (
            <span className="flex items-center gap-2 rounded-full bg-brand px-3.5 py-2 text-xs font-medium text-brand-foreground shadow-lg transition-transform group-hover:scale-105 sm:px-5 sm:py-3 sm:text-sm">
              {ended ? (
                <RotateCcwIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4 fill-current" />
              )}
              {ended ? "Watch again" : t > 0 ? "Resume" : "Play demo"}
            </span>
          )}
        </button>
      </div>

      <Controls
        t={t}
        playing={playing}
        onToggle={() => (playing ? setPlaying(false) : play())}
        onSeek={seek}
      />
    </div>
  )
}

function Controls({
  t,
  playing,
  onToggle,
  onSeek,
}: {
  t: number
  playing: boolean
  onToggle: () => void
  onSeek: (time: number) => void
}) {
  const format = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-foreground transition-colors hover:bg-muted"
        aria-label={playing ? "Pause demo" : "Play demo"}
      >
        {playing ? (
          <PauseIcon className="size-3.5 fill-current" />
        ) : (
          <PlayIcon className="size-3.5 fill-current" />
        )}
      </button>
      <div className="flex flex-1 gap-1">
        {scenes.map((s) => {
          const filled = clamp((t - s.start) / (s.end - s.start))
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSeek(s.start)}
              className="group flex flex-col gap-1.5 py-1 text-left"
              style={{ flexGrow: s.end - s.start, flexBasis: 0 }}
              aria-label={`Jump to ${s.label}`}
            >
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted transition-colors group-hover:bg-muted-foreground/20">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${filled * 100}%` }}
                />
              </span>
              <span
                className={cn(
                  "hidden truncate text-xs transition-colors sm:block",
                  t >= s.start && t < s.end
                    ? "font-medium text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {format(t)} / {format(DURATION)}
      </span>
    </div>
  )
}

// --- The canvas ---

function Stage({ t, scene }: { t: number; scene: SceneId }) {
  const pointer = pointers[scene]
  const caption = captions[scene]

  return (
    <div className="relative size-full bg-muted/40 text-foreground">
      {/* Soft brand wash and a faint grid */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--brand)_18%,transparent),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[22px_22px] opacity-70" />

      <AnimatePresence>
        <motion.div
          key={scene}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35 }}
        >
          {scene === "intro" && <IntroScene t={t} />}
          {scene === "apps" && <AppsScene t={t} />}
          {scene === "desktop" && <DesktopScene t={t} />}
          {scene === "tasks" && <TasksScene t={t} />}
          {scene === "outro" && <OutroScene t={t} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {caption && (
          <motion.div
            key={caption}
            className="absolute top-[18px] left-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-sm font-medium shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: -10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -10, x: "-50%" }}
          >
            {caption}
          </motion.div>
        )}
      </AnimatePresence>

      {pointer && <Pointer t={t} path={pointer.path} clicks={pointer.clicks} />}
    </div>
  )
}

function Pointer({
  t,
  path,
  clicks,
  label,
}: {
  t: number
  path: Waypoint[]
  clicks: number[]
  label?: string
}) {
  const { x, y } = pointerAt(path, t)
  const click = clicks.find((c) => t >= c && t < c + 0.45)
  const pressed = click !== undefined && t < click + 0.15

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{ left: x, top: y }}
    >
      {click !== undefined && (
        <span
          className="absolute -top-5 -left-5 size-10 rounded-full border-2 border-brand"
          style={{
            opacity: 1 - (t - click) / 0.45,
            transform: `scale(${0.3 + ((t - click) / 0.45) * 0.9})`,
          }}
        />
      )}
      <MousePointer2Icon
        className={cn(
          "-mt-0.5 -ml-0.5 size-6 drop-shadow-md transition-transform duration-100",
          label ? "fill-brand text-white" : "fill-foreground text-background",
          pressed && "scale-85"
        )}
      />
      {label && (
        <span className="absolute top-5 left-4 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground shadow">
          {label}
        </span>
      )}
    </div>
  )
}

function Caret() {
  return (
    <span className="ms-px inline-block h-[1em] w-px translate-y-[0.15em] animate-pulse bg-foreground" />
  )
}

function Pop({
  children,
  className,
  style,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28, delay }}
    >
      {children}
    </motion.div>
  )
}

// --- Scene: hello ---

function IntroScene({ t }: { t: number }) {
  const hello = "Hi! I'm Ada, your research bot."
  return (
    <div className="flex size-full flex-col items-center justify-center gap-6">
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 14,
          delay: 0.15,
        }}
        className="relative"
      >
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand/20 blur-2xl" />
        <Avatar
          seed="ada-research"
          animated
          className="size-28 ring-4 ring-background"
        />
        <motion.span
          className="absolute -top-2 -right-3 text-brand"
          animate={{ rotate: [0, 20, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          <SparklesIcon className="size-7" />
        </motion.span>
      </motion.div>
      {t >= 0.8 && (
        <Pop className="rounded-2xl rounded-tl-sm border bg-background px-5 py-3 text-xl font-medium shadow-sm">
          {typed(hello, t, 0.9, 32)}
          {t < 2.0 && <Caret />}
        </Pop>
      )}
      {t >= 2.1 && (
        <Pop className="text-base text-muted-foreground">
          Let me show you how I work in Arlo.
        </Pop>
      )}
    </div>
  )
}

// --- Scene: connect apps ---

const demoApps = [
  {
    name: "Gmail",
    note: "Read and send email",
    icon: MailIcon,
    tint: "bg-red-500/10 text-red-500",
  },
  {
    name: "Slack",
    note: "Post and read messages",
    icon: MessageSquareIcon,
    tint: "bg-violet-500/10 text-violet-500",
  },
  {
    name: "GitHub",
    note: "Issues and pull requests",
    icon: GitBranchIcon,
    tint: "bg-foreground/10 text-foreground",
  },
  {
    name: "Calendar",
    note: "See and add events",
    icon: CalendarIcon,
    tint: "bg-sky-500/10 text-sky-500",
  },
]

function AppsScene({ t }: { t: number }) {
  const connected = appsClicks.filter((c) => t >= c + 1).length

  return (
    <>
      <div
        className="absolute overflow-hidden rounded-xl border bg-background shadow-xl"
        style={{ left: 200, top: 70, width: 560, height: 420 }}
      >
        <div className="flex flex-col gap-1 p-6">
          <h3 className="text-xl font-semibold tracking-tight">Apps</h3>
          <p className="text-sm text-muted-foreground">
            Connect your apps so your bots can work in them for you.{" "}
            <span className="font-medium text-foreground tabular-nums">
              {connected} connected
            </span>
          </p>
        </div>
        <p
          className="absolute text-xs font-medium text-muted-foreground"
          style={{ left: 24, top: 112 }}
        >
          All apps
        </p>
        {demoApps.map((app, i) => {
          const click = appsClicks[i]
          const state =
            click === undefined || t < click
              ? "idle"
              : t < click + 1
                ? "connecting"
                : "connected"
          return (
            <div
              key={app.name}
              className={cn(
                "absolute flex items-center gap-3 rounded-lg border px-3 transition-colors",
                state === "connected" &&
                  "border-emerald-500/40 bg-emerald-500/5"
              )}
              style={{ left: 24, right: 24, top: 136 + 62 * i, height: 52 }}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  app.tint
                )}
              >
                <app.icon className="size-4" />
              </span>
              <div className="grid leading-tight">
                <span className="text-sm font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.note}
                </span>
              </div>
              <div
                className="absolute flex items-center justify-center"
                style={{ right: 12, width: 92, height: 32 }}
              >
                {state === "idle" && (
                  <span className="flex h-8 w-full items-center justify-center rounded-lg border bg-background text-xs font-medium shadow-xs">
                    Connect
                  </span>
                )}
                {state === "connecting" && (
                  <span className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border bg-muted text-xs text-muted-foreground">
                    <Spinner className="size-3" />
                    Signing in
                  </span>
                )}
                {state === "connected" && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="flex h-7 items-center gap-1 rounded-full bg-emerald-500 px-2.5 text-xs font-medium text-white"
                  >
                    <CheckIcon className="size-3.5" />
                    Connected
                  </motion.span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {t >= 9.8 && (
        <Pop
          className="absolute flex items-center gap-3 rounded-xl border bg-popover p-3 shadow-lg"
          style={{ right: 24, bottom: 24, width: 300 }}
        >
          <Avatar seed="ada-research" animated className="size-9" />
          <div className="grid leading-tight">
            <span className="text-sm font-medium">
              Ada can use your apps now
            </span>
            <span className="text-xs text-muted-foreground">
              Gmail, Slack and GitHub
            </span>
          </div>
        </Pop>
      )}
    </>
  )
}

// --- Scene: chat and desktop ---

const request =
  "Find today's top tech stories, summarize them and post to Slack"
const requestStart = 12.0
const requestCps = 34

const stories = [
  "A tiny robot that waters your plants",
  "Why cats love cardboard boxes",
  "Building a cozy home server",
  "The surprising math of pancakes",
]
// When Ada reads each story
const storyReads = [18.4, 18.9, 19.4, 19.9]

function DesktopScene({ t }: { t: number }) {
  const sent = t >= 14.35
  const draft = sent ? "" : typed(request, t, requestStart, requestCps)
  const working = t >= 16.7 && t < 22.3

  return (
    <div
      className="absolute flex overflow-hidden rounded-xl border bg-background shadow-xl"
      style={{ left: 40, top: 66, width: 880, height: 444 }}
    >
      {/* The chat */}
      <div
        className="relative flex shrink-0 flex-col border-e"
        style={{ width: 330 }}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <Avatar seed="ada-research" className="size-6" />
          <span className="text-sm font-medium">Ada</span>
          <span className="text-xs text-muted-foreground">Research bot</span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-3 pb-[68px] text-[13px] leading-snug">
          {sent && (
            <Pop className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
              {request}
            </Pop>
          )}
          {t >= 14.6 && t < 15.6 && (
            <Pop className="flex w-fit items-center gap-1 rounded-2xl bg-muted px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.12,
                  }}
                />
              ))}
            </Pop>
          )}
          {t >= 15.6 && (
            <AdaMessage>
              On it! I&apos;ll open my browser and take a look.
            </AdaMessage>
          )}
          {t >= 16.7 && (
            <Pop className="ms-8 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {working ? (
                <Spinner className="size-3" />
              ) : (
                <CheckIcon className="size-3 text-emerald-500" />
              )}
              {working ? "Using the computer" : "Used the computer"}
            </Pop>
          )}
          {t >= 22.3 && (
            <AdaMessage>
              Done! Here&apos;s the summary. I posted it to #news in Slack too.
              <div className="mt-2 flex flex-col gap-1.5">
                <span className="flex w-fit items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-xs">
                  <FileTextIcon className="size-3.5 text-brand" />
                  top-stories.md
                  <span className="text-muted-foreground">2 KB</span>
                </span>
                <span className="flex w-fit items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-xs">
                  <MessageSquareIcon className="size-3.5 text-violet-500" />
                  Sent a message in Slack
                </span>
              </div>
            </AdaMessage>
          )}
        </div>
        {/* Composer */}
        <div
          className={cn(
            "absolute flex items-center gap-2 rounded-xl border bg-background ps-3 pe-1.5 text-[13px] transition-shadow",
            t >= 11.9 && !sent && "ring-2 ring-ring/40"
          )}
          style={{ left: 12, right: 12, bottom: 12, height: 44 }}
        >
          <span className="min-w-0 flex-1 truncate">
            {draft ? (
              <>
                {draft}
                <Caret />
              </>
            ) : (
              <span className="text-muted-foreground">Message Ada…</span>
            )}
          </span>
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              draft
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <ArrowUpIcon className="size-4" />
          </span>
        </div>
      </div>

      {/* Ada's desktop */}
      <div className="flex flex-1 flex-col gap-2 p-4 pt-0">
        <div className="flex h-12 items-center gap-2 text-sm text-muted-foreground">
          <span>Ada&apos;s screen</span>
          <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            Live
          </span>
          <Maximize2Icon className="ms-auto size-4" />
        </div>
        <Screen t={t} />
      </div>
    </div>
  )
}

function AdaMessage({ children }: { children: React.ReactNode }) {
  return (
    <Pop className="flex items-end gap-2">
      <Avatar seed="ada-research" className="size-6" />
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
        {children}
      </div>
    </Pop>
  )
}

function Screen({ t }: { t: number }) {
  const url = "news.example.com"
  const urlTyped = typed(url, t, 16.8, 24)
  const loaded = t >= 17.6
  const command = "python summarize.py"

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand)_40%,var(--muted)),color-mix(in_oklch,oklch(0.7_0.12_300)_25%,var(--muted)))]">
      {/* A little sun and hill on the wallpaper */}
      <div className="absolute top-6 right-8 size-14 rounded-full bg-amber-200/60 blur-[1px]" />
      <div className="absolute -bottom-24 -left-10 h-48 w-[380px] rounded-[50%] bg-emerald-400/25" />

      {t >= 15.8 && (
        <Pop
          className="absolute flex flex-col overflow-hidden rounded-lg border bg-background shadow-lg"
          style={{ left: 24, top: 18, width: 340, height: 262 }}
        >
          <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
            <span className="size-2 rounded-full bg-red-400" />
            <span className="size-2 rounded-full bg-amber-400" />
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="ms-2 flex flex-1 items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <GlobeIcon className="size-3" />
              {urlTyped}
              {t >= 16.7 && t < 17.6 && <Caret />}
            </span>
          </div>
          {loaded ? (
            <div className="relative flex-1">
              <p className="px-3 pt-3 text-xs font-semibold">
                Top stories today
              </p>
              {stories.map((story, i) => {
                const read = t >= storyReads[i]
                const reading = read && t < (storyReads[i + 1] ?? 20.4)
                return (
                  <Pop
                    key={story}
                    delay={i * 0.1}
                    className={cn(
                      "absolute flex items-center gap-2 rounded-md px-2 text-[11px] transition-colors",
                      reading && "bg-brand/15"
                    )}
                    style={{ left: 8, right: 8, top: 36 + i * 36, height: 30 }}
                  >
                    <span className="w-3 text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate">{story}</span>
                    {read && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <CheckIcon className="size-3.5 text-emerald-500" />
                      </motion.span>
                    )}
                  </Pop>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              {t >= 16.7 && <Spinner className="size-4" />}
            </div>
          )}
        </Pop>
      )}

      {t >= 20.3 && (
        <Pop
          className="absolute flex flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 font-mono text-[11px] text-zinc-100 shadow-xl"
          style={{ left: 220, top: 168, width: 270, height: 140 }}
        >
          <div className="flex items-center gap-1.5 border-b border-zinc-700 px-2.5 py-1.5 text-zinc-400">
            <TerminalIcon className="size-3" />
            ada — terminal
          </div>
          <div className="flex flex-col gap-1 p-2.5 leading-relaxed">
            <span>
              <span className="text-brand">$</span>{" "}
              {typed(command, t, 20.8, 28)}
              {t < 21.6 && <Caret />}
            </span>
            {t >= 21.6 && (
              <span className="text-zinc-400">Summarized 4 stories</span>
            )}
            {t >= 22.0 && (
              <span className="text-emerald-400">Saved top-stories.md ✓</span>
            )}
          </div>
        </Pop>
      )}

      {/* The taskbar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-background/70 py-1.5 backdrop-blur">
        {[GlobeIcon, TerminalIcon, FileTextIcon].map((Icon, i) => (
          <span
            key={i}
            className="flex size-6 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm"
          >
            <Icon className="size-3.5" />
          </span>
        ))}
      </div>

      {t >= 15.9 && (
        <Pointer t={t} path={adaPath} clicks={adaClicks} label="Ada" />
      )}
    </div>
  )
}

// --- Scene: tasks ---

const repeatOptions = ["Once", "Daily", "Weekdays", "Weekly"]

function TasksScene({ t }: { t: number }) {
  const dialogOpen = t >= 25.85 && t < 30.4
  const created = t >= 30.5
  const status = t < 32.6 ? "scheduled" : t < 33.8 ? "running" : "done"
  const name = typed("Morning briefing", t, 26.6, 28)
  const prompt = typed("Summarize my inbox and today's meetings", t, 27.7, 36)
  const repeat = t >= 29.4 ? "Weekdays" : "Once"

  return (
    <>
      <div
        className="absolute overflow-hidden rounded-xl border bg-background shadow-xl"
        style={{ left: 180, top: 66, width: 600, height: 444 }}
      >
        <div className="flex flex-col gap-1 p-6">
          <h3 className="text-xl font-semibold tracking-tight">Tasks</h3>
          <p className="text-sm text-muted-foreground">
            Work your bots do on their own.
          </p>
        </div>
        <span
          className={cn(
            "absolute flex items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground transition-transform",
            t >= 25.8 && t < 25.95 && "scale-95"
          )}
          style={{ right: 24, top: 24, width: 104, height: 34 }}
        >
          <PlusIcon className="size-3.5" />
          New task
        </span>

        {created && (
          <TaskRow
            top={110}
            seed="ada-research"
            name="Morning briefing"
            schedule="Weekdays at 9:00"
            highlight
          >
            {status === "scheduled" && (
              <span className="text-xs text-muted-foreground">
                Next: tomorrow 9:00
              </span>
            )}
            {status === "running" && (
              <span className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                <Spinner className="size-3" />
                Running
              </span>
            )}
            {status === "done" && (
              <motion.span
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white"
              >
                <CheckIcon className="size-3" />
                Done
              </motion.span>
            )}
          </TaskRow>
        )}
        <TaskRow
          top={created ? 172 : 110}
          seed="juno-code"
          name="Check for broken links"
          schedule="Every Monday at 10:00"
        >
          <span className="text-xs text-muted-foreground">Next: Monday</span>
        </TaskRow>
      </div>

      {/* The new task dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            className="absolute inset-0 bg-black/15"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute rounded-xl border bg-background shadow-2xl"
              style={{ left: 290, top: 96, width: 380, height: 360 }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <p
                className="absolute text-base font-semibold"
                style={{ left: 20, top: 18 }}
              >
                New task for Ada
              </p>
              <Label top={56}>Name</Label>
              <Input top={76} height={34} active={t >= 26.5 && t < 27.6}>
                {name || (
                  <span className="text-muted-foreground">Give it a name</span>
                )}
                {t >= 26.5 && t < 27.6 && <Caret />}
              </Input>
              <Label top={122}>What should Ada do?</Label>
              <Input top={142} height={56} active={t >= 27.6 && t < 29.4}>
                {prompt}
                {t >= 27.6 && t < 29.4 && <Caret />}
              </Input>
              <Label top={210}>Repeat</Label>
              <div
                className="absolute flex gap-1.5"
                style={{ left: 20, right: 20, top: 230, height: 30 }}
              >
                {repeatOptions.map((option) => (
                  <span
                    key={option}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-lg border text-xs transition-colors",
                      option === repeat
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background"
                    )}
                  >
                    {option}
                  </span>
                ))}
              </div>
              <div
                className="absolute flex items-center gap-2 text-xs"
                style={{ left: 20, top: 272 }}
              >
                <span className="text-muted-foreground">at</span>
                <span className="rounded-lg border px-2.5 py-1">9:00 AM</span>
              </div>
              <div
                className="absolute flex gap-2"
                style={{ right: 20, top: 312 }}
              >
                <span className="flex h-8 items-center rounded-lg border px-3 text-xs font-medium">
                  Cancel
                </span>
                <span
                  className={cn(
                    "flex h-8 w-[100px] items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground transition-transform",
                    t >= 30.2 && "scale-95"
                  )}
                >
                  Create task
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip ahead to the next morning */}
      <AnimatePresence>
        {t >= 31.2 && t < 32.6 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex size-20 items-center justify-center rounded-full border-4 border-foreground/80 bg-background">
                <span
                  className="absolute bottom-1/2 left-1/2 h-6 w-1 origin-bottom -translate-x-1/2 rounded-full bg-foreground"
                  style={{
                    transform: `translateX(-50%) rotate(${(t - 31.2) * 900}deg)`,
                  }}
                />
                <span
                  className="absolute bottom-1/2 left-1/2 h-4 w-1 origin-bottom -translate-x-1/2 rounded-full bg-brand"
                  style={{
                    transform: `translateX(-50%) rotate(${(t - 31.2) * 75}deg)`,
                  }}
                />
              </div>
              <span className="flex items-center gap-2 text-lg font-semibold">
                <SunIcon className="size-5 text-amber-500" />
                Next morning, 9:00
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {t >= 33.9 && (
        <Pop
          className="absolute flex items-start gap-3 rounded-xl border bg-popover p-3 shadow-lg"
          style={{ right: 20, top: 20, width: 290 }}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <BellIcon className="size-4" />
          </span>
          <div className="grid gap-0.5 leading-tight">
            <span className="text-sm font-medium">
              Morning briefing is ready
            </span>
            <span className="text-xs text-muted-foreground">
              Ada · 12 new emails, 3 meetings today
            </span>
          </div>
        </Pop>
      )}
    </>
  )
}

function TaskRow({
  top,
  seed,
  name,
  schedule,
  highlight,
  children,
}: {
  top: number
  seed: string
  name: string
  schedule: string
  highlight?: boolean
  children: React.ReactNode
}) {
  return (
    <motion.div
      className={cn(
        "absolute flex items-center gap-3 rounded-lg border px-3",
        highlight && "border-brand/40 bg-brand/5"
      )}
      style={{ left: 24, right: 24, height: 52 }}
      initial={highlight ? { opacity: 0, y: -8, top } : false}
      animate={{ opacity: 1, y: 0, top }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <Avatar seed={seed} className="size-7" />
      <div className="grid flex-1 leading-tight">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{schedule}</span>
      </div>
      {children}
    </motion.div>
  )
}

function Label({ top, children }: { top: number; children: React.ReactNode }) {
  return (
    <span className="absolute text-xs font-medium" style={{ left: 20, top }}>
      {children}
    </span>
  )
}

function Input({
  top,
  height,
  active,
  children,
}: {
  top: number
  height: number
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "absolute rounded-lg border px-2.5 py-2 text-xs transition-shadow",
        active && "border-ring ring-2 ring-ring/30"
      )}
      style={{ left: 20, right: 20, top, height }}
    >
      {children}
    </div>
  )
}

// --- Scene: that's Arlo ---

function OutroScene({ t }: { t: number }) {
  const local = t - 36.5
  return (
    <div className="flex size-full flex-col items-center justify-center gap-5 text-center">
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        >
          <LogoMark className="size-16" />
        </motion.div>
        {local >= 0.3 && (
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex -space-x-3"
          >
            {["ada-research", "milo-writer", "juno-code"].map((seed) => (
              <Avatar
                key={seed}
                seed={seed}
                animated
                className="size-14 ring-4 ring-background"
              />
            ))}
          </motion.div>
        )}
      </div>
      {local >= 0.6 && (
        <Pop className="text-4xl font-semibold tracking-tight">
          That&apos;s <span className="text-brand">Arlo</span>.
        </Pop>
      )}
      {local >= 1.1 && (
        <Pop className="max-w-md text-base text-pretty text-muted-foreground">
          Bots that use your apps, work on their own computers, and keep going
          on a schedule while you&apos;re away.
        </Pop>
      )}
    </div>
  )
}

export { DemoVideo }
