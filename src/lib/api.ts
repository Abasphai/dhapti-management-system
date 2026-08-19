/**
 * API client — Vite proxy `/api` → http://127.0.0.1:4000 in dev.
 * On network failure, retries the direct backend URL so admin login still works
 * if the proxy is down or Vite was restarted.
 */

const CONFIGURED_BASE = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/$/,
  ""
);
/** Direct backend (CORS-enabled) — used as resilient fallback in development. */
const DIRECT_API_BASE = "http://127.0.0.1:4000/api";

let activeApiBase = CONFIGURED_BASE;

export const TOKEN_KEY = "dhapti-auth-token";
export const USER_KEY = "dhapti-auth-user";
/** Dispatched when JWT session is cleared due to 401 expiry / invalid token. */
export const SESSION_EXPIRED_EVENT = "dhapti-session-expired";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function parseErrorBody(data: Record<string, unknown>): {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
} {
  const nested =
    data.error && typeof data.error === "object"
      ? (data.error as { message?: string; code?: string })
      : null;
  const message =
    typeof data.error === "string"
      ? data.error
      : typeof nested?.message === "string"
        ? nested.message
        : typeof data.message === "string"
          ? data.message
          : "Request failed";
  const code =
    (typeof data.code === "string" ? data.code : undefined) ??
    (typeof nested?.code === "string" ? nested.code : undefined);
  const { error: _e, message: _m, code: _c, ...rest } = data;
  return {
    message,
    code,
    details: Object.keys(rest).length ? rest : undefined,
  };
}

function isSessionExpiryError(
  status: number,
  message: string,
  code?: string,
  details?: Record<string, unknown>
): boolean {
  if (status !== 401) return false;
  const reason = details?.reason;
  if (reason === "TOKEN_EXPIRED" || reason === "TOKEN_INVALID") return true;
  const m = message.toLowerCase();
  return (
    m.includes("invalid or expired token") ||
    m.includes("jwt expired") ||
    m.includes("jwt malformed") ||
    m.includes("token is no longer valid") ||
    (code === "UNAUTHORIZED" && m.includes("jwt"))
  );
}

function resolveLoginPath(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const u = JSON.parse(raw) as {
        portal?: string;
        role?: string;
      };
      if (u.portal === "student" || u.role === "STUDENT") {
        return "/student/login";
      }
      if (u.portal === "teacher" || u.role === "TEACHER") {
        return "/teacher/login";
      }
      if (
        u.portal === "admin" ||
        u.role === "ADMIN" ||
        u.role === "DEPARTMENT_ADMIN" ||
        u.role === "EXAM_ADMIN" ||
        u.role === "CERTIFICATE_ADMIN"
      ) {
        return "/admin/login";
      }
    }
  } catch {
    /* ignore */
  }

  const path = window.location.pathname;
  if (path.startsWith("/teacher")) return "/teacher/login";
  if (path.startsWith("/admin")) return "/admin/login";
  return "/student/login";
}

let handlingSessionExpiry = false;

/**
 * Clear expired JWT session, toast, and redirect to the correct portal login.
 * Safe to call multiple times (deduped).
 */
export function handleSessionExpired(options?: { silent?: boolean }) {
  if (handlingSessionExpiry) return;
  handlingSessionExpiry = true;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

  const onLoginPage = /\/(student|teacher|admin)\/login\/?$/.test(
    window.location.pathname
  );
  const loginPath = resolveLoginPath();

  if (!options?.silent && !onLoginPage) {
    void import("sonner").then(({ toast }) => {
      toast.error("Your session has expired. Please sign in again.");
    });
    window.location.assign(loginPath);
  } else {
    window.setTimeout(() => {
      handlingSessionExpiry = false;
    }, 1500);
  }
}

function maybeHandleSessionExpiry(
  path: string,
  status: number,
  message: string,
  code?: string,
  details?: Record<string, unknown>
) {
  if (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("/auth/register")
  ) {
    return;
  }
  if (!isSessionExpiryError(status, message, code, details)) {
    return;
  }
  handleSessionExpired();
}

function throwApiError(
  path: string,
  status: number,
  data: Record<string, unknown>
): never {
  const { message, code, details } = parseErrorBody(data);
  maybeHandleSessionExpiry(path, status, message, code, details);
  throw new ApiError(status, message, code, details);
}

function candidateBases(): string[] {
  const bases = [activeApiBase, CONFIGURED_BASE, DIRECT_API_BASE];
  return [...new Set(bases.filter(Boolean))];
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("failed to fetch") ||
      m.includes("networkerror") ||
      m.includes("load failed") ||
      m.includes("network request failed")
    );
  }
  return false;
}

async function fetchWithFallback(
  path: string,
  init: RequestInit
): Promise<Response> {
  const bases = candidateBases();
  let lastError: unknown;

  for (let i = 0; i < bases.length; i++) {
    const base = bases[i]!;
    try {
      const res = await fetch(`${base}${path}`, init);
      activeApiBase = base;
      return res;
    } catch (err) {
      lastError = err;
      if (!isNetworkFailure(err)) throw err;
      // try next base
    }
  }

  throw new ApiError(
    0,
    "Unable to reach the Dhapti API. Start the backend with `npm run dev:api` (port 4000) and the frontend with `npm run dev`.",
    "NETWORK_ERROR",
    {
      tried: bases,
      cause:
        lastError instanceof Error ? lastError.message : String(lastError ?? ""),
    }
  );
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetchWithFallback(path, {
    ...options,
    headers,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throwApiError(path, res.status, data);
  }
  return data as T;
}

/** Multipart upload via existing API base + JWT (do not set Content-Type). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const token = getToken();

  if (!onProgress) {
    return api<T>(path, { method: "POST", body: formData });
  }

  const bases = candidateBases();

  return new Promise<T>((resolve, reject) => {
    let baseIndex = 0;

    const attempt = () => {
      const base = bases[baseIndex] ?? DIRECT_API_BASE;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${base}${path}`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        activeApiBase = base;
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(xhr.responseText || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          data = {};
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as T);
          return;
        }
        try {
          throwApiError(path, xhr.status, data);
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => {
        if (baseIndex < bases.length - 1) {
          baseIndex += 1;
          attempt();
          return;
        }
        reject(
          new ApiError(
            0,
            "Unable to reach the Dhapti API for upload. Is the backend running on port 4000?",
            "NETWORK_ERROR"
          )
        );
      };
      xhr.send(formData);
    };

    attempt();
  });
}

/** Authenticated binary download (private submission files). */
export async function apiDownload(path: string, fallbackName: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetchWithFallback(path, { headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throwApiError(path, res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Authenticated blob URL for inline preview (caller must revoke). */
export async function apiBlobUrl(path: string): Promise<string> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetchWithFallback(path, { headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throwApiError(path, res.status, data);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Current resolved API base (after successful fallback, if any). */
export function getActiveApiBase() {
  return activeApiBase;
}
