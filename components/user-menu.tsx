"use client"

import { UserButton } from "@clerk/nextjs"
import { BlocksIcon, GaugeIcon, ListChecksIcon } from "lucide-react"

// A client component, since a server component can't reach UserButton.MenuItems
export function UserMenu() {
  return (
    <UserButton
      showName
      appearance={{
        elements: {
          rootBox: "min-w-0!",
          userButtonTrigger:
            "static! min-w-0! after:absolute after:inset-0 focus:shadow-none!",
          userButtonBox: "min-w-0! flex-row-reverse! gap-2!",
          userButtonAvatarBox: "size-8! rounded-lg!",
          userButtonOuterIdentifier:
            "truncate! ps-0! text-sm! font-medium! text-inherit! group-data-[collapsible=icon]:hidden!",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Apps"
          labelIcon={<BlocksIcon className="size-4" />}
          href="/apps"
        />
        <UserButton.Link
          label="Tasks"
          labelIcon={<ListChecksIcon className="size-4" />}
          href="/tasks"
        />
        <UserButton.Link
          label="Usage"
          labelIcon={<GaugeIcon className="size-4" />}
          href="/usage"
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
