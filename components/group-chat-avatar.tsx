import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

// Where each item sits inside the square, by how many are shown
const layouts = [
  [],
  ["inset-0 size-full"],
  // Side by side, overlapping in the middle
  [
    "top-1/2 left-0 size-[62%] -translate-y-1/2",
    "top-1/2 right-0 size-[62%] -translate-y-1/2",
  ],
  // A triangle: one on top, two below
  [
    "top-0 left-1/4 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
  // A 2x2 grid
  [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
]

const MAX_FACES = 3

// Takes the same box as a single ChatAvatar, so swapping one for the other
// never shifts the layout
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  // A fourth face would be too small to read, so the rest become a count
  const faces = seeds.length > MAX_FACES + 1 ? seeds.slice(0, MAX_FACES) : seeds
  const rest = seeds.length - faces.length
  const slots = layouts[faces.length + (rest > 0 ? 1 : 0)]

  return (
    <div
      className={cn("@container relative size-8 shrink-0", className)}
      aria-hidden
    >
      {faces.map((seed, i) => (
        <ChatAvatar key={i} seed={seed} className={cn("absolute", slots[i])} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[30cqw] leading-none font-medium text-muted-foreground tabular-nums",
            slots[MAX_FACES]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
