import type { QuestionType } from "@prisma/client";

export function normalizeShortAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseAcceptedAnswers(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map(normalizeShortAnswer)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type GradeableQuestion = {
  id: string;
  type: QuestionType;
  marks: number;
  correctBoolean: boolean | null;
  acceptedAnswersJson: string | null;
  choices: { id: string; isCorrect: boolean; label: string }[];
};

export type SubmittedAnswer = {
  questionId: string;
  choiceId?: string | null;
  answerText?: string | null;
};

export type GradedAnswer = {
  questionId: string;
  choiceId: string | null;
  answerText: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
  needsReview: boolean;
};

/**
 * Auto-grade objective answers. Short answers use exact normalized match;
 * empty accepted list → needsReview (0 marks until teacher/admin path).
 */
export function gradeAnswers(
  questions: GradeableQuestion[],
  submitted: SubmittedAnswer[]
): { answers: GradedAnswer[]; score: number; maxScore: number; needsManualReview: boolean } {
  const byId = new Map(submitted.map((a) => [a.questionId, a]));
  let score = 0;
  let maxScore = 0;
  let needsManualReview = false;
  const answers: GradedAnswer[] = [];

  for (const q of questions) {
    maxScore += q.marks;
    const sub = byId.get(q.id);
    const choiceId = sub?.choiceId ?? null;
    const answerText = sub?.answerText?.trim() ? sub.answerText.trim() : null;

    if (q.type === "MULTIPLE_CHOICE_SINGLE" || q.type === "TRUE_FALSE") {
      const correct = q.choices.find((c) => c.isCorrect);
      // TRUE_FALSE may use correctBoolean without choices
      let isCorrect = false;
      if (q.type === "TRUE_FALSE" && q.correctBoolean != null && !correct) {
        const label = answerText?.toLowerCase();
        const fromChoice = q.choices.find((c) => c.id === choiceId);
        if (fromChoice) {
          const truthy = /^(true|t|yes|1)$/i.test(fromChoice.label);
          isCorrect = truthy === q.correctBoolean;
        } else if (label != null) {
          const truthy = /^(true|t|yes|1)$/i.test(label);
          isCorrect = truthy === q.correctBoolean;
        }
      } else {
        isCorrect = Boolean(correct && choiceId && correct.id === choiceId);
      }
      const marksAwarded = isCorrect ? q.marks : 0;
      score += marksAwarded;
      answers.push({
        questionId: q.id,
        choiceId,
        answerText,
        isCorrect,
        marksAwarded,
        needsReview: false,
      });
      continue;
    }

    // SHORT_ANSWER
    const accepted = parseAcceptedAnswers(q.acceptedAnswersJson);
    if (accepted.length === 0) {
      needsManualReview = true;
      answers.push({
        questionId: q.id,
        choiceId: null,
        answerText,
        isCorrect: null,
        marksAwarded: 0,
        needsReview: true,
      });
      continue;
    }
    if (!answerText) {
      answers.push({
        questionId: q.id,
        choiceId: null,
        answerText: null,
        isCorrect: false,
        marksAwarded: 0,
        needsReview: false,
      });
      continue;
    }
    const isCorrect = accepted.includes(normalizeShortAnswer(answerText));
    const marksAwarded = isCorrect ? q.marks : 0;
    score += marksAwarded;
    answers.push({
      questionId: q.id,
      choiceId: null,
      answerText,
      isCorrect,
      marksAwarded,
      needsReview: false,
    });
  }

  return { answers, score, maxScore, needsManualReview };
}

export function calcPercentage(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 10000) / 100;
}
