// PDF 용량 줄이기 — 글자·링크·책갈피·양식 같은 문서 구조는 그대로 두고, 안에 든 사진만 다시 저장해요.
//  - JPEG(DCTDecode) 사진: 긴 변을 maxSide 까지 줄이고 quality 로 다시 저장
//  - Flate/압축 안 된 사진(8비트 회색·RGB): 픽셀로 풀어서 JPEG 로
//  - 압축 안 된 나머지 스트림(글자 그리기 명령, 글꼴 등): Flate 로 묶기
// 결과가 원래보다 충분히 작을 때만 바꿔요. 모르는 형식(CMYK, JPX, JBIG2, 마스크로 쓰는 그림 …)은 건드리지 않아요.
// pdf-lib 모듈과 이미지 코덱은 주입받아요 → 워커(브라우저)와 테스트(노드)가 같이 씀.
import type * as PL from "vendor:pdf-lib";
import { pngUnpredict, scaleToMaxSide } from "./lib.js";

export type ShrinkLib = Pick<typeof PL, "PDFName" | "PDFNumber" | "PDFArray" | "PDFDict" | "PDFStream" | "PDFRawStream" | "PDFRef">;
export interface ShrinkCodec {
  /** 이미지를 다시 그릴 수 있는지 (OffscreenCanvas 가 없으면 false → 스트림 묶기만) */
  canRecode: boolean;
  /** JPEG 바이트(가로 w·세로 h) → outW×outH JPEG. 못 하면 null */
  jpeg(bytes: Uint8Array, w: number, h: number, outW: number, outH: number, quality: number): Promise<Uint8Array | null>;
  /** 날 픽셀(성분 1=회색 / 3=RGB, 8비트) → JPEG. 못 하면 null */
  pixels(raw: Uint8Array, comps: 1 | 3, w: number, h: number, outW: number, outH: number, quality: number): Promise<Uint8Array | null>;
  inflate(bytes: Uint8Array): Promise<Uint8Array>;
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
}
export interface ShrinkOptions { maxSide: number; quality: number }
export interface ShrinkStats { images: number; recompressed: number; deflated: number; canRecode: boolean }

const MAX_PIXELS = 40_000_000; // 이보다 큰 사진은 메모리 때문에 건너뜀
const MIN_IMAGE_BYTES = 8 * 1024; // 이보다 작은 사진은 줄여도 차이가 없음
const MIN_STREAM_BYTES = 512;

