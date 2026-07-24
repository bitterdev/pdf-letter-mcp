/* Author: Fabian Bitter (fabian@bitter.de) */

import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../letter/i18n.js';

export const addressSchema = z
  .object({
    salutationLine: z.string().optional().describe('Own line above the name, e.g. "Herrn", "Frau", "Firma".'),
    company: z.string().optional(),
    name: z.string().optional(),
    additionalLine: z.string().optional().describe('Department, "c/o", floor.'),
    street: z.string().optional().describe('Street and house number.'),
    postOfficeBox: z.string().optional().describe('Used instead of the street, e.g. "Postfach 12 34 56".'),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional().describe('State or province, used for US/CA/AU style addresses.'),
    country: z.string().optional().describe('ISO 3166-1 alpha-2 code (recommended) or plain country name.'),
    addressLines: z
      .array(z.string())
      .optional()
      .describe('Manual override, replaces every other field of this address.'),
    phone: z.string().optional(),
    email: z.string().optional(),
    web: z.string().optional(),
  })
  .describe('Postal address.');

const imageSourceFields = {
  path: z.string().optional().describe('Path to a PNG or JPEG file. Other formats need the optional sharp dependency.'),
  base64: z.string().optional().describe('Image data as base64 or data URL, alternative to path.'),
  trim: z.boolean().optional().describe('Crop white borders around the image (needs sharp).'),
  removeBackground: z
    .boolean()
    .optional()
    .describe('Turn the white paper background of a scanned signature transparent (needs sharp).'),
  backgroundThreshold: z.number().min(0.1).max(0.99).optional().describe('Luminance cutoff for removeBackground, default 0.85.'),
  inkColor: z.string().optional().describe('Recolour the ink, e.g. "#1a1a1a" (needs sharp).'),
};

export const signatureSchema = z
  .object({
    ...imageSourceFields,
    name: z.string().optional().describe('Printed name below the signature.'),
    title: z.string().optional().describe('Role or function below the name.'),
    prefix: z.string().optional().describe('Line above the signature, e.g. "i. A." or "ppa.".'),
  })
  .describe(
    'Signature below the closing line. The image is scaled and placed by the renderer: it is laid over the blank line above the printed name and deliberately overlaps the closing line, exactly like a signature on paper. That overlap is intended and must not be compensated for.',
  );

export const letterShape = {
  profile: z
    .string()
    .optional()
    .describe('Sender identity, taken from the profile file on this machine (see list_profiles). The profile provides address, return address line and signature image. Use this instead of typing a sender.'),
  locale: z
    .string()
    .optional()
    .describe(`Language of the fixed texts and date format. Supported: ${SUPPORTED_LOCALES.join(', ')}. Regional tags such as "en-US" are accepted. Default "de".`),
  sender: addressSchema
    .optional()
    .describe('Sender, printed as the small return address line above the recipient. Only needed when no profile is used, a profile always wins.'),
  recipient: addressSchema.describe('Recipient, positioned in the DIN 5008 address field so it shows in the envelope window.'),
  marks: z
    .array(z.string())
    .optional()
    .describe('Remark zone above the address, max. 3 lines, e.g. ["Einschreiben"].'),
  returnAddressLine: z
    .string()
    .optional()
    .describe('Return address line above the recipient. Generated from the sender, pass "" to hide it.'),
  countryDisplay: z
    .enum(['auto', 'always', 'never'])
    .optional()
    .describe('When to print the country line, default "auto" (only for foreign recipients).'),

  place: z.string().optional().describe('Place for the "place, date" line.'),
  date: z
    .string()
    .optional()
    .describe('ISO date (2026-07-24), "today" or free text. Default "today".'),
  dateStyle: z.enum(['numeric', 'long', 'iso']).optional().describe('Default "numeric" (24.07.2026).'),

  subject: z.string().optional().describe('Subject line, printed without a "Betreff:" label as required by DIN 5008.'),
  subjectLines: z
    .array(z.string())
    .optional()
    .describe('Further bold lines right below the subject. This is where a normal German letter carries references, e.g. ["Zeichen: 535 B 335D028418", "Kunden-Nummer: 335D028418"].'),
  salutation: z.string().optional().describe('Default is the generic salutation of the locale.'),
  body: z
    .string()
    .describe('Letter text. Blank lines separate paragraphs, "- " starts a bullet list, "1. " a numbered list, **bold** and *italic* are supported, "\\pagebreak" forces a page break.'),
  closing: z.string().optional().describe('Default is the closing phrase of the locale.'),
  signature: signatureSchema.optional(),
  enclosures: z.array(z.string()).optional(),
  copyTo: z.array(z.string()).optional(),


  metadata: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      subject: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
};

export const outputShape = {
  outputPath: z
    .string()
    .optional()
    .describe('Target PDF path. Default: PDF_LETTER_OUTPUT_DIR (or the temp directory) plus a name derived from the subject.'),
  overwrite: z.boolean().optional().describe('Overwrite an existing file instead of adding a counter, default false.'),
  returnBase64: z.boolean().optional().describe('Also return the PDF as base64, default false.'),
};

export const letterSchema = z.object(letterShape);
export type LetterInput = z.infer<typeof letterSchema>;
