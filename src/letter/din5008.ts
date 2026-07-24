/* Author: Fabian Bitter (fabian@bitter.de) */

/**
 * Page geometry for German business letters (DIN 5008:2020) and a relaxed
 * "private" variant. All values are millimetres measured from the top-left
 * corner of the sheet, which is also the coordinate system used by the layout
 * engine (pdf-lib coordinates are converted at draw time).
 *
 * Form A  - high address field, letterhead 27 mm, more room for body text.
 * Form B  - low address field, letterhead 45 mm, for tall letterheads/logos.
 *
 * The address field is 85 x 45 mm and starts 20 mm from the left edge, so that
 * the address zone lands inside the window of DIN 680 / C6-C5 (DL) window
 * envelopes once the sheet is folded on the printed fold marks.
 *
 * Vertical split of the 45 mm address field (DIN 5008:2020):
 *   5.0 mm  return address line (Rücksendeangabe, small type)
 *  12.7 mm  additional/remark zone (Zusatz- und Vermerkzone, 3 lines)
 *  27.3 mm  address zone (Anschriftzone, up to 6 lines)
 */

export type LetterForm = 'A' | 'B' | 'private';

export interface AddressFieldGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  returnLineHeight: number;
  remarkZoneHeight: number;
  addressZoneTop: number;
  addressZoneHeight: number;
}

export interface InfoBlockGeometry {
  left: number;
  width: number;
  top: number;
}

export interface LetterGeometry {
  form: LetterForm;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  /** Top margin of continuation pages. */
  marginTop: number;
  /** Lowest usable y for body text (footer zone starts here). */
  marginBottom: number;
  contentWidth: number;
  addressField: AddressFieldGeometry;
  infoBlock: InfoBlockGeometry;
  /** Baseline zone of the subject line (Betreff), a.k.a. reference position. */
  subjectTop: number;
  foldMarks: number[];
  holeMark: number;
  markLeft: number;
  foldMarkLength: number;
  holeMarkLength: number;
  /** Footer baseline zone (Fußzeile), measured from the top edge. */
  footerTop: number;
}

const A4 = { width: 210, height: 297 } as const;

const ADDRESS_FIELD = {
  left: 20,
  width: 85,
  height: 45,
  returnLineHeight: 5,
  remarkZoneHeight: 12.7,
} as const;

interface FormSpec {
  addressFieldTop: number;
  subjectTop: number;
  foldMarks: number[];
}

const FORM_SPECS: Record<Exclude<LetterForm, 'private'>, FormSpec> = {
  // Letterhead 27 mm: address field 27-72 mm, remark zone starts at 32 mm.
  A: { addressFieldTop: 27, subjectTop: 81.5, foldMarks: [87, 192] },
  // Letterhead 45 mm: address field 45-90 mm, remark zone starts at 50 mm.
  B: { addressFieldTop: 45, subjectTop: 98.5, foldMarks: [105, 210] },
};

export interface GeometryOverrides {
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  addressFieldTop?: number;
  subjectTop?: number;
  footerTop?: number;
}

export function createGeometry(form: LetterForm, overrides: GeometryOverrides = {}): LetterGeometry {
  const spec = form === 'private' ? FORM_SPECS.A : FORM_SPECS[form];
  // DIN 5008 writing margin. The address field starts on the same line, so
  // letterhead, address, subject and body share one left edge.
  const marginLeft = overrides.marginLeft ?? 25;
  const marginRight = overrides.marginRight ?? 20;
  const marginTop = overrides.marginTop ?? 25;
  const marginBottom = overrides.marginBottom ?? 25;
  const addressFieldTop = overrides.addressFieldTop ?? spec.addressFieldTop;
  const subjectTop =
    overrides.subjectTop ?? (overrides.addressFieldTop !== undefined
      ? overrides.addressFieldTop + ADDRESS_FIELD.height + 9.5
      : spec.subjectTop);

  const addressZoneTop = addressFieldTop + ADDRESS_FIELD.returnLineHeight + ADDRESS_FIELD.remarkZoneHeight;

  // The address field keeps its right edge at 105 mm and follows the writing
  // margin on the left, so the block stays inside the 90 mm window (20 mm to
  // 110 mm from the left paper edge) of DIN 680 window envelopes.
  const addressLeft = Math.min(Math.max(marginLeft, ADDRESS_FIELD.left), 25);
  const addressWidth = ADDRESS_FIELD.left + ADDRESS_FIELD.width - addressLeft;

  return {
    form,
    pageWidth: A4.width,
    pageHeight: A4.height,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: A4.width - marginLeft - marginRight,
    addressField: {
      left: addressLeft,
      top: addressFieldTop,
      width: addressWidth,
      height: ADDRESS_FIELD.height,
      returnLineHeight: ADDRESS_FIELD.returnLineHeight,
      remarkZoneHeight: ADDRESS_FIELD.remarkZoneHeight,
      addressZoneTop,
      addressZoneHeight: addressFieldTop + ADDRESS_FIELD.height - addressZoneTop,
    },
    infoBlock: {
      left: 125,
      width: A4.width - marginRight - 125,
      top: addressFieldTop + ADDRESS_FIELD.returnLineHeight,
    },
    subjectTop,
    foldMarks: spec.foldMarks,
    holeMark: A4.height / 2,
    markLeft: 3.5,
    foldMarkLength: 4,
    holeMarkLength: 8,
    footerTop: overrides.footerTop ?? A4.height - 20,
  };
}

/** Line pitch of the DIN 5008 writing grid (12 pt). */
export const DIN_LINE_PITCH_MM = 4.2333;
