// 블록 → Word(.docx): 부품·관계·서식·표·그림·머리글·각주 (HWP_SPEC 12-14 + 0장 결정 9번)
import { test } from "vitest";
import assert from "node:assert/strict";
import { buildDocx, normalizeImages, pageSetupFromHwp, wordHeaderSlots, xmlText, A4, type ZipSync } from "../src/hwp-docx.js";
import type { Block, HeaderFooter, Note } from "../src/hwp-export.js";
// 집문서 public/vendor 의 fflate 를 그대로 써요(서비스와 같은 파일)
const ff: { zipSync: ZipSync; unzipSync(d: Uint8Array): Record<string, Uint8Array> } = await import(/* @vite-ignore */ new URL("../public/vendor/fflate-0.8.2.mjs", import.meta.url).href);
const dec = new TextDecoder();
const PNG1 = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const cell = (s: string, colspan = 1, rowspan = 1) => ({ colspan, rowspan, blocks: [{ t: "p" as const, runs: [{ text: s }] }] });

const blocks: Block[] = [
  { t: "p", align: "center", indentPt: -20, runs: [{ text: "제목 <&>", b: true, pt: 16, font: "함초롬바탕", color: "FF0000" }, { text: "\t탭\n줄", sup: true }] },
  { t: "img", mime: "image/png", data: PNG1, wPx: 2000, hPx: 1000 },
  { t: "table", colPx: [100, 150, 200], rows: [[cell("a", 1, 2), cell("b", 2)], [cell("c"), cell("d")]] },
  { t: "table", rows: [[cell("e")]] },
];

test("Word 파일 구조: 부품·순서·관계", () => {
  const z = buildDocx(blocks, A4, ff.zipSync);
  const files = ff.unzipSync(z);
  assert.deepEqual(Object.keys(files), ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "word/media/image1.png"]);
  const doc = dec.decode(files["word/document.xml"]);
  const rels = dec.decode(files["word/_rels/document.xml.rels"]);
  assert.match(doc, /^<\?xml version="1.0" encoding="UTF-8" standalone="yes"\?>/);
  assert.match(doc, /<w:t xml:space="preserve">제목 &lt;&amp;&gt;<\/w:t>/);
  assert.match(doc, /<w:rFonts w:ascii="함초롬바탕" w:hAnsi="함초롬바탕" w:eastAsia="함초롬바탕" w:cs="함초롬바탕"\/><w:b\/><w:bCs\/><w:color w:val="FF0000"\/><w:sz w:val="32"\/>/); // rPr 순서
  assert.match(doc, /<w:ind w:left="400" w:hanging="400"\/><w:jc w:val="center"\/>/); // 내어쓰기: 첫 줄은 여백에
  assert.match(doc, /<w:tab\/><w:t xml:space="preserve">탭<\/w:t><w:br\/>/);
  assert.match(rels, /Id="rIdImg1"[^>]*Target="media\/image1.png"/);
  assert.match(doc, /r:embed="rIdImg1"/);
  const cx = Number(/<wp:extent cx="(\d+)"/.exec(doc)?.[1]);
  assert.equal(cx, (A4.w - A4.left - A4.right) * 635); // 본문 폭보다 큰 그림은 폭에 맞춰요
  assert.equal((doc.match(/<w:vMerge w:val="restart"\/>/g) || []).length, 1);
  assert.equal((doc.match(/<w:vMerge\/>/g) || []).length, 1);
  assert.match(doc, /<w:gridSpan w:val="2"\/>/);
  assert.match(doc, /<w:tblGrid><w:gridCol w:w="1500"\/><w:gridCol w:w="2250"\/><w:gridCol w:w="3000"\/><\/w:tblGrid>/); // px × 15
  assert.match(doc, /<w:tcW w:w="5250" w:type="dxa"\/><w:gridSpan w:val="2"\/>/);
  assert.match(doc, /<\/w:tbl><w:p\/><w:tbl>/); // 표 둘 사이 빈 문단
  assert.match(doc, /<\/w:tbl><w:p\/><w:sectPr>/); // 문서는 문단으로 끝나요
  assert.ok(doc.split("<w:tc>").slice(1).every((tc) => /<\/w:p>|<w:p\/>/.test(tc.split("</w:tc>")[0])), "모든 칸이 문단을 가져요");
  assert.ok(!/docProps|creator|lastModifiedBy/.test(Object.keys(files).join() + dec.decode(files["[Content_Types].xml"])), "작성자·만든 시각 없음");
});

