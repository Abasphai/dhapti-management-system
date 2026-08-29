import "dotenv/config";
import type { Application, Request, Response } from "express";

let cachedApp: Application | null = null;

async function loadApp(): Promise<Application> {
  if (!cachedApp) {
    const mod = await import("../backend/dist/app.js");
    cachedApp = mod.default as Application;
  }
  return cachedApp;
}

/**
 * Vercel serverless entry — handles all `/api/*` requests via Express.
 * Rewrites in vercel.json route `/api/(.*)` → this function.
 */
export default async function handler(req: Request, res: Response) {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (error) {
    console.error("[api] handler bootstrap failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "API failed to start",
        code: "BOOTSTRAP_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
