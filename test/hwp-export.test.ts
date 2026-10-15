// 내보내기 공용: 형식별 허용(5-2 정책) · 파일 이름. Word·텍스트 변환 시험은 그 단계에서 더해요(HWP_SPEC 12-14).
import { test } from "vitest";
import assert from "node:assert/strict";
import { exportRules, exportName } from "../src/hwp-export.js";
import { hwpPolicy, type HwpSniff } from "../src/hwp-lib.js";

test("형식별 허용 = 5-2 정책", () => {
  const H5 = (o: Partial<HwpSniff>): HwpSniff => ({ kind: "hwp5", ...o });
  const pick = (s: HwpSniff, f: { noCopy: boolean; noPrint: boolean } | null) => {
    const r = exportRules(hwpPolicy(s, f), s);
    return (["pdf", "png", "docx", "txt"] as const).map((k) => (r[k].ok ? "o" : r[k].why)).join(" ");
  };
  assert.equal(pick(H5({}), null), "o o o o");
  assert.equal(pick(H5({ distribution: true }), { noCopy: false, noPrint: false }), "o o edit o"); // 배포용은 Word 로 안 옮겨요
  assert.equal(pick(H5({ distribution: true }), { noCopy: true, noPrint: false }), "o o copy copy");
  assert.equal(pick(H5({ distribution: true }), { noCopy: false, noPrint: true }), "print print print print");
  assert.equal(pick(H5({ distribution: true }), null), "print print print print");
  assert.equal(pick(H5({ privacy: true }), null), "privacy privacy privacy privacy");
  assert.equal(pick(H5({ password: true }), null), "o o o o");
  assert.equal(pick({ kind: "hwpx" }, null), "o o o o");
});

test("파일 이름", () => {
  assert.equal(exportName("보도자료.hwpx", "pdf"), "보도자료.pdf");
  assert.equal(exportName("보도자료.hwp", "docx"), "보도자료.docx");
  assert.equal(exportName("a/b:c?.hwp", "txt"), "b_c_.txt");
  assert.equal(exportName("보도자료.hwp", "png", { page: 3, pages: 12 }), "보도자료-03쪽.png");
  assert.equal(exportName("보도자료.hwp", "png", { page: 3, pages: 9 }), "보도자료-3쪽.png");
  assert.equal(exportName("보도자료.hwp", "png", { count: 12 }), "보도자료-쪽그림-12장.zip");
});
