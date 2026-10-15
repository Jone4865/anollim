// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// (배포용 문서 데이터 해석: 한컴 '한글 문서 파일 형식 – 배포용 문서' revision 1.2 의 2장 절차)
export type HwpKind = "hwp5" | "hwpx" | "hwp3" | "unknown";
export interface HwpSniff {
  kind: HwpKind; version?: string;
  password?: boolean;      // FileHeader 속성 bit 1
  distribution?: boolean;  // bit 2 배포용 문서
  drm?: boolean;           // bit 4 DRM 보안 문서
  certEncrypted?: boolean; // bit 8 공인 인증서 암호화
  certDrm?: boolean;       // bit 10 공인 인증서 DRM 보안 문서
  privacy?: boolean;       // bit 13 개인 정보 보안 문서
}
export interface DistFlags { noCopy: boolean; noPrint: boolean }

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
function startsWith(b: Uint8Array, s: string, at = 0): boolean {
  if (b.length < at + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
}

/** 파일 앞부분만 보고 형식과 FileHeader 속성을 가려요. 확장자는 믿지 않아요. */
export function sniffHwp(b: Uint8Array): HwpSniff {
  // 회사·기관 DRM 이 파일 전체를 감싼 경우(FileHeader 가 안 보여요). 머리말은 rhwp v0.8.7 src/parser/mod.rs detect_format 과 같아요.
  if (startsWith(b, "SCDSA") || startsWith(b, "\x9b DRMONE")) return { kind: "unknown", drm: true };
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4) {
    const head = String.fromCharCode(...b.subarray(0, Math.min(b.length, 200)));
    return { kind: head.includes("mimetype") && head.includes("application/hwp+zip") ? "hwpx" : "unknown" };
  }
  if (startsWith(b, "HWP Document File V3.00")) return { kind: "hwp3" };
  if (!CFB_SIG.every((x, i) => b[i] === x)) return { kind: "unknown" };
  const fh = cfbStream(b, ["FileHeader"], 256);
  if (!fh || !startsWith(fh, "HWP Document File")) return { kind: "unknown" };
  const v = u32(fh, 32), p = u32(fh, 36);
  return {
    kind: "hwp5", version: `${v >>> 24}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`,
    password: !!(p & 2), distribution: !!(p & 4), drm: !!(p & 16), certEncrypted: !!(p & 256), certDrm: !!(p & 1024),
    privacy: !!(p & 8192),
  };
}

/** 최소 CFB(OLE2) 읽기: path 스트림의 앞 maxBytes 바이트. 없거나 깨졌으면 null. 반복 상한으로 망가진 파일에서도 안 멈춰요. */
export function cfbStream(b: Uint8Array, path: string[], maxBytes: number): Uint8Array | null {
  try {
    if (b.length < 512 || !CFB_SIG.every((x, i) => b[i] === x)) return null;
    const secShift = u16(b, 30), miniShift = u16(b, 32);
    if (secShift !== 9 && secShift !== 12) return null;
    const secSize = 1 << secShift, miniSize = 1 << miniShift;
    const nFat = u32(b, 44), dirStart = u32(b, 48), miniCutoff = u32(b, 56), miniFatStart = u32(b, 60);
    const secOff = (n: number) => (n + 1) * secSize; // 헤더 = 섹터 하나 크기
    const fatSecs: number[] = [];
    for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(u32(b, 76 + i * 4));
    let dif = u32(b, 68), guard = 0;
    while (fatSecs.length < nFat && dif < 0xfffffffa && guard++ < 4096) {
      const o = secOff(dif), per = secSize / 4 - 1;
      for (let i = 0; i < per && fatSecs.length < nFat; i++) fatSecs.push(u32(b, o + i * 4));
      dif = u32(b, o + per * 4);
    }
    const per = secSize / 4;
    const fat = (n: number) => { const s = fatSecs[Math.floor(n / per)]; const o = s == null ? -1 : secOff(s) + (n % per) * 4; return o < 0 || o + 4 > b.length ? 0xfffffffe : u32(b, o); };
    const readChain = (start: number, size: number) => {
      const out = new Uint8Array(size); let n = start, p = 0, g = 0;
      while (n < 0xfffffffa && p < size && g++ < 1_000_000) { const o = secOff(n); const k = Math.min(secSize, size - p); if (o + k > b.length) return null; out.set(b.subarray(o, o + k), p); p += k; n = fat(n); }
      return p >= size ? out : null;
    };
    interface Ent { name: string; type: number; left: number; right: number; child: number; start: number; size: number }
    const ents: Ent[] = [];
    for (let n = dirStart, g = 0; n < 0xfffffffa && g++ < 10_000; n = fat(n)) {
      for (let i = 0; i < secSize / 128; i++) {
        const o = secOff(n) + i * 128; if (o + 128 > b.length) break;
        const nl = Math.min(64, u16(b, o + 64)); let name = "";
        for (let k = 0; k + 2 < nl; k += 2) name += String.fromCharCode(u16(b, o + k));
        ents.push({ name, type: b[o + 66], left: u32(b, o + 68), right: u32(b, o + 72), child: u32(b, o + 76), start: u32(b, o + 116), size: u32(b, o + 120) });
      }
    }
    if (!ents.length) return null;
    const find = (root: number, name: string): Ent | null => {
      const seen = new Set<number>(), st = [root];
      while (st.length) { const i = st.pop() as number; if (i >= ents.length || seen.has(i)) continue; seen.add(i); const e = ents[i]; if (e.name === name) return e; st.push(e.left, e.right); }
      return null;
    };
    let cur: Ent | null = ents[0];
    for (let i = 0; i < path.length && cur; i++) cur = find(cur.child, path[i]);
    if (!cur || cur.type !== 2) return null;
    const want = Math.min(cur.size, maxBytes);
    if (cur.size >= miniCutoff) return readChain(cur.start, want);
    const root = ents[0];
    const mini = readChain(root.start, root.size); if (!mini) return null;
    const out = new Uint8Array(want); let n = cur.start, p = 0, g = 0;
    while (n < 0xfffffffa && p < want && g++ < 1_000_000) {
      const k = Math.min(miniSize, want - p); out.set(mini.subarray(n * miniSize, n * miniSize + k), p); p += k;
      const idx = n * 4, s = Math.floor(idx / secSize); let ms = miniFatStart;
      for (let j = 0; j < s && ms < 0xfffffffa; j++) ms = fat(ms);
      if (ms >= 0xfffffffa) return null;
      n = u32(b, secOff(ms) + (idx % secSize));
    }
    return p >= want ? out : null;
  } catch { return null; }
}

