import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

// The signed-in user's chats, most recent first, each with its first bot
export async function getChats() {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return []

  const rows = await db.query.chats.findMany({
    where: (chats, { eq }) => eq(chats.userId, userId),
    orderBy: (chats, { desc }) => [desc(chats.lastMessageAt)],
    with: {
      members: {
        orderBy: (members, { asc }) => [asc(members.joinedAt)],
        limit: 1,
        with: { bot: true },
      },
    },
  })

  return rows.map(({ members, ...chat }) => ({
    ...chat,
    // Direct chats have exactly one bot; group chats fall back to the first
    bot: members[0]?.bot ?? null,
  }))
}
