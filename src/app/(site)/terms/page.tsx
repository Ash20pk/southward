import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site/blocks";
import { LegalSection } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Southward, an independent AMC exam study aid.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return (
    <SitePage narrow crumbs={[{ href: "/terms", label: "Terms" }]} title="Terms of use" lede="Last updated 24 September 2026. By creating an account or using Southward, you agree to these terms.">
      <LegalSection title="What Southward is">
        <p>
          An independent study aid for the Australian Medical Council exams. It is <strong>not</strong> affiliated with or
          endorsed by the Australian Medical Council, Ahpra or the Medical Board of Australia, and passing our practice
          questions doesn&rsquo;t guarantee any exam result.
        </p>
      </LegalSection>

      <LegalSection title="Not medical advice">
        <p>
          Everything here is written for exam practice. It is not clinical guidance and must not be used to diagnose or treat
          anyone. Guidelines change, so check current Australian sources (such as Therapeutic Guidelines and the Australian
          Medicines Handbook) before relying on anything in practice.
        </p>
      </LegalSection>

      <LegalSection title="AI features">
        <p>
          The tutor, question writer, practice patient and examiner are AI. They can be wrong, sometimes confidently. Treat
          what they say as a study prompt to check, not as fact. AI features have a daily limit, and we may change it to keep
          the service running for everyone.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>One account per person. Keep your password to yourself.</li>
          <li>Give a real email address so you can recover your account.</li>
          <li>You&rsquo;re responsible for what happens under your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Fair use">
        <p>Please don&rsquo;t:</p>
        <ul>
          <li>copy, scrape or resell Southward&rsquo;s questions, lessons, flashcards or stations;</li>
          <li>use the AI features for anything other than your own study, or try to get around the daily limits;</li>
          <li>upload material you don&rsquo;t have the right to use, or anything unlawful;</li>
          <li>interfere with the service or other people&rsquo;s use of it.</li>
        </ul>
        <p>We may suspend accounts that do.</p>
      </LegalSection>

      <LegalSection title="Content">
        <p>
          Southward&rsquo;s lessons, questions, flashcards and stations are ours, and you&rsquo;re welcome to use them for your own
          study. Anything you upload stays yours; you let us process it only to give you the feature you asked for. How we
          handle your data is covered in the{" "}
          <Link href="/privacy" className="text-brand underline">
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Availability and price">
        <p>
          Southward is free during early access. We may add paid plans later; if we do, we&rsquo;ll say so clearly before
          anything is charged, and nothing you&rsquo;ve done so far will be taken away without notice. We aim to keep the
          service running but can&rsquo;t promise it will always be available or error-free.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          Southward is provided as is. To the extent the law allows, we aren&rsquo;t liable for exam outcomes, decisions made
          using the content, or loss of data. Nothing in these terms limits rights you have under consumer law that can&rsquo;t
          be excluded.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>We may update these terms. If a change matters, we&rsquo;ll tell you in the app before it applies.</p>
      </LegalSection>
    </SitePage>
  );
}
