// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 내보내기 공용(DOM 없음 — 워커·화면·시험 어디서나 돌아요): 형식별 허용, 블록 모델, rhwp HTML 읽기, 표 격자, 텍스트,
// 조각 모으기(본문·각주·미주·머리말·꼬리말), 안내 문구, 파일 이름. 설계: HWP_SPEC 12장(0장 사용자 결정 9번 포함).
import type { HwpPolicy, HwpSniff } from "./hwp-lib.js";
import { outName } from "./lib.js";

/* ───── 형식별 허용 (5-2 정책을 그대로 따라요) ───── */
export type ExportFormat = "pdf" | "docx" | "txt" | "png";
/** 화면 순서(많이 찾을 순서) */
export const EXPORT_FORMATS: readonly ExportFormat[] = ["pdf", "docx", "png", "txt"];
export interface ExportRule { ok: boolean; why: "print" | "copy" | "privacy" | "edit" | null }
/**
 * 그림 형식(pdf·png)은 인쇄 제한에서 막고, 글을 꺼내는 형식(docx·txt)은 복사 제한에서도 막아요.
 * Word 는 '고쳐 쓸 수 있는 문서'를 만드는 일이라, 편집을 막으려고 만든 배포용 문서는 제한 플래그가 없어도 막아요(convertToEditable 과 같은 결과라서).
 */
export function exportRules(p: HwpPolicy, s: Pick<HwpSniff, "distribution">): Record<ExportFormat, ExportRule> {
  const img: ExportRule = p.pdf === "blocked" ? { ok: false, why: p.reason } : { ok: true, why: null };
  const text: ExportRule = p.pdf === "ok" ? { ok: true, why: null } : { ok: false, why: p.reason };
  const docx: ExportRule = !text.ok ? text : s.distribution ? { ok: false, why: "edit" } : text;
  return { pdf: img, png: img, docx, txt: text };
}

