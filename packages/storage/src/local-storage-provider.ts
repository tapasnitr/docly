import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { StorageObjectNotFoundError, type StorageProvider } from './storage-provider.js';

// Local-disk implementation of StorageProvider: each key is a relative path
// under `rootDir`. Fine for development and single-node deployments; for
// multiple API instances use shared object storage instead (the API itself
// stays stateless only if files live outside the instance).
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = resolve(rootDir);
  }

  // Resolves a key to an absolute path and refuses anything that escapes the
  // storage root (e.g. "../../etc/passwd"), as defense in depth - keys are
  // server-generated, but a bug elsewhere must not become a file-system
  // traversal.
  private pathFor(key: string): string {
    const target = resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async upload(key: string, data: Buffer): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async download(key: string): Promise<Readable> {
    const target = this.pathFor(key);
    try {
      await stat(target);
    } catch {
      throw new StorageObjectNotFoundError(key);
    }
    return createReadStream(target);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
