// 내보내기 공용: 형식별 허용(5-2 정책) · rhwp HTML 읽기 · 표 격자 · 텍스트 · 파일 이름 (HWP_SPEC 12-14 + 각주·미주)
import { test } from "vitest";
import assert from "node:assert/strict";
import { parseRhwpHtml, lineHeight, tableGrid, blocksToText, exportRules, exportName, warnLines, sniffImage, dataUri, notesIn, type Table, type Para, type Warn, type Note } from "../src/hwp-export.js";
import { hwpPolicy, type HwpSniff } from "../src/hwp-lib.js";

const PNG1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const wrap = (s: string) => `<html><body>\n<!--StartFragment-->\n${s}\n<!--EndFragment-->\n</body></html>`;

test("문단·글자 모양·엔티티", () => {
  const b = parseRhwpHtml(wrap(`<p style="margin:0;text-align:center;text-indent:-30.9px;line-height:160%;">\n<span style="font-family:'HY헤드라인M';font-size:30.0pt;font-weight:bold;color:#4c4c4c;">보 도</span><span style="font-family:'바탕';font-size:10.0pt;color:#000000;font-style:italic;text-decoration:underline;">&lt;a&gt; &amp; &quot;b&quot;\tc</span></p>`));
  assert.equal(b.length, 1);
  const p = b[0] as Para;
  assert.equal(p.align, "center");
  assert.ok(Math.abs((p.indentPt ?? 0) + 23.175) < 0.01);
  assert.equal(p.linePct, 160); // line-height:160% → Word 줄 간격
  assert.deepEqual(p.runs[0], { text: "보 도", font: "HY헤드라인M", pt: 30, b: true, color: "4C4C4C" });
  assert.deepEqual(p.runs[1], { text: '<a> & "b"\tc', font: "바탕", pt: 10, i: true, u: true, color: "000000" });
});

test("태그 사이 줄바꿈은 버리고 글 속 공백은 지켜요", () => {
  const p = parseRhwpHtml(wrap(`<p>\n<span>  두 칸 들여쓰기</span></p>`))[0] as Para;
  assert.equal(p.runs.map((r) => r.text).join(""), "  두 칸 들여쓰기");
});

test("표: colspan·rowspan·칸 배경·테두리, 칸 안 그림", () => {
  const html = wrap(`<table style="border-collapse:collapse;">
<tr><td style="background-color:#342dbe;border-left:7.0px solid #1b1760;border-top:none;" rowspan="2"><p><span>A</span></p></td><td colspan="2"><img src="data:image/png;base64,${PNG1}" width="27" height="27" /></td></tr>
<tr><td><p><span>B</span></p></td><td><p><span>C</span></p></td></tr>
</table>`);
  const t = parseRhwpHtml(html)[0] as Table;
  assert.equal(t.t, "table");
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0][0].rowspan, 2);
  assert.equal(t.rows[0][0].fill, "342DBE");
  assert.deepEqual(t.rows[0][0].borders, { left: { sz: 24, color: "1B1760" }, top: null });
  assert.equal(t.rows[0][1].colspan, 2);
  assert.equal(t.rows[0][1].blocks[0].t, "img");
  const g = tableGrid(t);
  assert.equal(g.cols, 3);
  assert.deepEqual(g.rows[1].map((s) => [s.col, s.span, s.merge]), [[0, 1, "continue"], [1, 1, null], [2, 1, null]]);
  assert.equal(blocksToText([t]), "﻿A\t[그림]\r\n\tB\tC\r\n");
});

test("격자: 빈 자리·짧은 줄은 빈 칸으로 채워요", () => {
  const c = (s: string, colspan = 1, rowspan = 1) => ({ colspan, rowspan, blocks: [{ t: "p" as const, runs: [{ text: s }] }] });
  const t: Table = { t: "table", rows: [[c("a"), c("b", 1, 3), c("c")], [c("d")], [c("e"), c("f")], [c("g", 3)]] };
  const g = tableGrid(t);
  assert.equal(g.cols, 3);
  assert.deepEqual(g.rows.map((r) => r.map((s) => (s.cell ? (s.merge === "continue" ? "^" : (s.cell.blocks[0] as Para).runs[0].text) : "_")).join("")), ["abc", "d^_", "e^f", "g"]);
});

