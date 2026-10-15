// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 한글 문서 워커(src/hwp-worker.ts)를 부르는 쪽. pdf 워커와 같은 id·pending 방식이에요.
//  - 요청은 하나씩 차례로 보내요. 시간 한도는 워커에 보낸 때부터 재요(긴 Word 만들기 뒤에 줄 선 쪽 그리기가 한도를 넘었다고 워커를 버리지 않게).
//  - 시간 한도(열기 30초, 쪽 그리기 15초, Word 60초, 텍스트 30초)를 넘기거나 WASM 이 멈추면(fatal) 워커를 버리고, 다음 요청 때 새로 만들어요.
//  - "다른 파일"을 누르면 dispose() 로 워커를 통째로 버려요(free() 로는 WASM 메모리가 줄지 않아요).
//  - 문서 암호는 open 메시지로만 넘기고 여기에 남기지 않아요. 오류 문구에도 넣지 않아요.
import type { Warn } from "./hwp-export.js";

export type HwpClientErrCode = "load" | "timeout" | "fatal" | "worker" | "error";
export class HwpClientError extends Error {
  constructor(public code: HwpClientErrCode, message: string) { super(message); this.name = "HwpClientError"; }
}
export interface OpenResult { pages: number; sizes: { w: number; h: number }[] }
export interface ExportProgress { done: number; total: number; phase?: "pack" }
export interface DocxResult { bytes: Uint8Array<ArrayBuffer>; warn: Warn }
export interface TxtResult { text: string; warn: Warn }

interface Job {
  id: number; op: string; args: unknown; ms: number; transfer: Transferable[];
  resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: ExportProgress) => void;
  timer?: ReturnType<typeof setTimeout>;
}
/** init 은 처음 한 번 WASM(전송 약 3~4MB)을 받는 시간까지라 넉넉히 잡아요. Word·텍스트는 HWP_SPEC 12-10 */
export const HWP_TIMEOUT = { init: 120_000, open: 30_000, svg: 15_000, docx: 60_000, txt: 30_000 } as const;
/** 워커가 import 하는 보기 도구 주소(vite.config.ts 의 RHWP 와 같아요) */
const RHWP_JS = "/vendor/rhwp-0.8.7/rhwp.js";

export class HwpClient {
  private w: Worker | null = null;
  private seq = 0;
  private queue: Job[] = [];
  private active: Job | null = null;

  private worker(): Worker {
    if (this.w) return this.w;
    const w = new Worker(new URL("./hwp-worker.js", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<{ id: number; type: string; result?: unknown; message?: string; code?: string; done?: number; total?: number; phase?: "pack" }>) => {
      const { id, type } = ev.data;
      const j = this.active;
      if (!j || j.id !== id) return;
      if (type === "progress") { j.onProgress?.({ done: ev.data.done ?? 0, total: ev.data.total ?? 0, phase: ev.data.phase }); return; } // 끝내지 않고 진행만
      clearTimeout(j.timer);
      this.active = null;
      if (type === "done") j.resolve(ev.data.result);
      else if (type === "fatal") { this.failAll(new HwpClientError("fatal", "보기 도구가 멈췄어요."), j); return; }
      else j.reject(new HwpClientError(ev.data.code === "load" ? "load" : "error", ev.data.message || ""));
      this.pump();
    };
    w.onerror = (e) => {
      e.preventDefault?.();
      // 배포 틈에 받은 HTML·404 가 브라우저 캐시(/vendor/* 는 1년 immutable)에 남아 워커가 못 떴을 수 있어요.
      // 캐시를 건너뛰고 한 번 새로 받아 캐시를 고쳐 두면, 다음에 만드는 워커는 제대로 받아요
      void fetch(RHWP_JS, { cache: "reload" }).catch(() => {});
      this.failAll(new HwpClientError("worker", "보기 도구를 불러오지 못했어요."));
    };
    this.w = w;
    return w;
  }

  private request<T>(op: string, args: unknown, ms: number, transfer: Transferable[] = [], onProgress?: (p: ExportProgress) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id: ++this.seq, op, args, ms, transfer, resolve: resolve as (v: unknown) => void, reject, onProgress });
      this.pump();
    });
  }
  /** 앞 요청이 끝났으면 다음 요청을 보내요. 시간 한도는 이때부터 */
  private pump(): void {
    if (this.active) return;
    const j = this.queue.shift();
    if (!j) return;
    this.active = j;
    j.timer = setTimeout(() => {
      if (this.active !== j) return;
      // 끝나지 않는 문서: 워커를 버려야 WASM 이 멈춰요
      this.failAll(new HwpClientError("timeout", "시간이 너무 오래 걸려요."), j);
    }, j.ms);
    try { this.worker().postMessage({ id: j.id, op: j.op, args: j.args }, j.transfer); }
    catch (e) {
      clearTimeout(j.timer); this.active = null;
      j.reject(new HwpClientError("worker", String((e as Error)?.message ?? e)));
      this.pump();
    }
  }

  /** 보기 도구(WASM)를 받아 띄우기만 해요. 처음 한 번 받는 동안 진행 문구를 따로 보여 주려고요 */
  init(): Promise<void> {
    return this.request<void>("init", undefined, HWP_TIMEOUT.init);
  }
  /** 문서 열기. buf 는 워커로 넘어가요(transfer). 원본은 부르는 쪽이 따로 갖고 있어요 */
  open(buf: ArrayBuffer, password?: string): Promise<OpenResult> {
    return this.request<OpenResult>("open", password ? { buf, password } : { buf }, HWP_TIMEOUT.open, [buf]);
  }
  /** 쪽 하나를 SVG 문자열로 (0부터) */
  svg(page: number): Promise<string> {
    return this.request<string>("svg", { page }, HWP_TIMEOUT.svg);
  }
  /** 열린 문서를 Word(.docx) 바이트로. 그림·머리말·각주까지 워커 안에서 만들어요 */
  docx(onProgress?: (p: ExportProgress) => void): Promise<DocxResult> {
    return this.request<DocxResult>("docx", undefined, HWP_TIMEOUT.docx, [], onProgress);
  }
  /** 열린 문서를 글자만(.txt, BOM + CRLF) */
  txt(onProgress?: (p: ExportProgress) => void): Promise<TxtResult> {
    return this.request<TxtResult>("txt", undefined, HWP_TIMEOUT.txt, [], onProgress);
  }
  /** 워커를 버려요. 기다리던 요청은 모두 취소돼요 */
  dispose(): void {
    this.failAll(new HwpClientError("error", "취소했어요."));
  }
  get alive(): boolean { return !!this.w; }

  private kill(): void {
    if (this.w) { try { this.w.terminate(); } catch { /* 무시 */ } this.w = null; }
  }
  /** 워커를 버리고 기다리던 요청을 모두 끝내요. cause(한도를 넘긴·멈춘 요청)는 그 이유로, 줄 서 있던 나머지는 '취소'로 */
  private failAll(err: HwpClientError, cause?: Job): void {
    this.kill();
    const all = [...(this.active ? [this.active] : []), ...this.queue];
    this.active = null; this.queue = [];
    const cancelled = new HwpClientError("error", "취소했어요.");
    for (const j of all) { clearTimeout(j.timer); j.reject(!cause || j === cause ? err : cancelled); }
  }
}
