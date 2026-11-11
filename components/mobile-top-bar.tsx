"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { LogoMark } from "@/components/logo"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"

// On phones the sidebar is a drawer, so pages need a button to open it.
// Chat pages put that button in their own header instead.
export function MobileTopBar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Picking a chat or page in the drawer should close it
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  if (pathname.startsWith("/chats/")) return null

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
      <SidebarTrigger className="-ms-1.5 text-muted-foreground" />
      <Link
        href="/"
        className="flex items-center gap-2 text-base font-semibold tracking-tight"
      >
        <LogoMark className="size-5" />
        Arlo
      </Link>
    </header>
  )
}
