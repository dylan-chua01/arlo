import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export default clerkMiddleware(async (auth, req) => {
  // / is the app for signed-in people and the landing page for everyone else.
  // A rewrite keeps the URL as / while showing /welcome.
  if (req.nextUrl.pathname === "/") {
    const { isAuthenticated } = await auth()
    if (!isAuthenticated) {
      return NextResponse.rewrite(new URL("/welcome", req.url))
    }
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's production proxy on *.vercel.app serves its .js files from here.
    "/__clerk/(.*)",
  ],
}
