import { notFound } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui';
import {
  CompetitorsForm,
  PolicyForm,
  VoiceForm,
} from '@/components/forms/profile-forms';
import { prisma } from '@/lib/db';
import { getPackOrFallback } from '@/lib/packs';
import { toDateInputValue } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      voiceProfile: true,
      policy: true,
      competitors: { orderBy: { sortIndex: 'asc' } },
    },
  });
  if (!client) notFound();

  const pack = getPackOrFallback(client.vertical);
  const voice = client.voiceProfile;
  const policy = client.policy;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={`Playbook: ${pack.label}`}
          description={pack.description}
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
              Headline KPI
            </p>
            <p className="mt-1 text-[14px] font-medium text-ink-900">
              {pack.headlineKpi.label}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              {pack.headlineKpi.help}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
              Staff ask-script
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-800">
              &ldquo;{pack.staffAskScript.line}&rdquo;
            </p>
            <p className="mt-1 text-[12px] text-ink-500">
              {pack.staffAskScript.when}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
              Hard rules for this vertical
            </p>
            <ul className="mt-1.5 space-y-1">
              {pack.staffAskScript.doNot.map((rule) => (
                <li key={rule} className="text-[13px] text-ink-700">
                  · {rule}
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>

      <VoiceForm
        clientId={client.id}
        presetHint={`Pre-filled from the ${pack.label} preset when this client was created. Change anything that does not sound like the owner.`}
        values={{
          formality: voice?.formality ?? pack.voicePreset.formality,
          languageMix: voice?.languageMix ?? pack.voicePreset.languageMix,
          greeting: voice?.greeting ?? pack.voicePreset.greeting,
          signOff: voice?.signOff ?? pack.voicePreset.signOff,
          preferredWords:
            voice?.preferredWords ?? pack.voicePreset.preferredWords.join('\n'),
          bannedWords: voice?.bannedWords ?? pack.voicePreset.bannedWords.join('\n'),
          emojiPolicy: voice?.emojiPolicy ?? pack.voicePreset.emojiPolicy,
          exampleReplies:
            voice?.exampleReplies ?? pack.voicePreset.exampleReplies.join('\n'),
        }}
      />

      <PolicyForm
        clientId={client.id}
        values={{
          refundPolicy: policy?.refundPolicy ?? '',
          appointmentPolicy: policy?.appointmentPolicy ?? '',
          cancellationPolicy: policy?.cancellationPolicy ?? '',
          neverPromise: policy?.neverPromise ?? '',
          sensitiveTopics: policy?.sensitiveTopics ?? '',
        }}
      />

      <CompetitorsForm
        clientId={client.id}
        rows={client.competitors.map((c) => ({
          name: c.name,
          mapsUrl: c.mapsUrl ?? '',
          rating: c.rating === null ? '' : String(c.rating),
          reviewCount: c.reviewCount === null ? '' : String(c.reviewCount),
          observedAt: toDateInputValue(c.observedAt),
        }))}
      />
    </div>
  );
}
