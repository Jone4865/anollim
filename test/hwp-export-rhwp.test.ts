// rhwp 0.8.7 로 연 합성 문서 → 텍스트·Word (Node, 브라우저 없이). public/vendor 의 고정 파일을 그대로 써요.
import fs from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import { collectBlocks, collectDocument, blocksToText, type Warn } from "../src/hwp-export.js";
import { buildDocx, pageSetupFromHwp, type ZipSync } from "../src/hwp-docx.js";
const rhwp: any = await import(/* @vite-ignore */ new URL("../public/vendor/rhwp-0.8.7/rhwp.js", import.meta.url).href);
await rhwp.default({ module_or_path: fs.readFileSync("public/vendor/rhwp-0.8.7/rhwp_bg.wasm") });
const ff: { zipSync: ZipSync; unzipSync(d: Uint8Array): Record<string, Uint8Array> } = await import(/* @vite-ignore */ new URL("../public/vendor/fflate-0.8.2.mjs", import.meta.url).href);
const rd = (f: string) => new Uint8Array(fs.readFileSync("test/fixtures/hwp/" + f));
const dec = new TextDecoder();

test("합성 HWP·HWPX → 텍스트·Word: 글·표·그림이 다 옮겨져요", () => {
  for (const f of ["synthetic.hwp", "synthetic.hwpx"]) {
    const d = new rhwp.HwpDocument(rd(f));
    const warn: Warn = {};
    const blocks = collectBlocks(d, warn);
    const txt = blocksToText(blocks);
    assert.ok(txt.startsWith("﻿") && txt.endsWith("\r\n"));
    assert.match(txt, /집문서 시험 문서예요\. 가나다라마바사 ABC /);
    assert.match(txt, /칸1/);
    assert.match(txt, /\[그림\]/);
    assert.equal(blocks.filter((b) => b.t === "table").length, 1);
    const files = ff.unzipSync(buildDocx(blocks, pageSetupFromHwp(JSON.parse(d.getPageDef(0))), ff.zipSync));
    const xml = dec.decode(files["word/document.xml"]);
    assert.match(xml, /집문서 시험 문서예요/);
    assert.match(xml, /칸1/);
    assert.equal((xml.match(/<w:tr>/g) || []).length, 2);
    assert.ok(Object.keys(files).some((k) => k.startsWith("word/media/image1.")));
    assert.deepEqual(warn, {});
    d.free();
  }
});

test("문서 글에 든 꺾쇠·따옴표는 글로 남고 태그가 되지 않아요", () => {
  const d = rhwp.HwpDocument.createEmpty(); d.createBlankDocument(); // 시험용 편집 API(서비스에서는 안 씀)
  d.insertText(0, 0, 0, `<script>alert(1)</script> & "q" 'a'`);
  const txt = blocksToText(collectBlocks(d));
  assert.equal(txt, `﻿<script>alert(1)</script> & "q" 'a'\r\n`);
  const xml = dec.decode(ff.unzipSync(buildDocx(collectBlocks(d), pageSetupFromHwp(JSON.parse(d.getPageDef(0))), ff.zipSync))["word/document.xml"]);
  assert.match(xml, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;q&quot; 'a'/);
});

