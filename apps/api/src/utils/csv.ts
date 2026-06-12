/**
 * Escape a single cell value for safe inclusion in a CSV file.
 *
 * Implements RFC 4180 quoting:
 *  - if the value contains `"`, `,`, CR, or LF, wrap the value in `"..."`
 *    and double any embedded `"`.
 *  - prefix formula-trigger characters (=, +, -, @, TAB, CR) with a single
 *    quote so spreadsheet apps like Excel / LibreOffice don't interpret the
 *    cell as a formula (CSV injection defense).
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '-';
  let s = typeof value === 'string' ? value : String(value);

  // Strip control chars that aren't CR/LF/TAB and that could confuse parsers.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // CSV-injection guard: prefix dangerous leading characters.
  if (s.length > 0) {
    const first = s.charCodeAt(0);
    if (
      s[0] === '=' || s[0] === '+' || s[0] === '-' || s[0] === '@' ||
      first === 0x09 /* \t */ || first === 0x0d /* \r */
    ) {
      s = "'" + s;
    }
  }

  // RFC 4180 quoting.
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Build a CSV row from an array of values. */
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}
