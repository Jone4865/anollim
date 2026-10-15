// HWP 형식·배포용·정책 판별 (순수 함수). 합성 시험 파일은 dev/make-hwp-fixtures.mjs 로 rhwp 가 직접 만든 것이에요.
import fs from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  sniffHwp, distributionFlags, decodeDistributeDocData, distributeKeyArray, hwpPolicy, hwpErrorCode, pdfEstimateKB,
  type HwpSniff, type HwpPolicy, type DistFlags,
} from "../src/hwp-lib.js";

const rd = (f: string) => new Uint8Array(fs.readFileSync("test/fixtures/" + f));
const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

test("sniffHwp: 합성 HWP·암호 HWP·HWPX·다른 형식·빈 파일·HWP 3.0", () => {
  const h = sniffHwp(rd("hwp/synthetic.hwp"));
  assert.equal(h.kind, "hwp5");
  assert.equal(h.password, false); assert.equal(h.distribution, false); assert.equal(h.privacy, false); assert.equal(h.drm, false);
  assert.equal(sniffHwp(rd("hwp/synthetic-pw1234.hwp")).password, true);
  assert.equal(sniffHwp(rd("hwp/synthetic.hwpx")).kind, "hwpx");
  assert.equal(sniffHwp(rd("alpha.pdf")).kind, "unknown");
  assert.equal(sniffHwp(rd("trans.png")).kind, "unknown");
  assert.equal(sniffHwp(new Uint8Array(0)).kind, "unknown");
  const h3 = new Uint8Array(32); h3.set(enc("HWP Document File V3.00"));
  assert.equal(sniffHwp(h3).kind, "hwp3");
});

test("회사 DRM 머리말(SoftCamp·Fasoo)은 FileHeader 없이도 DRM 으로 막아요", () => {
  const sc = new Uint8Array([...enc("SCDSA002"), 0, 0, 0xd0, 4]);
  const fa = new Uint8Array([0x9b, ...enc(" DRMONE  This Document is encrypted")]);
  assert.deepEqual(sniffHwp(sc), { kind: "unknown", drm: true });
  assert.deepEqual(sniffHwp(fa), { kind: "unknown", drm: true });
  assert.deepEqual(sniffHwp(enc("SCDS")), { kind: "unknown" });
  assert.equal(hwpPolicy(sniffHwp(sc), null).block, "drm");
  assert.equal(hwpPolicy(sniffHwp(fa), null).block, "drm");
});

test("개인 정보 보안 비트(bit 13)를 켜면 PDF·인쇄를 막아요", () => {
  const c = rd("hwp/synthetic.hwp");
  const sig = enc("HWP Document File");
  let at = -1;
  for (let i = 0; i + sig.length <= c.length && at < 0; i++) if (sig.every((x, k) => c[i + k] === x)) at = i;
  assert.ok(at > 0);
  c[at + 37] |= 0x20; // 속성 DWORD(오프셋 36)의 bit 13
  const s = sniffHwp(c);
  assert.equal(s.privacy, true);
  const p = hwpPolicy(s, null);
  assert.equal(p.pdf, "blocked"); assert.equal(p.reason, "privacy"); assert.equal(p.print, false);
});

/** 평문(시드 + 해시 16진수 40자 UTF-16 + 플래그)을 만들어 배포용 문서 방식대로 XOR 해요 */
function encodeDist(seed: number, flags: number): Uint8Array {
  const x = new Uint8Array(256);
  x[0] = seed & 255; x[1] = (seed >>> 8) & 255; x[2] = (seed >>> 16) & 255; x[3] = (seed >>> 24) & 255;
  const off = (seed & 0x0f) + 4;
  const hash = "0123456789abcdef0123456789ABCDEF01234567";
  for (let i = 0; i < 40; i++) { x[off + i * 2] = hash.charCodeAt(i); x[off + i * 2 + 1] = 0; }
  x[off + 80] = flags & 255; x[off + 81] = (flags >>> 8) & 255;
  const arr = distributeKeyArray(seed >>> 0);
  for (let i = 4; i < 256; i++) x[i] ^= arr[i];
  return x;
}
test("decodeDistributeDocData: 합성 시험 벡터", () => {
  const cases: [number, number, DistFlags][] = [
    [0x12345678, 0x0000, { noCopy: false, noPrint: false }],
    [0xdeadbeef, 0x8001, { noCopy: true, noPrint: false }],
    [7, 0x0003, { noCopy: true, noPrint: true }],
    [0xffffffff, 0x0002, { noCopy: false, noPrint: true }],
  ];
  for (const [seed, f, exp] of cases) assert.deepEqual(decodeDistributeDocData(encodeDist(seed, f)), exp, `seed ${seed.toString(16)}`);
  assert.equal(decodeDistributeDocData(new Uint8Array(256)), null);
  assert.equal(decodeDistributeDocData(new Uint8Array(10)), null);
});

