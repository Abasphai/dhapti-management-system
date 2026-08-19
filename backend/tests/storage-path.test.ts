import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSafePath } from "../src/lib/storage/localDisk.js";

describe("Phase 1F-B storage path safety", () => {
  it("rejects path traversal keys", () => {
    const bad = [
      "../secret.txt",
      "..\\secret.txt",
      "../../etc/passwd",
      "/etc/passwd",
      "assignments/../../secret",
      "assignments\\..\\..\\secret",
    ];
    for (const key of bad) {
      assert.throws(() => resolveSafePath(key), /INVALID_STORAGE_KEY/);
    }
  });

  it("allows nested relative keys", () => {
    const p = resolveSafePath(
      "assignments/a1/submissions/s1/file.pdf"
    );
    assert.ok(p.replace(/\\/g, "/").includes("assignments/a1/submissions/s1/file.pdf"));
  });
});
