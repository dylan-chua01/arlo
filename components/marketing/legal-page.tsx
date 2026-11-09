import Link from "next/link"

import { LEGAL_UPDATED } from "@/lib/legal"

export type LegalSection = {
  id: string
  title: string
  content: React.ReactNode
}

// Shared layout for the privacy policy and the terms: a heading, a summary,
// a table of contents that sticks on wide screens, and numbered sections
function LegalPage({
  title,
  summary,
  sections,
}: {
  title: string
  summary: React.ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="text-sm font-medium text-brand">Legal</p>
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated {LEGAL_UPDATED}
        </p>
      </div>
      <div className="mt-12 grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-1 text-sm">
            <p className="mb-2 font-medium">On this page</p>
            {sections.map((section, index) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className="rounded-md py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {index + 1}. {section.title}
              </Link>
            ))}
          </div>
        </nav>
        <article className="flex max-w-3xl min-w-0 flex-col gap-10 text-[0.95rem] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul,&_ol]:flex [&_ul,&_ol]:flex-col [&_ul,&_ol]:gap-1.5">
          <div className="rounded-2xl border bg-muted/40 p-6 text-foreground">
            {summary}
          </div>
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="flex scroll-mt-24 flex-col gap-4"
            >
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {index + 1}. {section.title}
              </h2>
              {section.content}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}

export { LegalPage }
