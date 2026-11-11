"use client"

import { useEffect, useState } from "react"
import { motion, MotionConfig, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

// Honors the visitor's "reduce motion" setting for every animation below it
function MarketingMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

// Fades and lifts its children in the first time they scroll into view
function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

// Seconds elapsed while `playing`, from 0 up to `duration`. With `loop` it
// wraps back to 0; otherwise it stops at `duration`. Changing `resetKey`
// starts it over. With reduced motion it sits at `duration`, the final frame.
function useElapsed(
  playing: boolean,
  duration: number,
  { loop = false, resetKey = 0 }: { loop?: boolean; resetKey?: number } = {}
) {
  const reduce = useReducedMotion()
  const [state, setState] = useState({ key: resetKey, t: 0 })

  useEffect(() => {
    if (!playing || reduce) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      setState((prev) => {
        const base = prev.key === resetKey ? prev.t : 0
        if (!loop && base >= duration) return prev
        const next = base + dt
        return {
          key: resetKey,
          t: next < duration ? next : loop ? 0 : duration,
        }
      })
    }, 50)
    return () => clearInterval(id)
  }, [playing, reduce, duration, loop, resetKey])

  if (reduce) return duration
  return state.key === resetKey ? state.t : 0
}

// Steps through `count` items, `step` seconds each, while `playing`. Picking
// one stops the cycle and plays that item once.
function useAutoCycle(count: number, step: number, playing: boolean) {
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState<number | null>(null)
  const auto = picked === null && !reduce

  const total = useElapsed(playing && auto, step * count, { loop: true })
  const single = useElapsed(playing && !auto, step, {
    resetKey: picked ?? 0,
  })

  const active = auto
    ? Math.min(count - 1, Math.floor(total / step))
    : (picked ?? 0)
  const t = auto ? total - active * step : single

  return { active, t, auto, select: setPicked }
}

// The part of `text` typed so far, at `cps` characters a second from `start`
function typed(text: string, t: number, start: number, cps = 40) {
  return text.slice(0, Math.max(0, Math.floor((t - start) * cps)))
}

// The italic serif accent used in headlines
function Accent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <em
      className={cn(
        "font-serif text-[1.12em] leading-none font-normal tracking-normal italic",
        className
      )}
    >
      {children}
    </em>
  )
}

export { Accent, MarketingMotion, Reveal, typed, useAutoCycle, useElapsed }
