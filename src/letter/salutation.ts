/* Author: Fabian Bitter (fabian@bitter.de) */

import type { PostalAddress } from './address.js';
import { interpolate, type LetterLabels } from './i18n.js';

const MALE_MARKERS = /^(herrn?|mr|mister|monsieur|m\.|sr|señor|sig|signore|dhr|de heer|pan|bay|sayın bay|hr)\b/i;
const FEMALE_MARKERS = /^(frau|fr\.|ms|mrs|miss|madame|mme|sra|señora|sig\.?ra|signora|mevrouw|mw|pani|bayan|fru)\b/i;
const PARTICLES = new Set(['von', 'van', 'de', 'del', 'della', 'di', 'da', 'dos', 'zu', 'ter', 'ten', 'le', 'la']);
const TITLES = /^(dr|prof|dipl|ing|mag|med|dent|jur|rer|nat|phil|habil|mba|llm|ba|ma|msc|bsc)\.?$/i;

/** Keeps academic titles and name particles, drops given names. */
export function surnameWithTitles(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return fullName.trim();

  const kept: string[] = [];
  tokens.forEach((token, index) => {
    const isLast = index === tokens.length - 1;
    const cleaned = token.replace(/[.,]$/, '');
    if (isLast || TITLES.test(cleaned) || PARTICLES.has(cleaned.toLowerCase())) kept.push(token);
  });
  return kept.join(' ');
}

/** Builds the salutation from the recipient, falling back to the generic one. */
export function deriveSalutation(recipient: PostalAddress, labels: LetterLabels): string {
  const name = recipient.name?.trim();
  if (!name) return labels.salutationGeneric;

  const marker = (recipient.salutationLine ?? '').trim();
  const surname = surnameWithTitles(name);

  if (MALE_MARKERS.test(marker)) return interpolate(labels.salutationMale, { name: surname });
  if (FEMALE_MARKERS.test(marker)) return interpolate(labels.salutationFemale, { name: surname });
  return labels.salutationGeneric;
}
