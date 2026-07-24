/* Author: Fabian Bitter (fabian@bitter.de) */

import { PDFDocument, rgb, type PDFPage, type RGB } from 'pdf-lib';
import { formatAddressLines, formatReturnAddress, formatSenderLines } from './address.js';
import { createGeometry, DIN_LINE_PITCH_MM, type LetterGeometry } from './din5008.js';
import { embedFonts, pickFont, type FontSet } from './fonts.js';
import { formatDate } from './format.js';
import { getHyphenationPattern, getLabels, interpolate, normalizeLocale, type LetterLabels } from './i18n.js';
import { embedImage, prepareImage } from './images.js';
import type { Letter } from './model.js';
import { deriveSalutation } from './salutation.js';
import {
  createHyphenator,
  parseBody,
  parseInline,
  wrapRuns,
  type Hyphenator,
  type InlineRun,
  type Line,
} from './text.js';
import { mmToPt, ptToMm, round } from '../units.js';

const BLACK = rgb(0, 0, 0);
const HAIRLINE = rgb(0.55, 0.55, 0.55);
const DEBUG_COLOR = rgb(0.85, 0.2, 0.2);

export interface RenderResult {
  bytes: Uint8Array;
  pageCount: number;
  warnings: string[];
  layout: {
    form: string;
    locale: string;
    font: string;
    fontSize: number;
    lineHeightMm: number;
    addressField: { left: number; top: number; width: number; height: number };
    addressZoneTop: number;
    /** Where the recipient address actually starts, see addressLayout. */
    addressTop: number;
    returnAddressTop: number | null;
    subjectTop: number;
    bodyTop: number;
    foldMarks: number[];
    addressLines: string[];
    date: string;
    /** Right aligned "place, date" line, null when the date sits in the information block. */
    placeDate: string | null;
    infoBlockRows: number;
    signature: {
      closingTop: number;
      nameTop: number;
      closingPage: number;
      namePage: number;
      /** Rendered size of the signature image in mm, null when there is none. */
      imageSize: { widthMm: number; heightMm: number } | null;
    };
  };
}

interface TextOptions {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'right' | 'center';
  maxWidth?: number;
  color?: RGB;
  underline?: boolean;
}

interface PageRecord {
  page: PDFPage;
}

export async function renderLetter(letter: Letter): Promise<RenderResult> {
  const renderer = new LetterRenderer(letter);
  return renderer.render();
}

class LetterRenderer {
  private readonly letter: Letter;
  private readonly locale: string;
  private readonly labels: LetterLabels;
  private readonly geometry: LetterGeometry;
  private readonly fontSize: number;
  private readonly lineHeight: number;
  private readonly warnings: string[] = [];

  private pdf!: PDFDocument;
  private fonts!: FontSet;
  private hyphenator: Hyphenator;
  private pages: PageRecord[] = [];
  private pageIndex = 0;
  private cursor = 0;
  private dateText = '';
  private addressLines: string[] = [];
  private bodyTop = 0;
  private closingTop = 0;
  private signatureNameTop = 0;
  private closingPage = 0;
  private namePage = 0;
  private addressTop = 0;
  private placeDateText: string | null = null;
  private infoBlockRows = 0;
  private returnTop: number | null = null;
  private subjectTop = 0;
  private signatureSize: { widthMm: number; heightMm: number } | null = null;

  constructor(letter: Letter) {
    this.letter = letter;
    this.locale = letter.locale ?? 'de';
    this.labels = getLabels(this.locale, letter.labels);
    this.geometry = createGeometry(letter.form ?? 'B', letter.geometry ?? {});
    this.fontSize = letter.font?.size ?? 11;
    this.lineHeight = ptToMm(this.fontSize * (letter.font?.lineHeight ?? 1.15));
    this.hyphenator = createHyphenator(
      getHyphenationPattern(this.locale),
      letter.hyphenation ?? true,
    );
  }

