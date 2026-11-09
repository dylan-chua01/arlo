import Link from "next/link"

import { SectionHeading } from "@/components/marketing/features"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs: { question: string; answer: React.ReactNode }[] = [
  {
    question: "What is Arlo?",
    answer:
      "Arlo lets you create AI bots that work like teammates. Each bot has a name, a job, a memory and its own cloud computer, so it can run code, browse, make files and work in your apps, not just answer questions.",
  },
  {
    question: "What is a bot's computer, and what is computer time?",
    answer:
      "Every bot gets its own private sandbox: a cloud computer with a desktop you can open to watch it work. Computer time only counts while that computer is running. It turns itself off after 10 minutes with nothing to do, and starts again when the bot is needed.",
  },
  {
    question: "What counts as AI usage?",
    answer:
      "AI usage is what your bots' replies cost to generate, plus the small cost of deciding which bot answers in a group chat. Each plan includes a dollar amount every month, and you can see how much you've used at any time on your Usage page.",
  },
  {
    question: "Which apps can bots connect to?",
    answer:
      "Gmail, Slack, Google Calendar, GitHub, Notion, Google Sheets and many more. You connect an app once on the Apps page, and your bots can use it from then on. Your plan sets how many apps can be connected at the same time.",
  },
  {
    question: "Can bots work while I'm away?",
    answer:
      "Yes. You can schedule a task to repeat, like every weekday at 9:00, or start one in the background. You'll hear a chime and get a desktop notification when a bot replies or a task finishes.",
  },
  {
    question: "Do bots remember things?",
    answer:
      "Yes. Each bot keeps a private list of notes that follows it into every chat it's in, so something you tell it once, it remembers next time. Files it makes stay on its computer, so it can pick up where it left off.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "You can create an account for free and look around, but creating bots needs a paid plan, because every bot comes with its own computer.",
  },
  {
    question: "What happens if I use up my plan?",
    answer:
      "Your bots stop replying and scheduled tasks stop running until your allowance resets at the start of your next billing month. If you need more sooner, upgrade: the new limits apply right away and what you've already used carries over.",
  },
  {
    question: "Can I change or cancel my plan?",
    answer:
      "Yes, any time from your account. Upgrades start right away. Downgrades and cancellations take effect when your current billing period ends, so you keep what you've paid for.",
  },
  {
    question: "What happens to a bot's data when I delete it?",
    answer:
      "Deleting a bot also deletes its computer, its files and its chat. This can't be undone.",
  },
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t bg-muted/40 py-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you need to know before you start."
        />
        <Accordion className="rounded-2xl border bg-card px-6">
          {faqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="py-4 text-base">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-center text-sm text-muted-foreground">
          Still have a question?{" "}
          <Link
            href="/contact"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Get in touch
          </Link>
        </p>
      </div>
    </section>
  )
}

export { Faq }
