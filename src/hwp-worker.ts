// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 한글 문서(HWP·HWPX·HWP 3.0) 워커 (module worker). rhwp(WASM)를 띄우고 쪽을 SVG 로 그리고, Word·텍스트로 옮겨요.
// 문서·암호는 이 워커 메모리에서만 다뤄요. 화면이 "다른 파일"을 누르면 워커를 통째로 버려요(free() 로는 WASM 메모리가 줄지 않아요).
// 글자 폭 측정기(measureTextWidth)는 두지 않아요: 0.8.7 의 rhwp.js 는 그 콜백을 찾지 않아요(README 의 '필수 설정'은 옛 설명, HWP_SPEC 3-4).
// 버전을 올릴 때 dev/update-rhwp.sh 가 다시 확인해요.
import init, { HwpDocument } from "vendor:rhwp";
import { collectDocument, blocksToText, type Warn } from "./hwp-export.js";
import { buildDocx, normalizeImages, pageSetupFromHwp, A4, type ZipSync } from "./hwp-docx.js";

const WASM = "/vendor/rhwp-0.8.7/rhwp_bg.wasm";
const FFLATE = "/vendor/fflate-0.8.2.mjs"; // 집문서에 이미 있는 zip 라이브러리. Word 를 고를 때만 받아요
let ready: Promise<unknown> | null = null;

/**
 * WASM 을 받아요. 배포 틈에 없는 주소가 HTML·404 로 오거나, 그런 응답이 브라우저 캐시(/vendor/* 는 1년 immutable)에
 * 남아 있으면 한 번은 캐시를 건너뛰고(cache: "reload") 새로 받아 캐시도 고쳐 둬요. 그래도 아니면 'load' 오류예요.
 */
async function fetchWasm(): Promise<Response> {
  const ok = (r: Response) => r.ok && (r.headers.get("content-type") ?? "").split(";")[0].trim() === "application/wasm";
  const r = await fetch(WASM);
  if (ok(r)) return r;
  const again = await fetch(WASM, { cache: "reload" });
  if (ok(again)) return again;
  throw new Error(`wasm ${again.status} ${again.headers.get("content-type") ?? ""}`);
}
let doc: HwpDocument | null = null;

type Msg =
  | { id: number; op: "init"; args?: undefined }
  | { id: number; op: "open"; args: { buf: ArrayBuffer; password?: string } }
  | { id: number; op: "svg"; args: { page: number } }
  | { id: number; op: "docx" | "txt"; args?: undefined }
  | { id: number; op: "close"; args?: undefined };

const post = (m: unknown, transfer: Transferable[] = []) => self.postMessage(m, { transfer });

/** BMP → PNG (워커 안 OffscreenCanvas). 안 되는 브라우저면 null → BMP 그대로 */
async function bmpToPng(data: Uint8Array, mime: string): Promise<Uint8Array | null> {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") return null;
  try {
    const bmp = await createImageBitmap(new Blob([data.slice()], { type: mime }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    c.getContext("2d")?.drawImage(bmp, 0, 0); bmp.close();
    return new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
  } catch { return null; }
}

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const { id, op } = ev.data;
  try {
    try {
      ready ||= init({ module_or_path: fetchWasm() }).catch((e) => { ready = null; throw e; }); // 받기 실패면 다음에 다시
      await ready;
    } catch (e) {
      post({ id, type: "error", code: "load", message: String((e as Error)?.message ?? e) });
      return;
    }
    if (op === "init") {
      post({ id, type: "done", result: null }); // 보기 도구(WASM)만 먼저 받아 두기
    } else if (op === "open") {
      doc?.free(); doc = null;
      const { buf, password } = ev.data.args;
      const bytes = new Uint8Array(buf);
      // 암호는 이 자리에서 여는 데만 쓰고 변수에 남기지 않아요
      doc = password ? HwpDocument.openWithPassword(bytes, password) : new HwpDocument(bytes);
      const pages = doc.pageCount();
      const d = doc;
      const sizes = Array.from({ length: pages }, (_, i) => {
        const p = JSON.parse(d.getPageInfo(i)) as { width: number; height: number };
        return { w: p.width, h: p.height };
      });
      post({ id, type: "done", result: { pages, sizes } });
    } else if (op === "svg") {
      if (!doc) throw new Error("열린 문서가 없어요.");
      post({ id, type: "done", result: doc.renderPageSvg(ev.data.args.page) });
    } else if (op === "docx" || op === "txt") {
      // 메인이 exportRules 로 허용한 경우에만 불러요(복사·인쇄 제한·개인 정보 보안·배포용(Word) 문서는 여기까지 오지 않아요)
      if (!doc) throw new Error("열린 문서가 없어요.");
      const d = doc;
      const warn: Warn = {};
      const onProgress = (done: number, total: number) => post({ id, type: "progress", done, total });
      // 한컴 전용 영역 글자(PUA)를 화면과 같은 표로 보통 글자로 바꿔요. 표(약 50KB)는 내보낼 때만 받아요
      const { puaFixer } = await import("./hwp-pua.js");
      const model = collectDocument(d, warn, { images: op === "docx", headerFooter: op === "docx", onProgress, fixText: puaFixer(warn) });
      if (op === "txt") { post({ id, type: "done", result: { text: blocksToText(model.blocks), warn } }); return; }
      post({ id, type: "progress", done: 1, total: 1, phase: "pack" });
      const { zipSync } = (await import(/* @vite-ignore */ FFLATE)) as { zipSync: ZipSync };
      let page = A4; try { page = pageSetupFromHwp(JSON.parse(d.getPageDef(0))); } catch { /* A4 */ }
      await normalizeImages(model.blocks, bmpToPng);
      const bytes = buildDocx(model.blocks, page, zipSync, { hf: model.hf });
      post({ id, type: "done", result: { bytes, warn } }, [bytes.buffer]);
    } else if (op === "close") {
      doc?.free(); doc = null;
      post({ id, type: "done", result: null });
    }
  } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) { post({ id, type: "fatal" }); return; } // 메인이 워커를 버려요
    post({ id, type: "error", message: String((e as Error)?.message ?? e) });
  }
};
