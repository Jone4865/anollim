// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 화면 쪽 내보내기 도우미(DOM 필요): 쪽 그림 PNG 묶기·공유 시트. PDF 는 tools-hwp.ts 의 rasterize → runPdf("pages") 그대로예요.
import { loadFflate } from "./ui.js";
import { zipWriter } from "./lib.js";
import { exportName } from "./hwp-export.js";

/** 한 번에 공유 시트로 넘기는 최대 장수. 카톡이 한 번에 받는 장수는 미확인이라 보수적으로 */
export const SHARE_MAX = 30;

export interface PagePng { page: number; blob: Blob } // page: 1부터
/** 쪽 그림 묶기: 한 장이면 PNG 그대로, 여러 장이면 그릴 때마다 ZIP 에 바로 넣어요(다 모았다가 한꺼번에 묶지 않아요) */
export interface PngPack { add(p: PagePng): Promise<void>; finish(): { name: string; blob: Blob }; abort(): void }
export async function pngPack(original: string, count: number, totalPages: number): Promise<PngPack> {
  const nameOf = (page: number) => exportName(original, "png", { page, pages: totalPages });
  if (count === 1) {
    let one: PagePng | null = null;
    return {
      async add(p) { one = p; },
      finish() { if (!one) throw new Error("쪽 그림이 없어요."); return { name: nameOf(one.page), blob: one.blob }; },
      abort() { one = null; },
    };
  }
  const w = zipWriter(await loadFflate());
  return {
    async add(p) { w.add(nameOf(p.page), new Uint8Array(await p.blob.arrayBuffer())); },
    finish() { return { name: exportName(original, "png", { count: w.count }), blob: w.finish() }; },
    abort() { w.abort(); },
  };
}
/** 공유 시트(카톡 등)로 그림 파일을 바로 보낼 수 있을 것 같은 장수·기기인지(그림을 들고 있을지 미리 정할 때) */
export const mayShare = (count: number) => count <= SHARE_MAX && typeof navigator.canShare === "function";
/** 공유 시트(카톡 등)로 그림 파일을 바로 보낼 수 있는 기기인지. canShare 는 참고만 하고 share() 오류도 받아요(MDN) */
export function shareFilesFor(original: string, pngs: PagePng[], totalPages: number): File[] | null {
  if (!pngs.length || !mayShare(pngs.length)) return null;
  const files = pngs.map((p) => new File([p.blob], exportName(original, "png", { page: p.page, pages: totalPages }), { type: "image/png" }));
  try { return navigator.canShare({ files }) ? files : null; } catch { return null; }
}
/** 버튼 클릭 안에서 바로 불러요(사용자 동작이 있어야 해요). 그림은 미리 다 만들어 둬요 */
export async function shareFiles(files: File[]): Promise<"shared" | "cancelled" | "failed"> {
  try { await navigator.share({ files }); return "shared"; }
  catch (e) { return (e as DOMException)?.name === "AbortError" ? "cancelled" : "failed"; }
}
