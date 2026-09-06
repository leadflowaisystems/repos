import { describe, expect, it } from 'vitest';
import { channelsFor } from '@/lib/comms/compose';

/**
 * TWO PLACES AN OPERATOR ACTUALLY SENDS THINGS (M18).
 *
 * RepOS sends nothing and never will. What it owes the operator is text that
 * needs no editing before it goes into a WhatsApp chat or an email — and the
 * same facts in both, because a message that says one thing in one channel and
 * something else in another is worse than no message.
 */

const BODY = 'Quick customer update for Corner Cafe:\n\nSlow service — mentioned 9 times.';

describe('copy-ready output', () => {
  it('gives WhatsApp the body untouched, with no subject or sign-off', () => {
    const c = channelsFor(BODY, 'OWNER_UPDATE', 'ENGLISH', 'Corner Cafe');
    expect(c.whatsapp).toBe(BODY);
    expect(c.whatsapp).not.toMatch(/^Subject:/m);
  });

  it('gives email a subject naming the business, and a greeting and sign-off', () => {
    const c = channelsFor(BODY, 'OWNER_UPDATE', 'ENGLISH', 'Corner Cafe');
    expect(c.email.subject).toContain('Corner Cafe');
    expect(c.email.greeting.length).toBeGreaterThan(0);
    expect(c.email.signOff.length).toBeGreaterThan(0);
    expect(c.email.body.startsWith(c.email.greeting)).toBe(true);
    expect(c.email.body.endsWith(c.email.signOff)).toBe(true);
  });

  it('adds no fact that was not already in the message', () => {
    const c = channelsFor(BODY, 'OWNER_UPDATE', 'ENGLISH', 'Corner Cafe');
    // Every digit in the email body must already appear in the source body.
    const digits = (s: string) => (s.match(/\d+/g) ?? []).sort();
    expect(digits(c.email.body)).toEqual(digits(BODY));
    expect(c.email.body).toContain(BODY);
  });

  it('gives each message type its own subject', () => {
    const subjects = (['OWNER_UPDATE', 'ACTION_MESSAGE', 'FOLLOW_UP'] as const).map(
      (t) => channelsFor(BODY, t, 'ENGLISH', 'Corner Cafe').email.subject,
    );
    expect(new Set(subjects).size).toBe(3);
  });

  it('speaks the owner’s own language in both channels', () => {
    for (const language of ['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI', 'MIXED'] as const) {
      const c = channelsFor(BODY, 'OWNER_UPDATE', language, 'Corner Cafe');
      expect(c.email.subject.length, language).toBeGreaterThan(0);
      expect(c.email.greeting.length, language).toBeGreaterThan(0);
      expect(c.whatsapp, language).toBe(BODY);
    }
    // And the four scripts are genuinely different, not English relabelled.
    const greetings = (['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI'] as const).map(
      (l) => channelsFor(BODY, 'OWNER_UPDATE', l, 'X').email.greeting,
    );
    expect(new Set(greetings).size).toBe(4);
  });

  it('never says or implies that Headway sent anything', () => {
    for (const language of ['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI', 'MIXED'] as const) {
      const c = channelsFor(BODY, 'OWNER_UPDATE', language, 'Corner Cafe');
      const all = `${c.whatsapp} ${c.email.subject} ${c.email.body}`;
      expect(all, language).not.toMatch(/\b(sent|delivered|emailed|messaged) (by|from) Headway\b/i);
      expect(all, language).not.toMatch(/Headway has (sent|emailed|messaged)/i);
    }
  });
});
