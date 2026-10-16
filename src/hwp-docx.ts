// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 블록 모델 → Word(.docx). OOXML(ECMA-376) 부품을 직접 써요: [Content_Types].xml · _rels/.rels · word/document.xml
// · word/styles.xml · word/_rels/document.xml.rels · word/settings.xml · (있을 때만) footnotes.xml · endnotes.xml · header*.xml · footer*.xml · media/*.
// 압축은 집문서에 이미 있는 fflate(zipSync)를 받아 써요. docx 패키지를 쓰지 않은 이유는 HWP_SPEC 12-4-5.
// 글·표·그림 우선, 서식은 근사(글꼴 이름·크기·굵게·기울임·밑줄·취소선·색·위/아래 첨자·정렬·들여쓰기·칸 병합·칸 테두리·칸 배경).
// 머리말·꼬리말은 Word 머리글·바닥글로, 각주·미주는 Word 각주·미주로(글만, 0장 결정 9번).
import { type Block, type Cell, type HeaderFooter, type Img, type Para, type Run, type Table, tableGrid } from "./hwp-export.js";

type Lv = 0 | 6;
/** fflate 0.8.2 zipSync 중 쓰는 모양만 */
export type ZipSync = (files: Record<string, Uint8Array | [Uint8Array, { level: Lv }]>, opts: { level: Lv; mtime: Date }) => Uint8Array;
/** 쪽 크기·여백(twip = 1/1440인치) */
export interface PageSetup { w: number; h: number; top: number; bottom: number; left: number; right: number; header: number; footer: number }
/** rhwp getPageDef(HWPUNIT = 1/7200인치) → twip. HWP 본문 위치는 위쪽 여백 + 머리말이라 Word 위쪽 여백에 둘을 더해요. */
export function pageSetupFromHwp(d: { width: number; height: number; marginLeft: number; marginRight: number; marginTop: number; marginBottom: number; marginHeader: number; marginFooter: number; landscape?: boolean }): PageSetup {
  const tw = (u: number) => Math.max(0, Math.round(u / 5));
  let w = tw(d.width), h = tw(d.height);
  if (d.landscape && w < h) [w, h] = [h, w]; // 가로 방향인데 세로 값이면 돌려요(rhwp 값의 뜻 미확인 → 이렇게 막아요)
  return { w, h, top: tw(d.marginTop + d.marginHeader), bottom: tw(d.marginBottom + d.marginFooter), left: tw(d.marginLeft), right: tw(d.marginRight), header: tw(d.marginTop), footer: tw(d.marginBottom) };
}
export const A4: PageSetup = { w: 11906, h: 16838, top: 1984, bottom: 1701, left: 1701, right: 1701, header: 850, footer: 850 };

