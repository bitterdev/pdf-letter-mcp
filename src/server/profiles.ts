/* Author: Fabian Bitter (fabian@bitter.de) */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { PostalAddress } from '../letter/address.js';
import type { Letter } from '../letter/model.js';

/**
 * Sender identities live on the machine, not in the prompt. The file holds the
 * address and the signature per person, so a letter only has to name a profile
 * and the server fills the rest in verbatim.
 */
export interface LetterProfile {
  /** Shown by list_profiles, e.g. "Fabian, privat". */
  description?: string;
  sender: PostalAddress;
  /** Place for the "place, date" line. */
  place?: string;
  locale?: string;
  signature?: {
    path?: string;
    /** Printed name below the signature, defaults to the sender name. */
    name?: string;
    title?: string;
    prefix?: string;
  };
  closing?: string;
}

export interface ProfileFile {
  defaultProfile?: string;
  profiles: Record<string, LetterProfile>;
}

export function profilesPath(): string {
  const configured = process.env.PDF_LETTER_PROFILES?.trim();
  if (configured) return path.resolve(configured.replace(/^~(?=$|\/)/, homedir()));
  return path.join(homedir(), '.config', 'pdf-letter-mcp', 'profiles.json');
}

export function loadProfiles(): ProfileFile {
  const file = profilesPath();
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return { profiles: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`The profile file ${file} is not valid JSON: ${(error as Error).message}`);
  }
  const data = parsed as ProfileFile;
  if (!data || typeof data !== 'object' || typeof data.profiles !== 'object' || data.profiles === null) {
    throw new Error(`The profile file ${file} needs a "profiles" object.`);
  }
  return { defaultProfile: data.defaultProfile, profiles: data.profiles };
}

export function listProfiles(): {
  path: string;
  defaultProfile: string | null;
  profiles: { key: string; description?: string; sender: string; hasSignature: boolean }[];
} {
  const file = loadProfiles();
  const fallback = process.env.PDF_LETTER_PROFILE?.trim();
  return {
    path: profilesPath(),
    defaultProfile: file.defaultProfile ?? fallback ?? null,
    profiles: Object.entries(file.profiles).map(([key, profile]) => ({
      key,
      ...(profile.description ? { description: profile.description } : {}),
      sender: [profile.sender?.company, profile.sender?.name].filter(Boolean).join(', ') || key,
      hasSignature: Boolean(profile.signature?.path),
    })),
  };
}

/**
 * Applies the named profile. The profile owns the identity of the letter, so
 * sender and signature image always come from the file and cannot be overridden
 * per call. Place, locale and closing are defaults that a letter may replace.
 */
export function applyProfile(letter: Letter, profileKey?: string): Letter {
  const file = loadProfiles();
  const key = profileKey?.trim() || file.defaultProfile || process.env.PDF_LETTER_PROFILE?.trim();

  if (!key) {
    if (!letter.sender) {
      throw new Error(
        `No profile and no sender given. Available profiles: ${Object.keys(file.profiles).join(', ') || 'none'}.`,
      );
    }
    return letter;
  }

  const profile = file.profiles[key];
  if (!profile) {
    throw new Error(
      `Unknown profile "${key}". Available: ${Object.keys(file.profiles).join(', ') || 'none'} (${profilesPath()}).`,
    );
  }

  const signature = {
    ...(letter.signature ?? {}),
    ...(profile.signature?.path ? { path: profile.signature.path, base64: undefined } : {}),
    name: profile.signature?.name ?? letter.signature?.name ?? profile.sender.name,
    ...(profile.signature?.title ? { title: profile.signature.title } : {}),
    ...(profile.signature?.prefix ? { prefix: profile.signature.prefix } : {}),
  };

  return {
    ...letter,
    sender: profile.sender,
    place: letter.place ?? profile.place,
    locale: letter.locale ?? profile.locale,
    closing: letter.closing ?? profile.closing,
    signature,
  };
}
