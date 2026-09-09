import { PageIntro, PeriodSwitch, Quiet, Section } from '@/components/portal/portal-ui';
import { getTranslator } from '@/lib/i18n/request';
import type { MessageKey } from '@/lib/i18n/strings';
import type { Translator } from '@/lib/i18n/t';
import type { PeriodReport, PeriodTheme } from '@/lib/reporting/service';

/**
 * The weekly Pulse and the monthly Review, rendered (M20 Stage 4). Those are
 * code names: to the owner these two pages are "This week" and "This month",
 * two windows of the one Check-in family.
 *
 * One component for both, because they answer the same questions over
 * different windows and two components would drift.
 *
 * What it will not do: fill space. When there is not enough feedback, the page
 * says so and stops. An owner who opens this every Monday needs to be able to
 * trust that a short page means a quiet week, not a broken report.
 *
 * EVERY SENTENCE COMES FROM THE DICTIONARY (M31), in English, Hindi or Marathi.
 * The two pages share the keys under `pulse.report.*`; the handful of sentences
 * that actually say "this week" or "this month" exist once per period, and
 * `ns` below picks the pair. Nothing on this page is stitched together from
 * fragments, because the pieces land in a different order in each language.
 */

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * The counting line beside a topic.
 *
 * One mention is one feedback entry that names the topic, never one customer —
 * one customer can leave several. Three whole sentences rather than an arrow
 * between two numbers: an arrow cannot be read out loud, and where it used to
 * sit Hindi and Marathi need a verb.
 */
function MovementNote({ theme, t }: { theme: PeriodTheme; t: Translator<MessageKey> }) {
  if (theme.movement === null) {
    return (
      <span className="text-[13px] text-ink-500">
        {t.plural('pulse.report.mentions', theme.count)}
      </span>
    );
  }
  if (theme.movement === 'STEADY') {
    return (
      <span className="text-[13px] text-ink-500">
        {t.plural('pulse.report.mentions.same', theme.count, { before: theme.before })}
      </span>
    );
  }
  return (
    <span
      className={
        theme.movement === 'DOWN' && theme.kind === 'ISSUE'
          ? 'text-[13px] font-medium text-good-700'
          : theme.movement === 'UP' && theme.kind === 'ISSUE'
            ? 'text-[13px] font-medium text-bad-700'
            : 'text-[13px] text-ink-600'
      }
    >
      {t.plural('pulse.report.mentions.changed', theme.count, { before: theme.before })}
    </span>
  );
}

function ThemeList({ themes, t }: { themes: PeriodTheme[]; t: Translator<MessageKey> }) {
  return (
    <ul className="divide-y divide-ink-100 border-y border-ink-100">
      {themes.map((theme) => (
        <li
          key={theme.key}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
        >
          <span className="text-[14px] text-ink-900">{theme.label}</span>
          <MovementNote theme={theme} t={t} />
        </li>
      ))}
    </ul>
  );
}

export async function PeriodReportView({
  report,
  basePath,
}: {
  report: PeriodReport;
  /** Where this door lives, so the period switch stays inside it. */
  basePath: string;
}) {
  const t = await getTranslator();
  const isWeek = report.kind === 'WEEK';
  // This page knows exactly which window it is reading, so it names it. `ns`
  // picks the week's wording or the month's, one whole sentence at a time.
  // Only shared code that genuinely cannot tell is allowed to say "period".
  const ns = isWeek ? 'pulse' : 'review';
  const title = t(`${ns}.title`);

  return (
    <div className="max-w-3xl">
      {/* The header above already names the business; this page reads as one
          of the check-in family, with the same intro the others use. */}
      <PageIntro
        eyebrow={t('pulse.report.eyebrow')}
        title={title}
        description={t('pulse.report.window', {
          from: dateLabel(report.window.from),
          to: dateLabel(report.window.to),
          days: report.window.days,
        })}
      />
      <PeriodSwitch basePath={basePath} current={isWeek ? 'pulse' : 'review'} />

      <p className="mt-6 text-[17px] leading-relaxed font-medium text-ink-900">
        {report.headline}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-600">
        {t.plural(`${ns}.volume`, report.volume.current, { previous: report.volume.previous })}
      </p>

      {report.enoughEvidence ? (
        <>
          {report.worsened.length > 0 ? (
            <Section eyebrow={t('pulse.report.section.worsened')}>
              <ThemeList themes={report.worsened} t={t} />
            </Section>
          ) : null}

          {report.improved.length > 0 ? (
            <Section eyebrow={t('pulse.report.section.improved')}>
              <ThemeList themes={report.improved} t={t} />
            </Section>
          ) : null}

          {report.praise.length > 0 ? (
            <Section eyebrow={t('pulse.report.section.praise')}>
              <ThemeList themes={report.praise} t={t} />
            </Section>
          ) : null}

          {!isWeek && report.unresolved.length > 0 ? (
            <Section eyebrow={t('pulse.report.section.unresolved')}>
              {/* The list is "raised in both windows and not less often". It
                  does not know whether the owner fixed anything, so the words
                  cover steady as well as rising and judge neither. The key is
                  the month's outright: this block never runs for a week. */}
              <p className="mb-3 text-[13px] leading-relaxed text-ink-600">
                {t('review.unresolved.note')}
              </p>
              <ThemeList themes={report.unresolved} t={t} />
            </Section>
          ) : null}

          {report.issues.length === 0 && report.praise.length === 0 ? (
            <Section eyebrow={t('pulse.report.section.topics')}>
              {/* Thin evidence, not a quiet week. Naming the bar is what keeps
                  the two apart, so the number stays in the sentence. */}
              <Quiet>{t(`${ns}.topics.none`)}</Quiet>
            </Section>
          ) : null}
        </>
      ) : null}

      {report.actions.length > 0 ? (
        <Section eyebrow={t(`${ns}.actions.eyebrow`)}>
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {report.actions.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-[14px] font-medium text-ink-900">{a.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">{a.themeLabel}</p>
                {a.outcome ? (
                  <p className="mt-1 text-[13px] text-ink-700">{a.outcome}</p>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-500">
                    {t('pulse.report.action.checking')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report.focus ? (
        <Section eyebrow={t('pulse.report.section.focus')}>
          <p className="text-[15px] leading-relaxed text-ink-900">{report.focus}</p>
        </Section>
      ) : null}

      {report.limits.length > 0 ? (
        <Section eyebrow={t('pulse.report.section.limits')}>
          <ul className="space-y-1.5">
            {report.limits.map((l) => (
              <li key={l} className="text-[13px] leading-relaxed text-ink-600">
                {l}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