  async render(): Promise<RenderResult> {
    this.pdf = await PDFDocument.create();
    this.fonts = await embedFonts(this.pdf, {
      family: this.letter.font?.family,
      files: this.letter.font?.files,
    });
    this.applyMetadata();

    this.dateText = formatDate(this.letter.date, this.letter.dateStyle ?? 'numeric', this.locale);
    this.subjectTop = this.resolveSubjectTop();

    this.addPage();
    await this.drawLetterhead();
    this.drawAddressField();
    this.drawInfoBlock();
    this.drawPlaceDate();
    this.drawSubject();
    this.drawSalutation();
    this.drawBody();
    await this.drawClosing();
    this.drawAttachments();
    this.drawFooters();
    this.drawPageHeaders();

    const bytes = await this.pdf.save();
    return {
      bytes,
      pageCount: this.pages.length,
      warnings: this.warnings,
      layout: {
        form: this.geometry.form,
        locale: normalizeLocale(this.locale),
        font: this.fonts.family,
        fontSize: this.fontSize,
        lineHeightMm: round(this.lineHeight, 3),
        addressField: {
          left: this.geometry.addressField.left,
          top: this.geometry.addressField.top,
          width: this.geometry.addressField.width,
          height: this.geometry.addressField.height,
        },
        addressZoneTop: round(this.geometry.addressField.addressZoneTop, 2),
        addressTop: round(this.addressTop, 2),
        returnAddressTop: this.returnTop === null ? null : round(this.returnTop, 2),
        subjectTop: round(this.subjectTop, 2),
        bodyTop: round(this.bodyTop, 2),
        foldMarks: this.geometry.foldMarks,
        addressLines: this.addressLines,
        date: this.dateText,
        placeDate: this.placeDateText,
        infoBlockRows: this.infoBlockRows,
        signature: {
          closingTop: round(this.closingTop, 2),
          nameTop: round(this.signatureNameTop, 2),
          closingPage: this.closingPage + 1,
          namePage: this.namePage + 1,
          imageSize: this.signatureSize,
        },
      },
    };
  }

  /**
   * The formal information block sits next to the address field, so the subject
   * starts at the DIN reference position. A normal letter has nothing up there
   * and gets a calmer distance of 33 mm below the address field instead.
   */
  private resolveSubjectTop(): number {
    if (this.letter.geometry?.subjectTop !== undefined) return this.geometry.subjectTop;
    if (this.infoBlockItems().length > 0) return this.geometry.subjectTop;
    const field = this.geometry.addressField;
    return Math.max(this.geometry.subjectTop, field.top + field.height + 33);
  }

  // --- infrastructure -----------------------------------------------------

  private applyMetadata(): void {
    const meta = this.letter.metadata ?? {};
    this.pdf.setTitle(meta.title ?? this.letter.subject ?? 'Letter');
    this.pdf.setAuthor(meta.author ?? this.letter.sender.company ?? this.letter.sender.name ?? '');
    this.pdf.setSubject(meta.subject ?? this.letter.subject ?? '');
    if (meta.keywords?.length) this.pdf.setKeywords(meta.keywords);
    this.pdf.setProducer('pdf-letter-mcp');
    this.pdf.setCreator('pdf-letter-mcp');
  }

  private get page(): PDFPage {
    const record = this.pages[this.pageIndex];
    if (!record) throw new Error('No page available.');
    return record.page;
  }

  private addPage(): void {
    const page = this.pdf.addPage([mmToPt(this.geometry.pageWidth), mmToPt(this.geometry.pageHeight)]);
    this.pages.push({ page });
    this.pageIndex = this.pages.length - 1;
    this.drawMarginMarks(page);
    if (this.letter.debug) this.drawDebugZones(page);
    this.cursor = this.geometry.marginTop;
  }

  private y(topMm: number): number {
    return mmToPt(this.geometry.pageHeight - topMm);
  }

  private width(text: string, bold = false, italic = false, size = this.fontSize): number {
    return ptToMm(pickFont(this.fonts, bold, italic).widthOfTextAtSize(sanitize(text), size));
  }

  private ascent(size = this.fontSize): number {
    return ptToMm(this.fonts.regular.heightAtSize(size, { descender: false }));
  }

  private text(value: string, xMm: number, topMm: number, options: TextOptions = {}): number {
    const clean = sanitize(value);
    if (clean.length === 0) return 0;
    const size = options.size ?? this.fontSize;
    const bold = options.bold ?? false;
    const italic = options.italic ?? false;
    const font = pickFont(this.fonts, bold, italic);
    const textWidth = this.width(clean, bold, italic, size);

    let x = xMm;
    if (options.align === 'right') x = xMm - textWidth;
    else if (options.align === 'center') x = xMm - textWidth / 2;

    const baseline = topMm + this.ascent(size);
    this.page.drawText(clean, {
      x: mmToPt(x),
      y: this.y(baseline),
      size,
      font,
      color: options.color ?? BLACK,
    });

    if (options.underline) {
      const underlineY = baseline + ptToMm(size * 0.14);
      this.page.drawLine({
        start: { x: mmToPt(x), y: this.y(underlineY) },
        end: { x: mmToPt(x + textWidth), y: this.y(underlineY) },
        thickness: 0.4,
        color: options.color ?? BLACK,
      });
    }
    return textWidth;
  }

