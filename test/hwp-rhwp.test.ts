// rhwp 0.8.7 통합 시험 (Node, 브라우저 없이). public/vendor 의 고정 파일을 그대로 써요(빌드가 다시 묶지 않는 것과 같은 파일).
// 글자 폭 측정기(measureTextWidth)는 정의하지 않아요(0.8.7 은 찾지 않음, HWP_SPEC 3-4).
import fs from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
// 주소를 변수로 넘겨서 tsc 가 .js 모듈 타입을 찾지 않게 해요(any).
const RHWP = new URL("../public/vendor/rhwp-0.8.7/rhwp.js", import.meta.url).href;
const rhwp: any = await import(/* @vite-ignore */ RHWP);
await rhwp.default({ module_or_path: fs.readFileSync("public/vendor/rhwp-0.8.7/rhwp_bg.wasm") });
const rd = (f: string) => new Uint8Array(fs.readFileSync("test/fixtures/hwp/" + f));

test("합성 HWP·HWPX 가 열리고 글자가 그려져요", () => {
  for (const f of ["synthetic.hwp", "synthetic.hwpx"]) {
    const d = new rhwp.HwpDocument(rd(f));
    assert.equal(d.pageCount(), 1);
    const info = JSON.parse(d.getPageInfo(0));
    assert.ok(Math.abs(info.width - 793.7) < 1 && Math.abs(info.height - 1122.5) < 1, "A4 96dpi px");
    const svg = d.renderPageSvg(0);
    assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/);
    assert.ok(!/<script|<foreignObject|javascript:/i.test(svg), "위험 요소 없음");
    assert.ok(!/href="(?!data:image\/|#)/.test(svg), "바깥 주소 없음");
    assert.match(svg, /Noto Serif KR/);
    d.free();
  }
});
test("암호 문서: 없음 → 필요, 틀림 → 불일치, 맞음 → 열림", () => {
  assert.throws(() => new rhwp.HwpDocument(rd("synthetic-pw1234.hwp")), /비밀번호가 필요한/);
  assert.throws(() => rhwp.HwpDocument.openWithPassword(rd("synthetic-pw1234.hwp"), "0000"), /일치하지 않/);
  assert.equal(rhwp.HwpDocument.openWithPassword(rd("synthetic-pw1234.hwp"), "1234").pageCount(), 1);
});
test("빈 파일·다른 형식은 오류(멈춤 아님)", () => {
  assert.throws(() => new rhwp.HwpDocument(new Uint8Array(0)), /EMPTY_FILE/);
  assert.throws(() => new rhwp.HwpDocument(new Uint8Array(fs.readFileSync("test/fixtures/alpha.pdf"))), /UNSUPPORTED_FILE_FORMAT/);
});
test("회사 DRM 머리말(SoftCamp·Fasoo)은 DRM_PROTECTED", () => {
  const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  assert.throws(() => new rhwp.HwpDocument(enc("SCDSA002\0\0")), /DRM_PROTECTED/);
  assert.throws(() => new rhwp.HwpDocument(enc("\x9b DRMONE  This Document is encrypted")), /DRM_PROTECTED/);
});
test("서비스가 쓰는 API 만 타입에 있어요(편집·다시 저장·배포용 풀기는 없음)", () => {
  const dts = fs.readFileSync("src/rhwp.d.ts", "utf8").replace(/\/\/.*$/gm, "");
  for (const bad of ["convertToEditable", "exportHwp", "exportHwpx", "exportHml", "insertText", "createEmpty"]) assert.ok(!dts.includes(bad), bad);
  // 워커 코드도 그런 API 를 부르지 않아요
  const worker = fs.readFileSync("src/hwp-worker.ts", "utf8").replace(/\/\/.*$/gm, "");
  for (const bad of ["convertToEditable", "exportHwp", "exportHml"]) assert.ok(!worker.includes(bad), bad);
});
