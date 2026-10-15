// 한컴 전용 영역 글자(PUA) → 보통 글자 (Word·텍스트 내보내기용, rhwp v0.8.7 표)
import { test } from "vitest";
import assert from "node:assert/strict";
import { puaToText, puaChar, puaFixer } from "../src/hwp-pua.js";
import { OLD_HANGUL_FROM, OLD_HANGUL_DATA } from "../src/hwp-pua-oldhangul.js";
import { warnLines, type Warn } from "../src/hwp-export.js";

test("공개 시험 파일(rhwp HWP5-nopassword)의 PUA 문단: 화면과 같은 글자로 바뀌어요", () => {
  // 본문 "커서를 항목 앞에 놓고 [U+F03A0]를 누르면" — 화면 SVG 는 ↵ 로 그려요
  assert.deepEqual(puaToText("커서를 항목 앞에 놓고 \u{F03A0}를 누르면"), { text: "커서를 항목 앞에 놓고 ↵를 누르면", unknown: 0 });
  // 머리말 U+F03EF~U+F03F4 — 화면은 '한글과컴퓨터'
  assert.equal(puaToText("\u{F03EF}\u{F03F0}\u{F03F1}\u{F03F2}\u{F03F3}\u{F03F4}").text, "한글과컴퓨터");
});

test("옛한글(Hanyang-PUA) → 첫가끝 자모: 한컴 규격 문서의 '\u1112\u119E\u11AB글'(U+F53A)", () => {
  assert.equal(puaToText("\uF53A글").text, "\u1112\u119E\u11AB글");
  assert.equal(puaChar(0xE1A7), "\u1100\u119E"); // rhwp 시험값
  assert.equal(puaChar(0xE231), "\u1102\u117A\u11A8\u1102\u117C\u11A8"); // 자모 6개짜리
  assert.equal(puaChar(0xE0BC), "\u115F\u1161\u11AE"); // 첫 칸
  assert.equal(puaChar(0xF8F7) !== null, true); // 마지막 칸
});

test("옛한글 표: rhwp 표와 같은 5,660개, U+E0BC~U+F8F7", () => {
  const slots = OLD_HANGUL_DATA.split(",");
  assert.equal(OLD_HANGUL_FROM, 0xE0BC);
  assert.equal(slots.length, 0xF8F7 - 0xE0BC + 1);
  assert.equal(slots.filter(Boolean).length, 5660);
  // 자모 영역(U+1100-11FF · U+A960-A97F · U+D7B0-D7FF)만 들어 있어요
  for (const s of slots) for (const ch of s) {
    const c = ch.codePointAt(0) as number;
    assert.ok((c >= 0x1100 && c <= 0x11FF) || (c >= 0xA960 && c <= 0xA97F) || (c >= 0xD7B0 && c <= 0xD7FF), c.toString(16));
  }
});

test("기호: 검증 표·글머리 표·네모 숫자·HWP5 기호 자리", () => {
  assert.equal(puaToText("\u{F0854}용비어천가\u{F0855}").text, "《용비어천가》");
  assert.equal(puaToText("\u{F02B1}\u{F02B2}\u{F02C4}\u{F02B0}\u{F02C5}").text, "①②⑳⓪⑫"); // 네모 안 숫자(텍스트 뽑기용 표면)
  assert.equal(puaToText("\u{F02CE}\u{F02E1}").text, "120"); // 반전 사각형 안 숫자 1, 20
  assert.equal(puaToText("\uF06C 항목 \uF0FC").text, "● 항목 ✔"); // U+F0xx 기호 글꼴 글머리
  assert.equal(puaToText("\u{F080F}\u{F080F}").text, "━━");
  assert.equal(puaToText("(\u{F012B})").text, "((인))");
  // HWP5 는 같은 기호를 0xA000|X 로 실어요 → 평면 15 로 맞춰 바꿔요
  assert.equal(puaToText("\uA2B1 \uA832").text, "① ═");
  // 표에 없는 0xA8xx(한글이 옮기지 않는 값, 예: 영어 단어 속 U+A813)는 그대로
  assert.deepEqual(puaToText("spectro\uA813scopy"), { text: "spectro\uA813scopy", unknown: 0 });
});

test("표에 없는 PUA 는 지어내지 않고 그대로 두고 세요", () => {
  assert.deepEqual(puaToText("가\u{F0123}나\uE000다"), { text: "가\u{F0123}나\uE000다", unknown: 2 });
  assert.deepEqual(puaToText("\uF03E"), { text: "\uF03E", unknown: 1 }); // U+F020~F0FF 중 표에 없는 것
  // HWP5 기호 자리인데 뜻을 모르는 것(0xA289 → U+F0289 는 ①이라 바뀌고, 0xA2FC → U+F02FC ►, 0xA3C5 → □)
  assert.equal(puaToText("\uA289\uA2FC\uA3C5").text, "①►□");
  assert.deepEqual(puaToText("\uA0E1"), { text: "\u{F00E1}", unknown: 1 }); // 평면 15 로 맞추고(한컴 글꼴이면 보여요) 세요
});

test("보통 글은 그대로(빠른 길), 서로게이트 짝도 깨지지 않아요", () => {
  const s = "보통 문장이에요. ABC 123 😀 \u1112\u119E\u11AB";
  assert.deepEqual(puaToText(s), { text: s, unknown: 0 });
  assert.deepEqual(puaToText("😀\u{F03A0}😀"), { text: "😀↵😀", unknown: 0 });
});

test("puaFixer: 못 바꾼 개수를 warn.pua 에 모으고 안내 문구가 나와요", () => {
  const warn: Warn = {};
  const fix = puaFixer(warn);
  assert.equal(fix("\u{F03A0}"), "↵");
  fix("\u{F0123}\u{F0124}"); fix("\uE000");
  assert.equal(warn.pua, 3);
  assert.deepEqual(warnLines(warn), ["한컴 전용 기호 3개는 바꿀 글자를 몰라 그대로 두었어요. 한컴 글꼴이 없는 곳에서는 네모(□)로 보일 수 있어요."]);
});
