<!-- Author: Fabian Bitter (fabian@bitter.de) -->

# pdf-letter-mcp

Local MCP server (stdio) that turns structured letter data into a print ready PDF. One fixed layout, the everyday German letter, with the recipient address positioned per DIN 5008 so it sits exactly in the window of DL and C6/C5 window envelopes. No web service, no external API, everything runs offline on your machine.

## Features

- One layout, no variants: return address line, recipient, right aligned "place, date", bold subject block with references below it, salutation, body, closing, signature, enclosures
- Address field 45 mm high ending at 105 mm from the left, with return address line, remark zone (Einschreiben, Nicht nachsenden) and address zone
- Return address, remarks and recipient are balanced inside the address field, so the block sits evenly in the envelope window and further address lines still fit. `addressLayout: "din"` switches back to the fixed zone boundaries
- Page breaks keep closing, signature image, name and enclosures together, follow-up pages carry recipient, date and page number
- Subject 33 mm below the address field, place and date three lines above it
- Fold marks at 105 mm and 210 mm, punch mark at 148.5 mm
- DIN 5008 writing margin of 25 mm on the left, and the address field follows it, so address, subject and body share one edge. The field keeps its right edge at 105 mm and stays inside the 90 mm envelope window
- Closing, one blank line, printed name. `signature.spaceMm` reserves more room for signing by hand
- Signature as an image file: PNG with alpha channel keeps its transparency, the image is laid over the blank line above the printed name and never shifts the text. Optional crop, background removal and ink recolouring for scans
- Multilingual: de, en, fr, es, it, nl, pt, pl, tr, da, sv, cs with locale aware date formats and address rules per country
- Language aware hyphenation, bold/italic markup, bullet and numbered lists, automatic page breaks with continuation headers
- Page numbers and a layout debug mode that draws the DIN 5008 zones
- Embedded Unicode fonts (DejaVu), any installed system font or a .ttf path

## Install

```bash
npm install
npm run build
```

Register the server in Claude Code:

```bash
claude mcp add pdf-letter -- node "/absolute/path/to/pdf-letter-mcp/dist/src/index.js"
```

Or in `~/.claude.json` / `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pdf-letter": {
      "command": "node",
      "args": ["/absolute/path/to/pdf-letter-mcp/dist/src/index.js"],
      "env": {
        "PDF_LETTER_OUTPUT_DIR": "~/Documents/Briefe"
      }
    }
  }
}
```

## Environment

| Variable | Purpose |
| --- | --- |
| `PDF_LETTER_OUTPUT_DIR` | Default directory for generated PDFs. Falls back to the system temp directory. |
| `PDF_LETTER_FONT_DIR` | Additional directory that is searched when a font family is resolved by name. |
| `PDF_LETTER_FONT` | Font family for every letter, e.g. `Arial`. Default is the bundled DejaVu Sans. |
| `PDF_LETTER_FONT_SIZE` | Font size in pt for every letter, default 11. |
| `PDF_LETTER_PROFILES` | Path to the sender profiles, default `~/.config/pdf-letter-mcp/profiles.json`. |
| `PDF_LETTER_PROFILE` | Profile used when a letter names none and the file has no `defaultProfile`. |

## Sender profiles

Sender addresses and signatures live in a file on the machine, never in the prompt. A letter names a profile, the server fills in address, return address line and signature image verbatim.

```json
{
  "defaultProfile": "erika",
  "profiles": {
    "erika": {
      "description": "Erika Musterfrau, privat",
      "sender": {
        "name": "Erika Musterfrau",
        "street": "Musterstraße 12",
        "postalCode": "12345",
        "city": "Musterstadt",
        "country": "DE"
      },
      "place": "Musterstadt",
      "locale": "de",
      "signature": { "path": "/pfad/zur/unterschrift.png" }
    }
  }
}
```

`create_letter` then only needs `"profile": "erika"` plus the content. The profile owns the identity: a sender or signature passed in the call is replaced by the profile, `place`, `locale` and `closing` are defaults that a letter may override. `list_profiles` shows what is available. Without a profile and without a sender the letter is refused instead of being invented.

The file belongs outside the repository, `profiles.json` is in `.gitignore`.

