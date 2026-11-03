"use client"

import * as React from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import type { Bot } from "@/lib/db/schema"

function CreateMenu({ bots }: { bots: Pick<Bot, "id" | "name" | "avatar">[] }) {
  // The dialogs live outside the menu so they stay mounted after the menu closes
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupChatDialogOpen, setGroupChatDialogOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              tooltip="Create"
              aria-label="Create"
              className="size-8"
            />
          }
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
            <PlusIcon />
            Create new bot
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setGroupChatDialogOpen(true)}>
            <UsersIcon />
            Create group chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
      <GroupChatDialog
        bots={bots}
        open={groupChatDialogOpen}
        onOpenChange={setGroupChatDialogOpen}
      />
    </>
  )
}

export { CreateMenu }
