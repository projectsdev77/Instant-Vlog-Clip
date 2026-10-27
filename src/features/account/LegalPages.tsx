import type { ReactNode } from 'react'
import { DEFAULT_LIMITS, GUEST_LIMITS, PRICING } from '@shared/plans.ts'
import { SitePage } from './SiteLayout'

// DRAFTS. Written from what the app actually does, as a starting point for a
// lawyer. Replace every [bracketed] placeholder and have them reviewed before
// launch; the banner below shows until LEGAL_REVIEWED is true.
const LEGAL_REVIEWED = false
const COMPANY = '[Company name]'
const CONTACT = '[contact@yourdomain.com]'
const UPDATED = '[date of last update]'

function Draft() {
  if (LEGAL_REVIEWED) return null
  return (
    <p role="note" className="mb-8 rounded-[var(--radius-card)] bg-[rgba(255,90,31,.10)] p-4 text-[14px] shadow-[inset_0_0_0_1px_rgba(255,122,61,.4)]">
      Draft for legal review. The [bracketed] parts still need filling in.
    </p>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[20px] font-bold">{title}</h2>
      <div className="space-y-3 text-[16px] leading-relaxed text-white/80">{children}</div>
    </section>
  )
}

export function TermsPage() {
  return (
    <SitePage title="Terms of Service" lead={`Last updated ${UPDATED}. These terms are between you and ${COMPANY}.`}>
      <Draft />
      <div className="space-y-10">
        <Section title="The service">
          <p>Instant Vlog Clip turns your video clips into short vlogs. Editing and exporting happen in your browser. To write scripts, plan edits, read lines aloud and make captions, the app uses AI services (see the Privacy Policy).</p>
        </Section>
        <Section title="Your account">
          <p>You can try one vlog without an account. After that you sign in with your email (or Google). Keep access to your email secure: anyone who can open the sign-in link can use your account. You must be at least [13/16] years old.</p>
        </Section>
        <Section title="Your content and the rights you need">
          <p>You keep all rights to your clips, recordings, scripts and finished vlogs. You must have the rights to everything you add: the people and places you filmed, your voice recordings, and any music you upload. Uploading music confirms you made it or have a licence to use it in your videos.</p>
          <p>Platforms such as TikTok, Instagram and YouTube may mute, claim or remove videos that use copyrighted music. That is between you and them.</p>
          <p>AI writes and voices content from what you give it. Check it before you publish: it can get details wrong. You are responsible for what you publish.</p>
        </Section>
        <Section title="Acceptable use">
          <p>Don’t use the service for anything illegal, to harass or impersonate people, to make sexual content involving minors, or to try to get around usage limits or attack the service.</p>
        </Section>
        <Section title="Plans and payment">
          <p>
            Free: {GUEST_LIMITS.generationsTotal} vlog without an account, then {DEFAULT_LIMITS.free.generationsPerDay} vlogs and {DEFAULT_LIMITS.free.revisionsPerDay} AI edits a day when signed in. Pro: {DEFAULT_LIMITS.pro.generationsPerDay} vlogs and{' '}
            {DEFAULT_LIMITS.pro.revisionsPerDay} AI edits a day, billed monthly or yearly through Stripe. Limits reset daily at midnight UTC and may change with notice.
          </p>
          <p>
            Your first Pro subscription starts with a {PRICING.trialDays}-day free trial; cancel before it ends and you won’t be charged. Subscriptions renew automatically until you cancel in your account (Manage billing). Cancelling keeps Pro until the end of
            the period you paid for. [Refund policy: e.g. no refunds for partial periods, except where the law requires.]
          </p>
        </Section>
        <Section title="Your vlogs are stored on your device">
          <p>Vlogs and clips are saved in your browser, not on our servers. Clearing your browser data deletes them. Download backups of the ones you want to keep. We can’t recover them for you.</p>
        </Section>
        <Section title="No warranty; liability">
          <p>
            The service is provided as is. [Limitation of liability and governing law for {`[jurisdiction]`}.]
          </p>
        </Section>
        <Section title="Ending your account">
          <p>You can delete your account at any time from Account. We may suspend accounts that break these terms.</p>
        </Section>
        <Section title="Contact">
          <p>{CONTACT}</p>
        </Section>
      </div>
    </SitePage>
  )
}

export function PrivacyPage() {
  return (
    <SitePage title="Privacy Policy" lead={`Last updated ${UPDATED}. ${COMPANY} runs Instant Vlog Clip. This explains what data goes where.`}>
      <Draft />
      <div className="space-y-10">
        <Section title="What stays on your device">
          <p>Your original video clips stay on the device you added them on. They are never uploaded to our servers. Making and exporting the video happens in your browser.</p>
        </Section>
        <Section title="What is saved to your account">
          <p>When you’re signed in, your drafts (the edit, your script, saved versions and small preview images), the voice audio, any song you added, and the latest finished video of each vlog are saved to your account, so you can open them on any device. Only you can see them. Deleting a vlog removes it from your account; deleting your account removes all of it. [Confirm how long saved vlogs are kept, and the space each plan includes.]</p>
          <p>When you’re signed out, everything is kept in your browser only.</p>
        </Section>
        <Section title="What is sent to AI services, and why">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b>Google Gemini</b> (or Anthropic Claude, depending on setup): a few still frames from each clip, short speech transcripts from clips, your title and script, to describe your clips, write and polish lines and plan the edit.
            </li>
            <li>
              <b>ElevenLabs</b>: your script lines, to read them aloud with an AI voice; your own voice recordings and short clip audio, to turn speech into captions.
            </li>
          </ul>
          <p>These requests pass through our server function and aren’t stored by us. Each provider handles them under its own terms. [Confirm the plans you use: paid API tiers don’t use your data to train models; Google’s free tier may.]</p>
        </Section>
        <Section title="Your account">
          <p>We keep your email address (from the sign-in link or Google), how many vlogs and AI edits you used each day, and, if you subscribe, your Stripe customer ID and subscription status. Authentication is run by Supabase.</p>
        </Section>
        <Section title="Payments">
          <p>Stripe handles payments. We never see or store your card details.</p>
        </Section>
        <Section title="Guests">
          <p>Without an account, a random ID stored in your browser and your IP address are used to count your free vlog.</p>
        </Section>
        <Section title="Cookies and storage">
          <p>We use your browser’s storage to keep your vlogs, settings, tutorial progress and sign-in session. We don’t use advertising cookies. [Add analytics or error monitoring here if you turn them on.]</p>
        </Section>
        <Section title="Your rights">
          <p>You can delete your account and its data at any time from Account; that also cancels any subscription. Vlogs in your browser are yours to delete there. For other requests (access, correction), contact {CONTACT}. [Add GDPR/CCPA details, data controller and retention periods.]</p>
        </Section>
        <Section title="Who processes data for us">
          <p>Supabase (accounts, server functions), Vercel (hosting), Google and/or Anthropic (AI), ElevenLabs (voice and captions), Stripe (payments). [Add regions and transfer safeguards.]</p>
        </Section>
      </div>
    </SitePage>
  )
}
