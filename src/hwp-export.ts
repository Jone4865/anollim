// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 내보내기 공용(DOM 없음 — 워커·화면·시험 어디서나 돌아요): 형식별 허용, 파일 이름.
// Word·텍스트용 블록 모델·rhwp HTML 읽기·텍스트 만들기는 다음 단계에서 이 파일에 더해요(HWP_SPEC 12-13).
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

/* ───── 파일 이름 (lib.ts 의 outName·safeName·baseName 규칙 그대로) ───── */
const pad = (n: number, total: number) => String(n).padStart(String(total).length, "0");
/** PDF·Word·텍스트: 원래 이름.확장자 / 쪽 그림 한 장: 이름-3쪽.png / 여러 장: zip 안 이름-03쪽.png, zip 은 이름-쪽그림-12장.zip */
export function exportName(original: string, fmt: ExportFormat, o: { page?: number; pages?: number; count?: number } = {}): string {
  if (fmt === "png") return o.count && o.count > 1 ? outName(original, `쪽그림-${o.count}장`, "zip") : outName(original, `${pad(o.page ?? 1, o.pages ?? 1)}쪽`, "png");
  return outName(original, "", fmt);
}
