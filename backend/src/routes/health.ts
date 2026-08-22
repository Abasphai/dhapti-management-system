import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: "ok",
      timestamp: new Date(),
      db: "up",
      service: "dhapti-api",
    });
  } catch {
    return res.status(503).json({
      status: "error",
      timestamp: new Date(),
      db: "down",
      service: "dhapti-api",
    });
  }
});
