/* Author: Fabian Bitter (fabian@bitter.de) */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PDFDocument, PDFImage } from 'pdf-lib';

export interface ImageSource {
  /** Absolute or relative path to a PNG/JPEG file (other formats need sharp). */
  path?: string;
  /** Raw image data, optionally as a data URL. */
  base64?: string;
}

export interface ImageProcessing {
  /** Crop uniform (white) borders around the signature. */
  trim?: boolean;
  /** Turn the white paper background of a scan into transparency. */
  removeBackground?: boolean;
  /** Luminance cutoff for removeBackground, 0..1, default 0.85. */
  backgroundThreshold?: number;
  /** Recolour the remaining ink, e.g. "#1a1a1a" or "#003366". */
  inkColor?: string;
}

export interface PreparedImage {
  data: Buffer;
  format: 'png' | 'jpg';
  warnings: string[];
}

type SharpModule = typeof import('sharp');

let sharpModule: SharpModule | null | undefined;

async function loadSharp(): Promise<SharpModule | null> {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const imported = (await import('sharp')) as unknown as { default?: SharpModule };
    sharpModule = (imported.default ?? (imported as unknown as SharpModule)) ?? null;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

function detectFormat(data: Buffer): 'png' | 'jpg' | 'other' {
  if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'png';
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpg';
  return 'other';
}

function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const int = parseInt(match[1] as string, 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

async function readSource(source: ImageSource): Promise<Buffer> {
  if (source.path) {
    return readFile(path.resolve(source.path));
  }
  if (source.base64) {
    const raw = source.base64.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(raw, 'base64');
  }
  throw new Error('Image source requires either "path" or "base64".');
}

/**
 * Makes a signature scan usable in a PDF: optional trimming, white background
 * removal and ink recolouring. Everything beyond plain PNG/JPEG pass-through
 * needs the optional `sharp` dependency.
 */
export async function prepareImage(
  source: ImageSource,
  processing: ImageProcessing = {},
): Promise<PreparedImage> {
  const warnings: string[] = [];
  const original = await readSource(source);
  const format = detectFormat(original);
  const wantsProcessing = Boolean(processing.trim || processing.removeBackground || processing.inkColor);

  if (!wantsProcessing && format !== 'other') {
    return { data: original, format, warnings };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    if (format === 'other') {
      throw new Error(
        'Unsupported image format. Provide a PNG or JPEG file, or install the optional "sharp" dependency for automatic conversion.',
      );
    }
    warnings.push('Optional dependency "sharp" is not available, the image was embedded unprocessed.');
    return { data: original, format, warnings };
  }

  let pipeline = sharp(original);
  if (processing.trim) {
    pipeline = pipeline.trim({ threshold: 12 });
  }

  if (processing.removeBackground || processing.inkColor) {
    const threshold = Math.min(Math.max(processing.backgroundThreshold ?? 0.85, 0.1), 0.99);
    const ink = processing.inkColor ? parseHexColor(processing.inkColor) : null;
    if (processing.inkColor && !ink) warnings.push(`Ignored invalid inkColor "${processing.inkColor}".`);

    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = Buffer.from(data);
    const cutoff = threshold * 255;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] as number;
      const g = pixels[i + 1] as number;
      const b = pixels[i + 2] as number;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (processing.removeBackground) {
        const alpha = luminance >= cutoff ? 0 : Math.round(255 * (1 - luminance / cutoff));
        pixels[i + 3] = Math.min(pixels[i + 3] as number, alpha);
      }
      if (ink) {
        pixels[i] = ink[0];
        pixels[i + 1] = ink[1];
        pixels[i + 2] = ink[2];
      }
    }
    const png = await sharp(pixels, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();
    return { data: png, format: 'png', warnings };
  }

  const png = await pipeline.png().toBuffer();
  return { data: png, format: 'png', warnings };
}

/**
 * Embeds the image, keeping the alpha channel of a PNG (pdf-lib turns it into a
 * soft mask). Interlaced, palette or 16 bit PNGs are not readable by pdf-lib, so
 * they are normalised to 8 bit RGBA first when sharp is available.
 */
export async function embedImage(pdf: PDFDocument, image: PreparedImage): Promise<PDFImage> {
  if (image.format === 'jpg') return pdf.embedJpg(image.data);
  try {
    return await pdf.embedPng(image.data);
  } catch (error) {
    const sharp = await loadSharp();
    if (!sharp) {
      throw new Error(
        `This PNG cannot be embedded (${error instanceof Error ? error.message : String(error)}). Save it as a non interlaced 8 bit PNG or install the optional "sharp" dependency.`,
      );
    }
    const normalized = await sharp(image.data).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
    return pdf.embedPng(normalized);
  }
}
