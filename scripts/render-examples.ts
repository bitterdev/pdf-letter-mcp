/* Author: Fabian Bitter (fabian@bitter.de) */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Letter } from '../src/letter/model.js';
import { renderLetter } from '../src/letter/render.js';

const outputDir = path.resolve(fileURLToPath(new URL('../../examples', import.meta.url)));

/** The one letter layout: return address, recipient, place and date, bold subject block. */
const standard: Letter = {
  locale: 'de',
  sender: { name: 'Erika Musterfrau', street: 'Musterstraße 12', postalCode: '12345', city: 'Musterstadt', country: 'DE' },
  recipient: {
    company: 'Stadtwerke Musterstadt',
    street: 'Industriestraße 8',
    postalCode: '12345',
    city: 'Musterstadt',
  },
  place: 'Musterstadt',
  date: '2026-07-24',
  dateStyle: 'long',
  subject: 'Widerspruch gegen die Jahresabrechnung vom 01.07.2026',
  subjectLines: ['Zeichen: SW-2026-0815', 'Kunden-Nummer: 000000000'],
  body: `hiermit widerspreche ich der Jahresabrechnung vom 01.07.2026 für die Lieferstelle Musterstraße 12.

Der abgerechnete Verbrauch liegt deutlich über dem Vorjahreswert. Der von mir am 30.06.2026 gemeldete Zählerstand von 12.345 kWh wurde offenbar nicht berücksichtigt.

Ich bitte um eine korrigierte Abrechnung und um eine kurze schriftliche Bestätigung des Eingangs.`,
  enclosures: ['Kopie der Jahresabrechnung'],
  signature: { name: 'Erika Musterfrau' },
};

/** Same layout, other language and a foreign recipient address. */
const english: Letter = {
  ...standard,
  locale: 'en',
  recipient: {
    company: 'Example Ltd.',
    name: 'Jamie Taylor',
    street: '221B Baker Street',
    city: 'London',
    postalCode: 'NW1 6XE',
    country: 'GB',
  },
  subject: 'Objection to the annual statement of 01/07/2026',
  subjectLines: ['Reference: SW-2026-0815', 'Customer number: 000000000'],
  body: `I hereby object to the annual statement of 01/07/2026 for the supply point Musterstraße 12.

The billed consumption is well above last year. The meter reading of 12,345 kWh that I reported on 30/06/2026 has apparently not been taken into account.

Please send a corrected statement and a short written confirmation of receipt.`,
  enclosures: ['Copy of the annual statement'],
};

const examples: { name: string; letter: Letter }[] = [
  { name: 'standard-letter', letter: standard },
  { name: 'standard-letter-debug', letter: { ...standard, debug: true } },
  { name: 'english-letter', letter: english },
];

await mkdir(outputDir, { recursive: true });
for (const example of examples) {
  const result = await renderLetter(example.letter);
  const file = path.join(outputDir, `${example.name}.pdf`);
  await writeFile(file, result.bytes);
  process.stdout.write(
    `${example.name}: ${result.pageCount} page(s) -> ${file}${
      result.warnings.length ? `\n  warnings: ${result.warnings.join(' | ')}` : ''
    }\n`,
  );
}
