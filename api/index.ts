/**
 * Vercel Serverless entry — Express app handles /api/* on the same domain.
 * Local: Vite proxies /api → :4000; Production: dhapti.com/api → this function.
 */
import "dotenv/config";

import app from "../backend/src/app.js";
import { getJwtSecret } from "../backend/src/lib/auth.js";

try {
  getJwtSecret();
} catch (err) {
  console.error("[vercel-api] JWT_SECRET misconfigured:", err);
}

export default app;