  private drawWrapped(
    runs: InlineRun[],
    xMm: number,
    topMm: number,
    maxWidth: number,
    options: { justify?: boolean; size?: number } = {},
  ): number {
    const size = options.size ?? this.fontSize;
    const lines = this.wrap(runs, maxWidth, size);
    let y = topMm;
    lines.forEach((line, index) => {
      this.drawLine(line, xMm, y, maxWidth, Boolean(options.justify) && index < lines.length - 1, size);
      y += this.lineHeight;
    });
    return lines.length;
  }

  private wrap(runs: InlineRun[], maxWidth: number, size = this.fontSize): Line[] {
    return wrapRuns(
      runs,
      maxWidth,
      (text, bold, italic) => this.width(text, bold, italic, size),
      this.hyphenator,
    );
  }

  private drawLine(line: Line, xMm: number, topMm: number, maxWidth: number, justify: boolean, size: number): void {
    if (!justify) {
      let x = xMm;
      for (const segment of line.segments) {
        this.text(segment.text, x, topMm, { size, bold: segment.bold, italic: segment.italic });
        x += this.width(segment.text, segment.bold, segment.italic, size);
      }
      return;
    }

    const words: InlineRun[] = [];
    for (const segment of line.segments) {
      for (const part of segment.text.split(/(\s+)/)) {
        if (part === '' || /^\s+$/.test(part)) continue;
        words.push({ text: part, bold: segment.bold, italic: segment.italic });
      }
    }
    if (words.length < 2) {
      this.drawLine(line, xMm, topMm, maxWidth, false, size);
      return;
    }
    const wordsWidth = words.reduce((sum, word) => sum + this.width(word.text, word.bold, word.italic, size), 0);
    const gap = (maxWidth - wordsWidth) / (words.length - 1);
    const spaceWidth = this.width(' ', false, false, size);
    if (gap > spaceWidth * 3 || gap < 0) {
      this.drawLine(line, xMm, topMm, maxWidth, false, size);
      return;
    }
    let x = xMm;
    for (const word of words) {
      this.text(word.text, x, topMm, { size, bold: word.bold, italic: word.italic });
      x += this.width(word.text, word.bold, word.italic, size) + gap;
    }
  }

  private bodyLimit(pageIndex = this.pageIndex): number {
    const footer = this.letter.footer;
    const hasFooterOnPage =
      Boolean(footer?.columns?.length) && (footer?.everyPage || pageIndex === 0);
    const footerLimit = this.geometry.footerTop - 6;
    const plainLimit = this.geometry.pageHeight - this.geometry.marginBottom;
    return hasFooterOnPage ? Math.min(footerLimit, plainLimit) : plainLimit;
  }

  private ensureSpace(heightMm: number): void {
    if (this.cursor + heightMm > this.bodyLimit()) this.addPage();
  }

  // --- letterhead and address zone ---------------------------------------

