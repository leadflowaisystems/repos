import { supabaseConfig, supabaseServerClient } from '@/lib/auth/supabase';
import { authRedirectUrl, callbackFor } from '@/lib/auth/redirect';

/**
 * DELIVERING AN INVITATION.
 *
 * Until now RepOS created an invitation and handed the owner a link to pass on
 * themselves. The reason was written into `@/lib/team/service`: "delivery is
 * the operator's job UNTIL THE SUPABASE PROJECT EXISTS". The project exists.
 * This is the part that was deferred.
 *
 * WHY SUPABASE AUTH AND NOT AN EMAIL SERVICE. Three constraints meet here and
 * only one answer satisfies all of them. RepOS may make no outbound call from
 * anywhere in `src/` except the AI adapter — a rule with a test behind it — so
 * an HTTP email API is out. `nodemailer` and the string `smtp.` are banned
 * outright in `src/`, so a hand-rolled transport is out. And no service-role
 * key is configured, so the Supabase admin invite API is out. What remains is
 * the mechanism the product already sends its password-reset and confirmation
 * mail through, using the key the application already holds: Supabase Auth,
 * with the anon key, from a server action. No new secret, no new dependency,
 * no new service, and one identity system rather than two.
 *
 * WHAT THE INVITEE GETS. A sign-in link to the address the owner typed. Opened,
 * it establishes their session and lands them on this business's invitation
 * page — which is where the business name, the role, the expiry and the Accept
 * button live. That page is RepOS's, so it is the surface RepOS controls and
 * the one that has to be client-ready. The mail itself is the project's own
 * template; an owner who wants RepOS's wording in it pastes the copy in
 * `prisma/m20/README.md` into their Supabase dashboard once.
 *
 * WHY IT HAS TO SIGN THEM IN. Accepting requires an account whose email
 * matches the invitation — that is the check which makes a leaked link useless.
 * A person invited for the first time has no account, so a link that only
 * showed them the invitation would strand them at "please sign in". One link
 * that does both is the whole flow.
 *
 * THE TOKEN IS NOT IN THIS MODULE'S OUTPUT. It goes into the redirect URL and
 * nowhere else: not into a log line, not into an error, not into the metadata.
 */

export const INVITE_PATH = '/invite';

/** The address an invitee opens. Absolute, because it is going into an email. */
export async function invitationLink(token: string): Promise<string | null> {
  return (await authRedirectUrl(`${INVITE_PATH}/${token}`)) ?? null;
}

export type InviteDelivery =
  /** The email provider accepted the message. Not proof it was read. */
  | { sent: true; email: string }
  /** Nothing was sent, and this is the reason an owner can act on. */
  | { sent: false; reason: string };

export type InvitationEmail = {
  email: string;
  token: string;
  businessName: string;
  /** As the owner chose it, in their words: "an owner" / "a staff member". */
  roleLabel: string;
  expiresAt: Date;
};

/**
 * Sends the invitation, and says honestly whether it went.
 *
 * Never throws: an invitation that exists with an undelivered email is a
 * recoverable situation the owner fixes by copying the link, and turning it
 * into a failed action would throw away the invitation they just made.
 */
export async function deliverInvitation(input: InvitationEmail): Promise<InviteDelivery> {
  const config = supabaseConfig();
  if (!config.ok) {
    return { sent: false, reason: 'Email is not configured for this installation.' };
  }

  // Straight to the invitation page, through the callback that exchanges the
  // link for a session and provisions the account on the way past.
  const redirectTo = await authRedirectUrl(callbackFor(`${INVITE_PATH}/${input.token}`));
  if (!redirectTo) {
    return {
      sent: false,
      reason:
        'RepOS does not know its own public address yet, so it cannot put a working link in an email. Set it on Settings.',
    };
  }

  try {
    const supabase = await supabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: input.email,
      options: {
        emailRedirectTo: redirectTo,
        // A first-time invitee has no account. Creating one on their behalf is
        // the invitation; RepOS's own User row is still only written when they
        // actually arrive, by `provisionUser` in the callback.
        shouldCreateUser: true,
        // Available to the project's email template as {{ .Data.* }}, for an
        // owner who wants the business name in the subject line. Never the
        // token, which is in the link and nowhere else.
        data: {
          repos_business: input.businessName,
          repos_role: input.roleLabel,
          repos_invitation: 'true',
        },
      },
    });
    if (error) return { sent: false, reason: readable(error.message) };
    return { sent: true, email: input.email };
  } catch {
    // A network or configuration failure. The message is deliberately not the
    // exception's, which can carry a URL or a key fragment.
    return { sent: false, reason: 'The email could not be sent just now.' };
  }
}

/**
 * Supabase's wording, turned into something an owner can act on.
 *
 * The rate-limit case is the one that will actually happen: a project on the
 * built-in email service is limited to a couple of messages an hour, and the
 * owner needs to know the invitation is fine and only the mail is not.
 */
function readable(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('rate') || text.includes('limit') || text.includes('too many')) {
    return 'The email service is rate-limited right now — the invitation is still valid, so send the link yourself.';
  }
  if (text.includes('signup') || text.includes('not allowed') || text.includes('disabled')) {
    return 'The Supabase project is not accepting new sign-ups, so it would not email a new address. Send the link yourself.';
  }
  if (text.includes('invalid') && text.includes('email')) {
    return 'The email provider refused that address.';
  }
  return `The email was not accepted: ${message}`;
}

/**
 * How the role reads in a sentence written to a person.
 *
 * BUSINESS_OWNER and BUSINESS_STAFF are database values and should not appear
 * in an email or on a page.
 */
export function roleLabel(role: string): string {
  return role === 'BUSINESS_OWNER' ? 'an owner' : 'a team member';
}
