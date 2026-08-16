const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and lowercases an email so the same address always maps to the same stored/looked-up value, regardless of how a user typed it. */
export function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/** Trims whitespace only — deliberately does not reformat digits, since existing accounts may already be stored in varying formats and this must keep matching them on login. */
export function normalizePhone(phone: unknown): string {
  return String(phone ?? '').trim();
}

export function isValidPhone(phone: string): boolean {
  return /^[+\d][\d\s-]{6,19}$/.test(phone);
}

export function normalizeFullName(name: unknown): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}
