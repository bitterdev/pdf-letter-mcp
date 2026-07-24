/* Author: Fabian Bitter (fabian@bitter.de) */

export interface LetterLabels {
  salutationGeneric: string;
  salutationMale: string;
  salutationFemale: string;
  salutationNeutral: string;
  closing: string;
  enclosure: string;
  enclosures: string;
  copyTo: string;
  pageOf: string;
  subjectPrefix: string;
  placeDate: string;
  infoDate: string;
  infoYourReference: string;
  infoYourMessageOf: string;
  infoOurReference: string;
  infoOurMessageOf: string;
  infoContact: string;
  infoPhone: string;
  infoMobile: string;
  infoFax: string;
  infoEmail: string;
  infoWeb: string;
  infoCustomerNumber: string;
  infoInvoiceNumber: string;
}

export type SupportedLocale =
  | 'de'
  | 'en'
  | 'fr'
  | 'es'
  | 'it'
  | 'nl'
  | 'pt'
  | 'pl'
  | 'tr'
  | 'da'
  | 'sv'
  | 'cs';

/**
 * Placeholders: {name} in salutations, {page}/{total} in pageOf,
 * {place}/{date} in placeDate.
 */
const LABELS: Record<SupportedLocale, LetterLabels> = {
  de: {
    salutationGeneric: 'Sehr geehrte Damen und Herren,',
    salutationMale: 'Sehr geehrter Herr {name},',
    salutationFemale: 'Sehr geehrte Frau {name},',
    salutationNeutral: 'Guten Tag {name},',
    closing: 'Mit freundlichen Grüßen',
    enclosure: 'Anlage',
    enclosures: 'Anlagen',
    copyTo: 'Kopie an',
    pageOf: 'Seite {page} von {total}',
    subjectPrefix: '',
    placeDate: '{place}, {date}',
    infoDate: 'Datum',
    infoYourReference: 'Ihr Zeichen',
    infoYourMessageOf: 'Ihre Nachricht vom',
    infoOurReference: 'Unser Zeichen',
    infoOurMessageOf: 'Unsere Nachricht vom',
    infoContact: 'Ansprechpartner',
    infoPhone: 'Telefon',
    infoMobile: 'Mobil',
    infoFax: 'Fax',
    infoEmail: 'E-Mail',
    infoWeb: 'Internet',
    infoCustomerNumber: 'Kundennummer',
    infoInvoiceNumber: 'Rechnungsnummer',
  },
  en: {
    salutationGeneric: 'Dear Sir or Madam,',
    salutationMale: 'Dear Mr {name},',
    salutationFemale: 'Dear Ms {name},',
    salutationNeutral: 'Dear {name},',
    closing: 'Kind regards',
    enclosure: 'Enclosure',
    enclosures: 'Enclosures',
    copyTo: 'Copy to',
    pageOf: 'Page {page} of {total}',
    subjectPrefix: '',
    placeDate: '{place}, {date}',
    infoDate: 'Date',
    infoYourReference: 'Your reference',
    infoYourMessageOf: 'Your message of',
    infoOurReference: 'Our reference',
    infoOurMessageOf: 'Our message of',
    infoContact: 'Contact',
    infoPhone: 'Phone',
    infoMobile: 'Mobile',
    infoFax: 'Fax',
    infoEmail: 'Email',
    infoWeb: 'Web',
    infoCustomerNumber: 'Customer number',
    infoInvoiceNumber: 'Invoice number',
  },
  fr: {
    salutationGeneric: 'Madame, Monsieur,',
    salutationMale: 'Monsieur {name},',
    salutationFemale: 'Madame {name},',
    salutationNeutral: 'Bonjour {name},',
    closing: 'Cordialement',
    enclosure: 'Pièce jointe',
    enclosures: 'Pièces jointes',
    copyTo: 'Copie à',
    pageOf: 'Page {page} sur {total}',
    subjectPrefix: 'Objet : ',
    placeDate: '{place}, le {date}',
    infoDate: 'Date',
    infoYourReference: 'Votre référence',
    infoYourMessageOf: 'Votre message du',
    infoOurReference: 'Notre référence',
    infoOurMessageOf: 'Notre message du',
    infoContact: 'Contact',
    infoPhone: 'Téléphone',
    infoMobile: 'Mobile',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Site web',
    infoCustomerNumber: 'Numéro de client',
    infoInvoiceNumber: 'Numéro de facture',
  },
  es: {
    salutationGeneric: 'Estimados señores y señoras:',
    salutationMale: 'Estimado Sr. {name}:',
    salutationFemale: 'Estimada Sra. {name}:',
    salutationNeutral: 'Estimado/a {name}:',
    closing: 'Atentamente',
    enclosure: 'Anexo',
    enclosures: 'Anexos',
    copyTo: 'Copia a',
    pageOf: 'Página {page} de {total}',
    subjectPrefix: 'Asunto: ',
    placeDate: '{place}, {date}',
    infoDate: 'Fecha',
    infoYourReference: 'Su referencia',
    infoYourMessageOf: 'Su mensaje del',
    infoOurReference: 'Nuestra referencia',
    infoOurMessageOf: 'Nuestro mensaje del',
    infoContact: 'Contacto',
    infoPhone: 'Teléfono',
    infoMobile: 'Móvil',
    infoFax: 'Fax',
    infoEmail: 'Correo electrónico',
    infoWeb: 'Web',
    infoCustomerNumber: 'Número de cliente',
    infoInvoiceNumber: 'Número de factura',
  },
  it: {
    salutationGeneric: 'Gentili Signore e Signori,',
    salutationMale: 'Gentile Sig. {name},',
    salutationFemale: 'Gentile Sig.ra {name},',
    salutationNeutral: 'Gentile {name},',
    closing: 'Cordiali saluti',
    enclosure: 'Allegato',
    enclosures: 'Allegati',
    copyTo: 'Copia a',
    pageOf: 'Pagina {page} di {total}',
    subjectPrefix: 'Oggetto: ',
    placeDate: '{place}, {date}',
    infoDate: 'Data',
    infoYourReference: 'Vostro riferimento',
    infoYourMessageOf: 'Vostro messaggio del',
    infoOurReference: 'Nostro riferimento',
    infoOurMessageOf: 'Nostro messaggio del',
    infoContact: 'Referente',
    infoPhone: 'Telefono',
    infoMobile: 'Cellulare',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Sito web',
    infoCustomerNumber: 'Numero cliente',
    infoInvoiceNumber: 'Numero fattura',
  },
  nl: {
    salutationGeneric: 'Geachte heer, mevrouw,',
    salutationMale: 'Geachte heer {name},',
    salutationFemale: 'Geachte mevrouw {name},',
    salutationNeutral: 'Beste {name},',
    closing: 'Met vriendelijke groet',
    enclosure: 'Bijlage',
    enclosures: 'Bijlagen',
    copyTo: 'Kopie aan',
    pageOf: 'Pagina {page} van {total}',
    subjectPrefix: 'Betreft: ',
    placeDate: '{place}, {date}',
    infoDate: 'Datum',
    infoYourReference: 'Uw kenmerk',
    infoYourMessageOf: 'Uw bericht van',
    infoOurReference: 'Ons kenmerk',
    infoOurMessageOf: 'Ons bericht van',
    infoContact: 'Contactpersoon',
    infoPhone: 'Telefoon',
    infoMobile: 'Mobiel',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Website',
    infoCustomerNumber: 'Klantnummer',
    infoInvoiceNumber: 'Factuurnummer',
  },
  pt: {
    salutationGeneric: 'Exmos. Senhores,',
    salutationMale: 'Exmo. Sr. {name},',
    salutationFemale: 'Exma. Sra. {name},',
    salutationNeutral: 'Caro(a) {name},',
    closing: 'Com os melhores cumprimentos',
    enclosure: 'Anexo',
    enclosures: 'Anexos',
    copyTo: 'Cópia para',
    pageOf: 'Página {page} de {total}',
    subjectPrefix: 'Assunto: ',
    placeDate: '{place}, {date}',
    infoDate: 'Data',
    infoYourReference: 'A sua referência',
    infoYourMessageOf: 'A sua mensagem de',
    infoOurReference: 'A nossa referência',
    infoOurMessageOf: 'A nossa mensagem de',
    infoContact: 'Contacto',
    infoPhone: 'Telefone',
    infoMobile: 'Telemóvel',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Website',
    infoCustomerNumber: 'Número de cliente',
    infoInvoiceNumber: 'Número de fatura',
  },
  pl: {
    salutationGeneric: 'Szanowni Państwo,',
    salutationMale: 'Szanowny Panie {name},',
    salutationFemale: 'Szanowna Pani {name},',
    salutationNeutral: 'Dzień dobry {name},',
    closing: 'Z poważaniem',
    enclosure: 'Załącznik',
    enclosures: 'Załączniki',
    copyTo: 'Do wiadomości',
    pageOf: 'Strona {page} z {total}',
    subjectPrefix: 'Dotyczy: ',
    placeDate: '{place}, {date}',
    infoDate: 'Data',
    infoYourReference: 'Wasz znak',
    infoYourMessageOf: 'Wasza wiadomość z',
    infoOurReference: 'Nasz znak',
    infoOurMessageOf: 'Nasza wiadomość z',
    infoContact: 'Osoba kontaktowa',
    infoPhone: 'Telefon',
    infoMobile: 'Telefon komórkowy',
    infoFax: 'Faks',
    infoEmail: 'E-mail',
    infoWeb: 'Strona internetowa',
    infoCustomerNumber: 'Numer klienta',
    infoInvoiceNumber: 'Numer faktury',
  },
  tr: {
    salutationGeneric: 'Sayın Yetkili,',
    salutationMale: 'Sayın {name} Bey,',
    salutationFemale: 'Sayın {name} Hanım,',
    salutationNeutral: 'Sayın {name},',
    closing: 'Saygılarımla',
    enclosure: 'Ek',
    enclosures: 'Ekler',
    copyTo: 'Bilgi',
    pageOf: 'Sayfa {page} / {total}',
    subjectPrefix: 'Konu: ',
    placeDate: '{place}, {date}',
    infoDate: 'Tarih',
    infoYourReference: 'Sizin referansınız',
    infoYourMessageOf: 'Mesaj tarihiniz',
    infoOurReference: 'Referansımız',
    infoOurMessageOf: 'Mesaj tarihimiz',
    infoContact: 'İlgili kişi',
    infoPhone: 'Telefon',
    infoMobile: 'Cep telefonu',
    infoFax: 'Faks',
    infoEmail: 'E-posta',
    infoWeb: 'İnternet',
    infoCustomerNumber: 'Müşteri numarası',
    infoInvoiceNumber: 'Fatura numarası',
  },
  da: {
    salutationGeneric: 'Kære modtager,',
    salutationMale: 'Kære hr. {name},',
    salutationFemale: 'Kære fru {name},',
    salutationNeutral: 'Kære {name},',
    closing: 'Med venlig hilsen',
    enclosure: 'Bilag',
    enclosures: 'Bilag',
    copyTo: 'Kopi til',
    pageOf: 'Side {page} af {total}',
    subjectPrefix: 'Vedr.: ',
    placeDate: '{place}, den {date}',
    infoDate: 'Dato',
    infoYourReference: 'Jeres reference',
    infoYourMessageOf: 'Jeres besked af',
    infoOurReference: 'Vores reference',
    infoOurMessageOf: 'Vores besked af',
    infoContact: 'Kontaktperson',
    infoPhone: 'Telefon',
    infoMobile: 'Mobil',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Website',
    infoCustomerNumber: 'Kundenummer',
    infoInvoiceNumber: 'Fakturanummer',
  },
  sv: {
    salutationGeneric: 'Hej,',
    salutationMale: 'Bäste herr {name},',
    salutationFemale: 'Bästa fru {name},',
    salutationNeutral: 'Hej {name},',
    closing: 'Med vänliga hälsningar',
    enclosure: 'Bilaga',
    enclosures: 'Bilagor',
    copyTo: 'Kopia till',
    pageOf: 'Sida {page} av {total}',
    subjectPrefix: 'Ärende: ',
    placeDate: '{place}, {date}',
    infoDate: 'Datum',
    infoYourReference: 'Er referens',
    infoYourMessageOf: 'Ert meddelande av',
    infoOurReference: 'Vår referens',
    infoOurMessageOf: 'Vårt meddelande av',
    infoContact: 'Kontaktperson',
    infoPhone: 'Telefon',
    infoMobile: 'Mobil',
    infoFax: 'Fax',
    infoEmail: 'E-post',
    infoWeb: 'Webbplats',
    infoCustomerNumber: 'Kundnummer',
    infoInvoiceNumber: 'Fakturanummer',
  },
  cs: {
    salutationGeneric: 'Vážené dámy a pánové,',
    salutationMale: 'Vážený pane {name},',
    salutationFemale: 'Vážená paní {name},',
    salutationNeutral: 'Dobrý den {name},',
    closing: 'S pozdravem',
    enclosure: 'Příloha',
    enclosures: 'Přílohy',
    copyTo: 'Na vědomí',
    pageOf: 'Strana {page} z {total}',
    subjectPrefix: 'Věc: ',
    placeDate: '{place}, {date}',
    infoDate: 'Datum',
    infoYourReference: 'Vaše značka',
    infoYourMessageOf: 'Vaše zpráva ze dne',
    infoOurReference: 'Naše značka',
    infoOurMessageOf: 'Naše zpráva ze dne',
    infoContact: 'Kontaktní osoba',
    infoPhone: 'Telefon',
    infoMobile: 'Mobil',
    infoFax: 'Fax',
    infoEmail: 'E-mail',
    infoWeb: 'Web',
    infoCustomerNumber: 'Číslo zákazníka',
    infoInvoiceNumber: 'Číslo faktury',
  },
};

/** Hyphenation pattern module of the `hyphen` package per locale. */
const HYPHENATION_PATTERNS: Record<SupportedLocale, string> = {
  de: 'de',
  en: 'en-us',
  fr: 'fr',
  es: 'es',
  it: 'it',
  nl: 'nl',
  pt: 'pt',
  pl: 'pl',
  tr: 'tr',
  da: 'da',
  sv: 'sv',
  cs: 'cs',
};

export const SUPPORTED_LOCALES = Object.keys(LABELS) as SupportedLocale[];

export function normalizeLocale(locale: string | undefined): SupportedLocale {
  if (!locale) return 'de';
  const base = locale.toLowerCase().split(/[-_]/)[0] as SupportedLocale;
  return SUPPORTED_LOCALES.includes(base) ? base : 'de';
}

export function getLabels(locale: string | undefined, overrides?: Partial<LetterLabels>): LetterLabels {
  const base = LABELS[normalizeLocale(locale)];
  return overrides ? { ...base, ...overrides } : { ...base };
}

export function getHyphenationPattern(locale: string | undefined): string {
  return HYPHENATION_PATTERNS[normalizeLocale(locale)];
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