/** MSVC rand() 로 만든 256바이트 배열 (배포용 문서 2.2절) */
export function distributeKeyArray(seed: number): Uint8Array {
  let hold = seed >>> 0;
  const rand = () => { hold = (Math.imul(hold, 214013) + 2531011) >>> 0; return (hold >>> 16) & 0x7fff; };
  const arr = new Uint8Array(256); let i = 0;
  while (i < 256) { const a = rand() & 0xff; const n = (rand() & 0x0f) + 1; for (let k = 0; k < n && i < 256; k++) arr[i++] = a; }
  return arr;
}

/** "배포용 문서 데이터" 256바이트 → 복사·인쇄 방지. 해시 자리가 16진수 40자가 아니면 null(형식 이상). */
export function decodeDistributeDocData(data: Uint8Array): DistFlags | null {
  if (data.length < 256) return null;
  const seed = u32(data, 0), arr = distributeKeyArray(seed);
  const x = new Uint8Array(256);
  for (let i = 0; i < 256; i++) x[i] = i < 4 ? data[i] : data[i] ^ arr[i];
  const off = (seed & 0x0f) + 4;
  if (off + 82 > 256) return null;
  let hash = ""; for (let i = 0; i < 40; i++) hash += String.fromCharCode(u16(x, off + i * 2));
  if (!/^[0-9a-fA-F]{40}$/.test(hash)) return null;
  const f = u16(x, off + 80);
  return { noCopy: !!(f & 1), noPrint: !!(f & 2) };
}

/** 배포용 HWP 5.0 의 ViewText/Section0 첫 레코드(HWPTAG_DISTRIBUTE_DOC_DATA = 0x1C, 256바이트) */
export function distributionFlags(b: Uint8Array): DistFlags | null {
  const s = cfbStream(b, ["ViewText", "Section0"], 260);
  if (!s || s.length < 260) return null;
  const h = u32(s, 0);
  if ((h & 0x3ff) !== 0x1c || h >>> 20 !== 256) return null;
  return decodeDistributeDocData(s.subarray(4, 260));
}

