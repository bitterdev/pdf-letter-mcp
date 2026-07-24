/* Author: Fabian Bitter (fabian@bitter.de) */

import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAddressLines, formatReturnAddress, formatSenderLines } from '../src/letter/address.js';

test('German address keeps the DIN 5008 order', () => {
  const lines = formatAddressLines({
    company: 'Muster GmbH',
    salutationLine: 'Frau',
    name: 'Dr. Erika Mustermann',
    additionalLine: 'Abteilung Einkauf',
    street: 'Bahnhofstraße 1',
    postalCode: '80331',
    city: 'München',
    country: 'DE',
  });
  assert.deepEqual(lines, [
    'Muster GmbH',
    'Frau Dr. Erika Mustermann',
    'Abteilung Einkauf',
    'Bahnhofstraße 1',
    '80331 München',
  ]);
});

test('a private recipient keeps the form of address on its own line', () => {
  const lines = formatAddressLines({
    salutationLine: 'Herrn',
    name: 'Max Mustermann',
    street: 'Lindenallee 7',
    postalCode: '20095',
    city: 'Hamburg',
  });
  assert.deepEqual(lines, ['Herrn', 'Max Mustermann', 'Lindenallee 7', '20095 Hamburg']);
});

test('a post office box replaces the street', () => {
  const lines = formatAddressLines({
    company: 'Muster GmbH',
    street: 'Bahnhofstraße 1',
    postOfficeBox: 'Postfach 12 34 56',
    postalCode: '80331',
    city: 'München',
  });
  assert.deepEqual(lines, ['Muster GmbH', 'Postfach 12 34 56', '80331 München']);
});

test('foreign recipients get an uppercase country line in the sender language', () => {
  const lines = formatAddressLines(
    { name: 'Jamie Taylor', street: '221B Baker Street', city: 'London', postalCode: 'NW1 6XE', country: 'GB' },
    { senderCountry: 'DE', locale: 'de' },
  );
  assert.deepEqual(lines, ['Jamie Taylor', '221B Baker Street', 'London', 'NW1 6XE', 'VEREINIGTES KÖNIGREICH']);
});

test('domestic recipients get no country line', () => {
  const lines = formatAddressLines(
    { name: 'Max Mustermann', street: 'Lindenallee 7', postalCode: '20095', city: 'Hamburg', country: 'DE' },
    { senderCountry: 'DE', locale: 'de' },
  );
  assert.equal(lines.at(-1), '20095 Hamburg');
});

test('US addresses use the city, state, zip line', () => {
  const lines = formatAddressLines(
    { name: 'Jane Doe', street: '1 Infinite Loop', city: 'Cupertino', region: 'CA', postalCode: '95014', country: 'US' },
    { senderCountry: 'DE', locale: 'en' },
  );
  assert.deepEqual(lines, ['Jane Doe', '1 Infinite Loop', 'Cupertino, CA 95014', 'UNITED STATES']);
});

test('manual address lines win over every other field', () => {
  const lines = formatAddressLines({ name: 'ignored', addressLines: ['Zeile 1', ' Zeile 2 '] });
  assert.deepEqual(lines, ['Zeile 1', 'Zeile 2']);
});

test('the return address line is a single line', () => {
  const line = formatReturnAddress({
    company: 'Musterfirma GmbH',
    name: 'Max Mustermann',
    street: 'Musterstraße 12',
    postalCode: '10115',
    city: 'Berlin',
  });
  assert.equal(line, 'Musterfirma GmbH · Musterstraße 12 · 10115 Berlin');
});

test('the sender block lists company, name and address', () => {
  const lines = formatSenderLines({
    company: 'Muster GmbH',
    name: 'Max Mustermann',
    street: 'Musterstraße 12',
    postalCode: '10115',
    city: 'Berlin',
  });
  assert.deepEqual(lines, ['Muster GmbH', 'Max Mustermann', 'Musterstraße 12', '10115 Berlin']);
});