  private async drawLetterhead(): Promise<void> {
    const options = this.letter.letterhead ?? {};
    const align = options.align ?? (this.geometry.form === 'private' ? 'left' : 'right');
    const size =
      options.fontSize ?? (this.geometry.form === 'private' ? this.fontSize : Math.max(8.5, this.fontSize - 2));
    const top = options.topMm ?? 15;
    const left = this.geometry.marginLeft;
    const right = this.geometry.pageWidth - this.geometry.marginRight;

    let logoBottom = top;
    if (options.logo?.path || options.logo?.base64) {
      const logo = options.logo;
      const prepared = await prepareImage(logo, logo);
      this.warnings.push(...prepared.warnings);
      const image = await embedImage(this.pdf, prepared);
      const aspect = image.height / image.width;
      const widthMm = logo.widthMm ?? (logo.heightMm ? logo.heightMm / aspect : 40);
      const heightMm = logo.heightMm ?? widthMm * aspect;
      const logoTop = logo.topMm ?? top;
      const logoAlign = logo.align ?? align;
      const x =
        logoAlign === 'right'
          ? right - widthMm
          : logoAlign === 'center'
            ? (this.geometry.pageWidth - widthMm) / 2
            : left;
      this.page.drawImage(image, {
        x: mmToPt(x),
        y: this.y(logoTop + heightMm),
        width: mmToPt(widthMm),
        height: mmToPt(heightMm),
      });
      logoBottom = logoTop + heightMm;
    }

    // The sender is already in the return address line above the recipient, so a
    // second sender block in the letterhead is opt-in.
    const showSender = options.showSender ?? false;
    const lines = options.lines ?? (showSender ? formatSenderLines(this.letter.sender) : []);
    if (lines.length > 0) {
      const pitch = ptToMm(size * 1.2);
      const startTop = options.logo && (options.logo.path || options.logo.base64) && (options.logo.align ?? align) === align
        ? logoBottom + 3
        : top;
      let y = startTop;
      for (const line of lines) {
        this.text(line, align === 'right' ? right : left, y, { size, align: align === 'right' ? 'right' : 'left' });
        y += pitch;
      }
      if (options.rule) {
        this.page.drawLine({
          start: { x: mmToPt(left), y: this.y(y + 1) },
          end: { x: mmToPt(right), y: this.y(y + 1) },
          thickness: 0.5,
          color: HAIRLINE,
        });
        y += 2;
      }
      const limit = this.addressFieldContentTop();
      if (y > limit) {
        this.warnings.push(
          `The letterhead ends at ${round(y)} mm and overlaps the address field content starting at ${round(limit)} mm. Use form "B", fewer lines or a smaller letterhead font.`,
        );
      }
    }
  }

  private returnAddressText(): string {
    const explicit = this.letter.returnAddressLine;
    if (explicit !== undefined) return explicit;
    // A private letter that prints the sender block in the letterhead does not
    // repeat it above the recipient.
    const senderInLetterhead =
      this.geometry.form === 'private' && this.letter.letterhead?.showSender === true;
    return senderInLetterhead ? '' : formatReturnAddress(this.letter.sender);
  }

  private recipientLines(): string[] {
    if (this.addressLines.length === 0) {
      this.addressLines = formatAddressLines(this.letter.recipient, {
        senderCountry: this.letter.sender.country,
        locale: this.locale,
        countryDisplay: this.letter.countryDisplay,
      });
    }
    return this.addressLines;
  }

  private returnAddressSize(): number {
    return Math.max(6, Math.min(8, this.fontSize - 3.5));
  }

  /**
   * Positions of the three parts inside the address field. In "balanced" mode
   * the whole group is centred in the field, which keeps the return address, the
   * remarks and the recipient close together and leaves room for further address
   * lines at the bottom. "din" keeps the fixed zone boundaries of the norm.
   */
  private addressFieldLayout(): {
    returnTop: number | null;
    marksTop: number;
    addressTop: number;
    pitch: number;
    marks: string[];
    lines: string[];
  } {
    const field = this.geometry.addressField;
    const pitch = Math.max(this.lineHeight, DIN_LINE_PITCH_MM);
    const marks = (this.letter.marks ?? []).filter((mark) => mark.trim().length > 0);
    const lines = this.recipientLines();
    const hasReturn = this.returnAddressText().trim().length > 0;
    const returnHeight = hasReturn ? ptToMm(this.returnAddressSize() * 1.2) : 0;

    if ((this.letter.addressLayout ?? 'balanced') === 'din') {
      return {
        returnTop: hasReturn ? field.top + (field.returnLineHeight - returnHeight) / 2 : null,
        marksTop: field.addressZoneTop - marks.length * pitch,
        addressTop: field.addressZoneTop,
        pitch,
        marks,
        lines,
      };
    }

    const gapAfterReturn = hasReturn ? pitch * 0.9 : 0;
    const gapAfterMarks = marks.length > 0 ? pitch * 0.75 : 0;
    const groupHeight =
      returnHeight + gapAfterReturn + marks.length * pitch + gapAfterMarks + lines.length * pitch;
    const top = Math.max(field.top, field.top + (field.height - groupHeight) / 2);

    const marksTop = top + returnHeight + gapAfterReturn;
    return {
      returnTop: hasReturn ? top : null,
      marksTop,
      addressTop: marksTop + marks.length * pitch + gapAfterMarks,
      pitch,
      marks,
      lines,
    };
  }

