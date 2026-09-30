import type { Metadata } from "next";
import { SitePage } from "@/components/site/blocks";
import { LegalSection } from "@/components/site/Legal";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Southward stores about you, who processes it, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <SitePage narrow crumbs={[{ href: "/privacy", label: "Privacy" }]} title="Privacy" lede="Last updated 30 September 2026. The short version: we keep what's needed to save your progress, we don't run ads or trackers, and we never sell your data.">
      <LegalSection title="What we store">
        <ul>
          <li>
            <strong>Your account:</strong> your first name, email address and a scrypt hash of your password. We never see or
            store the password itself.
          </li>
          <li>
            <strong>Your study progress:</strong> the answers you give, flashcard reviews, mock exam and clinical station
            results, lessons completed, your exam date and study settings. This is what lets you pick up on another device.
          </li>
          <li>
            <strong>Daily AI usage counts,</strong> so we can apply the fair-use limit.
          </li>
          <li>
            <strong>Sign-in attempt counts,</strong> keyed by a one-way hash of your IP address or email address, to slow
            down password guessing and automated sign-ups. They&rsquo;re cleared out after about a day.
          </li>
        </ul>
        <p>
          Without an account, progress stays in your browser&rsquo;s local storage on your device and never reaches us. Settings
          has an export button if you want your own copy either way.
        </p>
      </LegalSection>

      <LegalSection title="Who processes it">
        <ul>
          <li>
            <strong>Vercel</strong> hosts the site and <strong>Neon</strong> hosts the database, both in Singapore.
          </li>
          <li>
            <strong>OpenAI or Anthropic</strong> receive the text of AI requests: your tutor questions, clinical station
            conversation, and the text of any PDF you upload to make questions or flashcards. We don&rsquo;t keep uploaded PDFs;
            the text is sent for that one request and then discarded.
          </li>
          <li>
            <strong>TypeSafe</strong> checks AI-written questions and marks clinical stations, so it receives that content too.
          </li>
          <li>
            <strong>Your browser</strong> handles voice input in clinical stations. Some browsers, Chrome among them, send that
            audio to their maker to turn it into text.
          </li>
        </ul>
        <p>We don&rsquo;t send your name or email with AI requests.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          One cookie, which keeps you signed in. It&rsquo;s HttpOnly (page scripts can&rsquo;t read it) and lasts 60 days. No analytics,
          advertising or third-party cookies.
        </p>
      </LegalSection>

      <LegalSection title="Keeping it safe">
        <p>
          Everything travels over HTTPS, passwords are hashed, and the AI features only answer signed-in users. No system is
          perfectly secure, so please use a password you don&rsquo;t use anywhere else.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can export your progress at any time from Settings, and delete your account there too, under Delete
          account. Deleting an account removes it, its progress and its usage records from the database straight away.
          {CONTACT_EMAIL && (
            <>
              {" "}
              If you can&rsquo;t sign in, or have any question about your data, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">
                {CONTACT_EMAIL}
              </a>{" "}
              from the address you signed up with.
            </>
          )}
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If we change what we collect or who processes it, we&rsquo;ll update this page and the date at the top.</p>
      </LegalSection>
    </SitePage>
  );
}