/* ───── 블록 모델 ───── */
/** 각주·미주 하나. n 은 문서에 적힌 번호, paras 는 문단별 글(서식 없이) */
export interface Note { kind: "fn" | "en"; n: number; paras: string[] }
/** note 가 있으면 글 대신 각주·미주 참조 자리예요(text 는 빈 글) */
export interface Run { text: string; b?: true; i?: true; u?: true; s?: true; sup?: true; sub?: true; pt?: number; color?: string; font?: string; note?: Note }
export interface Para { t: "p"; runs: Run[]; align?: "left" | "center" | "right" | "both"; indentPt?: number; leftPt?: number }
export interface Img { t: "img"; mime: string; data: Uint8Array; wPx: number; hPx: number }
export type Side = "top" | "left" | "bottom" | "right";
export interface Border { sz: number; color: string } // sz = 1/8pt
export interface Cell { colspan: number; rowspan: number; blocks: Block[]; fill?: string; vAlign?: "top" | "center" | "bottom"; borders?: Partial<Record<Side, Border | null>> }
export interface Table { t: "table"; rows: Cell[][]; colPx?: number[] }
export type Block = Para | Img | Table;
/** 머리말·꼬리말 하나. applyTo: 0 양 쪽 · 1 짝수 쪽 · 2 홀수 쪽 (rhwp 0.8.7 실측) */
export interface HeaderFooter { kind: "header" | "footer"; applyTo: 0 | 1 | 2; paras: Para[] }
export interface DocModel { blocks: Block[]; hf: HeaderFooter[] }
/** 옮기지 못했거나 바꿔 옮긴 것 개수. 화면 안내(12-11)에 써요 */
export type WarnKind = "headerFooter" | "note" | "ole" | "cellObject" | "image" | "equation" | "shape" | "failed";
export type Warn = Partial<Record<WarnKind, number>>;
const bump = (w: Warn, k: WarnKind, n = 1) => { w[k] = (w[k] ?? 0) + n; };
/** rhwp 주석 "셀 안 X 컨트롤은 … 미지원 - 경고: 내용 생략됨" 중 글이 이미 들어 있는 것(필드·단 정의 등)은 세지 않아요 */
const HARMLESS_IN_CELL = /셀 안 (Field|ColumnDef|SectionDef|PageNumberPos|Bookmark|AutoNumber|NewNumber|PageHide|CharOverlap)\b/;

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function attrs(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const m of s.matchAll(/([^\s=\/]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) o[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  return o;
}
function css(style: string | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const d of (style ?? "").split(";")) { const i = d.indexOf(":"); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); }
  return o;
}
const toPt = (v: string | undefined): number | undefined => {
  const m = /^(-?[\d.]+)(pt|px)?$/.exec((v ?? "").trim()); if (!m) return undefined;
  const n = parseFloat(m[1]); return m[2] === "px" ? n * 0.75 : n;
};
const hex6 = (v: string | undefined): string | undefined => {
  const m = /^#([0-9a-f]{6})$/i.exec((v ?? "").trim()); return m ? m[1].toUpperCase() : undefined;
};
function runStyle(base: Omit<Run, "text">, st: Record<string, string>, tag: string): Omit<Run, "text"> {
  const r = { ...base };
  const fam = st["font-family"]?.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  if (fam) r.font = fam;
  const pt = toPt(st["font-size"]); if (pt && pt > 0) r.pt = Math.round(pt * 2) / 2;
  const fw = st["font-weight"]; if (fw === "bold" || (fw && parseInt(fw, 10) >= 600) || tag === "b" || tag === "strong") r.b = true;
  if (/italic|oblique/.test(st["font-style"] ?? "") || tag === "i" || tag === "em") r.i = true;
  const td = (st["text-decoration"] ?? "") + " " + (st["text-decoration-line"] ?? "");
  if (/underline/.test(td) || tag === "u") r.u = true;
  if (/line-through/.test(td) || tag === "s" || tag === "strike") r.s = true;
  const va = st["vertical-align"]; if (va === "super" || tag === "sup") r.sup = true; if (va === "sub" || tag === "sub") r.sub = true;
  const c = hex6(st["color"]); if (c) r.color = c;
  return r;
}
function borderOf(v: string | undefined): Border | null | undefined {
  if (v == null) return undefined;
  if (/\bnone\b|\bhidden\b/.test(v)) return null;
  const w = /([\d.]+)px/.exec(v); const px = w ? parseFloat(w[1]) : 1;
  if (!(px > 0)) return null;
  return { sz: Math.max(2, Math.min(24, Math.round(px * 6))), color: hex6(/#[0-9a-f]{6}/i.exec(v)?.[0]) ?? "000000" };
}
/** 그림 바이트의 앞부분으로 형식을 가려요. rhwp 는 BMP·WMF 를 application/octet-stream 으로 줘요(실측). */
export function sniffImage(d: Uint8Array): string | null {
  const at = (i: number, ...b: number[]) => b.every((x, k) => d[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x42, 0x4d)) return "image/bmp";
  if (at(0, 0xd7, 0xcd, 0xc6, 0x9a) || at(0, 0x01, 0x00, 0x09, 0x00) || at(0, 0x02, 0x00, 0x09, 0x00)) return "image/x-wmf";
  if (at(0, 0x01, 0x00, 0x00, 0x00) && at(40, 0x20, 0x45, 0x4d, 0x46)) return "image/x-emf";
  return null;
}
/** <img src="data:…;base64,…"> → 바이트와 형식(내용으로 다시 가려요). 다른 주소(http 등)는 받지 않아요. */
export function dataUri(src: string): { mime: string; data: Uint8Array } | null {
  const m = /^data:[a-z0-9.+\/-]*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(src.trim());
  if (!m) return null;
  let bin: string; try { bin = atob(m[1].replace(/\s+/g, "")); } catch { return null; }
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const mime = sniffImage(data);
  return mime ? { mime, data } : null;
}

/**
 * rhwp exportSelectionHtml / exportControlHtml 결과(<p>·<span>·<table>·<tr>·<td>·<img>·<br>·<a>)를 블록으로 바꿔요.
 * 우리가 아는 태그만 뜻을 읽고 나머지는 글만 남겨요. 링크 주소는 버려요. 주석에 "미지원·생략"이 있으면 warn.cellObject 를 세요.
 * HTML 은 화면 DOM 에 넣지 않아요(워커 안에서 정규식으로 읽기만 해요).
 */
export function parseRhwpHtml(html: string, warn: Warn = {}, opt: { images?: boolean } = {}): Block[] {
  const root: Block[] = [];
  const containers: Block[][] = [root];
  const tables: { table: Table; row: Cell[] | null }[] = [];
  const cells: Cell[] = [];
  let para: Para | null = null;
  let pStyle: Omit<Para, "t" | "runs"> = {};
  const styles: Omit<Run, "text">[] = [{}];
  const tagStack: string[] = [];
  const cur = () => containers[containers.length - 1];
  const flush = () => { if (para) { cur().push(para); para = null; } };
  const ensure = () => (para ??= { t: "p", runs: [], ...pStyle });
  const addText = (text: string) => {
    if (!text) return;
    const p = ensure(); const st = styles[styles.length - 1];
    const last = p.runs[p.runs.length - 1];
    if (last && !last.note && sameStyle(last, st)) last.text += text; else p.runs.push({ ...st, text });
  };
  const re = /<!--([\s\S]*?)-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)|</g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) { if (/미지원|생략/.test(m[1]) && !HARMLESS_IN_CELL.test(m[1])) bump(warn, "cellObject"); continue; }
    if (m[6] !== undefined || m[0] === "<") {
      const raw = m[6] ?? "<";
      if (/^[ \t\r\n]*$/.test(raw) && /[\r\n]/.test(raw)) continue; // 태그 사이 줄바꿈(꾸밈)은 버려요
      if (!para && /^\s*$/.test(raw)) continue;
      addText(decodeEntities(raw));
      continue;
    }
    const close = m[2] === "/", tag = m[3].toLowerCase(), a = close ? {} : attrs(m[4] ?? ""), selfClose = m[5] === "/" || tag === "br" || tag === "img";
    const st = css(a.style);
    if (tag === "p" || tag === "div") {
      flush();
      if (!close) {
        pStyle = {};
        const ta = st["text-align"]; if (ta === "center" || ta === "right" || ta === "left") pStyle.align = ta; else if (ta === "justify") pStyle.align = "both";
        const ind = toPt(st["text-indent"]); if (ind) pStyle.indentPt = ind;
        const ml = toPt(st["margin-left"]); if (ml && ml > 0) pStyle.leftPt = ml;
        ensure();
      } else pStyle = {};
      continue;
    }
    if (tag === "br") { addText("\n"); continue; }
    if (tag === "img") {
      if (close) continue;
      const img = opt.images === false ? { mime: "image/png", data: new Uint8Array(0) } : dataUri(a.src ?? ""); // 텍스트만 뽑을 땐 그림을 풀지 않아요
      if (!img) { bump(warn, "image"); continue; }
      const hadPara = !!para; flush();
      cur().push({ t: "img", ...img, wPx: Math.max(1, parseFloat(a.width) || 96), hPx: Math.max(1, parseFloat(a.height) || 96) });
      if (hadPara) ensure();
      continue;
    }
    if (tag === "table") {
      flush();
      if (!close) tables.push({ table: { t: "table", rows: [] }, row: null });
      else { const t = tables.pop(); if (t) { if (t.row?.length) t.table.rows.push(t.row); if (t.table.rows.length) cur().push(t.table); } }
      continue;
    }
    if (tag === "tr") {
      const t = tables[tables.length - 1]; if (!t) continue;
      if (t.row?.length) t.table.rows.push(t.row);
      t.row = close ? null : [];
      continue;
    }
    if (tag === "td" || tag === "th") {
      const t = tables[tables.length - 1]; if (!t) continue;
      if (!close) {
        flush();
        const c: Cell = { colspan: Math.max(1, Math.min(63, parseInt(a.colspan, 10) || 1)), rowspan: Math.max(1, Math.min(999, parseInt(a.rowspan, 10) || 1)), blocks: [] };
        const fill = hex6(st["background-color"] ?? st["background"]); if (fill && fill !== "FFFFFF") c.fill = fill;
        const va = st["vertical-align"]; if (va === "middle") c.vAlign = "center"; else if (va === "bottom") c.vAlign = "bottom";
        const b: Partial<Record<Side, Border | null>> = {};
        for (const s of ["top", "left", "bottom", "right"] as Side[]) { const v = borderOf(st["border-" + s] ?? st["border"]); if (v !== undefined) b[s] = v; }
        if (Object.keys(b).length) c.borders = b;
        t.row ??= [];
        t.row.push(c); cells.push(c); containers.push(c.blocks);
      } else if (cells.length && containers.length > 1) {
        flush(); cells.pop(); containers.pop();
      }
      continue;
    }
    // 글자 모양 태그(span·font·b·i·u·s·sup·sub·a·strong·em …): 열면 쌓고 닫으면 빼요
    if (selfClose) continue;
    if (!close) { styles.push(runStyle(styles[styles.length - 1], st, tag)); tagStack.push(tag); }
    else { const i = tagStack.lastIndexOf(tag); if (i >= 0) { tagStack.length = i; styles.length = i + 1; } }
  }
  flush();
  while (tables.length) { const t = tables.pop() as { table: Table; row: Cell[] | null }; if (t.row?.length) t.table.rows.push(t.row); if (t.table.rows.length) root.push(t.table); }
  return root;
}
function sameStyle(a: Omit<Run, "text">, b: Omit<Run, "text">): boolean {
  return a.b === b.b && a.i === b.i && a.u === b.u && a.s === b.s && a.sup === b.sup && a.sub === b.sub && a.pt === b.pt && a.color === b.color && a.font === b.font;
}

