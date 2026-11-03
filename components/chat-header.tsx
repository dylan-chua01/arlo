import { BotDialog } from "@/components/bot-dialog"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { Bot } from "@/lib/db/schema"

export function ChatHeader({
  name,
  avatars,
  bot,
  children,
}: {
  name: string
  // One seed per bot in the chat
  avatars: string[]
  // Makes the title a button that opens the bot's edit dialog
  bot?: Bot | null
  // Actions at the end of the header
  children?: React.ReactNode
}) {
  const title = (
    <>
      <GroupChatAvatar seeds={avatars} className="size-5" />
      <span className="truncate">{name}</span>
    </>
  )

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
      <h1 className="flex min-w-0 items-center gap-2 text-sm font-medium">
        {bot ? (
          <BotDialog bot={bot}>
            <Button variant="ghost" size="sm" className="-ms-2.5 min-w-0 gap-2">
              {title}
            </Button>
          </BotDialog>
        ) : (
          title
        )}
      </h1>
      {children}
    </header>
  )
}
