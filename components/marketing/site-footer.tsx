import Link from "next/link"

import { Logo } from "@/components/logo"
import { navLinks, SIGN_UP_HREF } from "@/components/marketing/site-nav"
import { LEGAL_ENTITY } from "@/lib/legal"

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="flex max-w-xs flex-col gap-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            AI teammates with their own computers. Chat with them, hand them
            work, and let them get on with it.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3 sm:gap-16">
          <div className="flex flex-col gap-3">
            <p className="font-medium">Product</p>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-medium">Account</p>
            <Link
              href="/sign-in"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href={SIGN_UP_HREF}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Create an account
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-medium">Legal</p>
            <Link
              href="/privacy"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms and Conditions
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {LEGAL_ENTITY}. All rights reserved.
      </div>
    </footer>
  )
}

export { SiteFooter }
