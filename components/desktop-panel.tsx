"use client"

import { cn } from "cn"
import { MonitorIcon, RotateCwIcon } from "lucide-react"
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"

import { getDesktopUrl } from "@/actions/sandbox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ResizablePanel } from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"
import { useUpgradeToast, useUsageLimitToast } from "@/hooks/use-upgrade-toast"
import type { Bot } from "@/lib/db/schema"

const DesktopPanelContext = createContext<{
  panelRef: RefObject<PanelImperativeHandle | null>
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

function useDesktopPanel() {
  const context = use(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider")
  }
  return context
}

export function DesktopPanelProvider({
  defaultOpen = false,
  children,
}: {
  // Should match whether the panel's defaultSize is above zero
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const panelRef = usePanelRef()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <DesktopPanelContext value={{ panelRef, open, setOpen }}>
      {children}
    </DesktopPanelContext>
  )
}

export function DesktopPanel({
  bot,
  ...props
}: Omit<
  React.ComponentProps<typeof ResizablePanel>,
  "panelRef" | "collapsible" | "onResize" | "children"
> & {
  bot?: Pick<Bot, "id" | "name"> | null
}) {
  const { panelRef, setOpen } = useDesktopPanel()
  const [desktop, setDesktop] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; url: string; key: number }
    | { status: "error"; error: string }
  >({ status: "idle" })
  const [dialogOpen, setDialogOpen] = useState(false)
  // Lags dialogOpen until the close animation ends, so the frame doesn't jump
  // back to the panel while the dialog is still fading out
  const [frameInDialog, setFrameInDialog] = useState(false)
  const [panelSlot, setPanelSlot] = useState<HTMLDivElement | null>(null)
  const [dialogSlot, setDialogSlot] = useState<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const showUpgradeToast = useUpgradeToast()
  const showUsageLimitToast = useUsageLimitToast()

  async function load() {
    if (!bot) return
    setDesktop({ status: "loading" })
    const result = await getDesktopUrl(bot.id)
    if (!result.success && "upgradeRequired" in result) {
      showUpgradeToast("Couldn't open the desktop")
    }
    if (!result.success && "usageLimitReached" in result) {
      showUsageLimitToast("Couldn't open the desktop")
    }
    setDesktop(
      result.success
        ? { status: "ready", url: result.url, key: Date.now() }
        : { status: "error", error: result.error }
    )
  }

  const title = `${bot?.name ?? "Bot"}'s screen`

  return (
    <ResizablePanel
      panelRef={panelRef}
      collapsible
      onResize={() => {
        const open = !panelRef.current?.isCollapsed()
        // Keeps the trigger's pressed state in sync when the panel is dragged
        setOpen(open)
        // The desktop loads the first time the panel opens, then stays loaded
        if (open && desktop.status === "idle") load()
      }}
      className="flex flex-col gap-3 p-4"
      {...props}
    >
      {bot ? (
        <>
          <Dialog
            open={dialogOpen}
            // Only the close button closes it; Escape, outside presses and
            // focus moving into the frame would otherwise end the session
            onOpenChange={(open, { reason }) => {
              if (open || reason === "close-press") setDialogOpen(open)
              if (open) setFrameInDialog(true)
            }}
            onOpenChangeComplete={(open) => {
              if (!open) setFrameInDialog(false)
            }}
            // A modal dialog traps focus, and the frame lives outside it
            modal={false}
          >
            <figure className="flex flex-col items-center gap-3">
              <figcaption className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="truncate">{title}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label="Reconnect"
                  disabled={desktop.status === "loading"}
                  onClick={load}
                >
                  <RotateCwIcon />
                </Button>
              </figcaption>
              <DialogTrigger
                disabled={desktop.status !== "ready"}
                aria-label={`Open ${title} fullscreen`}
                className="aspect-4/3 w-full rounded-xl border bg-card p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-zoom-in"
              >
                <div
                  ref={setPanelSlot}
                  className="flex size-full items-center justify-center overflow-hidden rounded-sm bg-muted"
                >
                  {desktop.status === "error" ? (
                    <span className="px-4 text-muted-foreground">
                      {desktop.error}
                    </span>
                  ) : desktop.status !== "ready" ? (
                    <Spinner className="text-muted-foreground" />
                  ) : null}
                </div>
              </DialogTrigger>
            </figure>
            <DialogContent
              initialFocus={frameRef}
              className="flex h-[calc(100svh-2rem)] flex-col sm:max-w-[calc(100%-2rem)]"
            >
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <div
                ref={setDialogSlot}
                className="min-h-0 flex-1 overflow-hidden rounded-sm bg-muted"
              />
            </DialogContent>
          </Dialog>
          {desktop.status === "ready" && (
            <DesktopFrame
              key={desktop.key}
              ref={frameRef}
              src={desktop.url}
              title={title}
              target={frameInDialog ? dialogSlot : panelSlot}
              interactive={dialogOpen}
              // The dialog zooms in and out, which no resize event reports
              track={dialogOpen || frameInDialog}
            />
          )}
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorIcon />
            </EmptyMedia>
            <EmptyTitle>No desktop</EmptyTitle>
            <EmptyDescription>
              This chat has no bot, so there&apos;s no sandbox to show.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </ResizablePanel>
  )
}

// One iframe for both the panel and the dialog. Moving an iframe in the DOM
// reloads it and drops the VNC session, so it stays put in a body-level layer
// and is laid over whichever slot is showing it.
function DesktopFrame({
  ref,
  src,
  title,
  target,
  interactive,
  track,
}: {
  ref: RefObject<HTMLIFrameElement | null>
  src: string
  title: string
  target: HTMLElement | null
  interactive: boolean
  track: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer || !target) return

    const sync = () => {
      const { top, left, width, height } = target.getBoundingClientRect()
      Object.assign(layer.style, {
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        // Hidden rather than unmounted, so a collapsed panel keeps the session
        visibility: width && height ? "visible" : "hidden",
      })
    }
    sync()

    const observer = new ResizeObserver(sync)
    observer.observe(target)
    window.addEventListener("resize", sync)

    let frame = 0
    if (track) {
      const loop = () => {
        sync()
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
      cancelAnimationFrame(frame)
    }
  }, [target, track])

  return createPortal(
    <div
      ref={layerRef}
      className={cn(
        "invisible fixed overflow-hidden rounded-sm",
        // Above the dialog, which portals in after this layer; in the panel
        // it's a preview, so clicks fall through to the trigger beneath
        interactive ? "z-51" : "pointer-events-none"
      )}
    >
      <iframe
        ref={ref}
        src={src}
        title={title}
        tabIndex={interactive ? 0 : -1}
        // The sandbox serves this page, so it gets an opaque origin that
        // can't reach the app; the proxy's CSP sandboxes it too
        sandbox="allow-scripts allow-pointer-lock"
        allow="clipboard-read; clipboard-write"
        className="size-full border-0"
      />
    </div>,
    document.body
  )
}

export function DesktopPanelTrigger() {
  const { panelRef, open } = useDesktopPanel()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="ms-auto text-muted-foreground"
      aria-label="Desktop"
      aria-pressed={open}
      onClick={() =>
        open ? panelRef.current?.collapse() : panelRef.current?.expand()
      }
    >
      <MonitorIcon />
    </Button>
  )
}
