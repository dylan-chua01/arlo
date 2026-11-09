import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatFilesProvider, ChatFilesTrigger } from "@/components/chat-files"
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
      <ChatFilesProvider>
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
          >
            <ChatFilesTrigger className="ms-auto text-muted-foreground" />
          </ChatHeader>
          <Chat key={chat.id} id={chat.id} name={name} bots={chat.bots} />
        </div>
      </ChatFilesProvider>
    )
  }

  const bot = chat.bots[0] ?? null

  return (
    // Open from the start, so you can watch the bot work without asking to
    <DesktopPanelProvider defaultOpen>
      <ChatFilesProvider>
        {/* The group's inline height: 100% beats a class, so its parent sets the height */}
        <div className="h-svh">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel minSize="30%" className="flex flex-col">
              <ChatHeader name={name} avatars={avatars} bot={bot}>
                <div className="ms-auto flex items-center gap-1">
                  <ChatFilesTrigger className="text-muted-foreground" />
                  <DesktopPanelTrigger />
                </div>
              </ChatHeader>
              <Chat key={chat.id} id={chat.id} name={name} />
            </ResizablePanel>
            <ResizableHandle />
            <DesktopPanel bot={bot} defaultSize="45%" minSize="30%" />
          </ResizablePanelGroup>
        </div>
      </ChatFilesProvider>
    </DesktopPanelProvider>
  )
}