/* ───── 텍스트(.txt) ───── */
const noteLabel = (n: Note) => `[${n.kind === "fn" ? "각주" : "미주"} ${n.n}]`;
const paraText = (p: Para) => p.runs.map((r) => (r.note ? noteLabel(r.note) : r.text)).join("");
function cellText(c: Cell): string {
  return c.blocks.map((b) => (b.t === "p" ? paraText(b) : b.t === "img" ? "[그림]" : tableLines(b).join(" / "))).join(" ").replace(/[\t\r\n]+/g, " ").trim();
}
/** 표를 격자로 펼쳐요: 위 칸에서 내려온 병합 자리(continue)와 빈 자리(cell null)까지. Word(vMerge)와 텍스트가 같이 써요. */
export interface Slot { col: number; span: number; cell: Cell | null; merge: "restart" | "continue" | null }
export function tableGrid(t: Table): { cols: number; rows: Slot[][] } {
  const hold: ({ left: number; span: number; cell: Cell } | undefined)[] = [];
  const rows: Slot[][] = []; let cols = 0;
  for (const row of t.rows) {
    const slots: Slot[] = []; let col = 0, k = 0, guard = 0;
    while (guard++ < 10_000) {
      const h = hold[col];
      if (h && h.left > 0) { slots.push({ col, span: h.span, cell: h.cell, merge: "continue" }); h.left--; col += h.span; continue; }
      if (k < row.length) {
        const c = row[k++];
        slots.push({ col, span: c.colspan, cell: c, merge: c.rowspan > 1 ? "restart" : null });
        for (let j = 0; j < c.colspan; j++) hold[col + j] = undefined;
        if (c.rowspan > 1) hold[col] = { left: c.rowspan - 1, span: c.colspan, cell: c };
        col += c.colspan; continue;
      }
      const next = hold.findIndex((x, i) => i >= col && !!x && x.left > 0);
      if (next < 0) break;
      while (col < next) slots.push({ col: col++, span: 1, cell: null, merge: null });
    }
    rows.push(slots); cols = Math.max(cols, col);
  }
  if (t.colPx && t.colPx.length > cols) cols = t.colPx.length;
  for (const r of rows) { let c = r.length ? r[r.length - 1].col + r[r.length - 1].span : 0; while (c < cols) r.push({ col: c++, span: 1, cell: null, merge: null }); }
  return { cols, rows };
}
function tableLines(t: Table): string[] {
  return tableGrid(t).rows.map((r) => r.flatMap((s) => [s.cell && s.merge !== "continue" ? cellText(s.cell) : "", ...Array(s.span - 1).fill("")]).join("\t").replace(/\t+$/, ""));
}
/** 본문(표 칸 안까지)에 나온 순서대로 각주·미주 */
export function notesIn(blocks: Block[]): Note[] {
  const out: Note[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === "p") { for (const r of b.runs) if (r.note) out.push(r.note); }
      else if (b.t === "table") for (const row of b.rows) for (const c of row) walk(c.blocks);
    }
  };
  walk(blocks);
  return out;
}
/** 글자만: 문단은 줄, 표는 한 줄에 한 행(칸은 탭), 그림은 [그림], 각주·미주는 [각주 1] 자리 표시 + 끝에 내용. 윈도 메모장을 위해 BOM + CRLF. */
export function blocksToText(blocks: Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.t === "p") lines.push(paraText(b));
    else if (b.t === "img") lines.push("[그림]");
    else lines.push(...tableLines(b));
  }
  const notes = notesIn(blocks);
  if (notes.length) { lines.push(""); for (const n of notes) lines.push(`${noteLabel(n)} ${n.paras.join(" ").trim()}`.trimEnd()); }
  return "﻿" + lines.join("\n").replace(/\r?\n/g, "\r\n") + "\r\n";
}

