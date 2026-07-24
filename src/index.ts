#!/usr/bin/env node
/* Author: Fabian Bitter (fabian@bitter.de) */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createGeometry } from './letter/din5008.js';
import { listBuiltinFamilies, resolveFontFiles } from './letter/fonts.js';
import { getLabels, SUPPORTED_LOCALES } from './letter/i18n.js';
import { prepareImage } from './letter/images.js';
import type { Letter } from './letter/model.js';
import { renderLetter } from './letter/render.js';
import { letterShape, outputShape } from './server/schema.js';
import { defaultOutputDir, slugify, uniquePath, writePdf } from './server/output.js';
import { applyProfile, listProfiles, profilesPath } from './server/profiles.js';

const packageVersion = '1.0.0';

const server = new McpServer(
  { name: 'pdf-letter-mcp', version: packageVersion },
  {
    instructions:
      'Renders letters as print ready PDF files in one fixed layout: return address line, recipient in the DIN 5008 address field so it shows in the window of DL/C6-C5 window envelopes, right aligned "place, date", bold subject block with references below it, salutation, body, closing, signature. Every locale uses the same layout with translated fixed texts. ' +
      'The layout is owned by the server, not by the caller: there are no parameters for margins, spacing, font, image size or position, and none must be invented. Supply content only. ' +
      'The signature image is meant to overlap the closing line, just like a signature written on paper over "Mit freundlichen Grüßen". That is correct output, not a defect, and it must not be corrected. ' +
      'The sender comes from a profile stored on this machine: call list_profiles and pass the profile key, never retype an address or a signature path. ' +
      'Use create_letter to write a PDF, preview_letter to check the result without writing a file, and prepare_signature to clean up a scanned signature once and reuse the result.',
  },
);

const toJson = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const toError = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
});

/**
 * Typography is a server setting, not a per letter decision, so every letter of
 * this installation looks the same. See PDF_LETTER_FONT and PDF_LETTER_FONT_SIZE.
 */
function toLetter(input: Record<string, unknown>): Letter {
  const { profile, ...rest } = input as Record<string, unknown>;
  const letter = applyProfile(rest as unknown as Letter, profile as string | undefined);
  const family = process.env.PDF_LETTER_FONT?.trim();
  const size = Number.parseFloat(process.env.PDF_LETTER_FONT_SIZE ?? '');
  if (family || Number.isFinite(size)) {
    letter.font = {
      ...(family ? { family } : {}),
      ...(Number.isFinite(size) ? { size } : {}),
    };
  }
  return letter;
}

function defaultFileName(letter: Letter): string {
  const date = new Date().toISOString().slice(0, 10);
  const subject = letter.subject?.trim() || letter.recipient?.company || letter.recipient?.name || 'brief';
  return `${date}-${slugify(subject)}.pdf`;
}