## Layout is fixed

The MCP tools take content only: addresses, date, subject, references, text, signature, enclosures. There are no parameters for margins, spacing, font, image size or position, and unknown fields sent by a client are dropped. Typography is an installation setting (`PDF_LETTER_FONT`, `PDF_LETTER_FONT_SIZE`), so every letter of one installation looks identical. The building blocks for a company letterhead, an information block and a footer are still in the library, but they are not reachable through the MCP.

## Tools

| Tool | Purpose |
| --- | --- |
| `create_letter` | Renders the letter and writes the PDF. Returns path, page count, layout metrics and warnings. |
| `preview_letter` | Same rendering without writing a file, for checking the layout. |
| `prepare_signature` | Cleans a scanned signature (crop, transparent background, ink colour) and writes a PNG. |
| `get_din5008_spec` | Returns the millimetre geometry of a form. |
| `list_locales` | Lists the supported languages and their fixed texts. |
| `list_fonts` | Lists built-in families and resolves a font name against the installed system fonts. |

### create_letter

The sender appears only in the small return address line above the recipient. Place and date sit right aligned above the bold subject block, references go directly below the subject.

```json
{
  "locale": "de",
  "sender": {
    "name": "Erika Musterfrau",
    "street": "Musterstraße 12",
    "postalCode": "12345",
    "city": "Musterstadt",
    "country": "DE"
  },
  "recipient": {
    "company": "Stadtwerke Musterstadt",
    "street": "Industriestraße 8",
    "postalCode": "12345",
    "city": "Musterstadt"
  },
  "place": "Musterstadt",
  "date": "2026-07-24",
  "dateStyle": "long",
  "subject": "Widerspruch gegen die Jahresabrechnung vom 01.07.2026",
  "subjectLines": ["Zeichen: SW-2026-0815", "Kunden-Nummer: 000000000"],
  "body": "hiermit widerspreche ich der Jahresabrechnung.\n\n- korrigierte Abrechnung\n- Eingangsbestätigung",
  "signature": {
    "path": "/pfad/zur/unterschrift.png",
    "widthMm": 45,
    "removeBackground": true,
    "trim": true,
    "name": "Erika Musterfrau"
  },
  "enclosures": ["Kopie der Abrechnung"]
}
```

Everything except `sender`, `recipient` and `body` is optional. The salutation is derived from the recipient (`Frau` plus `Dr. Erika Mustermann` becomes `Sehr geehrte Frau Dr. Mustermann,`), the date defaults to today, the closing to the locale default.

### Body markup

- Blank line: new paragraph
- Single newline: line break (set `bodyMode` to `markdown` to reflow instead)
- `- item` or `1. item`: bullet or numbered list
- `**bold**`, `*italic*`
- `\pagebreak` on its own line: forced page break

### Signature

Two ways, both end up as a real image in the PDF:

1. Pass the file directly: `signature.path` plus `trim` and `removeBackground`. The scan is cleaned on every render.
2. Clean it once with `prepare_signature` and reuse the resulting PNG. Faster and lets you check the result before it goes into a letter.

`trim`, `removeBackground` and `inkColor` need the optional `sharp` dependency, which is installed by default. A PNG that already has a transparent background works without it.

The image is an overlay: closing, one blank line, printed name stay exactly where they are, and the signature sits on top of that blank line and across the closing, the way a signature is written over "Mit freundlichen Grüßen" on paper. That overlap is the intended result.

Size and position are decided by the renderer, not by the caller. The signature is scaled to roughly the width of the closing line, around 50 mm, capped proportionally at 1.2 times that width and 28 mm in height. There is no parameter for width, height, offset or spacing, so nothing can shift the layout letter by letter.

## Verification

```bash
npm test          # geometry, address rules, typography, rendering
npm run examples  # writes sample letters to examples/
```

`examples/` holds the German letter, the same letter in English and a debug variant that draws the DIN 5008 zones, so the address field position can be checked against a window envelope. `preview_letter` reports the same measurements as JSON, plus warnings when the address is too long or does not fit the address field.

## License

MIT, see [LICENSE](LICENSE). The bundled DejaVu fonts are covered by the Bitstream Vera and Arev licenses.
