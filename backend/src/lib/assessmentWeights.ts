import type { AssessmentComponentType } from "@prisma/client";

import { prisma } from "./prisma.js";

const WEIGHT_SUM_TOLERANCE = 0.01;

export type WeightValidation =
  | { ok: true; weights: Array<{ componentType: AssessmentComponentType; weightPercent: number }> }
  | { ok: false; code: "WEIGHTS_NOT_CONFIGURED" | "WEIGHTS_INVALID_SUM"; message: string; total: number };

/** Load ClassSection assessment weights. Calculation requires sum ≈ 100. */
export async function getClassSectionWeights(classSectionId: string) {
  return prisma.assessmentWeight.findMany({
    where: { classSectionId },
    orderBy: { componentType: "asc" },
  });
}

export async function validateWeightsForCalculation(
  classSectionId: string
): Promise<WeightValidation> {
  const rows = await getClassSectionWeights(classSectionId);
  if (!rows.length) {
    return {
      ok: false,
      code: "WEIGHTS_NOT_CONFIGURED",
      message:
        "Assessment weights are not configured for this class section. Configure weights before calculating finals.",
      total: 0,
    };
  }
  const total = rows.reduce((s, r) => s + r.weightPercent, 0);
  if (Math.abs(total - 100) > WEIGHT_SUM_TOLERANCE) {
    return {
      ok: false,
      code: "WEIGHTS_INVALID_SUM",
      message: `Assessment weights must sum to 100 (currently ${round1(total)}).`,
      total,
    };
  }
  return {
    ok: true,
    weights: rows.map((r) => ({
      componentType: r.componentType,
      weightPercent: r.weightPercent,
    })),
  };
}

export async function setClassSectionWeights(
  classSectionId: string,
  weights: Array<{ componentType: AssessmentComponentType; weightPercent: number }>
) {
  const total = weights.reduce((s, w) => s + w.weightPercent, 0);
  if (weights.length && Math.abs(total - 100) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`Assessment weights must sum to 100 (got ${total})`);
  }

  await prisma.$transaction([
    prisma.assessmentWeight.deleteMany({ where: { classSectionId } }),
    prisma.assessmentWeight.createMany({
      data: weights.map((w) => ({
        classSectionId,
        componentType: w.componentType,
        weightPercent: w.weightPercent,
      })),
    }),
  ]);

  return getClassSectionWeights(classSectionId);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
