# PRODUCT PRINCIPLES

RepOS is a Customer Feedback → Business Improvement System. Its promise is:
know what your customers really think, fix what matters, see whether it
actually improved.

It is not a SaaS product and it is not review management. The operator signs in
with a password. The business owner never does — they get one secret link per
business, read-only. A customer never does either — they scan a QR and can say
something anonymously. That is the whole access model.

## What we sell

> You run the business. We handle your customer feedback — and every month we
> tell you the 3 things your customers are trying to tell you, and whether your
> fixes worked.

The customer buys an outcome delivered as a document and a conversation. RepOS
exists to make one operator able to deliver that outcome to many clients without
the minutes-per-client climbing.

## The three questions every feature must answer

1. Does this get a client?
2. Does this retain a client?
3. Does this reduce my minutes per client per month?

A feature that answers none of these does not get built, however interesting it
is.

## Non-negotiables

**The safe path is the easiest path.** If a shortcut would create platform or
compliance exposure, the product should make the compliant route the one that
takes fewer clicks. See COMPLIANCE.md.

**AI classifies and phrases. Application code counts.** A language model may
read a mixed English/Hinglish/Marathi sentence and decide which taxonomy bucket
it belongs in, and it may rewrite a finding more naturally. It may never produce
a number that reaches a report. This is enforced mechanically by a numeric
guard, not by prompt instructions.

**Say "not enough data" out loud.** A monthly report that invents a pattern from
four reviews destroys the trust the whole service runs on. RepOS has hard
evidence floors and states plainly when it cannot say something.

**Never fabricate a figure.** Blank means not observed. Not zero, not estimated,
not "approximately".

**No vertical is hardcoded.** All vertical knowledge lives in JSON under
`/packs`. Adding a business type is a data change, not a code change.

**Nothing leaves the laptop by itself.** No fetching, no posting, no sync, no
telemetry. The operator observes, enters and sends things themselves.

## What we deliberately do not build

Billing, multi-tenancy, user accounts, teams, roles, invitations, analytics,
notification infrastructure, and every other piece of SaaS machinery. One
operator, one laptop, one SQLite file.

No Google, Meta or WhatsApp integration: no OAuth, no review fetching, no reply
publishing, no messaging API. A public review link is a URL the operator types
in by hand, offered to every customer after they have already left feedback.

There is exactly one password, for the operator, so a public address cannot be
opened by a stranger (M16). The owner's own view needs no password — their link
is the credential, so RepOS holds no owner or customer credentials at all.

The long-term goal is that the owner needs to open this system only when they
want to; everything that matters also reaches them as a message the operator
sends by hand.
