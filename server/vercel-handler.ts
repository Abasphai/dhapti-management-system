import "dotenv/config";
import express from "express";
import serverless from "serverless-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import backendApp from "../backend/src/app.ts";

function logFatal(label: string, err: unknown) {
  console.error(`[vercel-handler] ${label}:`, err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}

process.on("unhandledRejection", (reason) => {
  logFatal("unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  logFatal("uncaughtException", err);
});

/** Ensure Express sees full `/api/...` paths on Vercel catch-all. */
function normalizeApiPath(req: IncomingMessage) {
  const url = req.url ?? "/";
  if (url.startsWith("/api")) return;

  const qIndex = url.indexOf("?");
  const pathPart = qIndex === -1 ? url : url.slice(0, qIndex);
  const qs = qIndex === -1 ? "" : url.slice(qIndex);
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  req.url = `/api${normalized}${qs}`;
}

const wrapper = express();
wrapper.use((req, _res, next) => {
  normalizeApiPath(req);
  next();
});
wrapper.use(backendApp);

const serverlessHandler = serverless(wrapper);

function sendCrashResponse(res: ServerResponse, err: unknown) {
  if (res.headersSent) return;
  res.statusCode = 500;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err instanceof Error
            ? err.message
            : String(err),
      code: "HANDLER_CRASH",
    })
  );
}

/**
 * Vercel serverless entry — serverless-http bridges req/res for POST bodies + Express.
 * Bundled to api/[...path].js (catch-all).
 */
export default function handler(
  req: IncomingMessage,
  res: ServerResponse
): void | Promise<unknown> {
  try {
    const result = serverlessHandler(req, res);
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      return (result as Promise<unknown>).catch((err: unknown) => {
        logFatal("serverless-handler promise rejection", err);
        sendCrashResponse(res, err);
      });
    }
    return result;
  } catch (err) {
    logFatal("sync handler crash", err);
    sendCrashResponse(res, err);
  }
}