test("머리말·꼬리말·각주·미주: Word 로 옮기고, 텍스트엔 각주·미주만(머리말은 세기만)", () => {
  for (const f of ["synthetic-notes.hwp", "synthetic-notes.hwpx"]) {
    const d = new rhwp.HwpDocument(rd(f));
    const warn: Warn = {};
    const m = collectDocument(d, warn, { headerFooter: true });
    assert.deepEqual(warn, {}, f);
    assert.deepEqual(m.hf.map((x) => `${x.kind}:${x.applyTo}:${x.paras.map((p) => p.runs.map((r) => r.text).join("")).join("|")}`), ["header:0:집문서 머리말 <시험>", "footer:0:집문서 꼬리말"]);
    const files = ff.unzipSync(buildDocx(m.blocks, pageSetupFromHwp(JSON.parse(d.getPageDef(0))), ff.zipSync, { hf: m.hf }));
    const xml = dec.decode(files["word/document.xml"]);
    // 각주는 글 12자 뒤("각주가 붙는 문장이에요" 다음) 자리에, 뒤 글은 그대로 이어져요
    assert.match(xml, /각주가 붙는 문장이에요<\/w:t><\/w:r><w:r><w:rPr><w:vertAlign w:val="superscript"\/><\/w:rPr><w:footnoteReference w:id="1"\/><\/w:r><w:r>(<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve">\. 뒤 글도 있어요\./);
    assert.match(xml, /미주가<\/w:t><\/w:r><w:r><w:rPr><w:vertAlign w:val="superscript"\/><\/w:rPr><w:endnoteReference w:id="1"\/>/);
    assert.match(dec.decode(files["word/footnotes.xml"]), /각주 내용 &amp; &lt;꺾쇠&gt;/);
    assert.match(dec.decode(files["word/endnotes.xml"]), /미주 내용/);
    assert.match(dec.decode(files["word/header1.xml"]), /집문서 머리말 &lt;시험&gt;/);
    assert.match(dec.decode(files["word/footer1.xml"]), /집문서 꼬리말/);
    // 텍스트: 각주·미주는 자리 표시 + 끝에 내용, 머리말·꼬리말은 안내에만
    const tw: Warn = {};
    const txt = blocksToText(collectBlocks(d, tw, { images: false }));
    assert.equal(txt, "﻿각주가 붙는 문장이에요[각주 1]. 뒤 글도 있어요.\r\n미주가[미주 1] 붙는 둘째 문단\r\n\r\n[각주 1] 각주 내용 & <꺾쇠>\r\n[미주 1] 미주 내용\r\n");
    assert.deepEqual(tw, { headerFooter: 2 });
    d.free();
  }
});

test("한컴 전용 영역 글자(PUA): 본문·머리말·각주를 화면과 같은 글자로 옮기고, 못 바꾼 것은 세요", async () => {
  const { puaFixer } = await import("../src/hwp-pua.js");
  const d = rhwp.HwpDocument.createEmpty(); d.createBlankDocument(); // 시험용 편집 API(서비스에서는 안 씀)
  // rhwp 공개 시험 파일(HWP5-nopassword)의 문장 + 한컴 규격 문서의 옛한글 '\u1112\u119E\u11AB글'(U+F53A) + 표에 없는 PUA 하나
  d.insertText(0, 0, 0, "커서를 놓고 \u{F03A0}를 누르면 \uF53A글 \u{F0123}");
  d.createHeaderFooter(0, true, 0);
  d.insertTextInHeaderFooter(0, true, 0, 0, 0, "\u{F03EF}\u{F03F0}\u{F03F1}\u{F03F2}\u{F03F3}\u{F03F4}");
  const fn = JSON.parse(d.insertFootnote(0, 0, 3));
  d.insertTextInFootnote(0, 0, fn.controlIdx, 0, 0, "각주 \u{F0854}책\u{F0855}");
  const warn: Warn = {};
  const m = collectDocument(d, warn, { headerFooter: true, fixText: puaFixer(warn) });
  assert.equal(warn.pua, 1);
  const txt = blocksToText(m.blocks);
  assert.match(txt, /커서를\[각주 1\] 놓고 ↵를 누르면 \u1112\u119E\u11AB글 \u{F0123}/u);
  assert.match(txt, /\[각주 1\] 각주 《책》/);
  assert.doesNotMatch(txt, /\u{F03A0}|\uF53A|\u{F0854}/u);
  const files = ff.unzipSync(buildDocx(m.blocks, pageSetupFromHwp(JSON.parse(d.getPageDef(0))), ff.zipSync, { hf: m.hf }));
  const xml = dec.decode(files["word/document.xml"]);
  assert.match(xml, /↵를 누르면 \u1112\u119E\u11AB글/);
  assert.doesNotMatch(xml, /\u{F03A0}/u);
  assert.match(dec.decode(files["word/header1.xml"]), /한글과컴퓨터/);
  assert.match(dec.decode(files["word/footnotes.xml"]), /각주 《책》/);
  // fixText 를 안 넣으면 예전처럼 그대로예요(화면·시험 코드가 따로 부를 때)
  const raw = blocksToText(collectBlocks(d));
  assert.match(raw, /\u{F03A0}/u);
  d.free();
});
