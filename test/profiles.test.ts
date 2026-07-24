/* Author: Fabian Bitter (fabian@bitter.de) */

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Letter } from '../src/letter/model.js';
import { applyProfile, listProfiles, profilesPath } from '../src/server/profiles.js';

const fixture = {
  defaultProfile: 'one',
  profiles: {
    one: {
      description: 'First sender',
      sender: { name: 'Erika Musterfrau', street: 'Musterstraße 12', postalCode: '12345', city: 'Musterstadt', country: 'DE' },
      place: 'Musterstadt',
      locale: 'de',
      signature: { path: '/tmp/one.png', name: 'Erika Musterfrau' },
    },
    two: {
      sender: { name: 'Max Mustermann', street: 'Lindenallee 7', postalCode: '20095', city: 'Hamburg', country: 'DE' },
      place: 'Hamburg',
      signature: { path: '/tmp/two.png', title: 'Geschäftsführer' },
    },
  },
};

const directory = mkdtempSync(path.join(tmpdir(), 'pdf-letter-profiles-'));
const file = path.join(directory, 'profiles.json');
writeFileSync(file, JSON.stringify(fixture));
process.env.PDF_LETTER_PROFILES = file;
delete process.env.PDF_LETTER_PROFILE;

const letter = { recipient: { name: 'Jamie Taylor' }, body: 'Text' } as unknown as Letter;

test('the profile file is read from PDF_LETTER_PROFILES', () => {
  assert.equal(profilesPath(), file);
  const listed = listProfiles();
  assert.equal(listed.defaultProfile, 'one');
  assert.deepEqual(
    listed.profiles.map((profile) => profile.key),
    ['one', 'two'],
  );
  assert.equal(listed.profiles[0]?.hasSignature, true);
});

test('a profile supplies sender, place, locale and signature', () => {
  const applied = applyProfile(letter, 'two');
  assert.equal(applied.sender.name, 'Max Mustermann');
  assert.equal(applied.place, 'Hamburg');
  assert.equal(applied.signature?.path, '/tmp/two.png');
  // Without an explicit signature name the sender name is printed.
  assert.equal(applied.signature?.name, 'Max Mustermann');
  assert.equal(applied.signature?.title, 'Geschäftsführer');
});

test('without a profile key the default profile is used', () => {
  assert.equal(applyProfile(letter).sender.name, 'Erika Musterfrau');
});

test('the profile owns the identity, a passed sender cannot override it', () => {
  const applied = applyProfile(
    { ...letter, sender: { name: 'Fremder Absender', city: 'Berlin' } } as Letter,
    'one',
  );
  assert.equal(applied.sender.name, 'Erika Musterfrau');
  assert.equal(applied.sender.city, 'Musterstadt');
});

test('a signature image from the call is replaced by the profile', () => {
  const applied = applyProfile(
    { ...letter, signature: { base64: 'AAAA', path: '/tmp/fremd.png' } } as Letter,
    'one',
  );
  assert.equal(applied.signature?.path, '/tmp/one.png');
  assert.equal(applied.signature?.base64, undefined);
});

test('place and locale of the letter win over the profile', () => {
  const applied = applyProfile({ ...letter, place: 'Köln', locale: 'en' } as Letter, 'one');
  assert.equal(applied.place, 'Köln');
  assert.equal(applied.locale, 'en');
});

test('an unknown profile fails with the available keys', () => {
  assert.throws(() => applyProfile(letter, 'nobody'), /Unknown profile "nobody".*one, two/s);
});

test('without profile and without sender the letter is refused', () => {
  const previous = process.env.PDF_LETTER_PROFILES;
  process.env.PDF_LETTER_PROFILES = path.join(directory, 'missing.json');
  assert.throws(() => applyProfile(letter), /No profile and no sender/);
  process.env.PDF_LETTER_PROFILES = previous;
});
