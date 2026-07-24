/* Author: Fabian Bitter (fabian@bitter.de) */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

const require = createRequire(import.meta.url);

export type FontWeight = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface FontFiles {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
}

export interface FontSet {
  family: string;
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

export interface FontSpec {
  /** Built-in family key, a system font name, or a font file path. */
  family?: string;
  files?: Partial<FontFiles>;
}

function dejavuDir(): string {
  const pkg = require.resolve('dejavu-fonts-ttf/package.json');
  return path.join(path.dirname(pkg), 'ttf');
}

function builtinFamilies(): Record<string, FontFiles> {
  const dir = dejavuDir();
  const file = (name: string) => path.join(dir, name);
  return {
    sans: {
      regular: file('DejaVuSans.ttf'),
      bold: file('DejaVuSans-Bold.ttf'),
      italic: file('DejaVuSans-Oblique.ttf'),
      boldItalic: file('DejaVuSans-BoldOblique.ttf'),
    },
    'sans-condensed': {
      regular: file('DejaVuSansCondensed.ttf'),
      bold: file('DejaVuSansCondensed-Bold.ttf'),
      italic: file('DejaVuSansCondensed-Oblique.ttf'),
      boldItalic: file('DejaVuSansCondensed-BoldOblique.ttf'),
    },
    serif: {
      regular: file('DejaVuSerif.ttf'),
      bold: file('DejaVuSerif-Bold.ttf'),
      italic: file('DejaVuSerif-Italic.ttf'),
      boldItalic: file('DejaVuSerif-BoldItalic.ttf'),
    },
    mono: {
      regular: file('DejaVuSansMono.ttf'),
      bold: file('DejaVuSansMono-Bold.ttf'),
      italic: file('DejaVuSansMono-Oblique.ttf'),
      boldItalic: file('DejaVuSansMono-BoldOblique.ttf'),
    },
  };
}

function systemFontDirs(): string[] {
  const dirs = [
    process.env.PDF_LETTER_FONT_DIR,
    path.join(homedir(), 'Library/Fonts'),
    '/Library/Fonts',
    '/System/Library/Fonts',
    '/System/Library/Fonts/Supplemental',
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    path.join(homedir(), '.local/share/fonts'),
  ];
  return dirs.filter((dir): dir is string => Boolean(dir) && existsSync(dir as string));
}

const STYLE_SUFFIXES: Record<FontWeight, string[]> = {
  regular: ['', '-Regular', ' Regular', '-Book'],
  bold: ['-Bold', ' Bold', 'bd', '-Bd'],
  italic: ['-Italic', ' Italic', '-Oblique', ' Oblique', 'i'],
  boldItalic: ['-BoldItalic', ' Bold Italic', '-BoldOblique', ' Bold Oblique', 'bi'],
};

/** Looks a font family up in the system font directories, .ttf/.otf only. */
function resolveSystemFamily(family: string): Partial<FontFiles> | undefined {
  const found: Partial<FontFiles> = {};
  for (const dir of systemFontDirs()) {
    for (const weight of Object.keys(STYLE_SUFFIXES) as FontWeight[]) {
      if (found[weight]) continue;
      for (const suffix of STYLE_SUFFIXES[weight]) {
        for (const ext of ['.ttf', '.otf']) {
          const candidate = path.join(dir, `${family}${suffix}${ext}`);
          if (existsSync(candidate)) {
            found[weight] = candidate;
            break;
          }
        }
        if (found[weight]) break;
      }
    }
  }
  return found.regular ? found : undefined;
}

export function resolveFontFiles(spec: FontSpec = {}): { files: FontFiles; family: string } {
  const builtins = builtinFamilies();
  const family = spec.family?.trim() || 'sans';

  let base: FontFiles | undefined = builtins[family.toLowerCase()];

  if (!base && (family.includes('/') || family.endsWith('.ttf') || family.endsWith('.otf'))) {
    const file = path.resolve(family);
    if (!existsSync(file)) throw new Error(`Font file not found: ${file}`);
    base = { regular: file, bold: file, italic: file, boldItalic: file };
  }

  if (!base) {
    const system = resolveSystemFamily(family);
    if (system?.regular) {
      base = {
        regular: system.regular,
        bold: system.bold ?? system.regular,
        italic: system.italic ?? system.regular,
        boldItalic: system.boldItalic ?? system.bold ?? system.regular,
      };
    }
  }

  if (!base) base = builtins.sans as FontFiles;

  const files: FontFiles = {
    regular: spec.files?.regular ? path.resolve(spec.files.regular) : base.regular,
    bold: spec.files?.bold ? path.resolve(spec.files.bold) : base.bold,
    italic: spec.files?.italic ? path.resolve(spec.files.italic) : base.italic,
    boldItalic: spec.files?.boldItalic ? path.resolve(spec.files.boldItalic) : base.boldItalic,
  };

  for (const [weight, file] of Object.entries(files)) {
    if (!existsSync(file)) throw new Error(`Font file for "${weight}" not found: ${file}`);
  }

  return { files, family };
}

const fileCache = new Map<string, Buffer>();

async function readFontFile(file: string): Promise<Buffer> {
  const cached = fileCache.get(file);
  if (cached) return cached;
  const data = await readFile(file);
  fileCache.set(file, data);
  return data;
}

export async function embedFonts(pdf: PDFDocument, spec: FontSpec = {}): Promise<FontSet> {
  pdf.registerFontkit(fontkit);
  const { files, family } = resolveFontFiles(spec);
  const [regular, bold, italic, boldItalic] = await Promise.all(
    [files.regular, files.bold, files.italic, files.boldItalic].map(async (file) =>
      pdf.embedFont(await readFontFile(file), { subset: true }),
    ),
  );
  return {
    family,
    regular: regular as PDFFont,
    bold: bold as PDFFont,
    italic: italic as PDFFont,
    boldItalic: boldItalic as PDFFont,
  };
}

export function pickFont(fonts: FontSet, bold = false, italic = false): PDFFont {
  if (bold && italic) return fonts.boldItalic;
  if (bold) return fonts.bold;
  if (italic) return fonts.italic;
  return fonts.regular;
}

export function listBuiltinFamilies(): string[] {
  return Object.keys(builtinFamilies());
}
