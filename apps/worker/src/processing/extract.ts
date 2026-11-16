import mammoth from 'mammoth';
import { definePDFJSModule, extractText as extractPdfText, getDocumentProxy } from 'unpdf';

// Thrown for problems with the file itself (corrupt, empty, unreadable).
// Retrying can't fix these, so the processor turns them into
// UnrecoverableError (no retries), and the message is shown to the user.
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

// Upper bound on stored text so one huge file can't bloat the database or
// produce an unbounded number of chunks.
export const MAX_TEXT_CHARS = 2_000_000;

export type SupportedExtension = 'pdf' | 'docx' | 'txt' | 'md';

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'md';
}

// Normalizes whatever the format produced into clean plain text: unified
// newlines, no control characters, no runs of blank lines or spaces.
export function normalizeText(raw: string): string {
  return (
    raw
      .replace(/\r\n?/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

// unpdf's bundled PDF.js needs runtime features only present from Node 22,
// but this project targets Node 20 (see package.json engines and the Docker
// images). The pdfjs-dist "legacy" build runs on Node 20+, so register it
// once, lazily, before the first PDF is read.
let pdfEngineReady: Promise<void> | null = null;
function ensurePdfEngine(): Promise<void> {
  pdfEngineReady ??= definePDFJSModule(() => import('pdfjs-dist/legacy/build/pdf.mjs'));
  return pdfEngineReady;
}

async function fromPdf(buffer: Buffer): Promise<string> {
  try {
    await ensurePdfEngine();
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  } catch {
    throw new ExtractionError('The PDF could not be read. It may be corrupt or password-protected.');
  }
}

async function fromDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  } catch {
    throw new ExtractionError('The Word document could not be read. It may be corrupt.');
  }
}

function fromPlainText(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ExtractionError('The text file is not valid UTF-8.');
  }
}

// Turns a stored file into plain text. Image-only (scanned) PDFs have no text
// layer, so they end up here as "no text" - OCR is out of scope for now.
export async function extractText(buffer: Buffer, extension: SupportedExtension): Promise<string> {
  const raw =
    extension === 'pdf' ? await fromPdf(buffer) : extension === 'docx' ? await fromDocx(buffer) : fromPlainText(buffer);

  const text = normalizeText(raw).slice(0, MAX_TEXT_CHARS);
  if (text.length === 0) {
    throw new ExtractionError(
      'No text could be extracted from this file. Scanned or image-only documents are not supported yet.'
    );
  }
  return text;
}
