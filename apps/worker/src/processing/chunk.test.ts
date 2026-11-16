import { describe, expect, it } from 'vitest';
import { chunkText } from './chunk.js';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('Just a short note.')).toEqual(['Just a short note.']);
  });

  it('returns nothing for empty or whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('never produces a chunk longer than the size limit', () => {
    const text = 'word '.repeat(2000);
    const chunks = chunkText(text, { size: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
  });

  it('prefers to break at paragraph boundaries', () => {
    const paragraph = 'A sentence that is reasonably long. '.repeat(15).trim(); // ~540 chars
    const chunks = chunkText(`${paragraph}\n\n${paragraph}\n\n${paragraph}`, { size: 700, overlap: 0 });
    // Every chunk ends on a complete sentence rather than mid-word.
    expect(chunks.every((c) => c.endsWith('.'))).toBe(true);
  });

  it('overlaps consecutive chunks so boundary text appears in both', () => {
    const text = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(text, { size: 200, overlap: 60 });
    for (let i = 1; i < chunks.length; i++) {
      const tailWords = chunks[i - 1]!.split(' ').slice(-3);
      expect(tailWords.some((word) => chunks[i]!.includes(word))).toBe(true);
    }
  });

  it('covers all of the text with no gaps', () => {
    const words = Array.from({ length: 1500 }, (_, i) => `token${i}`);
    const chunks = chunkText(words.join(' '), { size: 400, overlap: 80 });
    const joined = chunks.join(' ');
    for (const word of words) expect(joined).toContain(word);
  });

  it('makes progress on text with no spaces (hard split)', () => {
    const chunks = chunkText('x'.repeat(5000), { size: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });

  it('is deterministic', () => {
    const text = 'Lorem ipsum dolor sit amet. '.repeat(300);
    expect(chunkText(text)).toEqual(chunkText(text));
  });
});
