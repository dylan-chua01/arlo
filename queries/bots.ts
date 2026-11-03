import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

// The signed-in user's bots, oldest first, with just what a picker shows
export async function getBots() {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return []

  return db.query.bots.findMany({
    where: (bots, { eq }) => eq(bots.userId, userId),
    orderBy: (bots, { asc }) => [asc(bots.createdAt)],
    columns: { id: true, name: true, avatar: true },
  })
}
