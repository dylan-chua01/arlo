import { Show } from "@clerk/nextjs"
import Link from "next/link"

import { Logo } from "@/components/logo"
import { MobileNav } from "@/components/marketing/mobile-nav"
import {
  LANDING_PATH,
  navLinks,
  SIGN_UP_HREF,
} from "@/components/marketing/site-nav"
import { Button } from "@/components/ui/button"

function AccountButtons() {
  return (
    <>
      <Show when="signed-out">
        <Button
          variant="ghost"
          render={<Link href="/sign-in" />}
          nativeButton={false}
        >
          Sign in
        </Button>
        <Button render={<Link href={SIGN_UP_HREF} />} nativeButton={false}>
          Get started
        </Button>
      </Show>
      <Show when="signed-in">
        <Button render={<Link href="/" />} nativeButton={false}>
          Open Arlo
        </Button>
      </Show>
    </>
  )
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href={LANDING_PATH} aria-label="Arlo home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto hidden items-center gap-2 md:flex">
          <AccountButtons />
        </div>
        <div className="ms-auto md:hidden">
          <MobileNav>
            <AccountButtons />
          </MobileNav>
        </div>
      </div>
    </header>
  )
}

export { SiteHeader }
