import { Businesses } from '@/components/marketing/businesses';
import { Contact } from '@/components/marketing/contact';
import { Difference } from '@/components/marketing/difference';
import { FeedbackExperience } from '@/components/marketing/feedback-experience';
import { FinalCta } from '@/components/marketing/final-cta';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Intelligence } from '@/components/marketing/intelligence';
import { Memory } from '@/components/marketing/memory';
import { Problem } from '@/components/marketing/problem';
import { Signals } from '@/components/marketing/signals';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { WhyHeadway } from '@/components/marketing/why-headway';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/marketing/site';

/**
 * THE FRONT DOOR (M26).
 *
 * A visitor with no session who opens `/` is shown this page: the middleware
 * rewrites the request here, and a request that names this path directly is
 * sent back to `/`, so the site has exactly one address. A signed-in
 * operator opening `/` still gets the command centre; a signed-in owner is
 * still sent on to their workspace. No product route moved.
 *
 * The page is static. It reads no database and holds no session: everything
 * on it is written here, drawn from the vertical packs, or taken from the
 * demo dataset — and the few things that vary by deployment come from the
 * environment when the page is built.
 *
 * The order is the order a busy owner is persuaded in: the problem they
 * have, why this is not another dashboard, how it works, what it actually
 * says, the four places a signal lands, the memory it keeps, what their
 * customers will see, whether it fits their kind of business, why it is
 * different, and then the ask.
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
        <Problem />
        <Difference />
        <HowItWorks />
        <Intelligence />
        <Signals />
        <Memory />
        <FeedbackExperience />
        <Businesses />
        <WhyHeadway />
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
