/**
 * API client — always same-origin `/api`:
 * - Local: Vite proxy → Express :4000
 * - Production: Vercel serverless (`api/index.ts`)
 */

/** Relative same-origin API — never use external absolute URLs in production. */
export const API_BASE_URL = "/api";

const REQUEST_TIMEOUT_MS = 30_000;

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

function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 200).toLowerCase();
  return (
    head.includes("<!doctype") ||
    head.includes("<html") ||
    head.includes("<head")
  );
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

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;

  const onExternalAbort = () => {
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        0,
        "Request timed out. Please try again.",
        "NETWORK_ERROR",
        { timeoutMs: REQUEST_TIMEOUT_MS }
      );
    }
    throw new ApiError(
      0,
      "Unable to reach API. Check your connection and try again.",
      "NETWORK_ERROR",
      {
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

async function readResponsePayload(
  res: Response
): Promise<Record<string, unknown>> {
  const text = await res.text();
  let data: Record<string, unknown>;

  try {
    data = text.trim()
      ? (JSON.parse(text) as Record<string, unknown>)
      : {};
  } catch {
    data = {
      error: text?.trim() || "Server returned an unparsed error",
    };
  }

  if (looksLikeHtml(String(data.error ?? text))) {
    return {
      error:
        "API misconfigured (received HTML instead of JSON). Ensure /api routes to the Vercel serverless function.",
      code: "BAD_GATEWAY",
    };
  }

  return data;
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

  const res = await fetchWithTimeout(apiUrl(path), {
    ...options,
    headers,
  });

  const data = await readResponsePayload(res);
  if (!res.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      "Request failed";
    const code =
      typeof data.code === "string" ? data.code : undefined;
    maybeHandleSessionExpiry(path, res.status, message, code, data);
    throw new ApiError(res.status, message, code, data);
  }
  return data as T;
}

/** Multipart upload via same-origin /api + JWT (do not set Content-Type). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  const token = getToken();

  if (!onProgress) {
    return api<T>(path, { method: "POST", body: formData });
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(path));
    xhr.timeout = REQUEST_TIMEOUT_MS;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      const text = xhr.responseText || "";
      let data: Record<string, unknown>;
      try {
        data = text.trim()
          ? (JSON.parse(text) as Record<string, unknown>)
          : {};
      } catch {
        data = { error: text || "Server returned an unparsed error" };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      const message =
        (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        "Request failed";
      reject(
        new ApiError(
          xhr.status,
          message,
          typeof data.code === "string" ? data.code : undefined,
          data
        )
      );
    };
    xhr.ontimeout = () => {
      reject(
        new ApiError(
          0,
          "Request timed out. Please try again.",
          "NETWORK_ERROR"
        )
      );
    };
    xhr.onerror = () => {
      reject(
        new ApiError(
          0,
          "Unable to reach API. Check your connection and try again.",
          "NETWORK_ERROR"
        )
      );
    };
    xhr.send(formData);
  });
}

/** Authenticated binary download (private submission files). */
export async function apiDownload(path: string, fallbackName: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetchWithTimeout(apiUrl(path), { headers });
  if (!res.ok) {
    const text = await res.text();
    let errorData: Record<string, unknown>;
    try {
      errorData = text.trim()
        ? (JSON.parse(text) as Record<string, unknown>)
        : {};
    } catch {
      errorData = { error: text || "Server returned an unparsed error" };
    }
    const message =
      (typeof errorData.error === "string" && errorData.error) ||
      (typeof errorData.message === "string" && errorData.message) ||
      "Request failed";
    throw new ApiError(
      res.status,
      message,
      typeof errorData.code === "string" ? errorData.code : undefined,
      errorData
    );
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

  const res = await fetchWithTimeout(apiUrl(path), { headers });
  if (!res.ok) {
    const text = await res.text();
    let errorData: Record<string, unknown>;
    try {
      errorData = text.trim()
        ? (JSON.parse(text) as Record<string, unknown>)
        : {};
    } catch {
      errorData = { error: text || "Server returned an unparsed error" };
    }
    const message =
      (typeof errorData.error === "string" && errorData.error) ||
      (typeof errorData.message === "string" && errorData.message) ||
      "Request failed";
    throw new ApiError(
      res.status,
      message,
      typeof errorData.code === "string" ? errorData.code : undefined,
      errorData
    );
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Same-origin API base (always `/api`). */
export function getActiveApiBase() {
  return API_BASE_URL;
}
