/**
 * Turns "Ice Palace Arena" + "Fall River" into "ice-palace-arena-fall-river".
 * Used as a starting-point suggestion for the final rinks.id slug when an
 * admin approves a new-rink suggestion — admin can edit it before confirming.
 */
export function slugify(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
