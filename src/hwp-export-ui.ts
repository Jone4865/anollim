// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 화면 쪽 내보내기 도우미(DOM 필요): 쪽 그림 PNG 묶기·공유 시트. PDF 는 tools-hwp.ts 의 rasterize → runPdf("pages") 그대로예요.
import { makeZip } from "./ui.js";
import { exportName } from "./hwp-export.js";

/** 실측(HWP_SPEC 12-12): 150dpi 쪽당 평균 200~310KB, 200dpi 는 약 1.4배 → 넉넉히 잡아요 */
export const pngEstimateKB = (pages: number, dpi: 150 | 200) => pages * (dpi === 150 ? 300 : 420);
/** 한 번에 공유 시트로 넘기는 최대 장수. 카톡이 한 번에 받는 장수는 미확인이라 보수적으로 */
export const SHARE_MAX = 30;

export interface PagePng { page: number; blob: Blob } // page: 1부터
/** 한 장이면 PNG 그대로, 여러 장이면 집문서 makeZip(fflate, level 0) 으로 묶어요 */
export async function pngResult(original: string, pngs: PagePng[], totalPages: number): Promise<{ name: string; blob: Blob }> {
  if (pngs.length === 1) return { name: exportName(original, "png", { page: pngs[0].page, pages: totalPages }), blob: pngs[0].blob };
  const files = pngs.map((p) => ({ name: exportName(original, "png", { page: p.page, pages: totalPages }), blob: p.blob }));
  return { name: exportName(original, "png", { count: pngs.length }), blob: await makeZip(files) };
}
/** 공유 시트(카톡 등)로 그림 파일을 바로 보낼 수 있는 기기인지. canShare 는 참고만 하고 share() 오류도 받아요(MDN) */
export function shareFilesFor(original: string, pngs: PagePng[], totalPages: number): File[] | null {
  if (pngs.length > SHARE_MAX || typeof navigator.canShare !== "function") return null;
  const files = pngs.map((p) => new File([p.blob], exportName(original, "png", { page: p.page, pages: totalPages }), { type: "image/png" }));
  try { return navigator.canShare({ files }) ? files : null; } catch { return null; }
}
/** 버튼 클릭 안에서 바로 불러요(사용자 동작이 있어야 해요). 그림은 미리 다 만들어 둬요 */
export async function shareFiles(files: File[]): Promise<"shared" | "cancelled" | "failed"> {
  try { await navigator.share({ files }); return "shared"; }
  catch (e) { return (e as DOMException)?.name === "AbortError" ? "cancelled" : "failed"; }
}
