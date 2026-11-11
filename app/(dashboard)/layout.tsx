import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { MobileTopBar } from "@/components/mobile-top-bar"
import { TaskNotifications } from "@/components/task-notifications"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <MobileTopBar />
        {children}
      </SidebarInset>
      <TaskNotifications />
    </SidebarProvider>
  )
}
