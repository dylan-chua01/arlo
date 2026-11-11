"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

// Cycles through `words`, sliding each new one up into place
function RotatingWord({
  words,
  interval = 2200,
  className,
}: {
  words: string[]
  interval?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      interval
    )
    return () => clearInterval(id)
  }, [reduce, words.length, interval])

  return (
    <span className={cn("relative inline-block", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={words[index]}
          className="inline-block"
          initial={{ opacity: 0, y: "0.5em", filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: "-0.5em", filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export { RotatingWord }
