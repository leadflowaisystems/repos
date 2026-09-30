import { AtAGlance } from '@/components/marketing/at-a-glance';
import { Businesses } from '@/components/marketing/businesses';
import { Contact } from '@/components/marketing/contact';
import { Difference } from '@/components/marketing/difference';
import { Effort } from '@/components/marketing/effort';
import { Faq } from '@/components/marketing/faq';
import { FeedbackExperience } from '@/components/marketing/feedback-experience';
import { FinalCta } from '@/components/marketing/final-cta';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Intelligence } from '@/components/marketing/intelligence';
import { Memory } from '@/components/marketing/memory';
import { Problem } from '@/components/marketing/problem';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { WhyHeadway } from '@/components/marketing/why-headway';
import { WorkspaceTour } from '@/components/marketing/workspace-tour';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/marketing/site';

/**
 * THE FRONT DOOR (M26, refreshed after the Sep 2026 workspace redesign).
 *
 * A visitor with no session who opens `/` is shown this page: the middleware
 * rewrites the request here, and a request that names this path directly is
 * sent back to `/`, so the site has exactly one address. A signed-in
 * operator opening `/` still gets the command centre; a signed-in owner is
 * still sent on to their workspace. No product route moved.
 *
 * The page is static. It reads no database and holds no session: everything
 * on it is written here, drawn from the vertical packs and the kit catalogue,
 * or taken from the demo dataset — and the few things that vary by
 * deployment come from the environment when the page is built.
 *
 * The order answers the five questions an owner arrives with, then goes
 * deeper on each: what it is and what they would see (the hero, drawn as
 * today's Home), the answers in one minute, the problem it solves, how it
 * works and whose work each step is, the workspace tab by tab, one topic
 * opened, why it is not a dashboard, what happened after a change, how much
 * of their time it takes, what their customers see, whether it fits their
 * kind of business, why it is different, the questions owners ask, and then
 * the ask.
 */
export default function HomePage() {
  const home = siteUrl();
  const organisation = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    ...(home ? { url: home, logo: `${home}/icon.svg` } : {}),
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <AtAGlance />
        <Problem />
        <HowItWorks />
        <WorkspaceTour />
        <Intelligence />
        <Difference />
        <Memory />
        <Effort />
        <FeedbackExperience />
        <Businesses />
        <WhyHeadway />
        <Faq />
        <FinalCta />
        <Contact />
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        // Structured data for the one indexed page: who this is and what it does.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisation) }}
      />
    </>
  );
}
