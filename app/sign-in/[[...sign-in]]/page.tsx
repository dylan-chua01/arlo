import { SignIn } from "@clerk/nextjs"

import { Logo } from "@/components/logo"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <Logo />
      <SignIn />
    </div>
  )
}
