// Profiles seen before on this device, so returning means tapping a name
// instead of picking an account again. These are display hints only — a name,
// an address and an avatar URL. No password, token or session is written here:
// the session itself lives in Firebase's own storage, and Google is still the
// one that verifies who is entering.

const STORAGE_KEY = 'ensulugar-cuentas-recordadas-v1';
const MAX_REMEMBERED = 4;

export type RememberedAccount = {
  email: string;
  name: string;
  photo: string | null;
  lastSeen: number;
};

function isRemembered(value: unknown): value is RememberedAccount {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.email === 'string' &&
    entry.email.includes('@') &&
    typeof entry.name === 'string' &&
    (entry.photo === null || typeof entry.photo === 'string') &&
    typeof entry.lastSeen === 'number' &&
    Number.isFinite(entry.lastSeen)
  );
}

export function readRememberedAccounts(): RememberedAccount[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRemembered)
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_REMEMBERED);
  } catch {
    // A device that blocks storage simply greets everyone as new.
    return [];
  }
}

function save(accounts: RememberedAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.slice(0, MAX_REMEMBERED)));
  } catch {
    // Remembering is a convenience; entering still works without it.
  }
}

export function rememberAccount(account: Omit<RememberedAccount, 'lastSeen'>) {
  if (typeof localStorage === 'undefined' || !account.email.includes('@')) return;
  const others = readRememberedAccounts().filter(
    (entry) => entry.email.toLowerCase() !== account.email.toLowerCase(),
  );
  save([{ ...account, lastSeen: Date.now() }, ...others]);
}

export function forgetAccount(email: string) {
  if (typeof localStorage === 'undefined') return;
  save(
    readRememberedAccounts().filter(
      (entry) => entry.email.toLowerCase() !== email.toLowerCase(),
    ),
  );
}
