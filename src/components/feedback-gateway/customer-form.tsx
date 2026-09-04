'use client';

import clsx from 'clsx';
import { useActionState, useEffect, useState } from 'react';
import { submitCustomerFeedbackAction } from '@/lib/actions/gateway';
import { IDLE } from '@/lib/actions/shared';
import type { GatewayCopy } from '@/lib/gateway/copy';
import { DIMENSION_FIELD_PREFIX, SIGNAL_FIELD } from '@/lib/gateway/fields';
import type { PackDimension } from '@/lib/packs';

/**
 * The form a customer fills in (M14, restructured M19).
 *
 * Built on one belief: almost nobody writes, and the ones who do are not a
 * representative sample. So the fastest path through this form asks for taps
 * and never for words — an overall rating, a rating for each part of the
 * business the vertical cares about, and a specific or two if something was
 * off. Thirty seconds, no keyboard, and the business still learns which part
 * of the visit was the problem.
 *
 * Two things this form deliberately does not do. It does not treat a low
 * rating differently from a high one: the same follow-up, the same open box
 * and the same public-review option reach everyone, because a form that
 * quietly routes unhappy people somewhere quieter is not measuring anything.
 * And it does not celebrate — no confetti, no badges, no exclamation marks.
 * Somebody who just had a bad haircut is filling this in.
 *
 * Without JavaScript every section is visible at once and the single button
 * at the bottom posts all of it. The steps below are an enhancement on top of
 * a form that already works.
 */

const STAR_WORDS: Record<number, string> = {
  1: 'Poor',
  2: 'Not great',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
};

const MAX_TEXT = 1500;
/** At or below this, a rating is asking for a follow-up rather than praise. */
const NEEDS_DETAIL_AT = 3;

type Step = 'overall' | 'parts' | 'words';