  /** Topmost millimetre of the address field that actually carries content. */
  private addressFieldContentTop(): number {
    const layout = this.addressFieldLayout();
    return layout.returnTop ?? (layout.marks.length > 0 ? layout.marksTop : layout.addressTop);
  }

  private drawAddressField(): void {
    const field = this.geometry.addressField;
    const layout = this.addressFieldLayout();

    if (layout.returnTop !== null) {
      const size = this.returnAddressSize();
      let text = this.returnAddressText();
      if (this.width(text, false, false, size) > field.width) {
        this.warnings.push('The return address line was shortened to fit the address field width of 85 mm.');
        while (text.length > 4 && this.width(`${text}…`, false, false, size) > field.width) {
          text = text.slice(0, -1);
        }
        text = `${text.trimEnd()}…`;
      }
      this.text(text, field.left, layout.returnTop, {
        size,
        underline: this.letter.returnAddressUnderline ?? true,
      });
    }

    if (layout.marks.length > 3) {
      this.warnings.push(`The remark zone holds 3 lines, ${layout.marks.length} were given.`);
    }
    let top = layout.marksTop;
    for (const mark of layout.marks) {
      this.text(mark, field.left, top);
      top += layout.pitch;
    }

    if (layout.lines.length === 0) {
      this.warnings.push('The recipient address is empty.');
      return;
    }

    const bottom = layout.addressTop + layout.lines.length * layout.pitch;
    if (bottom > field.top + field.height) {
      const fits = Math.floor((field.top + field.height - layout.addressTop) / layout.pitch);
      this.warnings.push(
        `The address block needs ${round(bottom - field.top)} mm of the 45 mm address field, only ${fits} address lines fit. Shorten the address, merge lines or reduce the number of remarks.`,
      );
    }

    top = layout.addressTop;
    for (const line of layout.lines) {
      if (this.width(line) > field.width) {
        this.warnings.push(`Address line "${line}" is wider than the 85 mm address field.`);
      }
      this.text(line, field.left, top);
      top += layout.pitch;
    }
    this.addressTop = layout.addressTop;
    this.returnTop = layout.returnTop;
  }

  private infoBlockItems(): { label: string; value: string }[] {
    const options = this.letter.infoBlock ?? {};
    const items = (options.items ?? []).filter((item) => item.value?.trim());
    // The information block is the formal business variant. Without entries the
    // date goes into the "place, date" line above the subject instead.
    const showDate = options.showDate ?? items.length > 0;
    if (showDate && !items.some((item) => item.label === this.labels.infoDate)) {
      items.push({ label: this.labels.infoDate, value: this.dateText });
    }
    return items;
  }

  private drawInfoBlock(): void {
    const items = this.infoBlockItems();
    if (items.length === 0) return;
    this.infoBlockRows = items.length;

    const block = this.geometry.infoBlock;
    const options = this.letter.infoBlock ?? {};
    const size = options.fontSize ?? Math.max(8, this.fontSize - 1.5);
    const pitch = ptToMm(size * 1.25);
    const layout = options.layout ?? 'columns';
    const right = this.geometry.pageWidth - this.geometry.marginRight;
    let top = block.top;

    // A lone date reads better as a right aligned "place, date" line than as a
    // labelled table row with a wide gap.
    if (items.length === 1 && items[0]?.label === this.labels.infoDate) {
      const place = this.letter.place?.trim();
      const value = place
        ? interpolate(this.labels.placeDate, { place, date: items[0].value })
        : items[0].value;
      this.text(value, right, top, { size: this.fontSize, align: 'right' });
      return;
    }

    for (const item of items) {
      if (layout === 'columns') {
        this.text(item.label, block.left, top, { size });
        this.text(item.value, right, top, { size, align: 'right' });
        top += pitch;
      } else {
        this.text(item.label, block.left, top, { size, bold: true });
        top += pitch;
        this.text(item.value, block.left, top, { size });
        top += pitch * 1.15;
      }
    }

    if (top > this.subjectTop - 2) {
      this.warnings.push(
        `The information block ends at ${round(top)} mm and collides with the subject line at ${round(this.subjectTop)} mm. Reduce the number of entries or move the subject line down via geometry.subjectTop.`,
      );
    }
  }

