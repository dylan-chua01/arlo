"use client"

import * as React from "react"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"

function CreateMenu() {
  // The dialog lives outside the menu so it stays mounted after the menu closes
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)

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
          <DropdownMenuItem>
            <UsersIcon />
            Create group chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
    </>
  )
}

export { CreateMenu }
