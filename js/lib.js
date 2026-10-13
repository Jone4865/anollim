// 집문서 — 순수 함수 모음 (DOM 없음, node --test 로 테스트)

/**
 * "1-3, 5, 8-10" 같은 페이지 범위를 해석해요.
 * 반환: 그룹 배열. 각 그룹은 0부터 시작하는 페이지 번호 배열.
 * 예) parseRanges("1-3, 5", 10) → [[0,1,2],[4]]
 * 잘못된 입력은 한국어 메시지와 함께 Error 를 던져요.
 */
export function parseRanges(input, pageCount) {
  const text = String(input ?? "")
    .replace(/[～〜~–—]/g, "-")
    .replace(/[，、;]/g, ",")
    .trim();
  if (!text) throw new Error("페이지 범위를 입력해 주세요. 예) 1-3, 5");
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error("페이지가 없어요.");
  const groups = [];
  for (const raw of text.split(",")) {
    const part = raw.replace(/\s+/g, "");
    if (!part) continue;
    let m;
    if ((m = /^(\d+)$/.exec(part))) {
      const n = Number(m[1]);
      checkPage(n, pageCount, part);
      groups.push([n - 1]);
    } else if ((m = /^(\d*)-(\d*)$/.exec(part)) && (m[1] || m[2])) {
      const a = m[1] ? Number(m[1]) : 1;
      const b = m[2] ? Number(m[2]) : pageCount;
      checkPage(a, pageCount, part);
      checkPage(b, pageCount, part);
      const g = [];
      if (a <= b) for (let i = a; i <= b; i++) g.push(i - 1);
      else for (let i = a; i >= b; i--) g.push(i - 1);
      groups.push(g);
    } else {
      throw new Error(`"${raw.trim()}"을(를) 이해하지 못했어요. 예) 1-3, 5, 8-10`);
    }
  }
  if (!groups.length) throw new Error("페이지 범위를 입력해 주세요. 예) 1-3, 5");
  return groups;
}

function checkPage(n, max, part) {
  if (n < 1 || n > max) throw new Error(`"${part}" — 페이지는 1부터 ${max}까지 있어요.`);
}

/** 그룹들을 합쳐 중복 없이 순서대로 정렬한 페이지 집합 */
export function rangesToSet(groups) {
  return [...new Set(groups.flat())].sort((a, b) => a - b);
}

/** 0부터 시작하는 인덱스 배열을 "1-3, 5" 형태로 */
export function formatRanges(indices) {
  const s = [...new Set(indices)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? `${s[i] + 1}` : `${s[i] + 1}-${s[j] + 1}`);
    i = j;
  }
  return out.join(", ");
}

/** 바이트 → "1.2 MB" */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "")} ${units[u]}`;
}

/** 줄어든 비율(%) — 커지면 음수 */
export function savedPercent(before, after) {
  if (!before) return 0;
  return Math.round((1 - after / before) * 100);
}

/** "사진.final.JPG" → "사진.final" */
export function baseName(name) {
  const n = String(name ?? "").split(/[\\/]/).pop().trim();
  const i = n.lastIndexOf(".");
  const b = i > 0 ? n.slice(0, i) : n;
  return b || "파일";
}

/** 파일 이름에 못 쓰는 글자 정리 */
export function safeName(name) {
  return String(name ?? "")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120) || "파일";
}

/** 결과 파일 이름: outName("보고서.pdf", "합침", "pdf") → "보고서-합침.pdf" */
export function outName(original, suffix, ext) {
  const b = safeName(baseName(original));
  return `${b}${suffix ? "-" + suffix : ""}.${ext.replace(/^\./, "")}`;
}

/** 같은 이름이 겹치지 않게 (zip 안 파일들) */
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const key = n.toLowerCase();
    if (!seen.has(key)) { seen.set(key, 1); return n; }
    const c = seen.get(key) + 1;
    seen.set(key, c);
    const i = n.lastIndexOf(".");
    const cand = i > 0 ? `${n.slice(0, i)} (${c})${n.slice(i)}` : `${n} (${c})`;
    seen.set(cand.toLowerCase(), 1);
    return cand;
  });
}

/** 배열에서 항목 하나를 옮긴 새 배열 */
export function moveItem(arr, from, to) {
  const a = arr.slice();
  if (from < 0 || from >= a.length) return a;
  const t = Math.max(0, Math.min(a.length - 1, to));
  const [x] = a.splice(from, 1);
  a.splice(t, 0, x);
  return a;
}

/** 최대 가로/세로 안에 비율 유지해 맞추기 (확대는 안 함). 0/빈값은 제한 없음 */
export function fitWithin(w, h, maxW, maxH) {
  let s = 1;
  if (maxW > 0 && w > maxW) s = Math.min(s, maxW / w);
  if (maxH > 0 && h > maxH) s = Math.min(s, maxH / h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)), scaled: s < 1 };
}

/** 회전 각도 정규화 (0/90/180/270) */
export function normRotation(deg) {
  return (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
}

/** MIME → 확장자 */
export function extFor(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "application/pdf": "pdf" }[mime] || "bin";
}

/** 파일 종류 판별 (이름 + MIME) */
export function kindOf(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/heic|heif/.test(type) || /\.(heic|heif)$/.test(name)) return "heic";
  if (type.startsWith("image/") || /\.(jpe?g|png|webp|avif|gif|bmp)$/.test(name)) return "image";
  return "other";
}

/** 이미지 → PDF 배치 계산. 단위 pt. pageSize: "a4" | "original", margin pt */
export function layoutImage(imgW, imgH, pageSize, marginPt = 0) {
  if (pageSize === "original") {
    const w = imgW * 0.75, h = imgH * 0.75; // 96dpi 기준 px → pt
    return { pageW: w + marginPt * 2, pageH: h + marginPt * 2, x: marginPt, y: marginPt, w, h };
  }
  const A4 = [595.28, 841.89];
  const landscape = imgW > imgH;
  const pageW = landscape ? A4[1] : A4[0];
  const pageH = landscape ? A4[0] : A4[1];
  const boxW = pageW - marginPt * 2, boxH = pageH - marginPt * 2;
  const s = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * s, h = imgH * s;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

/** mm → pt */
export const mmToPt = (mm) => (mm * 72) / 25.4;

/** GPS 좌표 보기 좋게 */
export function formatCoord(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  return `${Math.abs(lat).toFixed(5)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(5)}°${lon >= 0 ? "E" : "W"}`;
}
