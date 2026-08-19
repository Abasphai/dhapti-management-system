import type { Readable } from "node:stream";

export interface StoredObjectMeta {
  storageKey: string;
  sizeBytes: number;
}

export interface FileStorage {
  /** Persist a local temp file to the key; returns size. */
  saveFromPath(localPath: string, storageKey: string): Promise<StoredObjectMeta>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  openReadStream(storageKey: string): Promise<Readable>;
  resolveAbsolutePath?(storageKey: string): string;
}
