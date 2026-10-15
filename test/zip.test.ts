// ZIP 을 한 파일씩 이어 붙이기(lib.ts zipWriter) — 집문서 public/vendor 의 fflate 0.8.2 를 그대로 써요
import { test } from "vitest";
import assert from "node:assert/strict";
import { zipWriter, uniqueName, type FflateStreamModule } from "../src/lib.js";
const ff: FflateStreamModule & { unzipSync(d: Uint8Array): Record<string, Uint8Array> } = await import(/* @vite-ignore */ new URL("../public/vendor/fflate-0.8.2.mjs", import.meta.url).href);
const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 255);

test("zipWriter: 넣은 차례·이름(한글)·내용 그대로, 결과는 Blob 하나", async () => {
  const w = zipWriter(ff);
  const a = bytes(300_000, 1), b = bytes(10, 2), c = new Uint8Array(0);
  w.add("보도자료-01쪽.png", a);
  w.add("보도자료-02쪽.png", b);
  w.add("빈 파일.txt", c);
  assert.equal(w.count, 3);
  const blob = w.finish();
  assert.equal(blob.type, "application/zip");
  const buf = new Uint8Array(await blob.arrayBuffer());
  const files = ff.unzipSync(buf);
  assert.deepEqual(Object.keys(files), ["보도자료-01쪽.png", "보도자료-02쪽.png", "빈 파일.txt"]);
  assert.deepEqual(files["보도자료-01쪽.png"], a);
  assert.deepEqual(files["보도자료-02쪽.png"], b);
  assert.equal(files["빈 파일.txt"].length, 0);
  // 압축 없이(stored) 넣어요: 결과 크기 ≈ 내용 + 머리 조각
  assert.ok(buf.length >= a.length + b.length && buf.length < a.length + b.length + 1000);
  // 한글 이름이면 UTF-8 표시(일반 목적 플래그 bit 11)를 켜요
  assert.equal(buf[0] === 0x50 && buf[1] === 0x4b, true);
  assert.equal((buf[7] & 0x08) !== 0, true);
});

test("zipWriter: abort 하면 모은 조각을 버리고, 빈 ZIP 도 만들 수 있어요", async () => {
  const w = zipWriter(ff);
  w.add("a.bin", bytes(1000, 3));
  w.abort();
  const e = zipWriter(ff).finish();
  assert.deepEqual(Object.keys(ff.unzipSync(new Uint8Array(await e.arrayBuffer()))), []);
});

test("uniqueName: 같은 이름은 '이름-2.확장자'로", () => {
  const used = new Set<string>();
  assert.equal(uniqueName("사진.jpg", used), "사진.jpg");
  assert.equal(uniqueName("사진.jpg", used), "사진-2.jpg");
  assert.equal(uniqueName("사진.jpg", used), "사진-3.jpg");
  assert.equal(uniqueName("README", used), "README");
  assert.equal(uniqueName("README", used), "README-2");
  assert.equal(uniqueName(".hidden", used), ".hidden");
  assert.equal(uniqueName(".hidden", used), ".hidden-2");
});
