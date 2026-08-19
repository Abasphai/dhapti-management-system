import { createLocalDiskStorage } from "./localDisk.js";
import type { FileStorage } from "./types.js";

let cached: FileStorage | null = null;

/** Default: local disk. Future: swap for S3-compatible adapter via env. */
export function getFileStorage(): FileStorage {
  if (!cached) {
    cached = createLocalDiskStorage();
  }
  return cached;
}

export type { FileStorage, StoredObjectMeta } from "./types.js";
export { resolveSafePath } from "./localDisk.js";