/* ───── rhwp 문서에서 조각 모으기 (워커에서 불러요. 쓰는 API 는 모두 읽기 전용) ───── */
export interface RhwpReadDoc {
  getSectionCount(): number;
  getParagraphCount(sec: number): number;
  getParagraphLength(sec: number, para: number): number;
  getTextRange(sec: number, para: number, off: number, count: number): string;
  getControls(): string;
  exportSelectionHtml(sec: number, sp: number, so: number, ep: number, eo: number): string;
  exportControlHtml(sec: number, para: number, cellPath: string, ci: number): string;
  getTableCellBboxes(sec: number, para: number, ci: number): string;
  getEquationProperties(sec: number, para: number, ci: number, cell: number, cellPara: number): string;
  getCellParagraphCount(sec: number, para: number, ci: number, cell: number): number;
  getCellParagraphLength(sec: number, para: number, ci: number, cell: number, cellPara: number): number;
  getTextInCell(sec: number, para: number, ci: number, cell: number, cellPara: number, off: number, count: number): string;
  // 각주·미주·머리말·꼬리말(0장 결정 9번). 모두 조회만 해요.
  getControlTextPositions(sec: number, para: number): string;
  getFootnoteInfo(sec: number, para: number, ci: number): string;
  getHeaderFooterList(sec: number, isHeader: boolean, applyTo: number): string;
  getHeaderFooter(sec: number, isHeader: boolean, applyTo: number): string;
  getHeaderFooterParaInfo(sec: number, isHeader: boolean, applyTo: number, para: number): string;
  getParaPropertiesInHf(sec: number, isHeader: boolean, applyTo: number, para: number): string;
  getCharPropertiesInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, para: number, off: number): string;
}
interface Ctrl { ctrlId: string; userDesc: string; list: number; para: number; pos: number; controlIndex: number }
const plain = (text: string): Para => ({ t: "p", runs: text ? [{ text }] : [] });
function safeText(doc: RhwpReadDoc, s: number, p: number, len: number): string {
  try { return doc.getTextRange(s, p, 0, len); } catch { return ""; }
}
/** 글에 섞인 제어 문자(탭·줄바꿈 말고)는 지워요 */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
/** 표 칸 위치(px)로 열 너비를 구해요. 열 수와 안 맞으면 undefined(같은 너비로). */
export function colWidthsFromBboxes(json: string): number[] | undefined {
  try {
    const cells = JSON.parse(json) as { x: number; w: number; pageIndex?: number }[];
    if (!cells.length) return undefined;
    const pg = cells[0].pageIndex;
    const edges: number[] = [];
    for (const c of cells.filter((c) => c.pageIndex === pg)) for (const x of [c.x, c.x + c.w]) if (!edges.some((e) => Math.abs(e - x) < 0.75)) edges.push(x);
    edges.sort((a, b) => a - b);
    const w = edges.slice(1).map((e, i) => e - edges[i]);
    return w.length && w.every((x) => x > 0) ? w : undefined;
  } catch { return undefined; }
}
const ALIGN: Record<string, Para["align"]> = { justify: "both", distribute: "both", center: "center", right: "right", left: "left" };

