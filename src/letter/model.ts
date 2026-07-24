/* Author: Fabian Bitter (fabian@bitter.de) */

import type { CountryDisplay, PostalAddress } from './address.js';
import type { LetterForm } from './din5008.js';
import type { DateStyle } from './format.js';
import type { LetterLabels } from './i18n.js';
import type { ImageProcessing, ImageSource } from './images.js';
import type { ParagraphMode } from './text.js';

export interface LogoOptions extends ImageSource, ImageProcessing {
  widthMm?: number;
  heightMm?: number;
  align?: 'left' | 'center' | 'right';
  /** Distance from the top edge of the sheet, default 15 mm. */
  topMm?: number;
}

export interface SignatureOptions extends ImageSource, ImageProcessing {
  widthMm?: number;
  heightMm?: number;
  /** Horizontal offset relative to the left text margin. */
  offsetXMm?: number;
  /** Blank space between closing and name when no image is given, default one blank line. */
  spaceMm?: number;
  /** Printed name below the signature. */
  name?: string;
  /** Role or function below the name. */
  title?: string;
  /** Extra line, e.g. "i. A." or "ppa.", printed above the signature. */
  prefix?: string;
}

export interface InfoBlockItem {
  label: string;
  value: string;
}

export interface InfoBlockOptions {
  items?: InfoBlockItem[];
  /** Adds the letter date as the last entry, default true for forms A and B. */
  showDate?: boolean;
  layout?: 'columns' | 'stacked';
  fontSize?: number;
}

export interface LetterheadOptions {
  logo?: LogoOptions;
  /** Free text lines; defaults to the sender address block. */
  lines?: string[];
  showSender?: boolean;
  align?: 'left' | 'right';
  fontSize?: number;
  /** Distance from the top edge, default 15 mm. */
  topMm?: number;
  /** Hairline below the letterhead. */
  rule?: boolean;
}

export interface FooterOptions {
  /** Up to four columns, each an array of lines. */
  columns?: string[][];
  fontSize?: number;
  rule?: boolean;
  /** Print the footer on every page instead of the first one only. */
  everyPage?: boolean;
}

export interface FontOptions {
  family?: string;
  size?: number;
  /** Multiple of the font size, default 1.15. */
  lineHeight?: number;
  files?: {
    regular?: string;
    bold?: string;
    italic?: string;
    boldItalic?: string;
  };
}

export interface GeometryOptions {
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  addressFieldTop?: number;
  subjectTop?: number;
  footerTop?: number;
}

export interface LetterMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
}

export interface Letter {
  locale?: string;
  form?: LetterForm;
  sender: PostalAddress;
  recipient: PostalAddress;
  /** Zusatz- und Vermerkzone, e.g. ["Einschreiben", "Rückschein"]. */
  marks?: string[];
  /** Single line above the recipient; set to "" to disable. */
  returnAddressLine?: string;
  returnAddressUnderline?: boolean;
  countryDisplay?: CountryDisplay;
  /**
   * "balanced" (default) centres return address, remarks and recipient inside
   * the address field, so the block sits evenly in the envelope window and
   * further address lines still fit. "din" keeps the fixed zone boundaries.
   */
  addressLayout?: 'balanced' | 'din';

  place?: string;
  date?: string;
  dateStyle?: DateStyle;
  /** Right aligned "place, date" line above the subject. */
  showPlaceDate?: boolean;

  subject?: string;
  /**
   * Further bold lines directly below the subject, the usual place for
   * "Zeichen", "Kunden-Nummer", "Rechnungsnummer" and the like.
   */
  subjectLines?: string[];
  subjectBold?: boolean;
  salutation?: string;
  body: string;
  bodyMode?: ParagraphMode;
  align?: 'left' | 'justify';
  closing?: string;
  signature?: SignatureOptions;
  enclosures?: string[];
  copyTo?: string[];

  infoBlock?: InfoBlockOptions;
  letterhead?: LetterheadOptions;
  footer?: FooterOptions;

  foldMarks?: boolean;
  holeMark?: boolean;
  pageNumbers?: 'header' | 'footer' | 'none';
  continuationHeader?: boolean;

  font?: FontOptions;
  hyphenation?: boolean;
  geometry?: GeometryOptions;
  labels?: Partial<LetterLabels>;
  metadata?: LetterMetadata;
  /** Draws the DIN 5008 zones as hairlines for verification. */
  debug?: boolean;
}
