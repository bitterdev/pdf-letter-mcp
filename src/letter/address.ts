/* Author: Fabian Bitter (fabian@bitter.de) */

import { countryName } from './format.js';

export interface PostalAddress {
  /** Form of address on its own line, e.g. "Herrn", "Frau", "Firma". */
  salutationLine?: string;
  company?: string;
  name?: string;
  /** Department, "c/o", building, floor. */
  additionalLine?: string;
  street?: string;
  postOfficeBox?: string;
  postalCode?: string;
  city?: string;
  /** State or province, used by US/CA/AU style postal lines. */
  region?: string;
  /** ISO 3166-1 alpha-2 code or plain country name. */
  country?: string;
  /** Fully manual override; when set, all other fields are ignored. */
  addressLines?: string[];
  phone?: string;
  email?: string;
  web?: string;
}

export type CountryDisplay = 'auto' | 'always' | 'never';

export interface AddressFormatOptions {
  /** Country of the sender, used to decide whether to print a country line. */
  senderCountry?: string;
  /** Language the country name is printed in (language of the sending country). */
  locale?: string;
  countryDisplay?: CountryDisplay;
}

const CITY_FIRST_COUNTRIES = new Set(['US', 'CA', 'AU', 'NZ']);
const POSTCODE_ON_OWN_LINE = new Set(['GB', 'IE']);

const isFilled = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function normalizeCountry(country: string | undefined): string | undefined {
  if (!isFilled(country)) return undefined;
  return country.trim().toUpperCase();
}

function postalLines(address: PostalAddress): string[] {
  const code = address.postalCode?.trim() ?? '';
  const city = address.city?.trim() ?? '';
  const region = address.region?.trim() ?? '';
  const country = normalizeCountry(address.country);

  if (!code && !city) return [];

  if (country && CITY_FIRST_COUNTRIES.has(country)) {
    const tail = [region, code].filter(Boolean).join(' ');
    return [[city, tail].filter(Boolean).join(', ')];
  }
  if (country && POSTCODE_ON_OWN_LINE.has(country)) {
    return [city, code].filter(Boolean);
  }
  return [[code, city].filter(Boolean).join(' ')];
}

/** Builds the address zone lines in DIN 5008 order. */
export function formatAddressLines(
  address: PostalAddress,
  options: AddressFormatOptions = {},
): string[] {
  if (address.addressLines?.length) {
    return address.addressLines.map((line) => line.trim()).filter((line) => line.length > 0);
  }

  const lines: string[] = [];
  // With a company the form of address belongs on the name line ("Muster GmbH" /
  // "Frau Dr. Mustermann"), without one it keeps its traditional own line.
  if (isFilled(address.company)) {
    lines.push(address.company.trim());
    const person = [address.salutationLine, address.name].filter(isFilled).join(' ').trim();
    if (person) lines.push(person);
  } else {
    if (isFilled(address.salutationLine)) lines.push(address.salutationLine.trim());
    if (isFilled(address.name)) lines.push(address.name.trim());
  }
  if (isFilled(address.additionalLine)) lines.push(address.additionalLine.trim());

  if (isFilled(address.postOfficeBox)) {
    lines.push(address.postOfficeBox.trim());
  } else if (isFilled(address.street)) {
    lines.push(address.street.trim());
  }

  lines.push(...postalLines(address));

  const country = normalizeCountry(address.country);
  const senderCountry = normalizeCountry(options.senderCountry);
  const display = options.countryDisplay ?? 'auto';
  const showCountry =
    isFilled(address.country) &&
    (display === 'always' || (display === 'auto' && country !== undefined && country !== (senderCountry ?? 'DE')));

  if (showCountry && country) {
    lines.push(countryName(country, options.locale).toUpperCase());
  }

  return lines;
}

/** Single line return address printed above the recipient (Rücksendeangabe). */
export function formatReturnAddress(sender: PostalAddress, separator = ' · '): string {
  const name = [sender.company, sender.name].filter(isFilled)[0]?.trim();
  const street = isFilled(sender.street) ? sender.street.trim() : sender.postOfficeBox?.trim();
  const city = [sender.postalCode, sender.city].filter(isFilled).join(' ').trim();
  return [name, street, city].filter(Boolean).join(separator);
}

/** Sender block for the letterhead. */
export function formatSenderLines(sender: PostalAddress): string[] {
  const lines: string[] = [];
  for (const value of [sender.company, sender.name, sender.additionalLine]) {
    if (isFilled(value)) lines.push(value.trim());
  }
  if (isFilled(sender.postOfficeBox)) lines.push(sender.postOfficeBox.trim());
  if (isFilled(sender.street)) lines.push(sender.street.trim());
  lines.push(...postalLines(sender));
  return lines;
}
