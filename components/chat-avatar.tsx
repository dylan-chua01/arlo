import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import moods from "@dicebear/styles/moods.json" with { type: "json" }
import { cn } from "cn"

const style = new Style(moods)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const src = new Avatar(style, {
    seed,
    tags: animated ? ["animation"] : undefined,
  }).toDataUri()

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
