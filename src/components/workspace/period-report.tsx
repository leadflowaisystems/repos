import { PageIntro, PeriodSwitch, Quiet, Section } from '@/components/portal/portal-ui';
import type { PeriodReport, PeriodTheme } from '@/lib/reporting/service';

/**
 * The weekly Pulse and the monthly Review, rendered (M20 Stage 4).
 *
 * One component for both, because they answer the same questions over
 * different windows and two components would drift.
 *
 * What it will not do: fill space. When there is not enough feedback, the page
 * says so and stops. An owner who opens this every Monday needs to be able to
 * trust that a short page means a quiet week, not a broken report.
 */

function dateLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function MovementNote({ theme }: { theme: PeriodTheme }) {
  if (theme.movement === null) {
    return <span className="text-[13px] text-ink-500">{theme.count} this period</span>;
  }
  if (theme.movement === 'STEADY') {
    return (
      <span className="text-[13px] text-ink-500">
        {theme.before} → {theme.count}, about the same
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
      {theme.before} → {theme.count}
    </span>
  );
}

function ThemeList({ themes }: { themes: PeriodTheme[] }) {
  return (
    <ul className="divide-y divide-ink-100 border-y border-ink-100">
      {themes.map((t) => (
        <li
          key={t.key}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
        >
          <span className="text-[14px] text-ink-900">{t.label}</span>
          <MovementNote theme={t} />
        </li>
      ))}
    </ul>
  );
}

export function PeriodReportView({
  report,
  basePath,
}: {
  report: PeriodReport;
  /** Where this door lives, so the period switch stays inside it. */
  basePath: string;
}) {
  const isWeek = report.kind === 'WEEK';
  const title = isWeek ? 'This week' : 'This month';

  return (
    <div className="max-w-3xl">
      {/* The header above already names the business; this page reads as one
          of the check-in family, with the same intro the others use. */}
      <PageIntro
        eyebrow="Check-in"
        title={title}
        description={`${dateLabel(report.window.from)} – ${dateLabel(report.window.to)}, compared with the ${report.window.days} days before`}
      />
      <PeriodSwitch basePath={basePath} current={isWeek ? 'pulse' : 'review'} />

      <p className="mt-6 text-[17px] leading-relaxed font-medium text-ink-900">
        {report.headline}
      </p>
      <p className="mt-1.5 text-[13px] text-ink-600">
        {report.volume.current} this period · {report.volume.previous} the period before
      </p>

      {report.enoughEvidence ? (
        <>
          {report.worsened.length > 0 ? (
            <Section eyebrow="Coming up more often">
              <ThemeList themes={report.worsened} />
            </Section>
          ) : null}

          {report.improved.length > 0 ? (
            <Section eyebrow="Coming up less often">
              <ThemeList themes={report.improved} />
            </Section>
          ) : null}

          {report.praise.length > 0 ? (
            <Section eyebrow="What customers responded well to">
              <ThemeList themes={report.praise} />
            </Section>
          ) : null}

          {!isWeek && report.unresolved.length > 0 ? (
            <Section eyebrow="Still unresolved">
              <p className="mb-3 text-[13px] leading-relaxed text-ink-600">
                Raised in both periods, and no less often than before.
              </p>
              <ThemeList themes={report.unresolved} />
            </Section>
          ) : null}

          {report.issues.length === 0 && report.praise.length === 0 ? (
            <Section eyebrow="Themes">
              <Quiet>
                No theme was named by enough customers this period to report on.
              </Quiet>
            </Section>
          ) : null}
        </>
      ) : null}

      {report.actions.length > 0 ? (
        <Section eyebrow={isWeek ? 'Changes in progress' : 'Changes you made'}>
          <ul className="divide-y divide-ink-100 border-y border-ink-100">
            {report.actions.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-[14px] font-medium text-ink-900">{a.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">{a.themeLabel}</p>
                {a.outcome ? (
                  <p className="mt-1 text-[13px] text-ink-700">{a.outcome}</p>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-500">Not measured yet.</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report.focus ? (
        <Section eyebrow="Worth a look next">
          <p className="text-[15px] leading-relaxed text-ink-900">{report.focus}</p>
        </Section>
      ) : null}

      {report.limits.length > 0 ? (
        <Section eyebrow="What this cannot tell you">
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