/** 머리말·꼬리말: 같은 자리(종류·쪽)는 앞 구역 것 하나만 옮기고, 글이 다른 나머지는 세요. 글이 없는 것(쪽 번호 자리 등)은 건너뛰어요. */
function collectHeaderFooters(doc: RhwpReadDoc, warn: Warn, keep: boolean, ctrls: Ctrl[]): HeaderFooter[] {
  let items: { sectionIdx: number; isHeader: boolean; applyTo: number }[];
  try { items = (JSON.parse(doc.getHeaderFooterList(0, true, 0)) as { items?: typeof items }).items ?? []; }
  catch { bump(warn, "headerFooter", ctrls.filter((c) => c.ctrlId === "head" || c.ctrlId === "foot").length); return []; }
  const out: HeaderFooter[] = [];
  const seen = new Map<string, string>(); // 자리 → 글
  const counted = new Set<string>();
  for (const it of [...items].sort((a, b) => a.sectionIdx - b.sectionIdx)) {
    const applyTo = (it.applyTo === 1 || it.applyTo === 2 ? it.applyTo : 0) as 0 | 1 | 2;
    const paras: Para[] = [];
    try {
      const info = JSON.parse(doc.getHeaderFooter(it.sectionIdx, it.isHeader, it.applyTo)) as { exists?: boolean; paraCount?: number };
      if (!info.exists) continue;
      for (let k = 0; k < Math.min(200, info.paraCount ?? 0); k++) {
        const text = clean(String((JSON.parse(doc.getHeaderFooterParaInfo(it.sectionIdx, it.isHeader, it.applyTo, k)) as { text?: string }).text ?? ""));
        const p = plain(text);
        try { const al = ALIGN[String((JSON.parse(doc.getParaPropertiesInHf(it.sectionIdx, it.isHeader, it.applyTo, k)) as { alignment?: string }).alignment)]; if (al && al !== "left") p.align = al; } catch { /* 왼쪽 */ }
        // 글자 모양은 문단 첫 글자 것으로(글꼴·크기·굵게·기울임·밑줄). 색은 옮기지 않아요 — 어두운 상자 위 흰 글자가 Word 에선 안 보여서요(규격 문서 실측)
        if (p.runs[0]) try {
          const c = JSON.parse(doc.getCharPropertiesInHeaderFooter(it.sectionIdx, it.isHeader, it.applyTo, k, 0)) as { fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean; underline?: boolean };
          const r = p.runs[0];
          if (c.fontFamily) r.font = String(c.fontFamily);
          if (c.fontSize && c.fontSize > 0) r.pt = Math.round(c.fontSize / 50) / 2; // 1/100pt → 0.5pt 단위
          if (c.bold) r.b = true; if (c.italic) r.i = true; if (c.underline) r.u = true;
        } catch { /* 기본 글자 */ }
        paras.push(p);
      }
    } catch { bump(warn, "headerFooter"); continue; }
    const text = paras.map(paraText).join("\n");
    if (!text.trim()) continue;
    const slot = `${it.isHeader ? "h" : "f"}${applyTo}`;
    const key = slot + "\u0000" + text;
    if (!keep) { if (!counted.has(key)) { counted.add(key); bump(warn, "headerFooter"); } continue; }
    const had = seen.get(slot);
    if (had === undefined) { seen.set(slot, text); out.push({ kind: it.isHeader ? "header" : "footer", applyTo, paras }); }
    else if (had !== text && !counted.has(key)) { counted.add(key); bump(warn, "headerFooter"); } // 구역마다 글이 다른 머리말은 첫 것만
  }
  return out;
}

