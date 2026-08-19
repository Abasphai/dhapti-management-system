import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import type { FileStorage, StoredObjectMeta } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../..");

function storageRoot(): string {
  const configured = process.env.FILE_STORAGE_PATH || "storage/private";
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(backendRoot, configured);
}

/**
 * Resolve storageKey inside root. Rejects path traversal / absolute keys.
 */
export function resolveSafePath(storageKey: string): string {
  if (!storageKey || storageKey.includes("\0")) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  const normalizedKey = storageKey.replace(/\\/g, "/");
  if (
    path.isAbsolute(normalizedKey) ||
    normalizedKey.includes("..") ||
    normalizedKey.startsWith("/")
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }

  const root = storageRoot();
  const absolute = path.resolve(root, normalizedKey);
  const relative = path.relative(root, absolute);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes("..")
  ) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return absolute;
}

export function createLocalDiskStorage(): FileStorage {
  return {
    async saveFromPath(localPath, storageKey): Promise<StoredObjectMeta> {
      const dest = resolveSafePath(storageKey);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(localPath, dest);
      const stat = await fs.stat(dest);
      return { storageKey, sizeBytes: stat.size };
    },

    async delete(storageKey): Promise<void> {
      try {
        const dest = resolveSafePath(storageKey);
        await fs.unlink(dest);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || (err as Error).message === "INVALID_STORAGE_KEY") {
          return;
        }
        throw err;
      }
    },

    async exists(storageKey): Promise<boolean> {
      try {
        const dest = resolveSafePath(storageKey);
        await fs.access(dest);
        return true;
      } catch {
        return false;
      }
    },

    async openReadStream(storageKey): Promise<Readable> {
      const dest = resolveSafePath(storageKey);
      return createReadStream(dest);
    },

    resolveAbsolutePath(storageKey): string {
      return resolveSafePath(storageKey);
    },
  };
}
