"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { SidebarMenuButton } from "@/components/ui/sidebar"

export function ChatMenuButton({
  chatId,
  tooltip,
  children,
}: {
  chatId: string
  tooltip?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const href = `/chats/${chatId}`
  const isActive = pathname === href

  return (
    <SidebarMenuButton
      size="lg"
      tooltip={tooltip}
      isActive={isActive}
      render={
        <Link href={href} aria-current={isActive ? "page" : undefined} />
      }
    >
      {children}
    </SidebarMenuButton>
  )
}