/**
 * 본문을 문단 순서대로: 문단 글(HTML, 각주·미주 자리 포함) → 그 문단의 표·그림·수식·글상자. 문단 하나가 실패해도 계속해요.
 * headerFooter: true 면 머리말·꼬리말을 모아요(Word). false 면 세기만 해요(텍스트).
 */
export function collectDocument(doc: RhwpReadDoc, warn: Warn = {}, opt: { images?: boolean; headerFooter?: boolean; onProgress?: (done: number, total: number) => void } = {}): DocModel {
  const out: Block[] = [];
  const secs = doc.getSectionCount();
  const counts = Array.from({ length: secs }, (_, s) => doc.getParagraphCount(s));
  const total = counts.reduce((a, b) => a + b, 0);
  const byPara = new Map<number, Ctrl[]>(); // 전체 문단 번호 → 본문 개체
  const notesBy = new Map<number, Ctrl[]>(); // 전체 문단 번호 → 각주·미주
  const all = JSON.parse(doc.getControls()) as Ctrl[];
  for (const c of all) {
    if (c.list !== 0) continue;
    if (c.ctrlId === "fn" || c.ctrlId === "en") { const a = notesBy.get(c.para) ?? []; a.push(c); notesBy.set(c.para, a); continue; }
    if (c.ctrlId === "tbl" || c.ctrlId === "gso" || c.ctrlId === "eqed") { const a = byPara.get(c.para) ?? []; a.push(c); byPara.set(c.para, a); }
  }
  const hf = collectHeaderFooters(doc, warn, opt.headerFooter === true, all);
  /** 문단 안 개체의 글 위치(논리 위치). 못 읽으면 null */
  const positions = (s: number, p: number): number[] | null => { try { const a = JSON.parse(doc.getControlTextPositions(s, p)); return Array.isArray(a) ? a as number[] : null; } catch { return null; } };
  const htmlRuns = (s: number, p: number, a: number, b: number, extra: Block[]): { runs: Run[]; style?: Omit<Para, "t" | "runs"> } => {
    const bs = parseRhwpHtml(doc.exportSelectionHtml(s, p, a, p, b), warn, opt);
    const runs: Run[] = []; let style: Omit<Para, "t" | "runs"> | undefined;
    for (const x of bs) {
      if (x.t === "p") { if (!style) { const { t: _t, runs: _r, ...rest } = x; style = rest; } runs.push(...x.runs); }
      else extra.push(x);
    }
    return { runs, style };
  };
  let g = 0;
  for (let s = 0; s < secs; s++) {
    for (let p = 0; p < counts[s]; p++, g++) {
      const ctrls = (byPara.get(g) ?? []).sort((a, b) => a.pos - b.pos);
      const noteCtrls = notesBy.get(g) ?? [];
      const len = doc.getParagraphLength(s, p);
      const tp = ctrls.length || noteCtrls.length ? positions(s, p) : null;
      let text: Block[] = len > 0 || !ctrls.length || noteCtrls.length ? [plain("")] : [];
      try {
        if (noteCtrls.length) {
          // 각주·미주 자리에서 글을 잘라 HTML 조각을 따로 받고, 사이에 참조 자리를 넣어요
          const extra: Block[] = [];
          const cuts = noteCtrls.map((c) => ({ c, off: Math.max(0, Math.min(len, tp?.[c.controlIndex] ?? len)) })).sort((a, b) => a.off - b.off || a.c.pos - b.c.pos);
          const para: Para = { t: "p", runs: [] };
          let at = 0, styled = false;
          const seg = (b: number) => {
            if (b <= at) return;
            const r = htmlRuns(s, p, at, b, extra);
            if (r.style && !styled) { Object.assign(para, r.style); styled = true; }
            para.runs.push(...r.runs); at = b;
          };
          for (const { c, off } of cuts) {
            seg(off);
            try {
              const info = JSON.parse(doc.getFootnoteInfo(s, p, c.controlIndex)) as { number?: number; texts?: string[] };
              const paras = (info.texts ?? []).map((t) => clean(String(t)).trim()).filter((t, i, a) => t || (i > 0 && i < a.length - 1));
              para.runs.push({ text: "", note: { kind: c.ctrlId === "en" ? "en" : "fn", n: Number(info.number) || 0, paras } });
            } catch { bump(warn, "note"); }
          }
          seg(len);
          text = [para, ...extra];
        } else if (len > 0) { const b = parseRhwpHtml(doc.exportSelectionHtml(s, p, 0, p, len), warn, opt); if (b.length) text = b; }
      } catch { bump(warn, "failed"); text = [plain(safeText(doc, s, p, len))]; } // HTML 이 안 되면 글만이라도
      const objs: Block[] = [];
      for (const c of ctrls) {
        try {
          if (c.ctrlId === "tbl") {
            const t = parseRhwpHtml(doc.exportControlHtml(s, p, "", c.controlIndex), warn, opt);
            let colPx: number[] | undefined; try { colPx = colWidthsFromBboxes(doc.getTableCellBboxes(s, p, c.controlIndex)); } catch { /* 같은 너비 */ }
            for (const b of t) { if (b.t === "table" && colPx) b.colPx = colPx; objs.push(b); }
          } else if (c.ctrlId === "eqed") {
            const script = String(JSON.parse(doc.getEquationProperties(s, p, c.controlIndex, -1, -1)).script ?? "").trim();
            objs.push(plain(`[수식] ${script}`)); bump(warn, "equation");
          } else if (c.userDesc === "그림") {
            const b = parseRhwpHtml(doc.exportControlHtml(s, p, "", c.controlIndex), warn, opt); objs.push(...b);
          } else if (c.userDesc === "OLE") {
            bump(warn, "ole");
          } else {
            // 글상자(사각형·타원 등 안의 글): 글만 옮겨요. 선·곡선처럼 글이 없으면 그냥 넘어가요.
            const n = doc.getCellParagraphCount(s, p, c.controlIndex, 0); let any = false;
            for (let k = 0; k < n; k++) {
              const t = doc.getTextInCell(s, p, c.controlIndex, 0, k, 0, doc.getCellParagraphLength(s, p, c.controlIndex, 0, k)).trim();
              if (t) { objs.push(plain(t)); any = true; }
            }
            if (any) bump(warn, "shape");
          }
        } catch { if (c.ctrlId !== "gso" || c.userDesc === "그림") bump(warn, "failed"); } // 선·곡선처럼 글 칸이 없는 도형은 오류가 정상
      }
      // 문단 글이 있고 개체가 모두 맨 앞(글 위치 0)이면 글 앞에 놓아요. 글 위치를 못 읽으면 rhwp 의 pos 로 봐요
      const before = ctrls.length > 0 && len > 0 && ctrls.every((c) => (tp ? tp[c.controlIndex] : c.pos) === 0);
      out.push(...(before ? [...objs, ...text] : [...text, ...objs]));
      if (opt.onProgress && (g & 31) === 0) opt.onProgress(g, total);
    }
  }
  return { blocks: out, hf };
}
/** 본문 블록만(머리말·꼬리말은 세기만) */
export function collectBlocks(doc: RhwpReadDoc, warn: Warn = {}, opt: { images?: boolean; onProgress?: (done: number, total: number) => void } = {}): Block[] {
  return collectDocument(doc, warn, { ...opt, headerFooter: false }).blocks;
}

