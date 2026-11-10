import type { NextRequest } from "next/server"

// noVNC's page and scripts, fetched from a sandbox's signed preview URL with
// the header that skips Daytona's "Preview URL Warning" page. An iframe can't
// send headers, so it loads the page from here instead. The screen itself
// streams over a WebSocket straight to Daytona, which never shows the warning.
//
// The host carries the signed token, so holding it is the permission and
// there's no sign-in check. The sandboxed frame sends no cookies anyway.

// Only noVNC on a Daytona preview host, so this can't fetch anything else
const HOST = /^6080-[a-z0-9]+\.daytonaproxy\d+\.net$/

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/desktop/[host]/[...path]">
) {
  const { host, path } = await ctx.params
  if (!HOST.test(host)) return new Response("Not found", { status: 404 })

  const upstream = new URL(
    `https://${host}/${path.map(encodeURIComponent).join("/")}`
  )
  upstream.search = request.nextUrl.search

  let response: Response
  try {
    response = await fetch(upstream, {
      headers: { "X-Daytona-Skip-Preview-Warning": "true" },
      cache: "no-store",
    })
  } catch {
    return new Response("Couldn't reach the desktop", { status: 502 })
  }

  const headers = new Headers({
    // The sandbox is the bot's to change, so what it serves never runs with
    // this app's origin: an opaque origin can't read Arlo's cookies or pages
    "Content-Security-Policy": "sandbox allow-scripts allow-pointer-lock",
    // The opaque origin loads noVNC's module scripts and JSON with CORS
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=300",
  })
  const contentType = response.headers.get("Content-Type")
  if (contentType) headers.set("Content-Type", contentType)

  return new Response(response.body, { status: response.status, headers })
}
