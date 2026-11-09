"use client"

import { useState, useSyncExternalStore } from "react"
import { UserButton } from "@clerk/nextjs"
import {
  BellIcon,
  BellOffIcon,
  BellRingIcon,
  BlocksIcon,
  GaugeIcon,
  ListChecksIcon,
} from "lucide-react"

import {
  desktopPermission,
  getNotificationsEnabled,
  playChime,
  requestDesktopPermission,
  setNotificationsEnabled,
  subscribeToNotificationsEnabled,
} from "@/lib/notify"

// A client component, since a server component can't reach UserButton.MenuItems
export function UserMenu() {
  const notifications = useSyncExternalStore(
    subscribeToNotificationsEnabled,
    getNotificationsEnabled,
    // Off on the server, so the menu doesn't offer to turn them off before
    // the browser has said whether they're on
    () => false
  )
  // Not something the browser reports changes to, so read again after asking
  const [permission, setPermission] = useState(() =>
    typeof window === "undefined" ? "default" : desktopPermission()
  )

  async function allowDesktop() {
    setPermission(await requestDesktopPermission())
  }

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
        {notifications && permission === "default" && (
          <UserButton.Action
            label="Allow desktop notifications"
            labelIcon={<BellRingIcon className="size-4" />}
            onClick={allowDesktop}
          />
        )}
        {notifications ? (
          <UserButton.Action
            label="Turn off notifications"
            labelIcon={<BellOffIcon className="size-4" />}
            onClick={() => setNotificationsEnabled(false)}
          />
        ) : (
          <UserButton.Action
            label="Turn on notifications"
            labelIcon={<BellIcon className="size-4" />}
            onClick={() => {
              setNotificationsEnabled(true)
              // So they know what it sounds like
              playChime()
              void allowDesktop()
            }}
          />
        )}
      </UserButton.MenuItems>
    </UserButton>
  )
}
