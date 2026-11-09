import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page"
import { MAX_FILE_SIZE } from "@/lib/files"
import {
  LEGAL_COUNTRY,
  LEGAL_EMAIL,
  LEGAL_ENTITY,
  MINIMUM_AGE,
} from "@/lib/legal"

export const metadata: Metadata = {
  title: "Privacy Policy | Arlo",
  description: `How ${LEGAL_ENTITY} collects, uses and protects your personal data when you use Arlo.`,
}

const email = <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>

// Who handles personal data on our behalf, and why. Keep in step with the
// services the app actually uses.
const providers = [
  {
    name: "Clerk",
    purpose: "Sign-in, account management and subscription billing",
  },
  {
    name: "Stripe",
    purpose: "Payment processing, through Clerk Billing",
  },
  {
    name: "Neon",
    purpose:
      "Our database, which stores your account records, chats, bots, tasks and shared files, and the AI gateway that connects to AI models",
  },
  {
    name: "Databricks",
    purpose: "Infrastructure behind Neon's AI gateway",
  },
  {
    name: "Anthropic",
    purpose: "The Claude AI models that write your bots' replies",
  },
  {
    name: "Daytona",
    purpose: "The cloud computers (sandboxes) your bots work on",
  },
  {
    name: "Composio",
    purpose: "Connecting your bots to the apps you choose to link",
  },
  {
    name: "Trigger.dev",
    purpose: "Running chats, scheduled tasks and background work",
  },
  {
    name: "Sentry",
    purpose: "Error monitoring, performance monitoring and session replays",
  },
]

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <>
        <p>
          Arlo is provided by <strong>{LEGAL_ENTITY}</strong>, based in{" "}
          {LEGAL_COUNTRY} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). We
          are the organisation responsible for the personal data described in
          this policy.
        </p>
        <p>
          This policy explains what personal data we collect when you use the
          Arlo website and app (the &quot;Service&quot;), why we collect it, who
          we share it with and the choices you have. It is written to meet
          Brunei&apos;s Personal Data Protection Order, 2025, and also explains
          the rights you may have under other laws, such as the GDPR, where they
          apply to you.
        </p>
        <p>Our Data Protection Officer can be contacted at {email}.</p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    content: (
      <>
        <h3>Information you give us</h3>
        <ul>
          <li>
            <strong>Account details:</strong> your name, email address, profile
            picture and sign-in details, including details from Google or
            another provider if you sign in with one.
          </li>
          <li>
            <strong>Billing details:</strong> your plan and payment history.
            Card details are collected and stored by Stripe, not by us.
          </li>
          <li>
            <strong>What you create:</strong> your bots&apos; names, jobs and
            instructions, the messages you send, group chats, and the tasks and
            schedules you set up.
          </li>
          <li>
            <strong>Files:</strong> files you share in chats, up to{" "}
            {MAX_FILE_SIZE / 1024 / 1024} MB each.
          </li>
          <li>
            <strong>Messages to us:</strong> your name, email address and
            message when you use our contact form or email us.
          </li>
        </ul>
        <h3>Information created as you use Arlo</h3>
        <ul>
          <li>
            <strong>Bot replies and memory:</strong> the replies your bots
            write, and the notes each bot keeps so it can remember things across
            chats.
          </li>
          <li>
            <strong>Sandbox contents:</strong> the files, programs and other
            work your bots create on their cloud computers.
          </li>
          <li>
            <strong>Usage records:</strong> how much AI usage and computer time
            you use, and which apps you have connected, so we can apply your
            plan&apos;s limits.
          </li>
          <li>
            <strong>Technical data:</strong> your IP address, browser and device
            type, pages visited, errors and performance information.
          </li>
          <li>
            <strong>Session replays:</strong> for a sample of visits, and for
            visits where an error occurs, Sentry records how the page changed
            and what you clicked, so we can find and fix problems.
          </li>
        </ul>
        <h3>Information from apps you connect</h3>
        <p>
          When you connect an app such as Gmail, Slack or GitHub, you authorise
          it through Composio. Your bots can then read and act on data in that
          app when you ask them to, or when a task you set up needs it. That
          data passes through our Service and our AI providers to do the work,
          and may be saved in your chats, files or bot memory. You can
          disconnect an app at any time on the Apps page.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use your information",
    content: (
      <>
        <p>We use personal data to:</p>
        <ul>
          <li>
            create and run your account, and provide the Service you ask for,
            including bot replies, sandboxes, connected apps, scheduled tasks
            and notifications;
          </li>
          <li>
            take payments, manage your subscription and apply your plan&apos;s
            usage limits;
          </li>
          <li>reply to your questions and support requests;</li>
          <li>
            keep the Service secure, prevent abuse and enforce our{" "}
            <Link href="/terms">Terms and Conditions</Link>;
          </li>
          <li>find and fix errors, and improve how the Service works;</li>
          <li>
            send you messages about your account, billing or important changes
            to the Service;
          </li>
          <li>meet our legal obligations.</li>
        </ul>
        <p>
          We do not sell your personal data, we do not use it for advertising,
          and we do not use your content to train AI models.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "How AI processes your content",
    content: (
      <>
        <p>
          To write a reply, Arlo sends the relevant parts of your chat to an AI
          model, along with the bot&apos;s instructions and memory, files you
          have shared, and results from its sandbox or connected apps. Arlo uses
          Anthropic&apos;s Claude models, reached through Neon&apos;s AI
          gateway. In a group chat, a short summary of recent messages is also
          sent to a model to decide which bot should answer.
        </p>
        <p>
          AI replies are generated automatically and may be wrong, incomplete or
          out of date. Please check anything important before you rely on it.
        </p>
      </>
    ),
  },
  {
    id: "consent",
    title: "Consent and legal grounds",
    content: (
      <>
        <p>
          We process your personal data with your consent, which you give when
          you create an account, use the Service or contact us, after being told
          about this policy. We also process it where it is needed to provide
          the Service you signed up for, where the law requires or allows it, or
          where we have a legitimate interest, such as keeping the Service
          secure, that is not outweighed by your rights.
        </p>
        <p>
          You can withdraw your consent at any time by giving us reasonable
          notice at {email}. If you do, we may not be able to continue providing
          the Service, and we will tell you what that means for your account
          before we act on your request.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: (
      <>
        <p>
          We share personal data only with the service providers that help us
          run Arlo, under contracts that limit what they can do with it:
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">What they do for us</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.name} className="border-t">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap text-foreground">
                    {provider.name}
                  </td>
                  <td className="px-4 py-2.5">{provider.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We also share personal data:</p>
        <ul>
          <li>
            <strong>with apps you connect,</strong> when your bots act in them
            for you. Those apps handle the data under their own privacy
            policies;
          </li>
          <li>
            <strong>when the law requires it,</strong> such as in response to a
            valid legal request, or to protect the rights, safety or property of
            our users, the public or us;
          </li>
          <li>
            <strong>in a business transfer,</strong> such as a merger or sale of
            the Service, in which case we will tell you before your data becomes
            subject to a different privacy policy.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Transfers outside Brunei",
    content: (
      <p>
        Most of our service providers store and process data outside Brunei,
        mainly in the United States. We only transfer personal data to places
        with data protection laws at least as strong as Brunei&apos;s, or under
        contracts that require the recipient to protect it to that standard.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <>
        <ul>
          <li>
            <strong>Your account and content</strong> are kept while your
            account is open. Deleting a bot permanently deletes its sandbox, its
            files and its chat straight away.
          </li>
          <li>
            <strong>When you ask us to close your account,</strong> we delete
            your personal data within 30 days, except what we must keep to meet
            legal, tax or accounting obligations or to resolve disputes.
          </li>
          <li>
            <strong>Billing records</strong> are kept for as long as tax and
            accounting laws require.
          </li>
          <li>
            <strong>Contact messages</strong> are kept for as long as we need to
            deal with your request and keep a reasonable record of it.
          </li>
          <li>
            <strong>Error reports and session replays</strong> are kept by
            Sentry for a limited period and then deleted automatically.
          </li>
        </ul>
        <p>
          We stop keeping personal data once it no longer serves the purpose we
          collected it for, or any other legal or business purpose.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    content: (
      <>
        <p>We only use cookies and browser storage that the Service needs:</p>
        <ul>
          <li>
            <strong>Sign-in cookies</strong> set by Clerk, which keep you signed
            in and protect your account;
          </li>
          <li>
            <strong>A preference cookie</strong> that remembers whether the
            sidebar is open;
          </li>
          <li>
            <strong>Browser storage</strong> that remembers your notification
            settings and stops the same notification being shown twice.
          </li>
        </ul>
        <p>We do not use advertising or cross-site tracking cookies.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    content: (
      <>
        <p>
          We take reasonable steps to protect personal data from unauthorised
          access, use, change, disclosure or loss. Data is encrypted in transit,
          sign-in is handled by a dedicated provider, and each bot works on its
          own separate sandbox. No system is completely secure, though, so we
          cannot guarantee the security of your data.
        </p>
        <p>
          If a data breach causes or is likely to cause significant harm to you,
          or is of a significant scale, we will tell you and the relevant
          authorities as the law requires.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>access</strong> the personal data we hold about you, and
            find out how it has been used or disclosed in the past year;
          </li>
          <li>
            <strong>correct</strong> personal data that is wrong or incomplete;
          </li>
          <li>
            <strong>withdraw your consent</strong> to us collecting, using or
            disclosing your personal data;
          </li>
          <li>
            <strong>ask us to delete</strong> your account and personal data.
          </li>
        </ul>
        <p>
          If the GDPR or a similar law applies to you, you may also have the
          right to receive your data in a portable format, to object to or
          restrict some processing, and to complain to your local data
          protection authority.
        </p>
        <p>
          To use any of these rights, email {email} from the address on your
          account. We may need to confirm your identity first. We aim to reply
          within 30 days, and will tell you if we need longer or if an exception
          in the law applies.
        </p>
        <p>
          If you are not happy with how we handled your request, please tell us
          first so we can try to put it right. You can also complain to the
          Authority for Info-communications Technology Industry of Brunei
          Darussalam (AITI) through{" "}
          <a
            href="https://pdp.aiti.gov.bn"
            target="_blank"
            rel="noopener noreferrer"
          >
            pdp.aiti.gov.bn
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Age limit",
    content: (
      <p>
        Arlo is only for people aged {MINIMUM_AGE} or over. We do not knowingly
        collect personal data from anyone younger. If you believe someone under{" "}
        {MINIMUM_AGE} has given us personal data, please contact us and we will
        delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We may update this policy from time to time. We will change the date at
        the top of this page when we do, and if a change is significant we will
        tell you by email or in the app before it takes effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    content: (
      <p>
        For questions about this policy or your personal data, email our Data
        Protection Officer at {email} or use our{" "}
        <Link href="/contact">contact form</Link>.
      </p>
    ),
  },
]

export default function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={
        <div className="flex flex-col gap-2">
          <p className="font-medium">The short version</p>
          <p className="text-muted-foreground">
            We collect what we need to run Arlo: your account, what you create,
            and the data your bots work with. We share it only with the services
            that power Arlo, never sell it, never use it for ads, and never use
            it to train AI models. You can ask to see, correct or delete your
            data at any time.
          </p>
        </div>
      }
      sections={sections}
    />
  )
}
