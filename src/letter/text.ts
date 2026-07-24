/* Author: Fabian Bitter (fabian@bitter.de) */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SOFT_HYPHEN = '\u00AD';

export interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

export interface ParagraphBlock {
  type: 'paragraph';
  runs: InlineRun[];
}

export interface ListItemBlock {
  type: 'list-item';
  marker: string;
  runs: InlineRun[];
}

export interface BlankBlock {
  type: 'blank';
}

export interface PageBreakBlock {
  type: 'page-break';
}

export type Block = ParagraphBlock | ListItemBlock | BlankBlock | PageBreakBlock;

export type ParagraphMode = 'hard-breaks' | 'markdown';

/** Measures a piece of text in millimetres. */
export type Measure = (text: string, bold: boolean, italic: boolean) => number;

export interface Line {
  segments: InlineRun[];
  width: number;
}

/** Parses **bold**, __bold__, *italic* and _italic_ into styled runs. */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let bold = false;
  let italic = false;
  let buffer = '';

  const flush = () => {
    if (buffer) {
      runs.push({ text: buffer, bold, italic });
      buffer = '';
    }
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    const next = text[i + 1];

    if (char === '\\' && next && '*_\\'.includes(next)) {
      buffer += next;
      i += 1;
      continue;
    }
    if ((char === '*' && next === '*') || (char === '_' && next === '_')) {
      flush();
      bold = !bold;
      i += 1;
      continue;
    }
    if (char === '*' || char === '_') {
      flush();
      italic = !italic;
      continue;
    }
    buffer += char;
  }
  flush();
  return runs.filter((run) => run.text.length > 0);
}

const LIST_BULLET = /^\s*[-*•]\s+(.*)$/;
const LIST_NUMBER = /^\s*(\d+)[.)]\s+(.*)$/;
const PAGE_BREAK = /^\s*(\\pagebreak|\[\[pagebreak\]\]|---pagebreak---|\f)\s*$/i;

/**
 * Splits the body text into blocks. In "hard-breaks" mode every newline is a
 * line break and a blank line separates paragraphs, which is what people expect
 * when they type a letter. In "markdown" mode single newlines are joined.
 */
export function parseBody(text: string, mode: ParagraphMode = 'hard-breaks'): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const joined = mode === 'markdown' ? paragraph.join(' ') : paragraph.join('\n');
    blocks.push({ type: 'paragraph', runs: parseInline(joined) });
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (PAGE_BREAK.test(line)) {
      flushParagraph();
      blocks.push({ type: 'page-break' });
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      blocks.push({ type: 'blank' });
      continue;
    }
    const bullet = LIST_BULLET.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'list-item', marker: '•', runs: parseInline(bullet[1] ?? '') });
      continue;
    }
    const numbered = LIST_NUMBER.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push({ type: 'list-item', marker: `${numbered[1]}.`, runs: parseInline(numbered[2] ?? '') });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  while (blocks.length > 0 && blocks[blocks.length - 1]?.type === 'blank') blocks.pop();
  while (blocks.length > 0 && blocks[0]?.type === 'blank') blocks.shift();
  return blocks;
}

export type Hyphenator = (word: string) => string[];

const noHyphenation: Hyphenator = (word) => [word];

/** Loads hyphenation patterns lazily; falls back to no hyphenation. */
export function createHyphenator(pattern: string | undefined, enabled = true): Hyphenator {
  if (!enabled || !pattern) return noHyphenation;
  try {
    const module = require(`hyphen/${pattern}/index.js`) as {
      hyphenateSync?: (text: string) => string;
    };
    if (typeof module.hyphenateSync !== 'function') return noHyphenation;
    const cache = new Map<string, string[]>();
    return (word: string): string[] => {
      const cached = cache.get(word);
      if (cached) return cached;
      const chunks = module
        .hyphenateSync!(word)
        .split(SOFT_HYPHEN)
        .filter((chunk) => chunk.length > 0);
      const result = chunks.length > 0 ? chunks : [word];
      cache.set(word, result);
      return result;
    };
  } catch {
    return noHyphenation;
  }
}

interface Token {
  kind: 'word' | 'space' | 'break';
  text: string;
  bold: boolean;
  italic: boolean;
}

