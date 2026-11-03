"use client"

import * as React from "react"
import { useAuth } from "@clerk/nextjs"
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
import { useUpgradeToast } from "@/hooks/use-upgrade-toast"
import { BOTS, SANDBOXES } from "@/lib/billing"
import type { Bot } from "@/lib/db/schema"

function CreateMenu({ bots }: { bots: Pick<Bot, "id" | "name" | "avatar">[] }) {
  // The dialogs live outside the menu so they stay mounted after the menu closes
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupChatDialogOpen, setGroupChatDialogOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const { has } = useAuth()
  const showUpgradeToast = useUpgradeToast()

  // Everything in the menu needs bots, so free users get the upgrade toast instead
  function handleMenuOpenChange(open: boolean) {
    if (open && !(has?.({ feature: BOTS }) && has?.({ feature: SANDBOXES }))) {
      showUpgradeToast("Upgrade to create")
      return
    }
    setMenuOpen(open)
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
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