export async function shrinkPdf(lib: ShrinkLib, doc: PL.PdfLibDocument, opts: ShrinkOptions, codec: ShrinkCodec,
  progress?: (done: number, total: number) => void): Promise<ShrinkStats> {
  const N = (s: string) => lib.PDFName.of(s);
  const ctx = doc.context;
  const look = (o: PL.PdfLibObject | undefined) => ctx.lookup(o);
  const num = (d: PL.PDFDict | undefined, k: string): number | null => {
    const v = d ? look(d.get(N(k))) : undefined;
    return v instanceof lib.PDFNumber ? v.asNumber() : null;
  };
  const isImage = (d: PL.PDFDict) => look(d.get(N("Subtype"))) === N("Image");

  const all = ctx.enumerateIndirectObjects();
  // 다른 그림의 마스크(SMask·Mask)로 쓰이는 그림은 회색 그대로여야 해서 건드리지 않아요
  const maskRefs = new Set<PL.PdfLibObject>();
  for (const [, o] of all) {
    if (!(o instanceof lib.PDFStream) || !isImage(o.dict)) continue;
    for (const k of ["SMask", "Mask"]) { const v = o.dict.get(N(k)); if (v instanceof lib.PDFRef) maskRefs.add(v); }
  }

  /** 필터 목록 (없으면 []), 이상하면 null */
  function filters(d: PL.PDFDict): PL.PDFName[] | null {
    const f = look(d.get(N("Filter")));
    if (f == null) return [];
    if (f instanceof lib.PDFName) return [f];
    if (f instanceof lib.PDFArray) {
      const out: PL.PDFName[] = [];
      for (let i = 0; i < f.size(); i++) { const x = look(f.get(i)); if (!(x instanceof lib.PDFName)) return null; out.push(x); }
      return out;
    }
    return null;
  }
  /** 색 공간: 성분 수 · 그대로 둬도 되는지(회색은 RGB JPEG 로 바뀌어 DeviceRGB 로 바꿔야 함) */
  function colorOf(d: PL.PDFDict): { comps: 1 | 3; keep: boolean } | null {
    const cs = look(d.get(N("ColorSpace")));
    if (cs === N("DeviceRGB")) return { comps: 3, keep: true };
    if (cs === N("DeviceGray")) return { comps: 1, keep: false };
    if (cs instanceof lib.PDFArray && cs.size() === 2 && look(cs.get(0)) === N("ICCBased")) {
      const s = look(cs.get(1));
      const n = s instanceof lib.PDFStream ? num(s.dict, "N") : null;
      if (n === 3) return { comps: 3, keep: true };
      if (n === 1) return { comps: 1, keep: false };
    }
    return null;
  }

  async function recodeImage(s: PL.PDFRawStream): Promise<PL.PDFRawStream | null> {
    const d = s.dict;
    const w = num(d, "Width"), h = num(d, "Height");
    if (!w || !h || num(d, "BitsPerComponent") !== 8 || w * h > MAX_PIXELS) return null;
    if (s.contents.length < MIN_IMAGE_BYTES || d.has(N("Decode"))) return null;
    const mask = look(d.get(N("Mask")));
    if (mask != null && !(mask instanceof lib.PDFStream)) return null; // 색 키 마스크는 정확한 색값이 필요
    const smask = look(d.get(N("SMask")));
    if (smask instanceof lib.PDFStream && smask.dict.has(N("Matte"))) return null; // Matte 는 크기가 같아야 함
    const fs = filters(d), cs = colorOf(d);
    if (!fs || !cs) return null;
    const out = scaleToMaxSide(w, h, opts.maxSide);
    let jpeg: Uint8Array | null = null;
    if (fs.length === 1 && fs[0] === N("DCTDecode")) {
      jpeg = await codec.jpeg(s.contents, w, h, out.width, out.height, opts.quality);
    } else if (fs.length === 0 || (fs.length === 1 && fs[0] === N("FlateDecode"))) {
      let raw: Uint8Array | null = fs.length ? await codec.inflate(s.contents) : s.contents;
      let parms = look(d.get(N("DecodeParms")));
      if (parms instanceof lib.PDFArray) parms = parms.size() === 1 ? look(parms.get(0)) : undefined;
      const pd = parms instanceof lib.PDFDict ? parms : undefined;
      const predictor = num(pd, "Predictor") ?? 1;
      if (predictor >= 10) {
        if ((num(pd, "Colors") ?? 1) !== cs.comps || (num(pd, "Columns") ?? 1) !== w || (num(pd, "BitsPerComponent") ?? 8) !== 8) return null;
        raw = pngUnpredict(raw, w, cs.comps);
      } else if (predictor !== 1) return null;
      const need = w * h * cs.comps;
      if (!raw || raw.length < need) return null;
      jpeg = await codec.pixels(raw.subarray(0, need), cs.comps, w, h, out.width, out.height, opts.quality);
    } else return null;
    if (!jpeg || jpeg.length > s.contents.length * 0.9 || s.contents.length - jpeg.length < 1024) return null;
    const nd = d.clone(ctx);
    nd.set(N("Filter"), N("DCTDecode"));
    nd.delete(N("DecodeParms"));
    nd.set(N("Width"), lib.PDFNumber.of(out.width));
    nd.set(N("Height"), lib.PDFNumber.of(out.height));
    nd.set(N("BitsPerComponent"), lib.PDFNumber.of(8));
    if (!cs.keep) nd.set(N("ColorSpace"), N("DeviceRGB"));
    nd.set(N("Length"), lib.PDFNumber.of(jpeg.length));
    return lib.PDFRawStream.of(nd, jpeg);
  }

  async function deflateStream(s: PL.PDFRawStream): Promise<PL.PDFRawStream | null> {
    const d = s.dict;
    if (d.has(N("Filter")) || d.has(N("DecodeParms")) || s.contents.length < MIN_STREAM_BYTES) return null;
    const type = look(d.get(N("Type")));
    if (type === N("Metadata") || type === N("XRef") || type === N("ObjStm")) return null;
    const z = await codec.deflate(s.contents);
    if (z.length >= s.contents.length * 0.95) return null;
    const nd = d.clone(ctx);
    nd.set(N("Filter"), N("FlateDecode"));
    nd.set(N("Length"), lib.PDFNumber.of(z.length));
    return lib.PDFRawStream.of(nd, z);
  }

  const streams = all.filter(([, o]) => o instanceof lib.PDFRawStream) as [PL.PDFRef, PL.PDFRawStream][];
  const stats: ShrinkStats = { images: 0, recompressed: 0, deflated: 0, canRecode: codec.canRecode };
  for (let i = 0; i < streams.length; i++) {
    const [ref, s] = streams[i];
    try {
      if (isImage(s.dict)) {
        stats.images++;
        if (codec.canRecode && !maskRefs.has(ref)) {
          const ns = await recodeImage(s);
          if (ns) { ctx.assign(ref, ns); stats.recompressed++; }
        }
      } else {
        const ns = await deflateStream(s);
        if (ns) { ctx.assign(ref, ns); stats.deflated++; }
      }
    } catch { /* 이 스트림은 그대로 둬요 */ }
    progress?.(i + 1, streams.length);
  }
  return stats;
}