  private drawPlaceDate(): void {
    const hasInfoDate = this.infoBlockItems().some((item) => item.label === this.labels.infoDate);
    const show = this.letter.showPlaceDate ?? !hasInfoDate;
    if (!show) return;

    const place = this.letter.place?.trim();
    const value = place
      ? interpolate(this.labels.placeDate, { place, date: this.dateText })
      : this.dateText;
    const top = this.subjectTop - this.lineHeight * 3;
    this.text(value, this.geometry.pageWidth - this.geometry.marginRight, top, { align: 'right' });
    this.placeDateText = value;
  }

  // --- body ---------------------------------------------------------------

  private drawSubject(): void {
    this.cursor = this.subjectTop;
    const subject = this.letter.subject?.trim();
    const extra = (this.letter.subjectLines ?? []).filter((line) => line.trim().length > 0);
    if (!subject && extra.length === 0) return;

    const bold = this.letter.subjectBold ?? true;
    const blocks = subject ? [`${this.labels.subjectPrefix}${subject}`, ...extra] : extra;
    for (const block of blocks) {
      const lines = this.drawWrapped(
        parseInline(block).map((run) => ({ ...run, bold: run.bold || bold })),
        this.geometry.marginLeft,
        this.cursor,
        this.geometry.contentWidth,
      );
      this.cursor += lines * this.lineHeight;
    }
  }

  private drawSalutation(): void {
    const salutation = this.letter.salutation ?? deriveSalutation(this.letter.recipient, this.labels);
    if (!salutation.trim()) {
      this.cursor += this.lineHeight;
      this.bodyTop = this.cursor;
      return;
    }
    this.cursor += this.lineHeight * 2;
    this.drawWrapped(parseInline(salutation), this.geometry.marginLeft, this.cursor, this.geometry.contentWidth);
    this.cursor += this.lineHeight * 2;
    this.bodyTop = this.cursor;
  }

  private drawBody(): void {
    const blocks = parseBody(this.letter.body ?? '', this.letter.bodyMode ?? 'hard-breaks');
    const justify = (this.letter.align ?? 'left') === 'justify';
    const indent = 6;

    for (const block of blocks) {
      if (block.type === 'page-break') {
        this.addPage();
        continue;
      }
      if (block.type === 'blank') {
        if (this.cursor > this.geometry.marginTop) this.cursor += this.lineHeight;
        continue;
      }

      const isList = block.type === 'list-item';
      const x = this.geometry.marginLeft + (isList ? indent : 0);
      const maxWidth = this.geometry.contentWidth - (isList ? indent : 0);
      const lines = this.wrap(block.runs, maxWidth);

      lines.forEach((line, index) => {
        this.ensureSpace(this.lineHeight);
        if (isList && index === 0) {
          this.text(block.marker, this.geometry.marginLeft, this.cursor);
        }
        this.drawLine(line, x, this.cursor, maxWidth, justify && index < lines.length - 1, this.fontSize);
        this.cursor += this.lineHeight;
      });
    }
  }

