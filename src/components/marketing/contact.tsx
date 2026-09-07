import { CopyButton } from '@/components/copy-button';
import { siteContact } from '@/lib/marketing/site';
import { GET_STARTED } from './links';
import { CARD_EYEBROW, Cta, Heading, Section } from './primitives';

/**
 * TALK TO US.
 *
 * Headway is a done-for-you service with people behind it, and this is how
 * a business owner reaches them — to get access, or to carry on after the
 * trial. Three ways, all as text a visitor copies: an address, a number, and
 * the same number as a WhatsApp contact. Never a mailto:, tel: or wa.me
 * link, because RepOS builds no messaging deep link anywhere and the
 * compliance suite holds it to that.
 */

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.2 4.4c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4l-.5-.3-2-1c-.3-.1-.5-.2-.7.2l-.9 1.1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6Z"
      />
    </svg>
  );
}

export function Contact() {
  const contact = siteContact();

  return (
    <Section id="contact" labelledBy="contact-heading">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <Heading
            id="contact-heading"
            eyebrow="Talk to us"
            title="Contact Headway to get access, or to carry on."
            lead="Headway is run by a small team. Tell us what you run, where it is and what you would like to fix first, and we will come back to you with how Headway would work for it — and what it costs. The same people are who you reach to continue your service after the trial."
          />

          <dl className="hw-rise mt-8 divide-y divide-ink-200 border-y border-ink-200">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
              <div className="min-w-0">
                <dt className={CARD_EYEBROW}>Email</dt>
                <dd className="mt-1 text-[20px] font-semibold break-all text-ink-900 sm:text-[22px]">{contact.email}</dd>
              </div>
              <CopyButton value={contact.email} label="Copy address" copiedLabel="Copied" className="min-h-11" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
              <div className="min-w-0">
                <dt className={CARD_EYEBROW}>Phone</dt>
                <dd className="mt-1 text-[20px] font-semibold text-ink-900 tabular-nums sm:text-[22px]">{contact.phone}</dd>
              </div>
              <CopyButton value={contact.whatsapp} label="Copy number" copiedLabel="Copied" className="min-h-11" />
            </div>
          </dl>

          <div className="hw-rise mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-good-200 bg-good-50 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3 text-good-700">
              <WhatsAppMark />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">Message us on WhatsApp</p>
                <p className="text-[14px] text-ink-700 tabular-nums">
                  {contact.phone} &middot; save the number and send us a message
                </p>
              </div>
            </div>
            <CopyButton value={contact.whatsapp} label="Copy WhatsApp number" copiedLabel="Copied" className="min-h-11" />
          </div>
        </div>

        <div className="hw-rise rounded-2xl border border-ink-200 bg-white p-6 sm:p-8">
          <p className={CARD_EYEBROW}>Prefer to start on your own?</p>
          <p className="mt-2 text-[22px] leading-snug font-semibold tracking-[-0.02em] text-ink-900">
            Create your account. Four answers, and your feedback page and QR code are ready to print.
          </p>
          <ul className="mt-5 space-y-2 text-[15px] text-ink-700">
            <li className="flex items-baseline gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              Your workspace starts on a trial. No card, no payment page.
            </li>
            <li className="flex items-baseline gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              Your first customer signals appear as feedback arrives through your card.
            </li>
            <li className="flex items-baseline gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              When you want to carry on, press Continue with Headway on your Account page and we agree the rest with you directly.
            </li>
          </ul>
          <div className="mt-7">
            <Cta href={GET_STARTED.href}>{GET_STARTED.label}</Cta>
          </div>
        </div>
      </div>
    </Section>
  );
}
