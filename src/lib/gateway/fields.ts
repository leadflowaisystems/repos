/**
 * The names the customer form posts under (M19).
 *
 * Here rather than beside the form on purpose. The form is a client
 * component, and a server action that imports a value from one gets a
 * reference to the component's module rather than the string itself — so the
 * action silently read no dimensions at all and every rating a customer gave
 * was dropped on the way in. Both sides import these from here, where there
 * is no boundary to cross.
 */

/** One dimension's rating posts as `dim:<key>`. */
export const DIMENSION_FIELD_PREFIX = 'dim:';

/** Every tapped specific posts under this one name. */
export const SIGNAL_FIELD = 'sig';
