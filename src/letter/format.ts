/* Author: Fabian Bitter (fabian@bitter.de) */

import { normalizeLocale, type SupportedLocale } from './i18n.js';

const DEFAULT_REGION: Record<SupportedLocale, string> = {
  de: 'de-DE',
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
  pt: 'pt-PT',
  pl: 'pl-PL',
  tr: 'tr-TR',
  da: 'da-DK',
  sv: 'sv-SE',
  cs: 'cs-CZ',
};

export type DateStyle = 'numeric' | 'long' | 'iso';

/** Turns "de" into "de-DE" while keeping explicit tags such as "en-US" intact. */
export function toIntlLocale(locale: string | undefined): string {
  if (locale && /[-_]/.test(locale)) return locale.replace('_', '-');
  return DEFAULT_REGION[normalizeLocale(locale)];
}

/**
 * Accepts an ISO date (YYYY-MM-DD), an ISO timestamp, "today", or free text.
 * Free text is passed through unchanged so callers can write dates by hand.
 */
export function formatDate(
  value: string | undefined,
  style: DateStyle,
  locale: string | undefined,
  now: Date = new Date(),
): string {
  const raw = (value ?? 'today').trim();
  const date = parseDate(raw, now);
  if (!date) return raw;
  if (style === 'iso') return date.toISOString().slice(0, 10);

  const intlLocale = toIntlLocale(locale);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: 'UTC' }).format(date);
}

export function parseDate(raw: string, now: Date = new Date()): Date | null {
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'today' || value === 'heute') {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{4}-\d{2}-\d{2}t/.test(value)) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value)) {
    const [day, month, year] = value.split('.').map(Number) as [number, number, number];
    return new Date(Date.UTC(year, month - 1, day));
  }
  return null;
}

export function countryName(code: string, locale: string | undefined): string {
  const normalized = code.trim();
  if (normalized.length !== 2) return normalized;
  try {
    const display = new Intl.DisplayNames([toIntlLocale(locale)], { type: 'region' });
    return display.of(normalized.toUpperCase()) ?? normalized;
  } catch {
    return normalized;
  }
}
