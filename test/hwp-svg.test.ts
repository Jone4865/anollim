// 쪽 SVG 손보기(글꼴 이름 앞붙이기·차트 안내 한국어·@font-face 넣기)
import { test } from "vitest";
import assert from "node:assert/strict";
import { preferBundledFonts, koreanPlaceholders, embedFonts, usedGroups, prepareSvg, pxToPt, FAMILY, type FontFace } from "../src/hwp-svg.js";

const SERIF = `font-family="&apos;함초롬바탕&apos;,&apos;Noto Serif KR&apos;,serif"`;
const SANS = `font-family="&apos;함초롬돋움&apos;,&apos;Noto Sans KR&apos;,sans-serif"`;
const MONO = `font-family="&apos;D2Coding&apos;,monospace"`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text ${SERIF}>가</text><text ${SANS}>나</text><text ${MONO}>a</text></svg>`;

test("preferBundledFonts: 명조·고딕 목록 맨 앞에 우리 이름, 고정폭은 그대로", () => {
  const out = preferBundledFonts(svg);
  assert.ok(out.includes(`font-family="&apos;${FAMILY.serif}&apos;,&apos;함초롬바탕&apos;`));
  assert.ok(out.includes(`font-family="&apos;${FAMILY.sans}&apos;,&apos;함초롬돋움&apos;`));
  assert.ok(out.includes(MONO));
});

test("koreanPlaceholders: 못 그린 옛 차트 안내를 한국어로, 개수", () => {
  const s = `<svg><text>legacy HWP chart data grid prologue not recognized</text><text>본문</text><text>legacy HWP chart x</text></svg>`;
  const r = koreanPlaceholders(s);
  assert.equal(r.charts, 2);
  assert.ok(!r.svg.includes("legacy"));
  assert.equal((r.svg.match(/이 차트는 표시하지 못했어요/g) || []).length, 2);
  assert.ok(r.svg.includes("<text>본문</text>"));
});

test("embedFonts: <svg …> 바로 뒤에 @font-face, 원래 내용은 그대로", () => {
  const f: FontFace = { family: "JMSerif", mime: "font/woff2", base64: "AAAA" };
  const out = embedFonts(svg, [f]);
  const head = svg.slice(0, svg.indexOf(">") + 1);
  assert.ok(out.startsWith(head + "<style>@font-face{font-family:'JMSerif';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}</style>"));
  assert.ok(out.endsWith(svg.slice(head.length)));
  assert.equal(embedFonts(svg, []), svg);
});

test("prepareSvg: 쓰는 묶음 글꼴만 넣어요", () => {
  const serif: FontFace = { family: "JMSerif", mime: "font/woff2", base64: "SERIF" };
  const sans: FontFace = { family: "JMSans", mime: "font/woff2", base64: "SANS" };
  const onlySerif = `<svg><text ${SERIF}>가</text></svg>`;
  assert.deepEqual(usedGroups(onlySerif), { serif: true, sans: false });
  const r = prepareSvg(onlySerif, { serif, sans });
  assert.ok(r.svg.includes("SERIF") && !r.svg.includes("base64,SANS"));
  assert.equal(r.charts, 0);
  // 글꼴을 못 받았으면 넣지 않고 이름만 붙여요(기기 글꼴로)
  assert.ok(!prepareSvg(onlySerif, {}).svg.includes("<style>"));
  assert.equal(pxToPt(800), 600);
});