/* ───── 안내 문구 (12-4-4 원문) ───── */
const WARN_TEXT: [WarnKind, (n: number) => string][] = [
  ["headerFooter", (n) => `머리말·꼬리말 ${n}개는 옮기지 않았어요.`],
  ["note", (n) => `각주·미주 ${n}개는 옮기지 않았어요.`],
  ["ole", (n) => `차트·OLE 개체 ${n}개는 옮기지 못했어요.`],
  ["cellObject", (n) => `표 안의 도형·수식 등 ${n}개는 옮기지 못했어요.`],
  ["image", (n) => `그림 ${n}개는 형식을 몰라 옮기지 못했어요.`],
  ["failed", (n) => `${n}곳은 글만 옮겼거나 옮기지 못했어요.`],
  ["equation", (n) => `수식 ${n}개는 수식 글(예: a over b)로 옮겼어요.`],
  ["shape", (n) => `글상자 ${n}개는 글만 옮겼어요.`],
];
export function warnLines(w: Warn): string[] {
  return WARN_TEXT.filter(([k]) => (w[k] ?? 0) > 0).map(([k, f]) => f(w[k] as number));
}

/* ───── 파일 이름 (lib.ts 의 outName·safeName·baseName 규칙 그대로) ───── */
const pad = (n: number, total: number) => String(n).padStart(String(total).length, "0");
/** PDF·Word·텍스트: 원래 이름.확장자 / 쪽 그림 한 장: 이름-3쪽.png / 여러 장: zip 안 이름-03쪽.png, zip 은 이름-쪽그림-12장.zip */
export function exportName(original: string, fmt: ExportFormat, o: { page?: number; pages?: number; count?: number } = {}): string {
  if (fmt === "png") return o.count && o.count > 1 ? outName(original, `쪽그림-${o.count}장`, "zip") : outName(original, `${pad(o.page ?? 1, o.pages ?? 1)}쪽`, "png");
  return outName(original, "", fmt);
}
