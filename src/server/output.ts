/* Author: Fabian Bitter (fabian@bitter.de) */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

export function defaultOutputDir(): string {
  const configured = process.env.PDF_LETTER_OUTPUT_DIR;
  if (configured && configured.trim()) {
    return path.resolve(configured.replace(/^~(?=$|\/)/, homedir()));
  }
  return path.join(tmpdir(), 'pdf-letter-mcp');
}

export function slugify(value: string, fallback = 'brief'): string {
  const slug = value
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

export function uniquePath(target: string): string {
  if (!existsSync(target)) return target;
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let counter = 1; counter < 1000; counter += 1) {
    const candidate = path.join(dir, `${base}-${counter}${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find a free file name for ${target}.`);
}

export interface WriteOptions {
  outputPath?: string;
  overwrite?: boolean;
  defaultName: string;
}

export async function writePdf(bytes: Uint8Array, options: WriteOptions): Promise<string> {
  const requested = options.outputPath?.trim();
  let target = requested
    ? path.resolve(requested.replace(/^~(?=$|\/)/, homedir()))
    : path.join(defaultOutputDir(), options.defaultName);
  if (!target.toLowerCase().endsWith('.pdf')) target = `${target}.pdf`;
  if (!options.overwrite) target = uniquePath(target);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return target;
}
