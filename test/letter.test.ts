/* Author: Fabian Bitter (fabian@bitter.de) */

import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { formatDate } from '../src/letter/format.js';
import { getLabels, normalizeLocale, SUPPORTED_LOCALES } from '../src/letter/i18n.js';
import type { Letter } from '../src/letter/model.js';
import { renderLetter } from '../src/letter/render.js';
import { deriveSalutation, surnameWithTitles } from '../src/letter/salutation.js';
import { slugify } from '../src/server/output.js';
import { letterSchema, letterShape, signatureSchema } from '../src/server/schema.js';

/** Minimal 8 bit RGBA PNG: a dark stroke on a fully transparent background. */
async function createAlphaPng(width = 200, height = 80): Promise<Buffer> {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter type "none"
    for (let x = 0; x < width; x += 1) {
      const onStroke = Math.abs(y - height / 2 - Math.sin(x / 12) * 12) < 3;
      const pixel = rowStart + 1 + x * 4;
      raw[pixel] = 20;
      raw[pixel + 1] = 20;
      raw[pixel + 2] = 40;
      raw[pixel + 3] = onStroke ? 255 : 0;
    }
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const baseLetter: Letter = {
  sender: { name: 'Erika Musterfrau', street: 'Musterstraße 12', postalCode: '10115', city: 'Berlin', country: 'DE' },
  recipient: {
    salutationLine: 'Herrn',
    name: 'Max Mustermann',
    street: 'Lindenallee 7',
    postalCode: '20095',
    city: 'Hamburg',
  },
  date: '2026-07-24',
  subject: 'Testbrief',
  body: 'Dies ist ein Testbrief.',
};

test('dates are formatted per locale and style', () => {
  assert.equal(formatDate('2026-07-24', 'numeric', 'de'), '24.07.2026');
  assert.equal(formatDate('2026-07-24', 'iso', 'de'), '2026-07-24');
  assert.equal(formatDate('2026-07-24', 'long', 'de'), '24. Juli 2026');
  assert.equal(formatDate('2026-07-24', 'numeric', 'en-US'), '07/24/2026');
  assert.equal(formatDate('24.07.2026', 'iso', 'de'), '2026-07-24');
  assert.equal(formatDate('kurz vor Weihnachten', 'numeric', 'de'), 'kurz vor Weihnachten');
});

test('every locale ships a complete label set', () => {
  const reference = Object.keys(getLabels('de'));
  for (const locale of SUPPORTED_LOCALES) {
    const labels = getLabels(locale) as unknown as Record<string, string>;
    for (const key of reference) {
      // subjectPrefix is intentionally empty wherever the language prints no label.
      const expected = key === 'subjectPrefix' ? 'string' : 'filled';
      assert.equal(typeof labels[key], 'string', `${locale} is missing "${key}"`);
      if (expected === 'filled') assert.ok(labels[key]?.trim(), `${locale} has an empty "${key}"`);
    }
  }
  assert.equal(normalizeLocale('en-GB'), 'en');
  assert.equal(normalizeLocale('xx'), 'de');
});

test('the salutation is derived from the recipient', () => {
  const labels = getLabels('de');
  assert.equal(deriveSalutation({ salutationLine: 'Herrn', name: 'Max Mustermann' }, labels), 'Sehr geehrter Herr Mustermann,');
  assert.equal(
    deriveSalutation({ salutationLine: 'Frau', name: 'Dr. Erika Mustermann' }, labels),
    'Sehr geehrte Frau Dr. Mustermann,',
  );
  assert.equal(deriveSalutation({ company: 'Muster GmbH' }, labels), 'Sehr geehrte Damen und Herren,');
  assert.equal(surnameWithTitles('Erika von Mustermann'), 'von Mustermann');
});

test('a letter renders to a single page PDF without warnings', async () => {
  const result = await renderLetter(baseLetter);
  assert.equal(result.pageCount, 1);
  assert.deepEqual(result.warnings, []);
  assert.equal(Buffer.from(result.bytes.slice(0, 5)).toString(), '%PDF-');
  assert.equal(result.layout.addressField.top, 45);
  assert.deepEqual(result.layout.addressLines, ['Herrn', 'Max Mustermann', 'Lindenallee 7', '20095 Hamburg']);
  assert.equal(result.layout.date, '24.07.2026');
});

test('long letters break into several pages', async () => {
  const body = Array.from({ length: 60 }, (_, index) => `Absatz ${index + 1} mit etwas Text zur Füllung der Seite.`).join(
    '\n\n',
  );
  const result = await renderLetter({ ...baseLetter, body });
  assert.ok(result.pageCount >= 2, `expected several pages, got ${result.pageCount}`);
});

test('an oversized address field is reported', async () => {
  const result = await renderLetter({
    ...baseLetter,
    recipient: {
      ...baseLetter.recipient,
      addressLines: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    },
  });
  assert.ok(result.warnings.some((warning) => warning.includes('address field')));
});

test('a tall letterhead in form A is reported', async () => {
  const result = await renderLetter({
    ...baseLetter,
    form: 'A',
    letterhead: { lines: ['Zeile 1', 'Zeile 2', 'Zeile 3', 'Zeile 4', 'Zeile 5', 'Zeile 6'] },
  });
  assert.ok(result.warnings.some((warning) => warning.includes('letterhead')));
});

test('locales change the fixed texts', async () => {
  const result = await renderLetter({ ...baseLetter, locale: 'fr', place: 'Berlin' });
  assert.equal(result.layout.locale, 'fr');
  assert.equal(result.pageCount, 1);
});

test('without a signature image only one blank line separates closing and name', async () => {
  const result = await renderLetter({ ...baseLetter, signature: { name: 'Erika Musterfrau' } });
  const { lineHeightMm } = result.layout;
  const spacing = result.layout.signature.nameTop - result.layout.signature.closingTop;
  assert.ok(
    Math.abs(spacing - lineHeightMm * 2) < 0.01,
    `expected closing plus one blank line (${lineHeightMm * 2} mm), got ${spacing} mm`,
  );
});

test('the address block is centred in the address field', async () => {
  const result = await renderLetter(baseLetter);
  const field = result.layout.addressField;
  const { lineHeightMm } = result.layout;
  const blockBottom = result.layout.addressTop + result.layout.addressLines.length * lineHeightMm;
  const above = (result.layout.returnAddressTop ?? 0) - field.top;
  const below = field.top + field.height - blockBottom;
  assert.ok(above > 0, 'the return address keeps a distance to the top edge');
  assert.ok(Math.abs(above - below) < 1.5, `expected an even split, got ${above} mm above and ${below} mm below`);
});

test('two more address lines still fit into the address field', async () => {
  const result = await renderLetter({
    ...baseLetter,
    recipient: {
      company: 'Mustermann Handels GmbH & Co. KG',
      salutationLine: 'Herrn',
      name: 'Max Mustermann',
      additionalLine: 'Abteilung Einkauf',
      street: 'Musterstr. 1',
      postalCode: '12345',
      city: 'Musterstadt',
      country: 'DE',
    },
  });
  const field = result.layout.addressField;
  const bottom = result.layout.addressTop + result.layout.addressLines.length * result.layout.lineHeightMm;
  assert.equal(result.layout.addressLines.length, 5);
  assert.ok(bottom <= field.top + field.height, `block ends at ${bottom} mm, field ends at ${field.top + field.height} mm`);
  assert.deepEqual(result.warnings, []);
});

test('closing, signature and name stay on one page', async () => {
  // Grows the body line by line so the closing meets the page break head on.
  for (let paragraphs = 30; paragraphs <= 46; paragraphs += 1) {
    const body = Array.from({ length: paragraphs }, (_, index) => `Zeile ${index + 1} des Brieftextes.`).join('\n');
    const result = await renderLetter({
      ...baseLetter,
      body,
      signature: { name: 'Erika Musterfrau', title: 'Geschäftsführerin' },
    });
    assert.equal(
      result.layout.signature.closingPage,
      result.layout.signature.namePage,
      `closing and name drifted apart at ${paragraphs} lines`,
    );
    assert.ok(
      result.layout.signature.nameTop < 272,
      `the name ran past the bottom margin at ${paragraphs} lines`,
    );
  }
});

test('the default letter carries place and date, no information block', async () => {
  const result = await renderLetter({ ...baseLetter, place: 'Musterstadt' });
  assert.equal(result.layout.infoBlockRows, 0, 'no block on the right');
  assert.equal(result.layout.placeDate, 'Musterstadt, 24.07.2026');
});

test('an information block takes the date over from the place line', async () => {
  const result = await renderLetter({
    ...baseLetter,
    place: 'Musterstadt',
    infoBlock: { items: [{ label: 'Kundennummer', value: '123' }] },
  });
  assert.equal(result.layout.infoBlockRows, 2, 'entry plus date');
  assert.equal(result.layout.placeDate, null);
});

test('subject lines are printed below the subject', async () => {
  const result = await renderLetter({
    ...baseLetter,
    subjectLines: ['Zeichen: SW-2026-0815', 'Kunden-Nummer: 000000000'],
  });
  const { subjectTop, bodyTop, lineHeightMm } = result.layout;
  // Subject plus two reference lines, then two blank lines before the salutation.
  assert.ok(
    Math.abs(bodyTop - (subjectTop + lineHeightMm * 3 + lineHeightMm * 4)) < 0.05,
    `salutation and body moved to ${bodyTop} mm`,
  );
});

test('a signature image overlays the blank line and keeps the alpha channel', async () => {
  const signaturePng = await createAlphaPng();
  const plain = await renderLetter({ ...baseLetter, signature: { name: 'Erika Musterfrau' } });
  const signed = await renderLetter({
    ...baseLetter,
    signature: { base64: signaturePng.toString('base64'), name: 'Erika Musterfrau' },
  });

  assert.equal(
    signed.layout.signature.nameTop,
    plain.layout.signature.nameTop,
    'the image must not push the name down',
  );
  assert.deepEqual(signed.warnings, []);
  // pdf-lib turns the alpha channel into a soft mask.
  assert.ok(Buffer.from(signed.bytes).includes('/SMask'), 'transparency was dropped');
});

test('the signature stays in the size range of the closing line', async () => {
  const signaturePng = await createAlphaPng(600, 240);

  const auto = await renderLetter({
    ...baseLetter,
    signature: { base64: signaturePng.toString('base64'), name: 'Erika Musterfrau' },
  });
  const size = auto.layout.signature.imageSize;
  assert.ok(size, 'no signature was drawn');
  assert.ok(size.widthMm >= 20 && size.widthMm <= 60, `automatic width ${size.widthMm} mm`);
  // Fits between the printed name and the blank line above the closing.
  assert.ok(size.heightMm <= auto.layout.lineHeightMm * 3, `automatic height ${size.heightMm} mm`);
  assert.deepEqual(auto.warnings, [], 'the automatic size is not worth a warning');

  const huge = await renderLetter({
    ...baseLetter,
    signature: { base64: signaturePng.toString('base64'), widthMm: 160, name: 'Erika Musterfrau' },
  });
  const capped = huge.layout.signature.imageSize;
  assert.ok(capped, 'no signature was drawn');
  assert.ok(capped.widthMm <= 80, `capped width ${capped.widthMm} mm`);
  assert.ok(capped.heightMm <= huge.layout.lineHeightMm * 3, `capped height ${capped.heightMm} mm`);
  // 600 x 240 pixels, the aspect ratio has to survive the scaling.
  assert.ok(Math.abs(capped.widthMm / capped.heightMm - 600 / 240) < 0.01, 'aspect ratio changed');
  assert.ok(huge.warnings.some((warning) => warning.includes('scaled down')));
});

test('the MCP surface exposes content only, no layout knobs', () => {
  const fields = Object.keys(letterShape);
  const forbidden = [
    'form',
    'geometry',
    'letterhead',
    'footer',
    'infoBlock',
    'addressLayout',
    'font',
    'align',
    'debug',
    'foldMarks',
    'holeMark',
    'subjectBold',
    'showPlaceDate',
    'hyphenation',
    'labels',
  ];
  for (const field of forbidden) {
    assert.ok(!fields.includes(field), `"${field}" must not be callable, the layout belongs to the server`);
  }
  const signatureFields = Object.keys(signatureSchema.shape);
  for (const field of ['widthMm', 'heightMm', 'offsetXMm', 'spaceMm']) {
    assert.ok(!signatureFields.includes(field), `signature.${field} must not be callable`);
  }
  // Content stays available.
  for (const field of ['sender', 'recipient', 'subject', 'subjectLines', 'body', 'signature', 'enclosures']) {
    assert.ok(fields.includes(field), `"${field}" is missing`);
  }
});

test('unknown layout fields sent by a client are stripped', () => {
  const parsed = letterSchema.parse({
    sender: { name: 'Erika Musterfrau' },
    recipient: { name: 'Max Mustermann' },
    body: 'Text',
    signature: { name: 'Erika Musterfrau', spaceMm: 40, widthMm: 120 },
    geometry: { marginLeft: 40 },
  } as unknown);
  assert.equal('geometry' in parsed, false);
  assert.equal('spaceMm' in (parsed.signature ?? {}), false);
  assert.equal('widthMm' in (parsed.signature ?? {}), false);
});

test('file names are derived from the subject', () => {
  assert.equal(slugify('Kündigung des Wartungsvertrags Nr. 4711'), 'kuendigung-des-wartungsvertrags-nr-4711');
  assert.equal(slugify('   '), 'brief');
});
