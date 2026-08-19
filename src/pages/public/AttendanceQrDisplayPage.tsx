import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type DisplayPayload = {
  universityName: string;
  department: { id: string; name: string; code: string };
  location: {
    id: string;
    name: string;
    code: string;
    roomHint: string | null;
  };
  serverTime: string;
  date: string;
  mode: "START" | "END" | "IDLE";
  modeLabel: string;
  qr: {
    tokenId: string;
    payload: string | null;
    keepClientPayload: boolean;
    issuedAt: string;
    expiresAt: string;
    ttlSeconds: number;
    remainingMs: number;
  } | null;
  sessions: Array<{
    courseCode: string;
    courseTitle: string;
    section: string;
    room: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    state: string;
  }>;
  disclaimer: string;
};

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function msToCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

/**
 * Full-screen department QR display (kiosk / TV).
 * Public route — no auth. Tokens come from the API only.
 * QR images are generated locally — live tokens never leave the app to third parties.
 */
export function AttendanceQrDisplayPage() {
  const locationId = window.location.pathname.split("/").pop() || "";
  const [data, setData] = useState<DisplayPayload | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [serverSkewMs, setServerSkewMs] = useState(0);
  const cachedMode = useRef<string | null>(null);

  const apiBase =
    import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000/api";

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      // H1: never send ?force=1 — server reuses valid tokens and re-serves payload from cache.
      const res = await fetch(
        `${apiBase}/attendance/display/${encodeURIComponent(locationId)}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Attendance display unavailable");
      }
      const json = (await res.json()) as DisplayPayload;
      setData(json);
      cachedMode.current = json.mode;
      const clientNow = Date.now();
      const serverNow = new Date(json.serverTime).getTime();
      setServerSkewMs(serverNow - clientNow);

      if (json.qr?.payload) {
        setPayload(json.qr.payload);
        setExpiresAt(json.qr.expiresAt);
      } else if (json.mode === "IDLE") {
        setPayload(null);
        setExpiresAt(null);
        setQrDataUrl(null);
      } else if (json.qr?.keepClientPayload && payload && expiresAt) {
        setExpiresAt(json.qr.expiresAt);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Attendance service is temporarily unavailable. Please try again."
      );
    } finally {
      setRefreshing(false);
    }
  }, [apiBase, locationId, payload, expiresAt]);

  useEffect(() => {
    void load();
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!payload) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(payload, {
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#002147", light: "#ffffff" },
    }).then((url: string) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const remaining =
      new Date(expiresAt).getTime() - (Date.now() + serverSkewMs);
    if (remaining <= 0) {
      void load();
      return;
    }
    const id = window.setTimeout(() => {
      void load();
    }, Math.min(remaining + 200, 60_000));
    return () => window.clearTimeout(id);
  }, [expiresAt, serverSkewMs, load]);

  // Soft poll for mode changes (START ↔ END) every 20s
  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const remainingMs = expiresAt
    ? Math.max(0, new Date(expiresAt).getTime() - (nowTick + serverSkewMs))
    : 0;

  const modeColor =
    data?.mode === "START"
      ? "bg-[#16a34a]"
      : data?.mode === "END"
        ? "bg-[#ea580c]"
        : "bg-slate-500";

  return (
    <div className="min-h-screen bg-[#00152e] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="flex flex-col gap-2 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ea580c]">
              Dynamic QR Verified Attendance
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
              {data?.universityName ?? "Dhapti University"}
            </h1>
            <p className="mt-2 text-xl font-semibold text-slate-200">
              {data?.department.name ?? "Department"}
              {data?.department.code ? (
                <span className="ml-2 font-mono text-base text-slate-400">
                  ({data.department.code})
                </span>
              ) : null}
            </p>
          </div>
          <div className="text-right text-sm text-slate-300">
            <p>{data ? formatDate(data.date) : "—"}</p>
            <p className="font-mono text-2xl font-bold text-white">
              {formatClock(new Date(nowTick + serverSkewMs).toISOString())}
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        )}

        <main className="grid flex-1 gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div
              className={`inline-flex rounded-2xl px-5 py-2 text-sm font-black uppercase tracking-wider text-white ${modeColor}`}
            >
              {data?.modeLabel ?? "Loading…"}
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/40">
              {refreshing && !qrDataUrl ? (
                <div className="flex h-[420px] items-center justify-center text-[#002147]">
                  Refreshing…
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Attendance QR code"
                  className="mx-auto h-auto w-full max-w-[420px]"
                  width={420}
                  height={420}
                />
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-[#002147]">
                  <p className="text-lg font-bold">No QR required</p>
                  <p className="text-sm text-slate-600">
                    There is no active faculty attendance window for this
                    department right now.
                  </p>
                </div>
              )}
            </div>
            {expiresAt && data?.mode !== "IDLE" && (
              <p className="text-center text-lg font-semibold text-slate-200">
                {refreshing ? (
                  <span className="text-[#ea580c]">Refreshing…</span>
                ) : (
                  <>
                    QR refreshes in{" "}
                    <span className="font-mono text-2xl text-white">
                      {msToCountdown(remainingMs)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s sessions
            </h2>
            {(data?.sessions ?? []).length === 0 ? (
              <p className="text-slate-400">No scheduled sessions listed.</p>
            ) : (
              <ul className="space-y-3">
                {data!.sessions.map((s, i) => (
                  <li
                    key={`${s.courseCode}-${s.section}-${i}`}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="font-bold text-white">
                      {s.courseCode} — {s.courseTitle}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {s.scheduledStartTime ?? "—"} – {s.scheduledEndTime ?? "—"}
                      {s.room ? ` · ${s.room}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#ea580c]">
                      {s.state.replace("_", " ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-4 text-xs leading-relaxed text-slate-500">
              {data?.disclaimer}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
