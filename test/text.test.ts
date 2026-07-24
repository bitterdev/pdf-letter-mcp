/* Author: Fabian Bitter (fabian@bitter.de) */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHyphenator, parseBody, parseInline, wrapRuns, type Line } from '../src/letter/text.js';

/** Every character is one unit wide, which keeps the expectations readable. */
const measure = (text: string) => text.length;
const plain = (lines: Line[]) => lines.map((line) => line.segments.map((segment) => segment.text).join(''));

test('inline markup becomes styled runs', () => {
  const runs = parseInline('Normal **fett** und *kursiv*.');
  assert.deepEqual(runs, [
    { text: 'Normal ', bold: false, italic: false },
    { text: 'fett', bold: true, italic: false },
    { text: ' und ', bold: false, italic: false },
    { text: 'kursiv', bold: false, italic: true },
    { text: '.', bold: false, italic: false },
  ]);
});

test('escaped markers stay literal', () => {
  assert.deepEqual(parseInline('5 \\* 3'), [{ text: '5 * 3', bold: false, italic: false }]);
});

test('blank lines separate paragraphs and dashes start lists', () => {
  const blocks = parseBody('Erster Absatz.\nZweite Zeile.\n\n- Punkt eins\n- Punkt zwei\n\n1. Erstens');
  assert.deepEqual(
    blocks.map((block) => block.type),
    ['paragraph', 'blank', 'list-item', 'list-item', 'blank', 'list-item'],
  );
  assert.equal(blocks[0]?.type === 'paragraph' && blocks[0].runs[0]?.text, 'Erster Absatz.\nZweite Zeile.');
  assert.equal(blocks[5]?.type === 'list-item' && blocks[5].marker, '1.');
});

test('markdown mode reflows single newlines', () => {
  const blocks = parseBody('Erste Zeile\nzweite Zeile', 'markdown');
  assert.equal(blocks[0]?.type === 'paragraph' && blocks[0].runs[0]?.text, 'Erste Zeile zweite Zeile');
});

test('page break markers become their own block', () => {
  const blocks = parseBody('Text\n\n\\pagebreak\n\nWeiter');
  assert.ok(blocks.some((block) => block.type === 'page-break'));
});

test('greedy wrapping keeps words intact', () => {
  const lines = wrapRuns(parseInline('aaa bbb ccc ddd'), 7, measure);
  assert.deepEqual(plain(lines), ['aaa bbb', 'ccc ddd']);
});

test('hard line breaks are honoured', () => {
  const lines = wrapRuns(parseInline('aaa\nbbb'), 40, measure);
  assert.deepEqual(plain(lines), ['aaa', 'bbb']);
});

test('long words are hyphenated at syllable boundaries', () => {
  const hyphenate = createHyphenator('de');
  assert.ok(hyphenate('Zahlungserinnerung').length > 1);
  const lines = wrapRuns(parseInline('Die Zahlungserinnerung'), 12, measure, hyphenate);
  assert.ok(lines.length > 1);
  assert.ok(lines[0]?.segments.map((segment) => segment.text).join('').endsWith('-'));
});

test('words that fit nowhere are split by characters', () => {
  const lines = wrapRuns(parseInline('AAAAAAAAAA'), 4, measure);
  assert.deepEqual(plain(lines), ['AAAA', 'AAAA', 'AA']);
});

test('styles survive line breaking', () => {
  const lines = wrapRuns(parseInline('aaa **bbb ccc**'), 7, measure);
  assert.deepEqual(plain(lines), ['aaa bbb', 'ccc']);
  assert.equal(lines[1]?.segments[0]?.bold, true);
});
