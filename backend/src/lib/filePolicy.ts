import { getConfiguredMaxUploadFileMb } from "./settings.js";

/** Centralized file upload rules (Phase 1F-B). */

export const SYSTEM_MAX_FILE_MB = Math.max(
  1,
  Number(process.env.MAX_FILE_SIZE_MB || 500)
);

/** Prefer admin System Settings max upload size when available. */
export async function resolveSystemMaxFileMb(): Promise<number> {
  try {
    return await getConfiguredMaxUploadFileMb();
  } catch {
    return SYSTEM_MAX_FILE_MB;
  }
}

/** Academic submission allowlist */
export const SUBMISSION_ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
  "zip",
  "rar",
  "7z",
  "png",
  "jpg",
  "jpeg",
] as const;

/** Course materials allowlist (includes audio / video) */
export const COURSE_MATERIAL_ALLOWED_EXTENSIONS = [
  ...SUBMISSION_ALLOWED_EXTENSIONS,
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "mp4",
  "webm",
  "mov",
] as const;

const SUBMISSION_MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  txt: ["text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
  rar: ["application/vnd.rar", "application/x-rar-compressed"],
  "7z": ["application/x-7z-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/aac"],
  ogg: ["audio/ogg", "application/ogg"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mov: ["video/quicktime"],
};

export type MaterialTypeName =
  | "PDF"
  | "POWERPOINT"
  | "WORD"
  | "ARCHIVE"
  | "AUDIO"
  | "VIDEO"
  | "LINK";

const EXTENSIONS_BY_MATERIAL_TYPE: Record<
  Exclude<MaterialTypeName, "LINK">,
  readonly string[]
> = {
  PDF: ["pdf"],
  POWERPOINT: ["ppt", "pptx"],
  WORD: ["doc", "docx"],
  ARCHIVE: ["zip", "rar", "7z"],
  AUDIO: ["mp3", "wav", "m4a", "ogg"],
  VIDEO: ["mp4", "webm", "mov"],
};

export function materialTypeFromExtension(
  extension: string
): Exclude<MaterialTypeName, "LINK"> | null {
  const ext = extension.toLowerCase();
  for (const [type, exts] of Object.entries(EXTENSIONS_BY_MATERIAL_TYPE) as Array<
    [Exclude<MaterialTypeName, "LINK">, readonly string[]]
  >) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

export function validateCourseMaterialFile(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  maxBytes: number;
  materialType?: Exclude<MaterialTypeName, "LINK">;
}): { ok: true; extension: string; safeName: string } | { ok: false; message: string } {
  if (input.sizeBytes <= 0) {
    return { ok: false, message: "Empty file is not allowed" };
  }
  if (input.sizeBytes > input.maxBytes) {
    const mb = Math.round(input.maxBytes / (1024 * 1024));
    return { ok: false, message: `File exceeds ${mb}MB limit` };
  }

  const extension = extensionOf(input.originalName);
  if (
    !extension ||
    !(COURSE_MATERIAL_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return {
      ok: false,
      message: `File type .${extension || "unknown"} is not allowed`,
    };
  }

  if (input.materialType) {
    const allowed = EXTENSIONS_BY_MATERIAL_TYPE[input.materialType];
    if (!allowed.includes(extension)) {
      return {
        ok: false,
        message: `File type .${extension} does not match selected material type ${input.materialType}`,
      };
    }
  }

  const allowedMimes = SUBMISSION_MIME_BY_EXT[extension] ?? [];
  const mime = (input.mimeType || "").toLowerCase();
  if (
    mime &&
    mime !== "application/octet-stream" &&
    allowedMimes.length > 0 &&
    !allowedMimes.includes(mime)
  ) {
    return {
      ok: false,
      message: "File MIME type does not match allowed type for this extension",
    };
  }

  return {
    ok: true,
    extension,
    safeName: sanitizeOriginalFileName(input.originalName),
  };
}

export function effectiveMaxFileMb(
  assignmentMaxFileMb: number | null | undefined,
  systemMaxFileMb: number = SYSTEM_MAX_FILE_MB
) {
  const systemCap = Math.max(1, Math.min(2000, systemMaxFileMb));
  const assignmentCap =
    typeof assignmentMaxFileMb === "number" && assignmentMaxFileMb > 0
      ? assignmentMaxFileMb
      : systemCap;
  return Math.min(assignmentCap, systemCap);
}

export function effectiveMaxFileBytes(
  assignmentMaxFileMb: number | null | undefined,
  systemMaxFileMb: number = SYSTEM_MAX_FILE_MB
) {
  return effectiveMaxFileMb(assignmentMaxFileMb, systemMaxFileMb) * 1024 * 1024;
}

export function extensionOf(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

export function sanitizeOriginalFileName(fileName: string): string {
  const base = (fileName.split(/[/\\]/).pop() || "file").replace(/\0/g, "");
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned || "file";
}

export function validateSubmissionFile(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  maxBytes: number;
}): { ok: true; extension: string; safeName: string } | { ok: false; message: string } {
  if (input.sizeBytes <= 0) {
    return { ok: false, message: "Empty file is not allowed" };
  }
  if (input.sizeBytes > input.maxBytes) {
    const mb = Math.round(input.maxBytes / (1024 * 1024));
    return { ok: false, message: `File exceeds ${mb}MB limit` };
  }

  const extension = extensionOf(input.originalName);
  if (
    !extension ||
    !(SUBMISSION_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return {
      ok: false,
      message: `File type .${extension || "unknown"} is not allowed`,
    };
  }

  const allowedMimes = SUBMISSION_MIME_BY_EXT[extension] ?? [];
  const mime = (input.mimeType || "").toLowerCase();
  // Browser MIME is untrusted; allow empty/octet-stream if extension is allowlisted.
  if (
    mime &&
    mime !== "application/octet-stream" &&
    allowedMimes.length > 0 &&
    !allowedMimes.includes(mime)
  ) {
    return {
      ok: false,
      message: "File MIME type does not match allowed type for this extension",
    };
  }

  return {
    ok: true,
    extension,
    safeName: sanitizeOriginalFileName(input.originalName),
  };
}
