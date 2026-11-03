import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import {
  DesktopPanel,
  DesktopPanelProvider,
  DesktopPanelTrigger,
} from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getChat } from "@/queries/chats"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  await auth.protect()

  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  const name = chat.name ?? chat.bots[0]?.name ?? "Chat"
  const avatars = chat.bots.map((bot) => bot.avatar)

  // Several sandboxes, so no one desktop to show
  if (chat.kind === "group") {
    return (
      <div className="flex h-svh flex-col">
        <ChatHeader name={name} avatars={avatars} />
        <Chat key={chat.id} id={chat.id} bots={chat.bots} />
      </div>
    )
  }

  const bot = chat.bots[0] ?? null

  return (
    <DesktopPanelProvider>
      {/* The group's inline height: 100% beats a class, so its parent sets the height */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel minSize="30%" className="flex flex-col">
            <ChatHeader name={name} avatars={avatars} bot={bot}>
              <DesktopPanelTrigger />
            </ChatHeader>
            <Chat key={chat.id} id={chat.id} />
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel bot={bot} defaultSize="0%" minSize="30%" />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
