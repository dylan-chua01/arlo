import { SignUp } from "@clerk/nextjs"
import Link from "next/link"

import { Logo } from "@/components/logo"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <Logo />
      <SignUp />
      <p className="max-w-sm px-4 text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4">
          Terms and Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  )
}
