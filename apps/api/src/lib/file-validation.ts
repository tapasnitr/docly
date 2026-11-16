import { ValidationError } from './errors.js';

export type DocumentExtension = 'pdf' | 'docx' | 'txt' | 'md';

// Canonical MIME type per allowed extension. The stored/served type always
// comes from here, never from what the browser claimed.
const CANONICAL_MIME: Record<DocumentExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};

// Types a browser may legitimately declare for each extension. Markdown in
// particular is often sent as text/plain or octet-stream, so those are
// accepted too - the real check is the content signature below.
const ACCEPTED_DECLARED_MIME: Record<DocumentExtension, string[]> = {
  pdf: ['application/pdf'],
  docx: [CANONICAL_MIME.docx],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain', 'application/octet-stream', ''],
};

export const ALLOWED_EXTENSIONS = Object.keys(CANONICAL_MIME) as DocumentExtension[];

export interface ValidatedUpload {
  extension: DocumentExtension;
  mimeType: string;
  // Display-safe original filename (no path, no control characters).
  filename: string;
}

// Strips any directory part and characters that are unsafe in headers or
// file systems. Only ever used for display and the download name - storage
// keys never contain it.
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  const limited = cleaned.length > 200 ? cleaned.slice(-200) : cleaned;
  return limited === '' || limited === '.' || limited === '..' ? 'document' : limited;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

function isPdf(buffer: Buffer): boolean {
  // The spec allows the header anywhere in the first 1024 bytes.
  return buffer.subarray(0, 1024).includes('%PDF-');
}

function isDocx(buffer: Buffer): boolean {
  // A .docx is a ZIP ("PK\x03\x04") whose entries include word/document.xml.
  return (
    buffer.length > 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    buffer.includes('word/document.xml')
  );
}

function isPlainText(buffer: Buffer): boolean {
  // No NUL bytes (binary giveaway) and valid UTF-8 throughout.
  if (buffer.subarray(0, 8192).includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

const SIGNATURE_CHECKS: Record<DocumentExtension, (buffer: Buffer) => boolean> = {
  pdf: isPdf,
  docx: isDocx,
  txt: isPlainText,
  md: isPlainText,
};

// Validates an upload on three independent axes - extension, declared MIME
// type, and actual content - because any one of them alone is trivially
// spoofed (a renamed .exe, or a script served as text/plain).
export function validateUpload(rawFilename: string, declaredMime: string, buffer: Buffer): ValidatedUpload {
  const filename = sanitizeFilename(rawFilename);
  const extension = extensionOf(filename) as DocumentExtension;

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new ValidationError(`Unsupported file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  if (buffer.length === 0) {
    throw new ValidationError('The uploaded file is empty');
  }
  if (!ACCEPTED_DECLARED_MIME[extension].includes(declaredMime.toLowerCase())) {
    throw new ValidationError('The file type does not match its extension');
  }
  if (!SIGNATURE_CHECKS[extension](buffer)) {
    throw new ValidationError('The file content does not match its extension');
  }

  return { extension, mimeType: CANONICAL_MIME[extension], filename };
}