function tokenize(runs: InlineRun[]): Token[] {
  const tokens: Token[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\n|[ \t]+)/);
    for (const part of parts) {
      if (part === '') continue;
      if (part === '\n') tokens.push({ kind: 'break', text: '', bold: run.bold, italic: run.italic });
      else if (/^[ \t]+$/.test(part)) tokens.push({ kind: 'space', text: ' ', bold: run.bold, italic: run.italic });
      else tokens.push({ kind: 'word', text: part, bold: run.bold, italic: run.italic });
    }
  }
  return tokens;
}

interface LineBuilder {
  segments: InlineRun[];
  width: number;
}

function pushSegment(line: LineBuilder, token: { text: string; bold: boolean; italic: boolean }, width: number): void {
  const last = line.segments[line.segments.length - 1];
  if (last && last.bold === token.bold && last.italic === token.italic) {
    last.text += token.text;
  } else {
    line.segments.push({ text: token.text, bold: token.bold, italic: token.italic });
  }
  line.width += width;
}

/** Greedy line breaking with optional hyphenation and hard character fallback. */
export function wrapRuns(
  runs: InlineRun[],
  maxWidth: number,
  measure: Measure,
  hyphenate: Hyphenator = noHyphenation,
): Line[] {
  const tokens = tokenize(runs);
  const lines: Line[] = [];
  let line: LineBuilder = { segments: [], width: 0 };
  let pendingSpace: Token | null = null;

  const finish = () => {
    lines.push({ segments: line.segments, width: line.width });
    line = { segments: [], width: 0 };
    pendingSpace = null;
  };

  const remaining = () => maxWidth - line.width - (pendingSpace ? measure(' ', pendingSpace.bold, pendingSpace.italic) : 0);

  const commitSpace = () => {
    if (pendingSpace) {
      pushSegment(line, pendingSpace, measure(' ', pendingSpace.bold, pendingSpace.italic));
      pendingSpace = null;
    }
  };

  const splitByCharacters = (token: Token, available: number): [string, string] => {
    let index = 0;
    let taken = '';
    while (index < token.text.length) {
      const candidate = taken + token.text[index];
      if (measure(candidate, token.bold, token.italic) > available) break;
      taken = candidate;
      index += 1;
    }
    if (taken === '') taken = token.text.slice(0, 1);
    return [taken, token.text.slice(taken.length)];
  };

  const splitByHyphenation = (token: Token, available: number): [string, string] | null => {
    const chunks = hyphenate(token.text);
    if (chunks.length < 2) return null;
    let head = '';
    let best: [string, string] | null = null;
    for (let i = 0; i < chunks.length - 1; i += 1) {
      head += chunks[i];
      const candidate = `${head}-`;
      if (measure(candidate, token.bold, token.italic) <= available) {
        best = [candidate, chunks.slice(i + 1).join('')];
      } else {
        break;
      }
    }
    if (!best) return null;
    const [, tail] = best;
    if (head.length < 2 || tail.length < 2) return null;
    return best;
  };

  for (const token of tokens) {
    if (token.kind === 'break') {
      finish();
      continue;
    }
    if (token.kind === 'space') {
      if (line.segments.length > 0) pendingSpace = token;
      continue;
    }

    let word: Token = token;
    for (;;) {
      const width = measure(word.text, word.bold, word.italic);
      if (width <= remaining()) {
        commitSpace();
        pushSegment(line, word, width);
        break;
      }

      const available = remaining();
      const hyphenated = available > 0 ? splitByHyphenation(word, available) : null;
      if (hyphenated) {
        commitSpace();
        pushSegment(line, { ...word, text: hyphenated[0] }, measure(hyphenated[0], word.bold, word.italic));
        finish();
        word = { ...word, text: hyphenated[1] };
        continue;
      }

      if (line.segments.length > 0) {
        finish();
        continue;
      }

      // Word does not fit on an empty line: break it by characters.
      const [head, tail] = splitByCharacters(word, maxWidth);
      pushSegment(line, { ...word, text: head }, measure(head, word.bold, word.italic));
      finish();
      if (tail === '') break;
      word = { ...word, text: tail };
    }
  }

  if (line.segments.length > 0 || lines.length === 0) finish();
  return lines;
}

/** Shortens a single line with an ellipsis so it fits into maxWidth. */
export function truncateToWidth(text: string, maxWidth: number, measure: (value: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && measure(`${result}…`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}…`;
}
