import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  allowedAccounts,
  checkAccess,
  findAllowedAccount,
  greetingName,
  normalizeEmail,
} = await import('../app/allowed-accounts.ts');

const google = (email, overrides = {}) => ({
  email,
  emailVerified: true,
  providers: ['google.com'],
  ...overrides,
});

test('gmail addresses compare the way Google reads them', () => {
  assert.equal(normalizeEmail('MaTe@Gmail.com'), 'mate@gmail.com');
  assert.equal(normalizeEmail('  ma.te.o@gmail.com '), 'mateo@gmail.com');
  assert.equal(normalizeEmail('mateo+bodas@gmail.com'), 'mateo@gmail.com');
  assert.equal(normalizeEmail('ma.teo+mesas@googlemail.com'), 'mateo@gmail.com');
});

test('other domains keep their local part, including Google Workspace', () => {
  assert.equal(normalizeEmail('ju.liet@suempresa.com'), 'ju.liet@suempresa.com');
  assert.equal(normalizeEmail('Juliet+Bodas@Suempresa.com'), 'juliet+bodas@suempresa.com');
});

test('anything that is not an address matches nothing', () => {
  for (const value of ['', '   ', 'mateo', '@gmail.com', 'mateo@', 'mateo@gmail', 'a@.com']) {
    assert.equal(normalizeEmail(value), '', `expected no match for ${JSON.stringify(value)}`);
  }
});

test('an entry left without an address never lets anyone in', () => {
  const pending = allowedAccounts.filter((entry) => !entry.email);
  assert.ok(pending.length > 0, 'this test guards the placeholder entries');
  assert.equal(findAllowedAccount(''), null);
  assert.equal(findAllowedAccount(null), null);
  assert.equal(findAllowedAccount('   '), null);
});

test('the list recognises its people through gmail spelling variants', () => {
  const [mateo] = allowedAccounts;
  assert.ok(mateo.email, 'the first entry should be configured');
  assert.equal(findAllowedAccount(mateo.email)?.name, mateo.name);
  assert.equal(findAllowedAccount(mateo.email.toUpperCase())?.name, mateo.name);
  const [local, domain] = mateo.email.split('@');
  if (domain === 'gmail.com') {
    assert.equal(findAllowedAccount(`${local}+mesas@gmail.com`)?.name, mateo.name);
    assert.equal(findAllowedAccount(`${local.split('').join('.')}@gmail.com`)?.name, mateo.name);
  }
});

test('only a verified Google account on the list reaches the plan', () => {
  const [mateo] = allowedAccounts;
  assert.deepEqual(checkAccess(google(mateo.email)), {
    status: 'allowed',
    name: mateo.name,
  });
  assert.deepEqual(checkAccess(google('alguien@gmail.com')), { status: 'denied' });
  assert.deepEqual(
    checkAccess(google(mateo.email, { emailVerified: false })),
    { status: 'unverified' },
  );
  assert.deepEqual(
    checkAccess(google(mateo.email, { providers: ['password'] })),
    { status: 'not-google' },
  );
  assert.deepEqual(
    checkAccess(google(mateo.email, { providers: [] })),
    { status: 'not-google' },
  );
  assert.deepEqual(checkAccess(google(null)), { status: 'not-google' });
});

test('a Google account linked alongside another provider still passes', () => {
  const [mateo] = allowedAccounts;
  assert.deepEqual(
    checkAccess(google(mateo.email, { providers: ['password', 'google.com'] })),
    { status: 'allowed', name: mateo.name },
  );
});

test('the greeting prefers the Google profile and falls back to the list', () => {
  assert.equal(greetingName('Mateo Espinosa Cubillos', 'Mateo'), 'Mateo');
  assert.equal(greetingName('  Juliet  Restrepo ', 'Juliet'), 'Juliet');
  assert.equal(greetingName(null, 'Juliet'), 'Juliet');
  assert.equal(greetingName('   ', 'Mateo'), 'Mateo');
});
