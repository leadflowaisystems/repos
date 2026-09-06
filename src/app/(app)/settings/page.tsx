import { Badge, Card, CardBody, CardHeader, DataRow, Notice } from '@/components/ui';
import { TakeBackupForm } from '@/components/forms/backup-form';
import { SignOutButton } from '@/components/sign-out';
import { prisma } from '@/lib/db';
import { backupDir, databaseFile, listBackups } from '@/lib/backup/service';
import { getPublicBaseUrl } from '@/lib/gateway/service';
import { requestOrigin } from '@/lib/gateway/origin';
import { PUBLIC_BASE_URL_VAR, resolvePublicBaseUrl } from '@/lib/config/public-url';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * THE INSTALLATION ITSELF (M16).
 *
 * Three questions the operator will actually ask: what address customers open,
 * who can get in, and where the copies of my data are. Everything on this page
 * is about the RepOS install, never about a client.
 */

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SettingsPage() {
  const [setting, origin, backups] = await Promise.all([
    getPublicBaseUrl(prisma),
    requestOrigin(),
    listBackups(),
  ]);
  const address = resolvePublicBaseUrl({ setting, requestOrigin: origin });
  const dbPath = databaseFile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900">This installation</h1>
        <p className="mt-1 text-[13px] text-ink-600">
          Settings for Headway itself. Nothing here changes a client&rsquo;s data.
        </p>
      </div>

      {/* ---- The address ------------------------------------------------ */}
      <Card>
        <CardHeader
          title="The address customers open"
          description="Every QR code and every owner link is built from this one address. It has to stay the same after a restart, or printed cards stop working."
          action={
            <Badge tone={address.ok ? (address.loopback ? 'warn' : 'good') : 'bad'}>
              {address.ok ? (address.loopback ? 'THIS COMPUTER ONLY' : 'SET') : 'NOT SET'}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          {address.ok ? (
            <>
              <dl>
                <DataRow label="Address">{address.url}</DataRow>
                <DataRow label="Where it comes from">
                  {address.source === 'ENV'
                    ? `${PUBLIC_BASE_URL_VAR}, set when Headway was installed`
                    : address.source === 'SETTING'
                      ? 'Saved inside Headway, on a client’s Feedback QR page'
                      : 'The address this page was opened on'}
                </DataRow>
              </dl>
              {address.source !== 'ENV' ? (
                <Notice tone="warn" title="Fine for testing, not for a real shop">
                  This address is worked out as Headway runs, so it can change. Before printing
                  cards for a real business, set <code>{PUBLIC_BASE_URL_VAR}</code> to the
                  permanent https address in the installation&rsquo;s environment file.
                </Notice>
              ) : null}
            </>
          ) : (
            <Notice tone="bad" title="No address is set">
              {address.reason}
            </Notice>
          )}
        </CardBody>
      </Card>

      {/* ---- Who can get in --------------------------------------------- */}
      <Card>
        <CardHeader
          title="Who can get in"
          description="Headway is for one person: you."
          action={<SignOutButton />}
        />
        <CardBody className="space-y-3">
          <p className="text-[13px] leading-relaxed text-ink-800">
            Every page and every button in Headway needs your password. There are no other
            accounts, no invitations, and no way for a customer or a business owner to sign in
            — because there is nothing for them to sign in to.
          </p>
          <p className="text-[13px] leading-relaxed text-ink-800">
            A business owner gets one private link per business instead. Anyone holding that
            link can read that one business&rsquo;s view and nothing else. If a link goes
            somewhere it should not, issue a new one on that client&rsquo;s page and the old
            one stops working immediately.
          </p>
          <p className="text-[13px] leading-relaxed text-ink-600">
            To change your password, run <code>npm run set-password</code> on this computer and
            follow what it prints. Your password is never stored in the database, so it is not
            in any backup.
          </p>
        </CardBody>
      </Card>

      {/* ---- Backups ----------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Backups"
          description="Everything Headway knows is in one file. A copy takes a second and is worth taking before anything unusual."
          action={<Badge tone={backups.files.length > 0 ? 'good' : 'warn'}>
            {backups.files.length > 0 ? `${backups.files.length} SAVED` : 'NONE YET'}
          </Badge>}
        />
        <CardBody className="space-y-5">
          {backups.files.length === 0 ? (
            <Notice tone="warn" title="No backup has been taken">
              If this computer&rsquo;s disk fails right now, every client&rsquo;s history goes
              with it. Take one, then copy it somewhere else — another drive, or a pen drive.
            </Notice>
          ) : null}

          <TakeBackupForm />

          <dl>
            <DataRow label="Live database">{dbPath ?? 'Not configured'}</DataRow>
            <DataRow label="Copies are written to">{backupDir()}</DataRow>
          </dl>

          {backups.files.length > 0 ? (
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                Copies on this computer
              </p>
              <ul className="mt-2 divide-y divide-ink-100 border-t border-ink-100">
                {backups.files.map((file) => (
                  <li
                    key={file.name}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span className="text-[13px] text-ink-900">{file.name}</span>
                    <span className="text-[12px] text-ink-500 tabular-nums">
                      {formatDateTime(file.takenAt)} · {megabytes(file.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-ink-200 px-4 py-3">
            <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
              Putting a backup back
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-800">
              <li>Stop Headway.</li>
              <li>
                Rename the live database file so you still have it, rather than deleting it.
              </li>
              <li>
                Copy the backup you want into its place and give it the live file&rsquo;s name.
              </li>
              <li>Start Headway and open a client to check the history is there.</li>
            </ol>
            <p className="mt-2 text-[12px] text-ink-500">
              A backup holds clients, feedback and history. It holds no password and no keys, so
              a restored copy still needs this computer&rsquo;s environment file to run.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