test("그림 형식은 바이트로 가려요(BMP·WMF 는 octet-stream 으로 와요)", () => {
  assert.equal(sniffImage(Uint8Array.from([0x42, 0x4d, 0, 0])), "image/bmp");
  assert.equal(sniffImage(Uint8Array.from([1, 0, 9, 0, 0, 3])), "image/x-wmf");
  assert.equal(sniffImage(Uint8Array.from([0, 1, 2])), null);
  assert.equal(dataUri(`data:application/octet-stream;base64,${PNG1}`)?.mime, "image/png");
  assert.equal(dataUri("https://example.com/a.png"), null);
  const w: Warn = {};
  assert.deepEqual(parseRhwpHtml(`<img src="https://evil.example/x.png" width="1" height="1">`, w), []);
  assert.equal(w.image, 1);
});

test("rhwp 경고 주석: 필드는 세지 않고 도형은 세요", () => {
  const w: Warn = {};
  parseRhwpHtml("<!-- rhwp: 셀 안 Field 컨트롤은 클립보드 HTML 내보내기 미지원 - 경고: 내용 생략됨 --><!-- rhwp: 셀 안 Shape 컨트롤은 클립보드 HTML 내보내기 미지원 - 경고: 내용 생략됨 -->", w);
  assert.deepEqual(w, { cellObject: 1 });
  assert.deepEqual(warnLines({ cellObject: 1, headerFooter: 2 }), ["머리말·꼬리말 2개는 옮기지 않았어요.", "표 안의 도형·수식 등 1개는 옮기지 못했어요."]);
});

test("텍스트만 뽑을 땐 그림을 풀지 않아요", () => {
  const b = parseRhwpHtml(`<img src="data:image/png;base64,${PNG1}" width="2" height="2">`, {}, { images: false });
  assert.equal(b[0].t === "img" && b[0].data.length, 0);
});

test("깨진·이상한 HTML 에서도 던지지 않아요", () => {
  for (const s of ["<table><tr><td><p>x", "</td></tr></table><p>y</p>", "<p><span>a</p></span>", "<", "<<>>", "<td>z</td>", "&#0; &#x110000; &bogus;"]) assert.doesNotThrow(() => blocksToText(parseRhwpHtml(s)));
});

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

test("텍스트: 각주·미주는 자리에 [각주 1] 표시, 끝에 내용(표 칸 안 것까지 차례로)", () => {
  const fn: Note = { kind: "fn", n: 1, paras: ["각주 글"] };
  const en: Note = { kind: "en", n: 1, paras: ["미주 첫 줄", "둘째 줄"] };
  const fn2: Note = { kind: "fn", n: 2, paras: [] };
  const blocks: (Para | Table)[] = [
    { t: "p", runs: [{ text: "본문" }, { text: "", note: fn }, { text: " 이어서" }] },
    { t: "table", rows: [[{ colspan: 1, rowspan: 1, blocks: [{ t: "p", runs: [{ text: "칸" }, { text: "", note: fn2 }] }] }]] },
    { t: "p", runs: [{ text: "끝", b: true }, { text: "", note: en }] },
  ];
  assert.deepEqual(notesIn(blocks), [fn, fn2, en]);
  assert.equal(blocksToText(blocks), "﻿본문[각주 1] 이어서\r\n칸[각주 2]\r\n끝[미주 1]\r\n\r\n[각주 1] 각주 글\r\n[각주 2]\r\n[미주 1] 미주 첫 줄 둘째 줄\r\n");
  // 각주 자리 뒤 글은 앞 글과 합치지 않아요(자리가 사라지지 않게)
  const p = parseRhwpHtml("<p><span>a</span></p>")[0] as Para;
  p.runs.push({ text: "", note: fn });
  assert.equal(p.runs.length, 2);
});

test("줄 간격 값 읽기: %·배수·고정(pt·px), 이상한 값은 버려요", () => {
  assert.deepEqual(lineHeight("160%"), { linePct: 160 });
  assert.deepEqual(lineHeight("1.5"), { linePct: 150 });
  assert.deepEqual(lineHeight("16.0pt"), { linePt: 16 });
  assert.deepEqual(lineHeight("20px"), { linePt: 15 });
  for (const v of ["normal", "", undefined, "0%", "5000%", "-1pt", "calc(1em)"]) assert.deepEqual(lineHeight(v), {}, String(v));
});
