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
import { getBots } from "@/queries/bots"
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
    const bots = await getBots()

    return (
      <div className="flex h-svh flex-col">
        <ChatHeader
          name={name}
          avatars={avatars}
          group={{
            chat: {
              id: chat.id,
              name: chat.name,
              botIds: chat.bots.map((bot) => bot.id),
            },
            bots,
          }}
        />
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
