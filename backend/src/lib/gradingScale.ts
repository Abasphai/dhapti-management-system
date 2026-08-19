import { computeBiuLetterGrade } from "./gradingPolicy.js";
import { prisma } from "./prisma.js";
import { getSystemSettings } from "./settings.js";

export type GradeScaleLookup = {
  configured: boolean;
  scaleId: string | null;
  scaleName: string | null;
  letterGrade: string | null;
  gradePoint: number | null;
};

/**
 * Active grade-scale lookup.
 * Official Dhapti scale is always available; DB GradeScale bands override when present.
 */
export async function getActiveGradeScale() {
  return prisma.gradeScale.findFirst({
    where: { isActive: true },
    include: {
      bands: { orderBy: [{ sortOrder: "asc" }, { minScore: "desc" }] },
    },
  });
}

/** Dhapti official scale is always configured (DB bands optional overlay). */
export async function isGradeScaleConfigured() {
  return true;
}

/** Map numeric percentage (0–100) → letter + gradePoint. */
export async function lookupGradeFromScore(
  percentage: number
): Promise<GradeScaleLookup> {
  const settings = await getSystemSettings();
  const cutoff = settings.passingGradeCutoff;
  const scale = await getActiveGradeScale();

  if (percentage < cutoff) {
    return {
      configured: true,
      scaleId: scale?.id ?? null,
      scaleName: scale?.name ?? "Dhapti Official Scale",
      letterGrade: "F",
      gradePoint: 0,
    };
  }

  if (scale && scale.bands.length > 0) {
    const band = scale.bands.find(
      (b) => percentage >= b.minScore && percentage <= b.maxScore
    );
    if (band) {
      return {
        configured: true,
        scaleId: scale.id,
        scaleName: scale.name,
        letterGrade: band.letterGrade,
        gradePoint: band.gradePoint,
      };
    }
  }

  const biu = computeBiuLetterGrade(percentage, cutoff);
  return {
    configured: true,
    scaleId: scale?.id ?? null,
    scaleName: scale?.name ?? "Dhapti Official Scale",
    letterGrade: biu.letter,
    gradePoint: biu.gradePoint,
  };
}
