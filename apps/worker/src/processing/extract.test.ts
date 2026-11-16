import { describe, expect, it } from 'vitest';
import { ExtractionError, extractText, MAX_TEXT_CHARS, normalizeText } from './extract.js';
import { makeDocx, makePdf } from './fixtures.js';

describe('normalizeText', () => {
  it('unifies newlines, strips control characters and collapses whitespace', () => {
    const raw = 'Line one\r\nLine  two\u0000 \t here\r\n\r\n\r\n\r\nLine three  ';
    expect(normalizeText(raw)).toBe('Line one\nLine two here\n\nLine three');
  });
});

describe('extractText', () => {
  it('extracts plain text and markdown as-is (normalized)', async () => {
    expect(await extractText(Buffer.from('Hello,\r\nworld!'), 'txt')).toBe('Hello,\nworld!');
    expect(await extractText(Buffer.from('# Title\n\nSome *markdown*.'), 'md')).toBe('# Title\n\nSome *markdown*.');
  });

  it('keeps non-ASCII text intact', async () => {
    expect(await extractText(Buffer.from('Grüße, 世界 — ✓'), 'txt')).toBe('Grüße, 世界 — ✓');
  });

  it('extracts the text layer of a PDF', async () => {
    const text = await extractText(makePdf('Quarterly revenue grew twelve percent'), 'pdf');
    expect(text).toContain('Quarterly revenue grew twelve percent');
  });

  it('extracts paragraphs from a .docx', async () => {
    const text = await extractText(await makeDocx(['First paragraph.', 'Second paragraph.']), 'docx');
    expect(text).toContain('First paragraph.');
    expect(text).toContain('Second paragraph.');
  });

  it('rejects a corrupt PDF with a user-facing message', async () => {
    const promise = extractText(Buffer.from('%PDF-1.4\nthis is garbage, not a pdf'), 'pdf');
    await expect(promise).rejects.toBeInstanceOf(ExtractionError);
    await expect(promise).rejects.toThrow(/could not be read/i);
  });

  it('rejects a corrupt .docx', async () => {
    await expect(extractText(Buffer.from('PK\u0003\u0004 not really a zip'), 'docx')).rejects.toBeInstanceOf(ExtractionError);
  });

  it('rejects invalid UTF-8 text', async () => {
    await expect(extractText(Buffer.from([0xff, 0xfe, 0xfd, 0x80]), 'txt')).rejects.toThrow(/UTF-8/);
  });

  it('rejects files with no extractable text (e.g. scanned PDFs)', async () => {
    await expect(extractText(Buffer.from('   \n\n  '), 'txt')).rejects.toThrow(/No text could be extracted/);
    await expect(extractText(makePdf(''), 'pdf')).rejects.toThrow(/No text could be extracted/);
  });

  it('caps very large text', async () => {
    const huge = Buffer.from('a'.repeat(MAX_TEXT_CHARS + 5000));
    expect((await extractText(huge, 'txt')).length).toBe(MAX_TEXT_CHARS);
  });
});
