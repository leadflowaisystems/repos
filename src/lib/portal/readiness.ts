/**
 * THE FIRST READ — one number, kept where the website can quote it.
 *
 * This module used to decide whether a business was "ready" for a reading at
 * all: below five responses every page showed one countdown card instead —
 * "2 / 5 responses", "3 more responses to go" — and nothing else. It was
 * honest, and it made Headway look like a product waiting for a threshold
 * before doing anything, when one response is already one customer heard.
 *
 * The evidence ladder replaced the gate (`./ladder.ts`, Oct 2026). Every page
 * now shows the strongest truthful thing the evidence supports at every count,
 * and five is where the FIRST READ begins — a stage on the ladder, not a lock.
 * The number stays here, free of the database, so the public website can quote
 * it (`PRODUCT_RULES.firstReadingAt`, held equal by tests/m26).
 */

/** Read responses at which the first read — likes, what stands out, what to watch — begins. */
export const FIRST_READING_AT = 5;
