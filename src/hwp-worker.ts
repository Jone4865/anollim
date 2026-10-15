// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 한글 문서(HWP·HWPX·HWP 3.0) 보기 전용 워커 (module worker). rhwp(WASM)를 띄우고 쪽을 SVG 로 그려요.
// 문서·암호는 이 워커 메모리에서만 다뤄요. 화면이 "다른 파일"을 누르면 워커를 통째로 버려요(free() 로는 WASM 메모리가 줄지 않아요).
// 글자 폭 측정기(measureTextWidth)는 두지 않아요: 0.8.7 의 rhwp.js 는 그 콜백을 찾지 않아요(README 의 '필수 설정'은 옛 설명, HWP_SPEC 3-4).
// 버전을 올릴 때 dev/update-rhwp.sh 가 다시 확인해요.
// Word·텍스트 내보내기 작업(docx·txt)은 다음 단계에서 이 워커에 더해요(HWP_SPEC 12-13).
import init, { HwpDocument } from "vendor:rhwp";

const WASM = "/vendor/rhwp-0.8.7/rhwp_bg.wasm";
let ready: Promise<unknown> | null = null;
let doc: HwpDocument | null = null;

type Msg =
  | { id: number; op: "init"; args?: undefined }
  | { id: number; op: "open"; args: { buf: ArrayBuffer; password?: string } }
  | { id: number; op: "svg"; args: { page: number } }
  | { id: number; op: "close"; args?: undefined };

const post = (m: unknown) => self.postMessage(m);

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const { id, op } = ev.data;
  try {
    try {
      ready ||= init({ module_or_path: WASM }).catch((e) => { ready = null; throw e; }); // 받기 실패면 다음에 다시
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
    } else if (op === "close") {
      doc?.free(); doc = null;
      post({ id, type: "done", result: null });
    }
  } catch (e) {
    if (e instanceof WebAssembly.RuntimeError) { post({ id, type: "fatal" }); return; } // 메인이 워커를 버려요
    post({ id, type: "error", message: String((e as Error)?.message ?? e) });
  }
};
