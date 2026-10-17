import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"

import { ChatAvatar } from "@/components/chat-avatar"
import { ChatMenuButton } from "@/components/chat-menu-button"
import { CreateMenu } from "@/components/create-menu"
import { SearchCommand } from "@/components/search-command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getChats } from "@/queries/chats"

export async function AppSidebar() {
  const chats = await getChats()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-end">
            <CreateMenu />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SearchCommand chats={chats} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:gap-2">
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <ChatMenuButton
                    chatId={chat.id}
                    tooltip={chat.name ?? chat.bot?.name}
                  >
                    <ChatAvatar seed={chat.bot?.avatar ?? chat.id} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {chat.name ?? chat.bot?.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(chat.lastMessageAt)}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {chat.lastMessagePreview}
                      </span>
                    </div>
                  </ChatMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
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
                      "truncate! ps-0! text-sm! font-medium! text-inherit! group-data-[collapsible=icon]:hidden!",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
