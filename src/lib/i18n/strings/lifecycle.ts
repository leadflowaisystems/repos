import type { Namespace } from '../t';

/**
 * Service state in words: trial, active, paused, ended, locked, request received
 *
 * English is the source. Hindi and Marathi say the SAME thing — no meaning
 * added, none dropped, and no number changed. A phrase with no `hi` or `mr`
 * falls back to English rather than showing a key.
 */
export const lifecycle = {} satisfies Namespace;
