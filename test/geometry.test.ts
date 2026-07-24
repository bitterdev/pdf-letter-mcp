/* Author: Fabian Bitter (fabian@bitter.de) */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createGeometry } from '../src/letter/din5008.js';

/**
 * The sheet is folded on the printed fold marks, so the address zone has to end
 * up 15 mm to 60 mm above the lower edge of the outer panel. That is exactly the
 * window of a DIN 680 window envelope (90 x 45 mm, 20 mm from the left, 15 mm
 * from the bottom).
 */
function windowFit(form: 'A' | 'B') {
  const geometry = createGeometry(form);
  const panelBottom = geometry.foldMarks[0] as number;
  const field = geometry.addressField;
  return {
    left: field.left,
    right: field.left + field.width,
    fromPanelBottom: panelBottom - (field.top + field.height),
    height: field.height,
  };
}

test('form A puts the address field at 27 mm', () => {
  const geometry = createGeometry('A');
  assert.equal(geometry.addressField.top, 27);
  assert.equal(geometry.addressField.height, 45);
  assert.equal(geometry.addressField.left, 25, 'flush with the writing margin');
  assert.equal(geometry.addressField.width, 80);
  assert.equal(Math.round(geometry.addressField.addressZoneTop * 10) / 10, 44.7);
  assert.deepEqual(geometry.foldMarks, [87, 192]);
});

test('form B puts the address field at 45 mm', () => {
  const geometry = createGeometry('B');
  assert.equal(geometry.addressField.top, 45);
  assert.equal(geometry.addressField.addressZoneTop, 62.7);
  assert.deepEqual(geometry.foldMarks, [105, 210]);
  assert.equal(geometry.subjectTop, 98.5);
});

test('both forms line the address field up with the envelope window', () => {
  for (const form of ['A', 'B'] as const) {
    const fit = windowFit(form);
    assert.ok(fit.left >= 20, `${form}: left edge inside the window`);
    assert.equal(fit.right, 105, `${form}: right edge`);
    assert.equal(fit.fromPanelBottom, 15, `${form}: distance to the fold`);
    assert.equal(fit.height, 45, `${form}: field height`);
  }
});

test('margins follow DIN 5008 and the punch mark sits in the middle', () => {
  const geometry = createGeometry('B');
  assert.equal(geometry.marginLeft, 25);
  assert.equal(geometry.marginRight, 20);
  assert.equal(geometry.contentWidth, 165);
  assert.equal(geometry.marginLeft, geometry.addressField.left, 'body and address share one left edge');
  assert.equal(geometry.holeMark, 148.5);
});

test('overrides move the address field and the subject line together', () => {
  const geometry = createGeometry('B', { addressFieldTop: 50 });
  assert.equal(geometry.addressField.top, 50);
  assert.equal(geometry.subjectTop, 104.5);
  assert.equal(geometry.infoBlock.top, 55);
});
