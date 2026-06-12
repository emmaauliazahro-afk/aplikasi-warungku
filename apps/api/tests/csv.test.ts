import { describe, it, expect } from 'vitest';
import { csvCell, csvRow } from '../src/utils/csv';

describe('csvCell', () => {
  it('returns plain cell unquoted when there are no special characters', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell('Warung Maju')).toBe('Warung Maju');
  });

  it('quotes a cell that contains a comma', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('escapes a double quote by doubling it and wraps the cell in quotes', () => {
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes a cell that contains a newline', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('prefixes a leading = with an apostrophe to prevent formula injection', () => {
    expect(csvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
  });

  it('prefixes a leading + with an apostrophe', () => {
    expect(csvCell('+1+1')).toBe("'+1+1");
  });

  it('prefixes a leading - with an apostrophe', () => {
    expect(csvCell('-100')).toBe("'-100");
  });

  it('prefixes a leading @ with an apostrophe', () => {
    expect(csvCell('@import')).toBe("'@import");
  });

  it('returns "-" for null and undefined values', () => {
    expect(csvCell(null)).toBe('-');
    expect(csvCell(undefined)).toBe('-');
  });

  it('strips control characters (NUL, bell, etc.) from the value', () => {
    // 0x00 (NUL) and 0x07 (BEL) are control chars that should be stripped.
    expect(csvCell('foo\x00bar\x07baz')).toBe('foobarbaz');
  });
});

describe('csvRow', () => {
  it('joins cells with a comma', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('quotes cells that need quoting while leaving simple ones alone', () => {
    expect(csvRow(['plain', 'has,comma', 'has"quote'])).toBe(
      'plain,"has,comma","has""quote"'
    );
  });

  it('returns an empty string for an empty array', () => {
    expect(csvRow([])).toBe('');
  });
});