  private async drawClosing(): Promise<void> {
    const signature = this.letter.signature ?? {};
    const closing = (this.letter.closing ?? this.labels.closing).trim();
    const hasImage = Boolean(signature.path || signature.base64);

    const closingWidth = closing ? this.width(closing) : 45;
    // A signature reads as handwriting next to the closing, so it stays in the
    // same order of magnitude as that line instead of covering half the page.
    const maxWidth = Math.min(80, Math.max(45, closingWidth * 1.2));
    // It is drawn from just above the printed name upwards. Reaching across the
    // closing is wanted, reaching into the last body line is not, and there is
    // exactly one blank line above the closing.
    const gapAboveName = signature.spaceMm ?? this.lineHeight;
    const maxHeight = Math.min(28, gapAboveName + this.lineHeight * 2 - 0.5);

    let image: Awaited<ReturnType<typeof embedImage>> | null = null;
    let imageWidth = 0;
    let imageHeight = 0;
    if (hasImage) {
      const prepared = await prepareImage(signature, signature);
      this.warnings.push(...prepared.warnings);
      image = await embedImage(this.pdf, prepared);
      const aspect = image.height / image.width;
      const requestedWidth =
        signature.widthMm ??
        (signature.heightMm ? signature.heightMm / aspect : Math.min(maxWidth, closingWidth * 1.1));
      const requestedHeight = signature.heightMm ?? requestedWidth * aspect;
      const scale = Math.min(1, maxWidth / requestedWidth, maxHeight / requestedHeight);
      imageWidth = requestedWidth * scale;
      imageHeight = requestedHeight * scale;
      // Fitting the automatic size into the free space is normal, only an
      // explicitly requested size that had to be reduced is worth a warning.
      const requestedSize = signature.widthMm !== undefined || signature.heightMm !== undefined;
      if (scale < 1 && requestedSize) {
        this.warnings.push(
          `The signature image was scaled down proportionally to ${round(imageWidth)} x ${round(imageHeight)} mm, the limit is ${round(maxWidth)} x ${round(maxHeight)} mm.`,
        );
      }
    }

    const nameLines = [signature.name, signature.title].filter(
      (value): value is string => Boolean(value?.trim()),
    );
    // The closing is always followed by a single blank line. A signature image
    // is an overlay on top of that line, it never pushes the name down.
    const gap = gapAboveName;
    const prefixHeight = signature.prefix?.trim() ? this.lineHeight : 0;
    const closingHeight = closing ? this.lineHeight : 0;
    const total =
      this.lineHeight + closingHeight + prefixHeight + gap + nameLines.length * this.lineHeight;

    this.cursor += this.lineHeight;
    this.ensureSpace(total);

    this.closingTop = this.cursor;
    this.closingPage = this.pageIndex;
    if (closing) {
      this.text(closing, this.geometry.marginLeft, this.cursor);
      this.cursor += this.lineHeight;
    }
    if (signature.prefix?.trim()) {
      this.cursor += this.lineHeight * 0.5;
      this.text(signature.prefix, this.geometry.marginLeft, this.cursor);
      this.cursor += this.lineHeight * 0.5;
    }

    this.cursor += gap;
    this.signatureNameTop = this.cursor;
    this.namePage = this.pageIndex;

    if (image) {
      // Sits directly above the printed name and grows upwards across the
      // closing line, so a tall signature never changes the text flow.
      const x = this.geometry.marginLeft + (signature.offsetXMm ?? 0);
      const bottom = this.cursor - 0.5;
      this.page.drawImage(image, {
        x: mmToPt(x),
        y: this.y(bottom),
        width: mmToPt(imageWidth),
        height: mmToPt(imageHeight),
      });
      this.signatureSize = { widthMm: round(imageWidth, 2), heightMm: round(imageHeight, 2) };
    }

    for (const line of nameLines) {
      this.text(line, this.geometry.marginLeft, this.cursor);
      this.cursor += this.lineHeight;
    }
  }

  private drawAttachments(): void {
    const enclosures = (this.letter.enclosures ?? []).filter((value) => value.trim());
    const copyTo = (this.letter.copyTo ?? []).filter((value) => value.trim());
    if (enclosures.length === 0 && copyTo.length === 0) return;

    const groups: { label: string; items: string[] }[] = [];
    if (enclosures.length > 0) {
      groups.push({
        label: enclosures.length === 1 ? this.labels.enclosure : this.labels.enclosures,
        items: enclosures,
      });
    }
    if (copyTo.length > 0) groups.push({ label: this.labels.copyTo, items: copyTo });

    for (const group of groups) {
      this.cursor += this.lineHeight;
      this.ensureSpace(this.lineHeight * (group.items.length + 1));
      this.text(group.label, this.geometry.marginLeft, this.cursor, { bold: true });
      this.cursor += this.lineHeight;
      for (const item of group.items) {
        this.text(item, this.geometry.marginLeft, this.cursor);
        this.cursor += this.lineHeight;
      }
    }
  }

  // --- page furniture -----------------------------------------------------

  private drawMarginMarks(page: PDFPage): void {
    const showFold = this.letter.foldMarks ?? this.geometry.form !== 'private';
    const showHole = this.letter.holeMark ?? this.geometry.form !== 'private';
    const line = (topMm: number, length: number) => {
      page.drawLine({
        start: { x: mmToPt(this.geometry.markLeft), y: this.y(topMm) },
        end: { x: mmToPt(this.geometry.markLeft + length), y: this.y(topMm) },
        thickness: 0.4,
        color: HAIRLINE,
      });
    };
    if (showFold) for (const mark of this.geometry.foldMarks) line(mark, this.geometry.foldMarkLength);
    if (showHole) line(this.geometry.holeMark, this.geometry.holeMarkLength);
  }

