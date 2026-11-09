import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page"
import { LANDING_PATH } from "@/components/marketing/site-nav"
import {
  LEGAL_COUNTRY,
  LEGAL_EMAIL,
  LEGAL_ENTITY,
  MINIMUM_AGE,
} from "@/lib/legal"

export const metadata: Metadata = {
  title: "Terms and Conditions | Arlo",
  description: `The terms that apply when you use Arlo, provided by ${LEGAL_ENTITY}.`,
}

const email = <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "About these terms",
    content: (
      <>
        <p>
          These Terms and Conditions (the &quot;Terms&quot;) are a contract
          between you and <strong>{LEGAL_ENTITY}</strong>, based in{" "}
          {LEGAL_COUNTRY} (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
          They apply when you use the Arlo website and app (the
          &quot;Service&quot;).
        </p>
        <p>
          By creating an account or using the Service, you agree to these Terms
          and to our <Link href="/privacy">Privacy Policy</Link>. If you do not
          agree, please do not use the Service.
        </p>
        <p>
          If you use the Service for a company or other organisation, you
          confirm that you are allowed to accept these Terms for it, and
          &quot;you&quot; includes that organisation.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Arlo",
    content: (
      <p>
        You must be at least {MINIMUM_AGE} years old and able to form a binding
        contract to use the Service. You may not use it if the law forbids you
        from doing so, or if we have previously closed your account for breaking
        these Terms.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    content: (
      <ul>
        <li>Give us accurate information and keep it up to date.</li>
        <li>
          Keep your sign-in details safe. You are responsible for everything
          that happens under your account.
        </li>
        <li>
          Tell us straight away at {email} if you think someone has used your
          account without permission.
        </li>
        <li>
          Accounts are for one person and cannot be shared or transferred.
        </li>
      </ul>
    ),
  },
  {
    id: "service",
    title: "The Service",
    content: (
      <>
        <p>
          Arlo lets you create AI bots, each with its own cloud computer (a
          &quot;sandbox&quot;), chat with them alone or in groups, connect them
          to other apps, and schedule tasks for them to carry out.
        </p>
        <p>
          We are always improving Arlo, so features may be added, changed or
          removed. If we remove something important to a paid plan, we will give
          you reasonable notice. We aim to keep the Service available, but we do
          not promise that it will always be available, uninterrupted or free of
          errors.
        </p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, billing and cancellation",
    content: (
      <>
        <ul>
          <li>
            <strong>Free accounts</strong> can sign in and look around. Creating
            bots and using sandboxes needs a paid plan.
          </li>
          <li>
            <strong>Paid plans</strong> are monthly subscriptions, billed in US
            dollars in advance through Clerk Billing and Stripe. The current
            prices and allowances are shown on our{" "}
            <Link href={`${LANDING_PATH}#pricing`}>pricing section</Link>.
          </li>
          <li>
            <strong>Renewal:</strong> your subscription renews automatically
            each month, and your payment method is charged, until you cancel.
          </li>
          <li>
            <strong>Allowances:</strong> each plan includes a monthly amount of
            AI usage, computer time and connected apps. Unused allowances do not
            carry over. When an allowance runs out, the features that use it
            stop until it resets or you upgrade.
          </li>
          <li>
            <strong>Changing plans:</strong> upgrades take effect straight away
            and keep the usage you have already counted that month. Downgrades
            take effect at the end of your current billing period.
          </li>
          <li>
            <strong>Cancelling:</strong> you can cancel at any time from your
            account. You keep access to your paid plan until the end of the
            period you have paid for.
          </li>
          <li>
            <strong>Refunds:</strong> payments are non-refundable, including for
            partly used periods, except where the law requires a refund or we
            decide otherwise.
          </li>
          <li>
            <strong>Price changes:</strong> we will tell you at least 30 days
            before a price change applies to your subscription. If you do not
            agree, you can cancel before it takes effect.
          </li>
          <li>
            <strong>Taxes:</strong> prices do not include taxes unless we say
            so. You are responsible for any taxes that apply.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    content: (
      <>
        <p>
          &quot;Your content&quot; means everything you put into the Service,
          such as messages, files, bot instructions and task details, and
          everything your bots produce for you, such as replies, files and
          sandbox work.
        </p>
        <p>
          You own your content. You give us a limited, worldwide licence to
          store, copy, process and transmit it only as needed to run, secure and
          support the Service for you, including sending it to our service
          providers as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. This licence ends when
          your content is deleted from the Service.
        </p>
        <p>
          You are responsible for your content, and you confirm that you have
          the rights you need to share it with us and to have the Service
          process it.
        </p>
      </>
    ),
  },
  {
    id: "bots",
    title: "Bots, sandboxes and connected apps",
    content: (
      <>
        <ul>
          <li>
            <strong>You direct your bots.</strong> Bots act on your
            instructions, including tasks that run on a schedule or in the
            background. You are responsible for what they do on your behalf,
            including anything they send, post, change or delete in apps you
            have connected. Give bots only the access they need, and check
            important actions before you approve them.
          </li>
          <li>
            <strong>Sandboxes are working space, not storage.</strong> They turn
            off when idle and may be reset or lost. Keep your own copies of
            anything important. Deleting a bot permanently deletes its sandbox,
            files and chat.
          </li>
          <li>
            <strong>Connected apps belong to someone else.</strong> When you
            connect an app, its own terms and privacy policy apply to your use
            of it. We are not responsible for third-party apps or for changes
            they make that affect the Service.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>
          You must not use the Service, or direct a bot or sandbox, to do any of
          the following:
        </p>
        <ul>
          <li>break any law, or help anyone else to;</li>
          <li>
            infringe anyone&apos;s intellectual property, privacy or other
            rights;
          </li>
          <li>
            create, store or share content that sexually exploits children,
            promotes violence or terrorism, or harasses, threatens or defames
            anyone;
          </li>
          <li>send spam, run scams or phishing, or impersonate anyone;</li>
          <li>
            create or spread malware, or attack, probe or get unauthorised
            access to any system, network or account;
          </li>
          <li>
            mine cryptocurrency, run proxies or put an unreasonable load on our
            infrastructure;
          </li>
          <li>
            get around usage limits, plan restrictions or security measures, or
            use more than one account to do so;
          </li>
          <li>
            resell, sublicense or provide the Service to others without our
            written permission;
          </li>
          <li>
            copy, reverse engineer or scrape the Service, or use it to build a
            competing product;
          </li>
          <li>break the usage policies of our AI model providers.</li>
        </ul>
      </>
    ),
  },
  {
    id: "ai-output",
    title: "AI output",
    content: (
      <>
        <p>
          Bot replies and work are produced by AI. They may be inaccurate,
          incomplete or inappropriate, and other people may receive similar
          output. AI output is not professional advice, including legal,
          medical, financial or tax advice.
        </p>
        <p>
          You are responsible for checking AI output before you use or rely on
          it, and for how you use it.
        </p>
      </>
    ),
  },
  {
    id: "our-rights",
    title: "Our intellectual property",
    content: (
      <>
        <p>
          The Service, including its software, design, logo and the Arlo name,
          belongs to us and our licensors. These Terms give you a limited,
          non-exclusive, non-transferable right to use the Service while your
          account is open. They do not give you any other rights in it.
        </p>
        <p>
          If you send us feedback or suggestions, we may use them freely and
          without paying you.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and closing your account",
    content: (
      <>
        <p>
          You can stop using the Service at any time. To close your account and
          have your data deleted, email {email}.
        </p>
        <p>
          We may suspend or close your account, or limit what it can do, if you
          break these Terms, if your use creates a risk or legal problem for us
          or others, or if a payment fails. Where it is reasonable, we will warn
          you first and give you a chance to fix the problem.
        </p>
        <p>
          When your account closes, your right to use the Service ends and we
          may delete your content. Sections that by their nature should
          continue, such as payment obligations, disclaimers, limits of
          liability and governing law, continue to apply.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <p>
        To the extent the law allows, the Service is provided &quot;as is&quot;
        and &quot;as available&quot;, without warranties of any kind, whether
        express or implied, including warranties of merchantability, fitness for
        a particular purpose, accuracy and non-infringement.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limits of our liability",
    content: (
      <>
        <p>To the extent the law allows:</p>
        <ul>
          <li>
            we are not liable for any indirect, incidental, special or
            consequential loss, or for loss of profits, revenue, data or
            goodwill, arising from or related to the Service or these Terms;
          </li>
          <li>
            we are not liable for actions your bots take on your instructions,
            for AI output, or for third-party apps and services;
          </li>
          <li>
            our total liability for all claims about the Service or these Terms
            is limited to the greater of the amount you paid us in the 12 months
            before the claim arose, or US$100.
          </li>
        </ul>
        <p>
          Nothing in these Terms limits liability that cannot be limited by law,
          such as liability for fraud, or for death or personal injury caused by
          negligence.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    content: (
      <p>
        You agree to compensate us for reasonable losses, costs and claims
        (including reasonable legal fees) that arise from your content, your use
        of the Service, the actions your bots take for you, or your breach of
        these Terms or of the law.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law and disputes",
    content: (
      <>
        <p>
          These Terms are governed by the laws of {LEGAL_COUNTRY}. If a dispute
          arises, please contact us first at {email} so we can try to resolve it
          informally.
        </p>
        <p>
          If we cannot resolve it within 30 days, the courts of {LEGAL_COUNTRY}{" "}
          have exclusive jurisdiction, unless the law where you live gives you
          the right to bring a claim in your local courts.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: (
      <p>
        We may update these Terms from time to time. We will change the date at
        the top of this page, and if a change is significant we will tell you by
        email or in the app at least 14 days before it takes effect. If you keep
        using the Service after a change takes effect, you accept the updated
        Terms. If you do not agree, stop using the Service and cancel your
        subscription.
      </p>
    ),
  },
  {
    id: "general",
    title: "General",
    content: (
      <ul>
        <li>
          These Terms and our Privacy Policy are the whole agreement between you
          and us about the Service.
        </li>
        <li>
          If any part of these Terms cannot be enforced, the rest still applies.
        </li>
        <li>
          If we do not enforce a right straight away, we have not given it up.
        </li>
        <li>
          You may not transfer your rights under these Terms without our
          consent. We may transfer ours as part of a merger, sale or
          reorganisation.
        </li>
        <li>
          We are not responsible for delays or failures caused by events beyond
          our reasonable control.
        </li>
      </ul>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    content: (
      <p>
        Questions about these Terms? Email {email} or use our{" "}
        <Link href="/contact">contact form</Link>.
      </p>
    ),
  },
]

export default function Page() {
  return (
    <LegalPage
      title="Terms and Conditions"
      summary={
        <div className="flex flex-col gap-2">
          <p className="font-medium">The short version</p>
          <p className="text-muted-foreground">
            You must be {MINIMUM_AGE} or over. You own what you create, and
            you&apos;re responsible for what your bots do on your instructions.
            Plans renew monthly and you can cancel any time, keeping access
            until the period ends. Don&apos;t use Arlo for anything illegal or
            harmful. AI can make mistakes, so check its work. These Terms follow
            the laws of {LEGAL_COUNTRY}.
          </p>
        </div>
      }
      sections={sections}
    />
  )
}