test("본문 폭보다 넓은 표는 폭에 맞춰 줄여요", () => {
  const doc = dec.decode(ff.unzipSync(buildDocx([{ t: "table", colPx: [400, 400], rows: [[cell("x"), cell("y")]] }], A4, ff.zipSync))["word/document.xml"]);
  assert.match(doc, /<w:gridCol w:w="4252"\/><w:gridCol w:w="4252"\/>/); // (11906-1701-1701)/2
});

test("같은 입력이면 같은 파일(시각 고정)", () => {
  assert.deepEqual(buildDocx(blocks, A4, ff.zipSync), buildDocx(blocks, A4, ff.zipSync));
});

test("XML 에 못 쓰는 글자는 지워요", () => {
  assert.equal(xmlText("a\u0000b\u0007c￾\uD800d😀\"<"), "abcd😀&quot;&lt;");
});

test("쪽 설정: HWPUNIT → twip, 위쪽 = 여백 + 머리말", () => {
  assert.deepEqual(pageSetupFromHwp({ width: 59528, height: 84188, marginLeft: 5669, marginRight: 5669, marginTop: 4251, marginBottom: 4251, marginHeader: 2834, marginFooter: 2834 }),
    { w: 11906, h: 16838, top: 1417, bottom: 1417, left: 1134, right: 1134, header: 850, footer: 850 });
  assert.equal(pageSetupFromHwp({ width: 59528, height: 84188, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, marginHeader: 0, marginFooter: 0, landscape: true }).w, 16838);
});

test("BMP 는 PNG 로 바꿔 넣어요(표 안까지), 못 바꾸면 그대로", async () => {
  const bmp = Uint8Array.from([0x42, 0x4d, 1, 2, 3]);
  const bs: Block[] = [{ t: "img", mime: "image/bmp", data: bmp, wPx: 10, hPx: 10 }, { t: "table", rows: [[{ colspan: 1, rowspan: 1, blocks: [{ t: "img", mime: "image/bmp", data: bmp, wPx: 1, hPx: 1 }] }]] }];
  assert.equal(await normalizeImages(bs, async () => PNG1), 2);
  assert.ok(Object.keys(ff.unzipSync(buildDocx(bs, A4, ff.zipSync))).every((k) => !k.endsWith(".bmp")));
  const keep: Block[] = [{ t: "img", mime: "image/bmp", data: bmp, wPx: 1, hPx: 1 }];
  assert.equal(await normalizeImages(keep, async () => null), 0);
  assert.ok("word/media/image1.bmp" in ff.unzipSync(buildDocx(keep, A4, ff.zipSync)));
});

test("각주·미주: 본문 자리에 참조, footnotes·endnotes 부품, 구분선 자리와 설정, 미주 번호는 1·2·3", () => {
  const fn: Note = { kind: "fn", n: 1, paras: ["각주 <글>", "둘째 문단"] };
  const en: Note = { kind: "en", n: 1, paras: ["미주"] };
  const bs: Block[] = [{ t: "p", runs: [{ text: "앞" }, { text: "", note: fn }, { text: "뒤" }, { text: "", note: en }] }];
  const files = ff.unzipSync(buildDocx(bs, A4, ff.zipSync));
  assert.deepEqual(Object.keys(files), ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "word/footnotes.xml", "word/endnotes.xml", "word/settings.xml"]);
  const doc = dec.decode(files["word/document.xml"]);
  assert.match(doc, /<w:t xml:space="preserve">앞<\/w:t><\/w:r><w:r><w:rPr><w:vertAlign w:val="superscript"\/><\/w:rPr><w:footnoteReference w:id="1"\/><\/w:r><w:r><w:t xml:space="preserve">뒤<\/w:t><\/w:r><w:r><w:rPr><w:vertAlign w:val="superscript"\/><\/w:rPr><w:endnoteReference w:id="1"\/><\/w:r>/);
  assert.match(doc, /<w:sectPr><w:endnotePr><w:numFmt w:val="decimal"\/><\/w:endnotePr><w:pgSz/);
  const fx = dec.decode(files["word/footnotes.xml"]);
  assert.match(fx, /<w:footnote w:type="separator" w:id="-1">[\s\S]*<w:separator\/>[\s\S]*<w:footnote w:type="continuationSeparator" w:id="0">/);
  assert.match(fx, /<w:footnote w:id="1"><w:p><w:pPr><w:spacing w:after="0"\/><\/w:pPr><w:r><w:rPr><w:vertAlign w:val="superscript"\/><\/w:rPr><w:footnoteRef\/><\/w:r>.*각주 &lt;글&gt;.*<\/w:p><w:p>.*둘째 문단.*<\/w:p><\/w:footnote>/);
  assert.match(dec.decode(files["word/endnotes.xml"]), /<w:endnote w:id="1">.*<w:endnoteRef\/>.*미주/);
  const st = dec.decode(files["word/settings.xml"]);
  assert.match(st, /<w:footnotePr><w:footnote w:id="-1"\/><w:footnote w:id="0"\/><\/w:footnotePr><w:endnotePr><w:numFmt w:val="decimal"\/><w:endnote w:id="-1"\/><w:endnote w:id="0"\/><\/w:endnotePr>/);
  assert.ok(!st.includes("evenAndOddHeaders"));
  const ct = dec.decode(files["[Content_Types].xml"]), rels = dec.decode(files["word/_rels/document.xml.rels"]);
  for (const part of ["footnotes", "endnotes", "settings"]) {
    assert.match(ct, new RegExp(`PartName="/word/${part}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${part}\\+xml"`));
    assert.match(rels, new RegExp(`relationships/${part}" Target="${part}.xml"`));
  }
});