  private drawFooters(): void {
    const footer = this.letter.footer;
    if (!footer?.columns?.length) return;
    const size = footer.fontSize ?? Math.max(6.5, this.fontSize - 3);
    const pitch = ptToMm(size * 1.25);
    const columns = footer.columns.slice(0, 4);
    const columnWidth = this.geometry.contentWidth / columns.length;
    const pages = footer.everyPage ? this.pages : this.pages.slice(0, 1);

    pages.forEach((record, index) => {
      const previous = this.pageIndex;
      this.pageIndex = footer.everyPage ? index : 0;
      if (footer.rule ?? true) {
        record.page.drawLine({
          start: { x: mmToPt(this.geometry.marginLeft), y: this.y(this.geometry.footerTop - 2) },
          end: {
            x: mmToPt(this.geometry.pageWidth - this.geometry.marginRight),
            y: this.y(this.geometry.footerTop - 2),
          },
          thickness: 0.4,
          color: HAIRLINE,
        });
      }
      columns.forEach((lines, columnIndex) => {
        let top = this.geometry.footerTop;
        for (const line of lines) {
          this.text(line, this.geometry.marginLeft + columnIndex * columnWidth, top, { size });
          top += pitch;
        }
      });
      this.pageIndex = previous;
    });
  }

  private drawPageHeaders(): void {
    const total = this.pages.length;
    if (total < 2) return;
    const mode = this.letter.pageNumbers ?? 'header';
    const useHeader = (this.letter.continuationHeader ?? true) && mode !== 'footer';
    const size = Math.max(7.5, this.fontSize - 2);
    const right = this.geometry.pageWidth - this.geometry.marginRight;

    const recipient =
      this.letter.recipient.company?.trim() ||
      this.letter.recipient.name?.trim() ||
      this.addressLines[0] ||
      '';
    for (let index = 1; index < total; index += 1) {
      const previous = this.pageIndex;
      this.pageIndex = index;
      const label = interpolate(this.labels.pageOf, { page: index + 1, total });
      if (useHeader) {
        const top = Math.max(10, this.geometry.marginTop - 10);
        if (recipient) this.text(recipient, this.geometry.marginLeft, top, { size });
        this.text(`${this.dateText} · ${label}`, right, top, { size, align: 'right' });
      } else if (mode === 'footer') {
        this.text(label, right, this.geometry.pageHeight - this.geometry.marginBottom + 6, {
          size,
          align: 'right',
        });
      }
      this.pageIndex = previous;
    }

    if (mode === 'footer' && !useHeader) {
      const previous = this.pageIndex;
      this.pageIndex = 0;
      this.text(
        interpolate(this.labels.pageOf, { page: 1, total }),
        right,
        this.geometry.pageHeight - this.geometry.marginBottom + 6,
        { size, align: 'right' },
      );
      this.pageIndex = previous;
    }
  }

  private drawDebugZones(page: PDFPage): void {
    const rect = (top: number, left: number, width: number, height: number) => {
      page.drawRectangle({
        x: mmToPt(left),
        y: this.y(top + height),
        width: mmToPt(width),
        height: mmToPt(height),
        borderColor: DEBUG_COLOR,
        borderWidth: 0.3,
        opacity: 0,
      });
    };
    const field = this.geometry.addressField;
    rect(field.top, field.left, field.width, field.height);
    rect(field.top, field.left, field.width, field.returnLineHeight);
    rect(field.top + field.returnLineHeight, field.left, field.width, field.remarkZoneHeight);
    rect(
      this.geometry.marginLeft,
      this.geometry.marginLeft,
      this.geometry.contentWidth,
      this.geometry.pageHeight - this.geometry.marginTop - this.geometry.marginBottom,
    );
    page.drawLine({
      start: { x: mmToPt(this.geometry.marginLeft), y: this.y(this.subjectTop) },
      end: {
        x: mmToPt(this.geometry.pageWidth - this.geometry.marginRight),
        y: this.y(this.subjectTop),
      },
      thickness: 0.3,
      color: DEBUG_COLOR,
    });
    rect(
      this.geometry.infoBlock.top,
      this.geometry.infoBlock.left,
      this.geometry.infoBlock.width,
      20,
    );
  }
}

/** Removes control characters that would break PDF text drawing. */
function sanitize(value: string): string {
  return value.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').replace(/\t/g, '    ');
}
