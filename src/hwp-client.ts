// 한글 문서 보기 워커(src/hwp-worker.ts)를 부르는 쪽. pdf 워커와 같은 id·pending 방식이에요.
//  - 시간 한도(열기 30초, 쪽 그리기 15초)를 넘기거나 WASM 이 멈추면(fatal) 워커를 버리고, 다음 요청 때 새로 만들어요.
//  - "다른 파일"을 누르면 dispose() 로 워커를 통째로 버려요(free() 로는 WASM 메모리가 줄지 않아요).
//  - 문서 암호는 open 메시지로만 넘기고 여기에 남기지 않아요. 오류 문구에도 넣지 않아요.

export type HwpClientErrCode = "load" | "timeout" | "fatal" | "worker" | "error";
export class HwpClientError extends Error {
  constructor(public code: HwpClientErrCode, message: string) { super(message); this.name = "HwpClientError"; }
}
export interface OpenResult { pages: number; sizes: { w: number; h: number }[] }

interface Pending { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
/** init 은 처음 한 번 WASM(전송 약 3~4MB)을 받는 시간까지라 넉넉히 잡아요 */
export const HWP_TIMEOUT = { init: 120_000, open: 30_000, svg: 15_000 } as const;

export class HwpClient {
  private w: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private worker(): Worker {
    if (this.w) return this.w;
    const w = new Worker(new URL("./hwp-worker.js", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<{ id: number; type: string; result?: unknown; message?: string; code?: string }>) => {
      const { id, type } = ev.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (type === "progress") return; // 보기 단계에서는 진행 메시지가 없어요(내보내기 단계에서 써요)
      this.pending.delete(id);
      clearTimeout(p.timer);
      if (type === "done") p.resolve(ev.data.result);
      else if (type === "fatal") { this.kill(); p.reject(new HwpClientError("fatal", "보기 도구가 멈췄어요.")); }
      else p.reject(new HwpClientError(ev.data.code === "load" ? "load" : "error", ev.data.message || ""));
    };
    w.onerror = (e) => {
      e.preventDefault?.();
      this.failAll(new HwpClientError("worker", "보기 도구를 불러오지 못했어요."));
    };
    this.w = w;
    return w;
  }

  private request<T>(op: string, args: unknown, ms: number, transfer: Transferable[] = []): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        // 끝나지 않는 문서: 워커를 버려야 WASM 이 멈춰요
        this.failAll(new HwpClientError("timeout", "시간이 너무 오래 걸려요."));
      }, ms);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      try { this.worker().postMessage({ id, op, args }, transfer); }
      catch (e) { this.pending.delete(id); clearTimeout(timer); reject(new HwpClientError("worker", String((e as Error)?.message ?? e))); }
    });
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
  /** 워커를 버려요. 기다리던 요청은 모두 취소돼요 */
  dispose(): void {
    this.failAll(new HwpClientError("error", "취소했어요."));
  }
  get alive(): boolean { return !!this.w; }

  private kill(): void {
    if (this.w) { try { this.w.terminate(); } catch { /* 무시 */ } this.w = null; }
  }
  private failAll(err: HwpClientError): void {
    this.kill();
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) { clearTimeout(p.timer); p.reject(err); }
  }
}
