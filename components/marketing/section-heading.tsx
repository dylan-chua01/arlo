import { Reveal } from "@/components/marketing/motion"

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: React.ReactNode
  description: string
}) {
  return (
    <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p className="text-sm font-medium text-brand">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </h2>
      <p className="text-pretty text-muted-foreground">{description}</p>
    </Reveal>
  )
}

export { SectionHeading }