test("머리글·바닥글: 양 쪽 → 기본, 홀수·짝수 → 기본·짝수(+짝수/홀수 다르게)", () => {
  const P = (t: string) => [{ t: "p" as const, runs: [{ text: t }], align: "center" as const }];
  const both: HeaderFooter[] = [{ kind: "header", applyTo: 0, paras: P("머리 <말>") }, { kind: "footer", applyTo: 0, paras: P("꼬리") }];
  const files = ff.unzipSync(buildDocx(blocks.slice(0, 1), A4, ff.zipSync, { hf: both }));
  assert.ok(!("word/settings.xml" in files));
  const doc = dec.decode(files["word/document.xml"]);
  assert.match(doc, /<w:sectPr><w:headerReference w:type="default" r:id="rIdHdr1"\/><w:footerReference w:type="default" r:id="rIdFtr1"\/><w:pgSz/);
  assert.match(dec.decode(files["word/header1.xml"]), /^<\?xml[^>]*\?>\n<w:hdr [^>]*><w:p><w:pPr><w:jc w:val="center"\/><\/w:pPr><w:r><w:t xml:space="preserve">머리 &lt;말&gt;<\/w:t><\/w:r><\/w:p><\/w:hdr>$/);
  assert.match(dec.decode(files["word/footer1.xml"]), /<w:ftr [^>]*>.*꼬리.*<\/w:ftr>$/);
  const rels = dec.decode(files["word/_rels/document.xml.rels"]);
  assert.match(rels, /Id="rIdHdr1" Type="http:\/\/schemas.openxmlformats.org\/officeDocument\/2006\/relationships\/header" Target="header1.xml"/);
  // 홀수·짝수 머리말 + 양 쪽 꼬리말 → 꼬리말도 짝수 쪽에 같이 둬요
  const s = wordHeaderSlots([{ kind: "header", applyTo: 1, paras: P("짝") }, { kind: "header", applyTo: 2, paras: P("홀") }, { kind: "footer", applyTo: 0, paras: P("꼬리") }]);
  assert.equal(s.evenAndOdd, true);
  assert.deepEqual(s.parts.map((p) => `${p.kind}:${p.type}:${p.paras[0].runs[0].text}`), ["header:default:홀", "header:even:짝", "footer:default:꼬리", "footer:even:꼬리"]);
  const f2 = ff.unzipSync(buildDocx(blocks.slice(0, 1), A4, ff.zipSync, { hf: [{ kind: "header", applyTo: 1, paras: P("짝") }, { kind: "header", applyTo: 2, paras: P("홀") }] }));
  assert.match(dec.decode(f2["word/settings.xml"]), /<w:evenAndOddHeaders\/>/);
  assert.match(dec.decode(f2["word/document.xml"]), /<w:headerReference w:type="default" r:id="rIdHdr1"\/><w:headerReference w:type="even" r:id="rIdHdr2"\/>/);
});
