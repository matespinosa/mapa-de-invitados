// Who may open the plan. Signing in with Google is the only door, and only the
// accounts listed here reach the organizer; anyone else lands on a private
// notice. Emails are public identifiers, not secrets: the real protection is
// the Firestore rules, which tie every plan document to its own account.

export type AllowedAccount = {
  /** Google address of the person. An empty value is an entry still to fill. */
  email: string;
  /** Short name for the greeting, used until Google hands us a profile name. */
  name: string;
};

export const allowedAccounts: AllowedAccount[] = [
  { email: 'matespinosa09@gmail.com', name: 'Mateo' },
  // Replace the empty value with Juliet's Google address so she can enter.
  { email: '', name: 'Juliet' },
];

export const GOOGLE_PROVIDER = 'google.com';

const gmailDomains = new Set(['gmail.com', 'googlemail.com']);

/**
 * Reduce an address to the form Google itself compares. Gmail ignores dots and
 * everything after a `+`, so `ma.teo+bodas@gmail.com` and `mateo@gmail.com`
 * are the same inbox and must match the same entry. Other domains — Google
 * Workspace included — keep their local part untouched. Anything that is not a
 * plausible address returns an empty string, which never matches an entry.
 */
export function normalizeEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1) return '';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return '';
  }
  if (!gmailDomains.has(domain)) return `${local}@${domain}`;
  const base = local.split('+')[0].replaceAll('.', '');
  return base ? `${base}@gmail.com` : '';
}

export function findAllowedAccount(email: string | null | undefined): AllowedAccount | null {
  const wanted = normalizeEmail(email ?? '');
  if (!wanted) return null;
  return allowedAccounts.find((entry) => normalizeEmail(entry.email) === wanted) ?? null;
}

export type AccountProfile = {
  email: string | null;
  emailVerified: boolean;
  providers: readonly string[];
};

export type AccessVerdict =
  | { status: 'allowed'; name: string }
  | { status: 'not-google' }
  | { status: 'unverified' }
  | { status: 'denied' };

/**
 * Decide whether a signed-in account reaches the organizer. The account has to
 * come from Google's provider with a verified address — that is what makes it a
 * Google account rather than a look-alike — and then be one of the people on
 * the list above.
 */
export function checkAccess(profile: AccountProfile): AccessVerdict {
  if (!profile.providers.includes(GOOGLE_PROVIDER)) return { status: 'not-google' };
  if (!profile.email || !normalizeEmail(profile.email)) return { status: 'not-google' };
  if (!profile.emailVerified) return { status: 'unverified' };
  const match = findAllowedAccount(profile.email);
  return match ? { status: 'allowed', name: match.name } : { status: 'denied' };
}

/** First name for the greeting, preferring what Google knows over our list. */
export function greetingName(
  displayName: string | null | undefined,
  fallback: string,
): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0];
  return first || fallback;
}
