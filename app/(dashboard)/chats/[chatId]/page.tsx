import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader } from "@/components/chat-header"
import { getChat } from "@/queries/chats"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  await auth.protect()

  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  return (
    <div className="flex min-h-svh flex-col">
      <ChatHeader
        name={chat.name ?? chat.bot?.name ?? "Chat"}
        avatar={chat.bot?.avatar ?? chat.id}
        bot={chat.bot}
      />
    </div>
  )
}