server.registerTool(
  'create_letter',
  {
    title: 'Create letter PDF',
    description:
      'Renders a letter as a PDF file in the fixed house layout (DIN 5008 address field, 25 mm writing margin, fold and punch marks, bold subject block). Pass content only, the layout is fixed. The signature image intentionally overlaps the closing line. Returns the absolute file path, the page count, layout metrics and warnings.',
    inputSchema: { ...letterShape, ...outputShape },
  },
  async (input) => {
    try {
      const { outputPath, overwrite, returnBase64, ...letterInput } = input as Record<string, unknown>;
      const letter = toLetter(letterInput);
      const result = await renderLetter(letter);
      const file = await writePdf(result.bytes, {
        outputPath: outputPath as string | undefined,
        overwrite: overwrite as boolean | undefined,
        defaultName: defaultFileName(letter),
      });
      return toJson({
        path: file,
        pageCount: result.pageCount,
        warnings: result.warnings,
        layout: result.layout,
        ...(returnBase64 ? { base64: Buffer.from(result.bytes).toString('base64') } : {}),
      });
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'preview_letter',
  {
    title: 'Preview letter layout',
    description:
      'Renders the letter in memory and returns layout metrics and warnings without writing a file. Use it to check whether the address fits the address field or the letter runs onto a second page.',
    inputSchema: letterShape,
  },
  async (input) => {
    try {
      const result = await renderLetter(toLetter(input as Record<string, unknown>));
      return toJson({
        pageCount: result.pageCount,
        warnings: result.warnings,
        layout: result.layout,
        sizeBytes: result.bytes.length,
      });
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'prepare_signature',
  {
    title: 'Prepare signature image',
    description:
      'Cleans up a scanned signature: crops white borders, turns the paper background transparent and optionally recolours the ink. Writes a PNG that can be passed to create_letter as signature.path. Needs the optional sharp dependency.',
    inputSchema: {
      path: z.string().optional().describe('Path to the scan (PNG, JPEG, and with sharp also WebP/TIFF/HEIC).'),
      base64: z.string().optional().describe('Image data as base64 or data URL, alternative to path.'),
      outputPath: z.string().optional().describe('Target PNG path. Default: output directory plus "signature.png".'),
      trim: z.boolean().optional().describe('Crop uniform borders, default true.'),
      removeBackground: z.boolean().optional().describe('Turn the white background transparent, default true.'),
      backgroundThreshold: z.number().min(0.1).max(0.99).optional().describe('Luminance cutoff, default 0.85.'),
      inkColor: z.string().optional().describe('Recolour the ink, e.g. "#1a1a1a".'),
      overwrite: z.boolean().optional(),
    },
  },
  async (input) => {
    try {
      const prepared = await prepareImage(
        { path: input.path, base64: input.base64 },
        {
          trim: input.trim ?? true,
          removeBackground: input.removeBackground ?? true,
          backgroundThreshold: input.backgroundThreshold,
          inkColor: input.inkColor,
        },
      );
      let target = input.outputPath
        ? path.resolve(input.outputPath)
        : path.join(defaultOutputDir(), 'signature.png');
      if (!input.overwrite) target = uniquePath(target);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, prepared.data);
      return toJson({ path: target, format: prepared.format, warnings: prepared.warnings });
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'list_profiles',
  {
    title: 'List sender profiles',
    description:
      'Lists the sender profiles configured on this machine. Each profile carries the address and the signature of one person, so create_letter only needs the profile key.',
    inputSchema: {},
  },
  async () => {
    try {
      return toJson(listProfiles());
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'get_din5008_spec',
  {
    title: 'Get DIN 5008 geometry',
    description:
      'Returns the millimetre geometry of the layout: address field, remark zone, writing margins, subject position, fold and punch marks.',
    inputSchema: {},
  },
  async () => {
    try {
      return toJson(createGeometry('B'));
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'list_locales',
  {
    title: 'List locales',
    description: 'Lists the supported languages together with their fixed texts (salutation, closing, enclosures, page numbering).',
    inputSchema: {
      locale: z.string().optional().describe('Return the labels of a single locale.'),
    },
  },
  async (input) => {
    try {
      if (input.locale) return toJson({ locale: input.locale, labels: getLabels(input.locale) });
      return toJson({
        locales: SUPPORTED_LOCALES.map((locale) => ({ locale, labels: getLabels(locale) })),
      });
    } catch (error) {
      return toError(error);
    }
  },
);

server.registerTool(
  'list_fonts',
  {
    title: 'List fonts',
    description:
      'Lists the built-in font families and resolves a font name against the installed system fonts, so you can check what create_letter would embed.',
    inputSchema: {
      family: z.string().optional().describe('Font family or .ttf path to resolve.'),
    },
  },
  async (input) => {
    try {
      const builtin = listBuiltinFamilies();
      if (!input.family) return toJson({ builtin, outputDir: defaultOutputDir(), profiles: profilesPath() });
      const resolved = resolveFontFiles({ family: input.family });
      return toJson({ builtin, requested: input.family, resolved });
    } catch (error) {
      return toError(error);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(`pdf-letter-mcp failed to start: ${String(error)}\n`);
  process.exit(1);
});