export function CustomerFeedbackForm({
  token,
  copy,
  nonce,
  dimensions,
}: {
  token: string;
  copy: GatewayCopy;
  nonce: string;
  dimensions: PackDimension[];
}) {
  const [state, formAction, pending] = useActionState(submitCustomerFeedbackAction, IDLE);
  const [stars, setStars] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('overall');

  // False through the server render and the first paint, so a browser with no
  // JavaScript keeps a form it can actually complete.
  const [stepped, setStepped] = useState(false);
  useEffect(() => setStepped(dimensions.length > 0), [dimensions.length]);

  // An error can only come back from the server, and it is about the words.
  useEffect(() => {
    if (state.message) setStep('words');
  }, [state.message]);

  const shows = (which: Step) => !stepped || step === which;
  const last: Step = 'words';

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="nonce" value={nonce} />
      {/* Honeypot: never shown, never filled by a person. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {/* --- Overall ------------------------------------------------------ */}
      <section className={clsx(shows('overall') ? 'block' : 'hidden')}>
        <fieldset>
          <legend className="text-[14px] font-medium text-ink-800">
            {copy.ratingLabel}{' '}
            <span className="font-normal text-ink-500">({copy.ratingOptional})</span>
          </legend>
          <StarRow
            name="stars"
            label={copy.ratingLabel}
            value={stars}
            onChange={(value) => {
              setStars(value);
              if (stepped) setStep('parts');
            }}
            size="large"
          />
        </fieldset>
        {stepped ? (
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('parts')}
              className="min-h-11 text-[15px] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-700"
            >
              {copy.skipLabel}
            </button>
            <button
              type="button"
              onClick={() => setStep('parts')}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800"
            >
              {copy.continueLabel}
            </button>
          </div>
        ) : null}
      </section>

      {/* --- The vertical's own questions --------------------------------- */}
      {dimensions.length > 0 ? (
        <section className={clsx(shows('parts') ? 'block' : 'hidden', !stepped && 'mt-10')}>
          <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
            {copy.dimensionsHeadline}
          </h2>
          <p className="mt-1 text-[13px] text-ink-500">{copy.dimensionsNote}</p>

          <div className="mt-5 divide-y divide-ink-100 border-y border-ink-100">
            {dimensions.map((dimension) => {
              const rating = ratings[dimension.key] ?? null;
              return (
                <DimensionRow
                  key={dimension.key}
                  dimension={dimension}
                  rating={rating}
                  signalsNote={copy.signalsNote}
                  onChange={(value) =>
                    setRatings((prev) => ({ ...prev, [dimension.key]: value }))
                  }
                />
              );
            })}
          </div>

          {stepped ? (
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('overall')}
                className="min-h-11 text-[15px] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-700"
              >
                {copy.backLabel}
              </button>
              <button
                type="button"
                onClick={() => setStep('words')}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink-900 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800"
              >
                {copy.continueLabel}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* --- Words, last and optional ------------------------------------- */}
      <section className={clsx(shows(last) ? 'block' : 'hidden', !stepped && 'mt-10')}>
        <h2 className="text-[17px] leading-snug font-semibold tracking-tight text-ink-900">
          {stepped ? copy.textHeadline : copy.textLabel}
        </h2>
        <p className="mt-1 text-[13px] text-ink-500">{copy.textNote}</p>
        <label htmlFor="feedback-text" className="sr-only">
          {copy.textLabel}
        </label>
        <textarea
          id="feedback-text"
          name="text"
          rows={4}
          maxLength={MAX_TEXT}
          placeholder={copy.placeholder}
          aria-invalid={state.errors.text ? true : undefined}
          className={clsx(
            'mt-3 w-full resize-y rounded-xl border bg-white px-4 py-3 text-[16px] leading-relaxed text-ink-900 placeholder:text-ink-400',
            state.errors.text ? 'border-bad-600' : 'border-ink-300',
          )}
        />
        <p className="mt-1.5 text-[12px] text-ink-500">{copy.languageHint}</p>

        {state.message ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-bad-200 bg-bad-50 px-4 py-3 text-[14px] text-bad-700"
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-7">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-ink-900 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-ink-800 disabled:bg-ink-400"
          >
            {pending ? 'Sending…' : copy.submitLabel}
          </button>
          {stepped ? (
            <button
              type="button"
              onClick={() => setStep(dimensions.length > 0 ? 'parts' : 'overall')}
              className="mt-4 min-h-11 w-full text-[15px] font-medium text-ink-500 underline underline-offset-4 hover:text-ink-700"
            >
              {copy.backLabel}
            </button>
          ) : null}
        </div>
      </section>

      {/* The one reassurance the page makes, under every step of it. */}
      <p className="mt-8 text-center text-[12px] leading-relaxed text-ink-500">
        {copy.privacyLine}
      </p>
    </form>
  );
}

/**
 * One of the vertical's questions.
 *
 * The follow-up appears only once the customer has said something that asks
 * for one, and it is worded by the pack rather than here — "What would have
 * made it better?" for a kitchen, "What did not turn out as you wanted?" for
 * a salon. A good rating gets an invitation too, just not a list of faults.
 */
function DimensionRow({
  dimension,
  rating,
  signalsNote,
  onChange,
}: {
  dimension: PackDimension;
  rating: number | null;
  signalsNote: string;
  onChange: (value: number) => void;
}) {
  const low = rating !== null && rating <= NEEDS_DETAIL_AT;
  const high = rating !== null && rating > NEEDS_DETAIL_AT;

  return (
    <fieldset className="py-4">
      <legend className="text-[15px] font-medium text-ink-800">{dimension.label}</legend>
      <StarRow
        name={`${DIMENSION_FIELD_PREFIX}${dimension.key}`}
        label={dimension.label}
        value={rating}
        onChange={onChange}
        size="small"
      />

      {low && dimension.signals.length > 0 ? (
        <div className="mt-3">
          <p className="text-[13px] text-ink-600">{dimension.improvePrompt}</p>
          <p className="mt-0.5 text-[12px] text-ink-500">{signalsNote}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {dimension.signals.map((signal) => (
              <SignalChip key={signal.key} value={signal.key} label={signal.label} />
            ))}
          </div>
        </div>
      ) : null}

      {high && dimension.goodPrompt ? (
        <p className="mt-3 text-[13px] text-ink-500">{dimension.goodPrompt}</p>
      ) : null}
    </fieldset>
  );
}

/** A tappable specific. A checkbox, so it works without JavaScript too. */
function SignalChip({ value, label }: { value: string; label: string }) {
  const [on, setOn] = useState(false);
  return (
    <label
      className={clsx(
        'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[14px] transition-colors select-none',
        on
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-ink-300 bg-white text-ink-700 hover:border-ink-400',
      )}
    >
      <input
        type="checkbox"
        name={SIGNAL_FIELD}
        value={value}
        checked={on}
        onChange={(event) => setOn(event.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

/** Five stars. Plain radio inputs, so the form posts with or without React. */
function StarRow({
  name,
  label,
  value,
  onChange,
  size,
}: {
  name: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  size: 'large' | 'small';
}) {
  const large = size === 'large';
  return (
    <div
      className={clsx('flex flex-wrap items-center gap-0.5', large ? 'mt-2' : 'mt-1.5')}
      role="radiogroup"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <label
            key={star}
            className={clsx(
              'grid cursor-pointer place-items-center rounded-xl leading-none transition-colors select-none',
              large ? 'h-11 w-11 text-[30px]' : 'h-11 w-10 text-[24px]',
              filled ? 'text-warn-600' : 'text-ink-300 hover:text-ink-400',
            )}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
              aria-label={`${label}: ${star} star${star === 1 ? '' : 's'} — ${STAR_WORDS[star]}`}
            />
            <span aria-hidden>{filled ? '★' : '☆'}</span>
          </label>
        );
      })}
      {large ? (
        <span className="ml-2 min-h-5 text-[14px] text-ink-600" aria-live="polite">
          {value !== null ? STAR_WORDS[value] : ''}
        </span>
      ) : (
        <span className="ml-2 min-h-5 text-[13px] text-ink-500">
          {value !== null ? STAR_WORDS[value] : ''}
        </span>
      )}
    </div>
  );
}