test("distributionFlags: 일반 문서는 null, 망가진 입력 200건에도 던지지 않아요", () => {
  const b = rd("hwp/synthetic.hwp");
  assert.equal(distributionFlags(b), null);
  for (let k = 0; k < 200; k++) {
    const c = b.slice(0, Math.min(b.length, 512 + k * 300));
    const i = (k * 7919) % c.length; c[i] ^= 0xff;
    assert.doesNotThrow(() => { distributionFlags(c); sniffHwp(c); });
  }
});

test("hwpPolicy: 5-2 표 17줄", () => {
  const H5 = (o: Partial<HwpSniff>): HwpSniff => ({ kind: "hwp5", ...o });
  const pick = (p: HwpPolicy) => [p.block, p.pdf, p.reason, p.preview, p.print].map(String).join(" ");
  const T: [string, HwpSniff, DistFlags | null, string, boolean?][] = [
    ["일반", H5({}), null, "null ok null svg true"],
    ["HWPX", { kind: "hwpx" }, null, "null ok null svg true"],
    ["HWP3", { kind: "hwp3" }, null, "null ok null svg true"],
    ["배포용 제한 없음", H5({ distribution: true }), { noCopy: false, noPrint: false }, "null ok null svg true"],
    ["배포용 복사방지", H5({ distribution: true }), { noCopy: true, noPrint: false }, "null image-only copy raster true"],
    ["배포용 인쇄방지", H5({ distribution: true }), { noCopy: false, noPrint: true }, "null blocked print raster false"],
    ["배포용 둘 다", H5({ distribution: true }), { noCopy: true, noPrint: true }, "null blocked print raster false"],
    ["배포용 플래그 못 읽음", H5({ distribution: true }), null, "null blocked print raster false"],
    ["암호", H5({ password: true }), null, "null ok null svg true"],
    ["개인 정보 보안", H5({ privacy: true }), null, "null blocked privacy svg false"],
    ["개인 정보 보안 + 복사방지", H5({ privacy: true, distribution: true }), { noCopy: true, noPrint: false }, "null blocked privacy raster false"],
    ["DRM bit4", H5({ drm: true }), null, "drm blocked null raster false"],
    ["인증서 DRM bit10", H5({ certDrm: true }), null, "drm blocked null raster false"],
    ["인증서 암호화 bit8", H5({ certEncrypted: true }), null, "cert blocked null raster false"],
    ["형식 아님", { kind: "unknown" }, null, "unknown blocked null raster false"],
    ["스위치 끔 + 배포용", H5({ distribution: true }), { noCopy: false, noPrint: false }, "distribution blocked null raster false", false],
    ["스위치 끔 + 일반", H5({}), null, "null ok null svg true", false],
  ];
  for (const [name, s, f, exp, allow] of T) assert.equal(pick(allow === undefined ? hwpPolicy(s, f) : hwpPolicy(s, f, allow)), exp, name);
  assert.equal(hwpPolicy(H5({ password: true }), null).needPassword, true);
});

test("hwpErrorCode: rhwp 0.8.7 실제 오류 문구", () => {
  const M: [string, string][] = [
    ["유효하지 않은 파일: 비밀번호가 필요한 암호 문서입니다 (parse_document_with_password 또는 parse_hwp_with_password 로 비밀번호를 전달하세요)", "password-needed"],
    ["유효하지 않은 파일: 암호 오류: 비밀번호가 일치하지 않거나 암호화 데이터가 손상되었습니다", "password-wrong"],
    ["유효하지 않은 파일: HWPX 오류: 비밀번호가 일치하지 않거나 암호화 데이터가 손상되었습니다", "password-wrong"],
    ["유효하지 않은 파일: 지원하지 않는 포맷입니다: 빈 파일. 오류코드: EMPTY_FILE. 빈 파일(0 바이트)입니다.", "empty"],
    ["유효하지 않은 파일: 지원하지 않는 포맷입니다: 알 수 없는 파일 형식. 오류코드: UNSUPPORTED_FILE_FORMAT. 현재 rhwp는 HWP 5.0, HWPX, 일부 HWP 3.0, HWPML 2.9 문서를 지원합니다.", "unsupported"],
    ["유효하지 않은 파일: 지원하지 않는 포맷입니다: DRM 보호 문서 (SoftCamp SCDSA). 오류코드: DRM_PROTECTED. DRM/보안 컨테이너로 보호된 문서입니다.", "drm"],
    ["무언가 다른 오류", "failed"],
  ];
  for (const [m, code] of M) assert.equal(hwpErrorCode(m), code, m);
});

test("pdfEstimateKB: 쪽당 150dpi 230KB · 200dpi 340KB", () => {
  assert.equal(pdfEstimateKB(24, 150), 5520);
  assert.equal(pdfEstimateKB(2, 200), 680);
});