/** XML 1.0 에 못 쓰는 글자(제어 문자·짝 없는 서로게이트·U+FFFE/FFFF)는 지우고 & < > " 는 바꿔요 */
export function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const enc = new TextEncoder();
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const NS = `${W_NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.";
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif", "image/bmp": "bmp", "image/x-wmf": "wmf", "image/x-emf": "emf" };
const PACKED = new Set(["image/png", "image/jpeg", "image/gif"]); // 이미 압축된 형식은 다시 압축하지 않아요
const DEFAULT_FONT = "맑은 고딕";
const NOTE_SZ = 18; // 각주·미주 글 9pt(반 포인트)

/**
 * BMP 는 PNG 로 바꿔요(실측: macOS Quick Look 이 docx 안 BMP 를 못 그렸고, PNG 로 바꾸니 그려졌어요).
 * 파일은 조금 커져요(문체부 2011 HWP: BMP 를 deflate 로 넣으면 379KB, PNG 로 바꾸면 약 487KB) — 다른 프로그램에서 보이는 게 먼저예요.
 * 바꾸는 함수는 워커가 넣어 줘요(OffscreenCanvas). 못 바꾸면 BMP 그대로 둬요(Word 는 BMP 를 보여 줘요). WMF·EMF 는 브라우저가 못 풀어서 그대로.
 */
export async function normalizeImages(blocks: Block[], toPng: (data: Uint8Array, mime: string) => Promise<Uint8Array | null>): Promise<number> {
  let n = 0;
  const walk = async (bs: Block[]): Promise<void> => {
    for (const b of bs) {
      if (b.t === "img" && b.mime === "image/bmp") { const png = await toPng(b.data, b.mime); if (png && png.length) { b.data = png; b.mime = "image/png"; n++; } }
      else if (b.t === "table") for (const row of b.rows) for (const c of row) await walk(c.blocks);
    }
  };
  await walk(blocks);
  return n;
}

/** Word 머리글·바닥글 자리. 홀수 쪽 것이 있으면 기본으로, 짝수 쪽 것이 있으면 짝수 쪽으로(그때는 Word 의 '짝수/홀수 다르게'를 켜요) */
export function wordHeaderSlots(hf: HeaderFooter[]): { evenAndOdd: boolean; parts: { kind: "header" | "footer"; type: "default" | "even"; paras: Para[] }[] } {
  const parts: { kind: "header" | "footer"; type: "default" | "even"; paras: Para[] }[] = [];
  const pick = (kind: "header" | "footer", a: 0 | 1 | 2) => hf.find((x) => x.kind === kind && x.applyTo === a)?.paras;
  const slots = (["header", "footer"] as const).map((kind) => {
    const both = pick(kind, 0), even = pick(kind, 1), odd = pick(kind, 2);
    return { kind, def: odd ?? both, even: even ?? (odd && both ? both : undefined) };
  });
  const evenAndOdd = slots.some((s) => s.even);
  for (const s of slots) {
    if (s.def) parts.push({ kind: s.kind, type: "default", paras: s.def });
    // '짝수/홀수 다르게'는 문서 전체에 걸려서, 짝수 쪽 것이 없는 종류는 기본 것을 짝수 쪽에도 같이 둬요(안 그러면 짝수 쪽이 비어요)
    const ev = s.even ?? (evenAndOdd ? s.def : undefined);
    if (ev) parts.push({ kind: s.kind, type: "even", paras: ev });
  }
  return { evenAndOdd, parts };
}

export function buildDocx(blocks: Block[], page: PageSetup, zipSync: ZipSync, opts: { mtime?: Date; hf?: HeaderFooter[] } = {}): Uint8Array {
  const media: Record<string, [Uint8Array, { level: Lv }]> = {};
  const rels: string[] = [`<Relationship Id="rIdStyles" Type="${REL}styles" Target="styles.xml"/>`];
  const overrides: string[] = [];
  const parts: Record<string, Uint8Array> = {};
  let pic = 0;
  const textW = Math.max(1440, page.w - page.left - page.right);
  const footnotes: string[] = [], endnotes: string[] = [];

  const rPr = (r: Run): string => {
    let x = "";
    if (r.font) { const f = xmlText(r.font); x += `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`; }
    if (r.b) x += "<w:b/><w:bCs/>";
    if (r.i) x += "<w:i/><w:iCs/>";
    if (r.s) x += "<w:strike/>";
    if (r.color && r.color !== "000000") x += `<w:color w:val="${r.color}"/>`;
    if (r.pt) { const hp = Math.max(2, Math.min(3276, Math.round(r.pt * 2))); x += `<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`; }
    if (r.u) x += '<w:u w:val="single"/>';
    if (r.sup) x += '<w:vertAlign w:val="superscript"/>'; else if (r.sub) x += '<w:vertAlign w:val="subscript"/>';
    return x ? `<w:rPr>${x}</w:rPr>` : "";
  };
  const textRun = (text: string, pr: string): string => {
    let body = "";
    for (const p of text.split(/(\t|\n)/)) body += p === "\t" ? "<w:tab/>" : p === "\n" ? "<w:br/>" : p ? `<w:t xml:space="preserve">${xmlText(p)}</w:t>` : "";
    return body ? `<w:r>${pr}${body}</w:r>` : "";
  };
  /** 각주·미주 내용(글만). Word 번호는 1부터 차례로(-1·0 은 구분선 자리) */
  const noteRef = (r: Run): string => {
    const n = r.note; if (!n) return "";
    const fn = n.kind === "fn", list = fn ? footnotes : endnotes, id = list.length + 1, tag = fn ? "footnote" : "endnote";
    const paras = n.paras.length ? n.paras : [""];
    const sz = `<w:rPr><w:sz w:val="${NOTE_SZ}"/><w:szCs w:val="${NOTE_SZ}"/></w:rPr>`;
    list.push(`<w:${tag} w:id="${id}">` + paras.map((t, i) =>
      `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${i === 0 ? `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:${tag}Ref/></w:r>` + textRun(" ", sz) : ""}${textRun(t, sz)}</w:p>`).join("") + `</w:${tag}>`);
    return `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:${tag}Reference w:id="${id}"/></w:r>`;
  };
  const run = (r: Run): string => (r.note ? noteRef(r) : textRun(r.text, rPr(r)));
  const para = (p: Para): string => {
    let pp = "";
    const ind = p.indentPt ? Math.round(p.indentPt * 20) : 0;
    // HWP 내어쓰기(음수)는 첫 줄이 왼쪽 여백에 있고 다음 줄부터 들어가요. rhwp HTML 은 text-indent 음수만 줘서 Word 에선 왼쪽을 그만큼 더해요.
    const left = (p.leftPt ? Math.round(p.leftPt * 20) : 0) + (ind < 0 ? -ind : 0);
    if (left || ind) pp += `<w:ind${left ? ` w:left="${left}"` : ""}${ind > 0 ? ` w:firstLine="${ind}"` : ind < 0 ? ` w:hanging="${-ind}"` : ""}/>`;
    if (p.align && p.align !== "left") pp += `<w:jc w:val="${p.align}"/>`;
    return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ""}${p.runs.map(run).join("")}</w:p>`;
  };
  const image = (im: Img, maxTw: number): string => {
    const ext = EXT[im.mime]; if (!ext) return "<w:p/>";
    pic++;
    const name = `image${pic}.${ext}`; media[`word/media/${name}`] = [im.data, { level: PACKED.has(im.mime) ? 0 : 6 }]; // BMP·WMF·EMF 는 압축하면 많이 줄어요
    rels.push(`<Relationship Id="rIdImg${pic}" Type="${REL}image" Target="media/${name}"/>`);
    let wTw = im.wPx * 15, hTw = im.hPx * 15; // 96dpi px → twip
    if (wTw > maxTw) { hTw = hTw * maxTw / wTw; wTw = maxTw; }
    const cx = Math.max(1, Math.round(wTw * 635)), cy = Math.max(1, Math.round(hTw * 635)); // twip → EMU
    return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${pic}" name="그림 ${pic}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${pic}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${pic}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };
  const border = (side: string, b: { sz: number; color: string } | null | undefined): string =>
    b === undefined ? "" : b === null ? `<w:${side} w:val="nil"/>` : `<w:${side} w:val="single" w:sz="${b.sz}" w:space="0" w:color="${b.color}"/>`;
  const cellXml = (cell: Cell | null, span: number, merge: "restart" | "continue" | null, wTw: number): string => {
    let pr = `<w:tcW w:w="${Math.round(wTw)}" w:type="dxa"/>`;
    if (span > 1) pr += `<w:gridSpan w:val="${span}"/>`;
    if (merge) pr += merge === "restart" ? '<w:vMerge w:val="restart"/>' : "<w:vMerge/>";
    const bd = cell?.borders;
    if (bd) { const x = border("top", bd.top) + border("left", bd.left) + border("bottom", bd.bottom) + border("right", bd.right); if (x) pr += `<w:tcBorders>${x}</w:tcBorders>`; }
    if (cell?.fill) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${cell.fill}"/>`;
    if (cell?.vAlign) pr += `<w:vAlign w:val="${cell.vAlign}"/>`;
    let body = merge === "continue" || !cell ? "" : blocksXml(cell.blocks, Math.max(360, wTw - 216));
    if (!body.endsWith("</w:p>") && !body.endsWith("<w:p/>")) body += "<w:p/>"; // 칸은 문단으로 끝나야 해요
    return `<w:tc><w:tcPr>${pr}</w:tcPr>${body}</w:tc>`;
  };
  const table = (t: Table, maxTw: number): string => {
    const g = tableGrid(t); if (!g.cols) return "";
    let cols = t.colPx && t.colPx.length === g.cols ? t.colPx.map((px) => px * 15) : Array(g.cols).fill(maxTw / g.cols);
    const sum = cols.reduce((a, b) => a + b, 0); if (sum > maxTw) cols = cols.map((c) => (c * maxTw) / sum);
    const grid = cols.map((c) => `<w:gridCol w:w="${Math.max(1, Math.round(c))}"/>`).join("");
    const rows = g.rows.map((r) => `<w:tr>${r.map((s) => cellXml(s.cell, s.span, s.merge, cols.slice(s.col, s.col + s.span).reduce((a, b) => a + b, 0))).join("")}</w:tr>`).join("");
    const b = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
    return `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(cols.reduce((a, c) => a + c, 0))}" w:type="dxa"/><w:tblBorders>${b}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
  };
  function blocksXml(bs: Block[], maxTw: number): string {
    let x = "";
    for (const b of bs) {
      if (b.t === "p") x += para(b);
      else if (b.t === "img") x += image(b, maxTw);
      else { const tx = table(b, maxTw); if (tx) x += (x.endsWith("</w:tbl>") ? "<w:p/>" : "") + tx; } // 표 둘이 붙으면 Word 가 하나로 합쳐서 사이에 빈 문단
    }
    return x;
  }

  let body = blocksXml(blocks, textW);
  if (!body.endsWith("</w:p>") && !body.endsWith("<w:p/>")) body += "<w:p/>";

  // 머리글·바닥글 (글만)
  const hs = wordHeaderSlots(opts.hf ?? []);
  let refs = "", nh = 0, nf = 0;
  for (const part of hs.parts) {
    const isH = part.kind === "header", n = isH ? ++nh : ++nf, file = `${part.kind}${n}.xml`, id = `rId${isH ? "Hdr" : "Ftr"}${n}`, root = isH ? "hdr" : "ftr";
    let x = part.paras.map(para).join(""); if (!x) x = "<w:p/>";
    parts[`word/${file}`] = enc.encode(`${XML}<w:${root} ${NS}>${x}</w:${root}>`);
    rels.push(`<Relationship Id="${id}" Type="${REL}${part.kind}" Target="${file}"/>`);
    overrides.push(`<Override PartName="/word/${file}" ContentType="${CT}${part.kind}+xml"/>`);
    refs += `<w:${part.kind}Reference w:type="${part.type}" r:id="${id}"/>`;
  }
  // 각주·미주: -1·0 은 Word 가 쓰는 구분선 자리예요(설정 파일에서 가리켜요)
  const sep = (tag: string) => `<w:${tag} w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:${tag}><w:${tag} w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:${tag}>`;
  for (const [list, tag] of [[footnotes, "footnote"], [endnotes, "endnote"]] as const) {
    if (!list.length) continue;
    parts[`word/${tag}s.xml`] = enc.encode(`${XML}<w:${tag}s ${NS}>${sep(tag)}${list.join("")}</w:${tag}s>`);
    rels.push(`<Relationship Id="rId${tag === "footnote" ? "Fn" : "En"}" Type="${REL}${tag}s" Target="${tag}s.xml"/>`);
    overrides.push(`<Override PartName="/word/${tag}s.xml" ContentType="${CT}${tag}s+xml"/>`);
  }
  // 미주 번호는 HWP 처럼 1, 2, 3(Word 기본은 i, ii, iii)
  const enPr = endnotes.length ? '<w:endnotePr><w:numFmt w:val="decimal"/></w:endnotePr>' : "";
  // settings 는 늘 넣어요: compatibilityMode 15 가 없으면 Word 가 Word 2007 문서로 보고 '호환 모드'로 열고,
  // 그 모드에선 표 테두리가 칸 여백(108twip)만큼 왼쪽 여백 밖으로 나가요. 순서는 CT_Settings(evenAndOddHeaders → footnotePr → endnotePr → compat).
  const s = (hs.evenAndOdd ? "<w:evenAndOddHeaders/>" : "")
    + (footnotes.length ? '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' : "")
    + (endnotes.length ? '<w:endnotePr><w:numFmt w:val="decimal"/><w:endnote w:id="-1"/><w:endnote w:id="0"/></w:endnotePr>' : "")
    + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>';
  parts["word/settings.xml"] = enc.encode(`${XML}<w:settings ${W_NS}>${s}</w:settings>`);
  rels.push(`<Relationship Id="rIdSettings" Type="${REL}settings" Target="settings.xml"/>`);
  overrides.push(`<Override PartName="/word/settings.xml" ContentType="${CT}settings+xml"/>`);

  const orient = page.w > page.h ? ' w:orient="landscape"' : "";
  const doc = `${XML}<w:document ${NS}><w:body>${body}<w:sectPr>${refs}${enPr}<w:pgSz w:w="${page.w}" w:h="${page.h}"${orient}/><w:pgMar w:top="${page.top}" w:right="${page.right}" w:bottom="${page.bottom}" w:left="${page.left}" w:header="${page.header}" w:footer="${page.footer}" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `${XML}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${DEFAULT_FONT}" w:hAnsi="${DEFAULT_FONT}" w:eastAsia="${DEFAULT_FONT}" w:cs="${DEFAULT_FONT}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const types = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Default Extension="wmf" ContentType="image/x-wmf"/><Default Extension="emf" ContentType="image/x-emf"/><Override PartName="/word/document.xml" ContentType="${CT}document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${CT}styles+xml"/>${overrides.join("")}</Types>`;
  const rootRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`;
  // [Content_Types].xml 을 맨 앞에. XML·BMP·WMF·EMF 는 압축(6), PNG·JPEG·GIF 는 그대로(0). 시각은 1980-01-01 로 고정(같은 입력 → 같은 파일, 만든 시각을 남기지 않음).
  // 작성자·회사·만든 시각(docProps)은 넣지 않아요.
  return zipSync({
    "[Content_Types].xml": enc.encode(types), "_rels/.rels": enc.encode(rootRels),
    "word/document.xml": enc.encode(doc), "word/styles.xml": enc.encode(styles), "word/_rels/document.xml.rels": enc.encode(docRels),
    ...parts,
    ...media,
  }, { level: 6, mtime: opts.mtime ?? new Date(1980, 0, 1) });
}
