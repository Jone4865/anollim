// 공통 UI 조각 + 라이브러리 로더
import { formatSize, kindOf, moveItem } from "./lib.js";

/* ───── DOM 도우미 ───── */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  up: `<svg viewBox="0 0 24 24" ${P}><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
  down: `<svg viewBox="0 0 24 24" ${P}><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  left: `<svg viewBox="0 0 24 24" ${P}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  right: `<svg viewBox="0 0 24 24" ${P}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${P}><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  rotL: `<svg viewBox="0 0 24 24" ${P}><path d="M4 4v5h5"/><path d="M4.5 13a8 8 0 1 0 2.3-6.2L4 9"/></svg>`,
  rotR: `<svg viewBox="0 0 24 24" ${P}><path d="M20 4v5h-5"/><path d="M19.5 13a8 8 0 1 1-2.3-6.2L20 9"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${P} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`,
  dl: `<svg viewBox="0 0 24 24" ${P}><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
  upload: `<svg class="drop-ico" viewBox="0 0 80 60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><g filter="url(#pencil)"><path d="M22 20 l26 -2 l8 8 l2 30 l-34 2 z" stroke-opacity=".55"/><path d="M18 24 l26 -2 l8 8 l2 28 l-34 2 z" fill="rgba(255,253,247,.12)"/><path d="M44 22 l1 8 l7 0"/><path d="M36 2 v24 M29 19 l7 7 l7 -7" stroke-width="3"/></g></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  back: `<svg viewBox="0 0 24 24" ${P} width="16" height="16"><path d="M15 6l-6 6 6 6"/></svg>`,
};
export const icon = (name) => h("span", { html: ICONS[name], style: "display:contents" });
export function iconBtn(name, label, onClick, extra = "") {
  return h("button", { type: "button", class: `icon-btn ${extra}`, title: label, "aria-label": label, html: ICONS[name], onclick: onClick });
}

/* ───── 토스트 ───── */
let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ───── 드롭존 ───── */
// accept: input accept 문자열, filter(file) → true 면 받음. compact 는 파일이 들어온 뒤 작게.
export function dropzone({ accept, multiple = true, title, sub, onFiles }) {
  const input = h("input", { type: "file", accept, multiple: multiple || null, tabindex: "-1", "aria-hidden": "true" });
  const el = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": title },
    h("span", { html: ICONS.upload, style: "display:contents" }),
    h("div", { class: "drop-title" }, title),
    h("div", { class: "drop-sub" }, sub),
    input);
  const pick = () => input.click();
  el.addEventListener("click", (e) => { if (e.target !== input) pick(); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  input.addEventListener("change", () => { const fs = [...input.files]; input.value = ""; if (fs.length) onFiles(fs); });
  let depth = 0;
  el.addEventListener("dragenter", (e) => { if (hasFiles(e)) { e.preventDefault(); depth++; el.classList.add("over"); } });
  el.addEventListener("dragover", (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
  el.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) el.classList.remove("over"); });
  el.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; el.classList.remove("over");
    const fs = [...e.dataTransfer.files];
    if (fs.length) onFiles(multiple ? fs : fs.slice(0, 1));
  });
  el.setCompact = (on, label) => {
    el.classList.toggle("compact", on);
    el.querySelector(".drop-title").textContent = on ? (label || "파일 더 넣기") : title;
  };
  return el;
}
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

