# PRODUCT PRINCIPLES

RepOS is an internal operator tool. It is not a SaaS product, and the business
owner is not expected to log into it.

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

Authentication, billing, multi-tenancy, deployment infrastructure, user
accounts, analytics, notification infrastructure, and every other piece of SaaS
machinery. One operator, one laptop, one SQLite file.

The long-term goal is that the owner never needs to open this system at all.
