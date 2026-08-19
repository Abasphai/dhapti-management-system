import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BIU_COMPONENT_CAPS,
  attendancePercentToMarks,
  biuAssignmentMaxPerItem,
  computeBiuLetterGrade,
  computePassFail,
  effectiveAssignmentScoreCap,
  evaluateBiuMarks,
  validateBiuComponentMarks,
} from "../src/lib/gradingPolicy.js";

describe("Dhapti grading policy", () => {
  it("rejects component marks over official caps", () => {
    const overMidterm = validateBiuComponentMarks({
      midterm: 31,
      finalExam: 0,
      quiz: 0,
      attendance: 0,
      presentation: 0,
      assignment: 0,
    });
    assert.equal(overMidterm.ok, false);
    if (!overMidterm.ok) {
      assert.match(overMidterm.message, /Midterm/i);
    }

    const overFinal = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 41,
      quiz: 0,
      attendance: 0,
      presentation: 0,
      assignment: 0,
    });
    assert.equal(overFinal.ok, false);

    const overQuiz = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 0,
      quiz: 10.1,
      attendance: 0,
      presentation: 0,
      assignment: 0,
    });
    assert.equal(overQuiz.ok, false);

    const overAttendance = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 0,
      quiz: 0,
      attendance: 11,
      presentation: 0,
      assignment: 0,
    });
    assert.equal(overAttendance.ok, false);

    const overPresentation = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 0,
      quiz: 0,
      attendance: 0,
      presentation: 6,
      assignment: 0,
    });
    assert.equal(overPresentation.ok, false);

    const overAssignment = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 0,
      quiz: 0,
      attendance: 0,
      presentation: 0,
      assignment: 5.5,
    });
    assert.equal(overAssignment.ok, false);

    const overCombinedScores = validateBiuComponentMarks({
      midterm: 0,
      finalExam: 0,
      quiz: 0,
      attendance: 0,
      presentation: 0,
      assignmentScores: [2.5, 2.6],
    });
    assert.equal(overCombinedScores.ok, false);

    const twoAssignmentsOk = validateBiuComponentMarks({
      midterm: 30,
      finalExam: 40,
      quiz: 10,
      attendance: 10,
      presentation: 5,
      assignmentScores: [2.5, 2.5],
    });
    assert.equal(twoAssignmentsOk.ok, true);
  });

  it("maps total marks to official Dhapti letter grades and grade points", () => {
    const cases: Array<[number, string, number]> = [
      [100, "A+", 4.0],
      [90, "A+", 4.0],
      [89, "A", 3.75],
      [85, "A", 3.75],
      [84, "A-", 3.5],
      [80, "A-", 3.5],
      [79, "B+", 3.25],
      [75, "B+", 3.25],
      [74, "B", 3.0],
      [70, "B", 3.0],
      [69, "B-", 2.75],
      [65, "B-", 2.75],
      [64, "C+", 2.5],
      [60, "C+", 2.5],
      [59, "C", 2.25],
      [55, "C", 2.25],
      [54, "C-", 2.0],
      [50, "C-", 2.0],
      [49, "F", 0.0],
      [0, "F", 0.0],
    ];
    for (const [score, letter, gp] of cases) {
      const result = computeBiuLetterGrade(score);
      assert.equal(result.letter, letter, `score ${score}`);
      assert.equal(result.gradePoint, gp, `score ${score} GP`);
    }

    const raisedCutoff = computeBiuLetterGrade(55, 60);
    assert.equal(raisedCutoff.letter, "F");
    assert.equal(raisedCutoff.gradePoint, 0);
    const stillPass = computeBiuLetterGrade(60, 60);
    assert.equal(stillPass.letter, "C+");
  });

  it("evaluates full Dhapti mark set into total + letter", () => {
    const result = evaluateBiuMarks({
      midterm: 28,
      finalExam: 36,
      quiz: 8,
      attendance: 9,
      presentation: 4,
      assignment: 5,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.total, 90);
      assert.equal(result.letterGrade, "A+");
      assert.equal(result.gradePoint, 4.0);
    }
  });

  it("applies assignment per-item caps under Dhapti policy", () => {
    assert.equal(biuAssignmentMaxPerItem(1), BIU_COMPONENT_CAPS.ASSIGNMENTS_COMBINED);
    assert.equal(biuAssignmentMaxPerItem(2), 2.5);
    assert.equal(
      effectiveAssignmentScoreCap({
        assignmentMaxMarks: 100,
        publishedAssignmentCountInSection: 1,
      }),
      5
    );
    assert.equal(
      effectiveAssignmentScoreCap({
        assignmentMaxMarks: 100,
        publishedAssignmentCountInSection: 2,
      }),
      2.5
    );
  });

  it("converts attendance % into 0–10 Dhapti attendance marks", () => {
    assert.equal(attendancePercentToMarks(null), 0);
    assert.equal(attendancePercentToMarks(undefined), 0);
    assert.equal(attendancePercentToMarks(100), 10);
    assert.equal(attendancePercentToMarks(50), 5);
    assert.equal(attendancePercentToMarks(85), 8.5);
    assert.equal(attendancePercentToMarks(0), 0);
    assert.equal(attendancePercentToMarks(120), 10);
  });

  it("computes PASS/FAIL from total with default and custom cutoffs", () => {
    assert.equal(computePassFail(50), "PASS");
    assert.equal(computePassFail(49.99), "FAIL");
    assert.equal(computePassFail(0), "FAIL");
    assert.equal(computePassFail(100), "PASS");
    assert.equal(computePassFail(55, 60), "FAIL");
    assert.equal(computePassFail(60, 60), "PASS");

    const evaluated = evaluateBiuMarks({
      midterm: 15,
      finalExam: 20,
      quiz: 5,
      attendance: 5,
      presentation: 2,
      assignment: 2,
    });
    assert.equal(evaluated.ok, true);
    if (evaluated.ok) {
      assert.equal(evaluated.total, 49);
      assert.equal(evaluated.letterGrade, "F");
      assert.equal(evaluated.gradePoint, 0);
      assert.equal(computePassFail(evaluated.total), "FAIL");
    }
  });
});