/* ───── 진행 표시 ───── */
export function progress() {
  const fill = h("i");
  const bar = h("div", { class: "bar" }, fill);
  const text = h("div", { class: "ptext" });
  const el = h("div", { class: "progress", hidden: true, role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100" }, bar, text);
  return {
    el,
    set(frac, msg) {
      el.hidden = false;
      const indet = frac == null;
      bar.classList.toggle("indet", indet);
      if (!indet) { const p = Math.round(Math.max(0, Math.min(1, frac)) * 100); fill.style.width = p + "%"; el.setAttribute("aria-valuenow", p); }
      if (msg != null) text.textContent = msg;
    },
    hide() { el.hidden = true; fill.style.width = "0"; },
  };
}

/* ───── 알림 ───── */
export function alertBox() {
  const el = h("div", { class: "alert", hidden: true, role: "alert" });
  return {
    el,
    show(msg, kind = "") { el.className = `alert ${kind}`; el.textContent = msg; el.hidden = false; },
    hide() { el.hidden = true; },
  };
}
export const errMsg = (e) => (e && e.message) || String(e || "알 수 없는 문제가 생겼어요.");

/* ───── 내려받기 ───── */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name, style: "display:none" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** 결과 한 줄: 이름, 크기, (부가정보), 내려받기 버튼 */
export function resultItem({ name, blob, extra, thumb }) {
  const btn = h("button", { type: "button", class: "btn sm primary", onclick: () => download(blob, name) }, icon("dl"), "내려받기");
  btn.dataset.name = name;
  return h("div", { class: "ritem" },
    thumb || null,
    h("div", { class: "fmeta" }, h("div", { class: "fname", title: name }, name), h("div", { class: "fsub" }, formatSize(blob.size), extra ? h("span", {}, " · ", extra) : null)),
    btn);
}

export function resultBox(title) {
  const box = h("div", { class: "result" }, h("h2", {}, icon("ok"), title));
  // 테스트·자동화를 위해 마지막 결과를 남겨둬요 (전송 아님)
  return box;
}

/* ───── 드래그로 순서 바꾸기 (데스크톱). 휴대폰은 버튼으로 ───── */
export function sortable(container, itemSelector, onMove, { horizontal = false } = {}) {
  let from = -1;
  const items = () => [...container.querySelectorAll(itemSelector)];
  const clear = () => items().forEach((x) => x.classList.remove("drop-before", "drop-after", "dragging"));
  container.addEventListener("dragstart", (e) => {
    const it = e.target.closest(itemSelector);
    if (!it) return;
    from = items().indexOf(it);
    it.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/x-anollim", String(from));
  });
  const where = (e, it) => {
    const r = it.getBoundingClientRect();
    return horizontal ? (e.clientX - r.left > r.width / 2) : (e.clientY - r.top > r.height / 2);
  };
  container.addEventListener("dragover", (e) => {
    if (from < 0) return;
    const it = e.target.closest(itemSelector);
    if (!it) return;
    e.preventDefault();
    items().forEach((x) => x.classList.remove("drop-before", "drop-after"));
    it.classList.add(where(e, it) ? "drop-after" : "drop-before");
  });
  container.addEventListener("drop", (e) => {
    if (from < 0) return;
    const it = e.target.closest(itemSelector);
    e.preventDefault();
    if (it) {
      let to = items().indexOf(it);
      if (where(e, it)) to++;
      if (to > from) to--;
      if (to !== from) onMove(from, to);
    }
    from = -1; clear();
  });
  container.addEventListener("dragend", () => { from = -1; clear(); });
}
export { moveItem };

/* ───── 세그먼트 버튼 ───── */
export function seg(options, value, onChange) {
  const el = h("div", { class: "seg", role: "group" });
  const render = () => {
    el.replaceChildren(...options.map((o) => h("button", {
      type: "button", "aria-pressed": String(o.value === value), disabled: o.disabled || null, title: o.title || null,
      onclick: () => { if (o.value !== value) { value = o.value; render(); onChange(value); } },
    }, o.label)));
  };
  render();
  el.setValue = (v) => { value = v; render(); };
  return el;
}

/* ───── 파일 검사 ───── */
export const LIMITS = {
  pdfFile: 300 * 1024 * 1024,
  imageFile: 60 * 1024 * 1024,
  bgFile: 30 * 1024 * 1024,
};
export function filterFiles(files, kinds, maxBytes, report) {
  const ok = [], bad = [];
  for (const f of files) {
    const k = kindOf(f);
    if (!kinds.includes(k)) bad.push(`${f.name}: 이 도구에서 쓸 수 없는 파일이에요.`);
    else if (f.size > maxBytes) bad.push(`${f.name}: ${formatSize(maxBytes)}보다 커서 넣지 않았어요.`);
    else if (f.size === 0) bad.push(`${f.name}: 빈 파일이에요.`);
    else ok.push(f);
  }
  if (bad.length) report(bad.join("\n"));
  return ok;
}

/* ───── PDF 워커 ───── */
let pdfWorker, seq = 0;
const pending = new Map();
function worker() {
  if (pdfWorker) return pdfWorker;
  pdfWorker = new Worker(new URL("./pdf-worker.js", import.meta.url), { type: "module" });
  pdfWorker.onmessage = (ev) => {
    const { id, type } = ev.data;
    const p = pending.get(id);
    if (!p) return;
    if (type === "progress") p.onProgress?.(ev.data.done, ev.data.total);
    else { pending.delete(id); type === "done" ? p.resolve(ev.data.result) : p.reject(new Error(ev.data.message)); }
  };
  pdfWorker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error("PDF 처리 도구를 불러오지 못했어요. 새로고침 후 다시 해 주세요."));
    pending.clear();
    pdfWorker = null;
    e.preventDefault?.();
  };
  return pdfWorker;
}
export function runPdf(op, args, transfer = [], onProgress) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, onProgress });
    worker().postMessage({ id, op, args }, transfer);
  });
}

/* ───── PDF.js (썸네일) ───── */
let pdfjsP;
export function loadPdfjs() {
  pdfjsP ||= import("/vendor/pdfjs/pdf.min.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
    return m;
  }).catch((e) => { pdfjsP = null; throw new Error("PDF 미리보기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."); });
  return pdfjsP;
}
export async function openPdfjs(buf) {
  const pdfjs = await loadPdfjs();
  try {
    return await pdfjs.getDocument({
      data: buf, cMapUrl: "/vendor/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
      isEvalSupported: false, enableXfa: false,
    }).promise;
  } catch (e) {
    if (e && e.name === "PasswordException") throw new Error("암호가 걸린 PDF예요. 암호를 푼 뒤 다시 넣어 주세요.");
    throw new Error("PDF를 읽지 못했어요. 파일이 깨졌거나 PDF가 아닐 수 있어요.");
  }
}

