'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Button, Notice, Textarea } from '@/components/ui';
import { CopyButton } from '@/components/copy-button';

/**
 * Prepared owner communication.
 *
 * The whole point is that there is nothing to fill in. The operator opens a
 * client and the message is already written from that client's own data, in
 * that client's own language. Copy it, or edit it first.
 *
 * Editing is local and deliberate: an owner message is not stored anywhere, so
 * an edit lives until the operator copies it. There is no send button because
 * RepOS has no way to send anything.
 */

export type CommsMessageView = {
  type: string;
  title: string;
  description: string;
  body: string;
  /** The email framing for this message, in the owner's own language. */
  emailSubject: string;
  emailGreeting: string;
  emailSignOff: string;
  notes: string[];
  problems: Array<{ code: string; message: string; blocking: boolean }>;
  blocked: boolean;
};

const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'ENGLISH', label: 'English' },
  { value: 'HINDI', label: 'Hindi' },
  { value: 'HINGLISH', label: 'Hinglish' },
  { value: 'MARATHI', label: 'Marathi' },
];

function LanguageSwitch({
  base,
  current,
}: {
  base: string;
  current: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12px] text-ink-500">Write in</span>
      {LANGUAGES.map((language) => (
        <Link
          key={language.value}
          href={`${base}?commsLang=${language.value}`}
          scroll={false}
          className={clsx(
            'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
            current === language.value
              ? 'border-ink-900 bg-ink-900 text-white'
              : 'border-ink-200 text-ink-600 hover:bg-ink-50',
          )}
        >
          {language.label}
        </Link>
      ))}
    </div>
  );
}

function MessageCard({ message }: { message: CommsMessageView }) {
  /**
   * The same words, framed for an inbox rather than a chat.
   *
   * Built from whatever is in the box, so an edit the operator makes is
   * carried into both copies. Nothing is added but the subject, greeting and
   * sign-off an email needs and a chat does not.
   */
  const emailText = (text: string) =>
    `Subject: ${message.emailSubject}

${message.emailGreeting}

${text}

${message.emailSignOff}`;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(message.body);

  // Switching language rewrites the message underneath; keep the box honest.
  useEffect(() => {
    setValue(message.body);
    setEditing(false);
  }, [message.body]);

  const blocking = message.problems.filter((problem) => problem.blocking);

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="mb-3">
        <p className="text-[14px] font-semibold text-ink-900">{message.title}</p>
        <p className="text-[12px] text-ink-500">{message.description}</p>
      </div>

      {message.blocked ? (
        <Notice tone="bad" title="Not offered">
          {blocking.map((problem) => problem.message).join(' ')}
        </Notice>
      ) : editing ? (
        <div className="space-y-3">
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={Math.min(18, Math.max(6, value.split('\n').length + 1))}
            aria-label={message.title}
          />
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              value={value}
              label="Copy for WhatsApp"
              copiedLabel="Copied"
              variant="primary"
            />
            <CopyButton
              value={emailText(value)}
              label="Copy for email"
              copiedLabel="Copied"
              variant="secondary"
            />
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setValue(message.body)}
              disabled={value === message.body}
            >
              Reset
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-md border border-ink-100 bg-ink-50 px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-900">
            {value}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton
              value={value}
              label="Copy for WhatsApp"
              copiedLabel="Copied"
              variant="primary"
            />
            <CopyButton
              value={emailText(value)}
              label="Copy for email"
              copiedLabel="Copied"
              variant="secondary"
            />
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
          <p className="text-[12px] text-ink-500">
            RepOS does not send anything. Copy it and send it yourself, however you already talk
            to this owner.
          </p>
        </div>
      )}

      {message.notes.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {message.notes.map((note) => (
            <li key={note} className="text-[12px] text-ink-500">
              {note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function OwnerCommsPanel({
  base,
  language,
  messages,
  replyHref,
  ownerContext = [],
}: {
  base: string;
  language: string;
  messages: CommsMessageView[];
  replyHref: string;
  /** What the owner told RepOS (M13). For the operator to keep in mind; never auto-inserted. */
  ownerContext?: string[];
}) {
  return (
    <div className="space-y-4">
      <LanguageSwitch base={base} current={language} />

      {ownerContext.length > 0 ? (
        <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">
            Keep in mind — the owner told RepOS
          </p>
          <ul className="mt-1.5 space-y-1">
            {ownerContext.map((line) => (
              <li key={line} className="text-[13px] leading-relaxed text-ink-700 italic">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4">
        {messages.map((message) => (
          <MessageCard key={message.type} message={message} />
        ))}
      </div>

      <p className="text-[12px] text-ink-500">
        Nothing is sent from here — copy the text and send it however you normally
        talk to this owner. Replies to individual reviews are prepared on the{' '}
        <Link href={replyHref} className="underline underline-offset-2">
          Feedback page
        </Link>
        .
      </p>
    </div>
  );
}
