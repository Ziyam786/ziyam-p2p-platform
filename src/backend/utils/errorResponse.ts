/**
 * Prisma/DB errors (and other unexpected internals) can leak schema/column
 * names, constraint names, or raw SQL in their .message — those must never
 * reach the client, only the server log. Deliberately-thrown application
 * errors (`new Error('a short user-facing sentence')`, the pattern used
 * throughout this codebase for validation/business-rule failures — see
 * PayoutEngine, hostReview.routes.ts, etc.) are safe to pass through as-is;
 * that's how this app already surfaces real, helpful error copy to users.
 */
export function safeErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): string {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = String(error?.message ?? '');
  const looksInternal = /^P\d{4}$/.test(code) || /prisma|constraint|column|relation .* does not exist|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(message);
  return looksInternal ? fallback : message || fallback;
}
