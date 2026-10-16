import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="has-focus-visible:ring-2"
            >
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
                      "truncate! ps-0! text-sm! font-medium! text-inherit!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