/** 이의가 오면 false 로 바꿔 배포용 문서는 열지 않아요(9장). 배포 한 번으로 바로 적용돼요. */
export const HWP_ALLOW_DISTRIBUTION = true;
export type HwpBlock = "drm" | "cert" | "distribution" | "unknown";
export interface HwpPolicy {
  block: HwpBlock | null;
  needPassword: boolean;
  pdf: "ok" | "image-only" | "blocked";
  reason: "print" | "copy" | "privacy" | null;
  preview: "svg" | "raster"; // raster = 화면도 캔버스 그림(PNG)으로만. SVG 에는 본문 글자가 그대로 들어 있어서요
  print: boolean;            // false 면 @media print 로 쪽을 숨기고 안내만 인쇄돼요
}
/** 배포용인데 플래그를 못 읽으면(null) 복사·인쇄 둘 다 막힌 것으로 봐요(모르면 막아요) */
export function hwpPolicy(s: HwpSniff, flags: DistFlags | null, allowDistribution: boolean = HWP_ALLOW_DISTRIBUTION): HwpPolicy {
  const no = (block: HwpBlock): HwpPolicy => ({ block, needPassword: false, pdf: "blocked", reason: null, preview: "raster", print: false });
  if (s.drm || s.certDrm) return no("drm"); // SCDSA·Fasoo 머리말(kind "unknown")도 여기라서 unknown 보다 먼저
  if (s.kind === "unknown") return no("unknown");
  if (s.certEncrypted) return no("cert");
  const dist = !!s.distribution;
  if (dist && !allowDistribution) return no("distribution");
  const noPrint = dist && (!flags || flags.noPrint);
  const noCopy = dist && (!flags || flags.noCopy);
  const privacy = !!s.privacy; // 보호된 글자가 어떻게 그려지는지 확인 전(10장)이라 PDF·인쇄를 막아요
  return {
    block: null, needPassword: !!s.password,
    pdf: noPrint || privacy ? "blocked" : noCopy ? "image-only" : "ok",
    reason: noPrint ? "print" : privacy ? "privacy" : noCopy ? "copy" : null,
    preview: noPrint || noCopy ? "raster" : "svg",
    print: !(noPrint || privacy),
  };
}

/* ───── rhwp 오류 문구 → 코드 (메시지는 rhwp 0.8.7 에서 실측) ───── */
export type HwpErr = "password-needed" | "password-wrong" | "empty" | "drm" | "unsupported" | "failed";
export function hwpErrorCode(msg: string): HwpErr {
  if (msg.includes("DRM_PROTECTED")) return "drm"; // "지원하지 않는 포맷"보다 먼저 봐요
  if (msg.includes("비밀번호가 필요한")) return "password-needed";
  if (msg.includes("비밀번호가 일치하지 않")) return "password-wrong";
  if (msg.includes("EMPTY_FILE")) return "empty";
  if (msg.includes("UNSUPPORTED_FILE_FORMAT")) return "unsupported";
  return "failed";
}
/** 화질(dpi): 150 보통 · 200 선명하게 · 300 인쇄용 (0장 결정 2번) */
export type HwpDpi = 150 | 200 | 300;
/**
 * 그림 PDF 예상 크기(KB). 실측 쪽당 150dpi 약 230KB · 200dpi 약 340KB (HWP_SPEC 3-5), 300dpi 는 넉넉히 640KB.
 * Chrome 다시 잰 값(2026-10-15, 공개 시험 문서 4개): 150dpi 204~267KB · 200dpi 301~391KB · 300dpi 513~661KB — 그대로 맞아요.
 */
export const pdfEstimateKB = (pages: number, dpi: HwpDpi) => pages * (dpi === 150 ? 230 : dpi === 200 ? 340 : 640);
/**
 * 쪽 그림(PNG) 예상 크기(KB) 범위 [작게, 크게]. Chrome 실측(2026-10-15, 공개 시험 문서 4개 — 문체부 보도자료 3건·rhwp 시험 파일 24쪽) 쪽당
 * 150dpi 388~466KB · 200dpi 578~723KB · 300dpi 987~1,312KB 를 조금 넓혀 잡았어요. 예전 값(resvg 로 잰 150dpi 300KB)은 Chrome 보다 20~30% 작았어요.
 * 사진이 많은 문서는 더 커질 수 있어요.
 */
const PNG_KB: Record<HwpDpi, readonly [number, number]> = { 150: [380, 480], 200: [570, 730], 300: [980, 1320] };
export const pngEstimateKB = (pages: number, dpi: HwpDpi): [number, number] => [pages * PNG_KB[dpi][0], pages * PNG_KB[dpi][1]];
/**
 * PDF·쪽 그림을 한 번에 만드는 최대 쪽 수(화질별). 쪽마다 캔버스는 바로 비우지만(300dpi A4 한 장이 약 35MB) 결과는 끝까지 갖고 있어서
 * 화질이 높을수록 줄여요(Chrome 실측 쪽당 쪽 그림 0.4·0.6·1MB, PDF 0.24·0.35·0.6MB). 아이폰·아이패드는 메모리가 더 작아요.
 * 150dpi 는 설계(12-10) 그대로, 200·300dpi 는 그림 넓이(1.8배·4배)를 보고 줄였어요.
 */
export const maxExportPages = (dpi: HwpDpi, ios: boolean): number => (ios ? { 150: 40, 200: 25, 300: 15 } : { 150: 100, 200: 60, 300: 40 })[dpi];
