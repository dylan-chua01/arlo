// The landing page is served at / to signed-out visitors and at /welcome to
// everyone, since / is the app for signed-in people. Section links point at
// /welcome so they work from any page, signed in or not.
export const LANDING_PATH = "/welcome"

export const navLinks = [
  { href: `${LANDING_PATH}#features`, label: "Features" },
  { href: `${LANDING_PATH}#pricing`, label: "Pricing" },
  { href: `${LANDING_PATH}#faq`, label: "FAQ" },
  { href: "/contact", label: "Contact" },
]

// Sign-up sends new people straight to choosing a plan
export const SIGN_UP_HREF = "/sign-up?redirect_url=/pricing"
