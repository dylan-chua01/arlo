import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
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

  return (
    <DesktopPanelProvider>
      {/* The group's inline height: 100% beats a class, so its parent sets the height */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel minSize="30%" className="flex flex-col">
            <ChatHeader
              name={chat.name ?? chat.bot?.name ?? "Chat"}
              avatar={chat.bot?.avatar ?? chat.id}
              bot={chat.bot}
            />
            <Chat key={chat.id} id={chat.id} />
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel bot={chat.bot} defaultSize="0%" minSize="30%" />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
