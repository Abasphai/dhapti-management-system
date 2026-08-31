import "dotenv/config";
import serverless from "serverless-http";
import app from "../backend/dist/app.js";

/**
 * Vercel optional catch-all — handles `/api`, `/api/health`, `/api/auth/login`, etc.
 * Express routes in backend/src/app.ts are mounted under `/api/*`.
 */
const handler = serverless(app, {
  binary: [
    "application/pdf",
    "application/octet-stream",
    "image/*",
    "video/*",
    "audio/*",
  ],
});

export default handler;
