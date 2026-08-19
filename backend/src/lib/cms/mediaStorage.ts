import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

/**
 * CMS media storage abstraction.
 * Local adapter for Phase 1; swap implementation for object storage later
 * without changing CMS route business logic.
 */

export type CmsStoredObject = {
  storageKey: string;
  sizeBytes: number;
};

export interface CmsMediaStorage {
  saveFromPath(localPath: string, storageKey: string): Promise<CmsStoredObject>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  openReadStream(storageKey: string): Promise<Readable>;
  buildKey(originalName: string): string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../..");

function cmsStorageRoot(): string {
  const configured =
    process.env.CMS_STORAGE_PATH ||
    process.env.FILE_STORAGE_PATH ||
    "storage/private";
  const base = path.isAbsolute(configured)
    ? configured
    : path.resolve(backendRoot, configured);
  return path.join(base, "cms");
}

function resolveSafeCmsPath(storageKey: string): string {
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
  const root = cmsStorageRoot();
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

export function createLocalCmsMediaStorage(): CmsMediaStorage {
  return {
    buildKey(originalName: string): string {
      const ext = path.extname(originalName).toLowerCase().slice(0, 12);
      const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
      return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExt}`;
    },

    async saveFromPath(localPath, storageKey): Promise<CmsStoredObject> {
      const dest = resolveSafeCmsPath(storageKey);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(localPath, dest);
      const stat = await fs.stat(dest);
      return { storageKey, sizeBytes: stat.size };
    },

    async delete(storageKey): Promise<void> {
      try {
        await fs.unlink(resolveSafeCmsPath(storageKey));
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (
          code === "ENOENT" ||
          (err as Error).message === "INVALID_STORAGE_KEY"
        ) {
          return;
        }
        throw err;
      }
    },

    async exists(storageKey): Promise<boolean> {
      try {
        await fs.access(resolveSafeCmsPath(storageKey));
        return true;
      } catch {
        return false;
      }
    },

    async openReadStream(storageKey): Promise<Readable> {
      return createReadStream(resolveSafeCmsPath(storageKey));
    },
  };
}

let cached: CmsMediaStorage | null = null;

export function getCmsMediaStorage(): CmsMediaStorage {
  if (!cached) cached = createLocalCmsMediaStorage();
  return cached;
}

/** Allowlist for CMS uploads (images + PDF only). */
export const CMS_ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
]);

export const CMS_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

export function isAllowedCmsUpload(originalName: string, mimeType: string): boolean {
  const ext = path.extname(originalName).toLowerCase();
  if (!CMS_ALLOWED_EXT.has(ext)) return false;
  if (!mimeType || !CMS_ALLOWED_MIME.has(mimeType)) return false;
  return true;
}
