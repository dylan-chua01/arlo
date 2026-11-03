import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

// The signed-in user's chats, most recent first, each with its bots in join order
export async function getChats() {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return []

  const rows = await db.query.chats.findMany({
    where: (chats, { eq }) => eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.lastMessageAt)],
    with: {
      members: {
        orderBy: (members, { asc }) => [asc(members.joinedAt)],
        with: { bot: true },
      },
    },
  })

  return rows.map(({ members, ...chat }) => ({
    ...chat,
    // Direct chats have exactly one bot; group chats have several
    bots: members.map((member) => member.bot),
  }))
}

// One of the signed-in user's chats with its bots, or null if it isn't theirs
export async function getChat(chatId: string) {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return null

  const row = await db.query.chats.findFirst({
    where: (chats, { and, eq }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        orderBy: (members, { asc }) => [asc(members.joinedAt)],
        with: { bot: true },
      },
    },
  })
  if (!row) return null

  const { members, ...chat } = row
  return {
    ...chat,
    // Direct chats have exactly one bot; group chats have several
    bots: members.map((member) => member.bot),
  }
}
