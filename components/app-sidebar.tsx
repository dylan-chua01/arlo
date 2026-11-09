import { formatDistanceToNowStrict } from "date-fns"
import Link from "next/link"

import { ChatMenuButton } from "@/components/chat-menu-button"
import { CreateMenu } from "@/components/create-menu"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { LogoMark } from "@/components/logo"
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
import { UserMenu } from "@/components/user-menu"
import { getBots } from "@/queries/bots"
import { getChats } from "@/queries/chats"

export async function AppSidebar() {
  const [chats, bots] = await Promise.all([getChats(), getBots()])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
            <SidebarMenuButton
              render={<Link href="/" />}
              tooltip="Arlo"
              className="flex-1 hover:bg-transparent active:bg-transparent"
            >
              <LogoMark className="size-5!" />
              <span className="text-base font-semibold tracking-tight">
                Arlo
              </span>
            </SidebarMenuButton>
            <CreateMenu bots={bots} />
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
                    tooltip={chat.name ?? chat.bots[0]?.name}
                  >
                    <GroupChatAvatar
                      seeds={chat.bots.map((bot) => bot.avatar)}
                    />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {chat.name ?? chat.bots[0]?.name}
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
              <UserMenu />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