/** 보이는 썸네일부터 차례로 그려요 */
export function thumbRenderer(doc, width = 220) {
  const queue = [];
  let busy = false;
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); }
    pump();
  }, { rootMargin: "300px" });
  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const box = queue.shift();
      const n = Number(box.dataset.page);
      try {
        const page = await doc.getPage(n + 1);
        const vp0 = page.getViewport({ scale: 1 });
        const scale = Math.min(width / vp0.width, (width * 1.4) / vp0.height) * Math.min(2, window.devicePixelRatio || 1);
        const vp = page.getViewport({ scale });
        const c = document.createElement("canvas");
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        page.cleanup();
        box.replaceChildren(c);
        box.dispatchEvent(new CustomEvent("rendered"));
      } catch { box.replaceChildren(h("div", { class: "ph" })); }
    }
    busy = false;
  }
  return {
    observe(box) { io.observe(box); },
    destroy() { io.disconnect(); queue.length = 0; doc.destroy?.(); },
  };
}

/* ───── 이미지 읽기 ───── */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const MAX_PIXELS = IS_IOS ? 16_000_000 : 50_000_000;

let heicP;
// HEIC: 브라우저가 직접 못 열면 heic-to(libheif WASM, CSP 빌드)로 브라우저 안에서 풀어요
const loadHeic = () => (heicP ||= import("/vendor/heic-to-1.5.2-csp.mjs").catch(() => { heicP = null; throw new Error("HEIC 변환 도구를 불러오지 못했어요."); }));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** File → { source(ImageBitmap|HTMLImageElement), width, height, close() } (EXIF 방향 반영) */
export async function decodeImage(file) {
  const k = kindOf(file);
  let blob = file;
  try {
    return await bitmapFrom(blob);
  } catch (e) {
    if (k !== "heic") throw new Error(`${file.name}: 이미지를 열지 못했어요. 지원하지 않는 형식이거나 파일이 깨졌을 수 있어요.`);
  }
  // HEIC: 브라우저가 직접 못 열면 heic2any 로 변환 (브라우저 안에서)
  try {
    const { heicTo } = await loadHeic();
    blob = await withTimeout(heicTo({ blob: file, type: "image/png" }), 60_000);
    return await bitmapFrom(blob);
  } catch (e) {
    throw new Error(`${file.name}: HEIC 사진을 열지 못했어요. 아이폰 설정 > 카메라 > 포맷에서 '높은 호환성'으로 찍거나 JPG로 바꿔 넣어 주세요.`);
  }
}
async function bitmapFrom(blob) {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* 아래 img 방식으로 */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 이미지 → canvas (크기 조절 · 배경색 채우기) */
export function drawToCanvas(img, w, h2, fill) {
  let s = 1;
  if (w * h2 > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h2));
  const cw = Math.max(1, Math.floor(w * s)), ch = Math.max(1, Math.floor(h2 * s));
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const ctx = c.getContext("2d");
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, cw, ch); }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, 0, 0, cw, ch);
  return c;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("이미지를 저장하지 못했어요. 사진이 너무 클 수 있어요."))), type, quality));
}

/** 브라우저가 이 형식으로 저장(인코딩)할 수 있는지 */
const encCache = {};
export async function canEncode(type) {
  if (type in encCache) return encCache[type];
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const b = await new Promise((r) => c.toBlob(r, type, 0.8));
  return (encCache[type] = !!b && b.type === type);
}

/** 작은 미리보기 URL (목록용) */
export async function thumbURL(img, size = 120) {
  const s = Math.min(1, size / Math.max(img.width, img.height));
  const c = drawToCanvas(img, img.width * s, img.height * s);
  const b = await canvasToBlob(c, "image/jpeg", 0.7);
  return URL.createObjectURL(b);
}

/* ───── ZIP ───── */
export async function makeZip(files) {
  const { zip } = await import("/vendor/fflate-0.8.2.mjs");
  const obj = {};
  for (const f of files) obj[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  return new Promise((res, rej) => zip(obj, { level: 0 }, (err, data) => (err ? rej(new Error("ZIP을 만들지 못했어요.")) : res(new Blob([data], { type: "application/zip" })))));
}

/** 붙여넣기(클립보드) 이미지 */
export function filesFromPaste(e) {
  const out = [];
  for (const it of e.clipboardData?.items || []) {
    if (it.kind === "file") {
      const f = it.getAsFile();
      if (f) {
        const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
        out.push(f.name && f.name !== "image." + ext && f.name !== "image.png" ? f : new File([f], `붙여넣은-이미지-${Date.now()}.${ext}`, { type: f.type }));
      }
    }
  }
  return out;
}
