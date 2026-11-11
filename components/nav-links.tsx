"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BlocksIcon, ListChecksIcon } from "lucide-react"

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

const links = [
  { href: "/tasks", label: "Tasks", icon: ListChecksIcon },
  { href: "/apps", label: "Apps", icon: BlocksIcon },
]

// Pages that aren't chats, kept in the sidebar so they're one click away
export function NavLinks() {
  const pathname = usePathname()

  return links.map((link) => {
    const isActive =
      pathname === link.href || pathname.startsWith(`${link.href}/`)
    return (
      <SidebarMenuItem key={link.href}>
        <SidebarMenuButton
          tooltip={link.label}
          isActive={isActive}
          render={
            <Link
              href={link.href}
              aria-current={isActive ? "page" : undefined}
            />
          }
        >
          <link.icon />
          <span>{link.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  })
}
