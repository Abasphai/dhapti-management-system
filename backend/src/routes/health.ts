import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, service: "biu-api", db: "up" });
  } catch {
    return res.status(503).json({ ok: false, service: "biu-api", db: "down" });
  }
});
