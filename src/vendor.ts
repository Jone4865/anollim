// public/vendor/ 의 고정 버전 라이브러리(일부는 CSP 에 맞게 고친 빌드)를 그 주소 그대로, 처음 쓸 때 불러와요.
// Vite 가 다시 묶지 않게 @vite-ignore 로 주소를 넘기고, 쓰는 API 만 아래에 타입으로 적어요.
// 못 불러오면 배포 틈에 받은 HTML·404 가 브라우저 캐시(/vendor/* 는 1년 immutable)에 남았을 수 있어서, 캐시를 건너뛰고 한 번 새로 받아
// 캐시를 고쳐 둬요(같은 페이지에서는 실패한 import 를 브라우저가 기억해서, 고친 캐시는 새로고침 뒤부터 쓰여요).
export const vendorImport = <T>(url: string): Promise<T> =>
  (import(/* @vite-ignore */ url) as Promise<T>).catch((e: unknown) => {
    void fetch(url, { cache: "reload" }).catch(() => {});
    throw e;
  });

/* ───── pdf-lib 1.17.1: PDF 워커에서만 써서 타입은 src/pdf-lib.d.ts 의 "vendor:pdf-lib" 모듈에 있어요 ───── */
export type { PdfLibDocument, PdfLibPage, PdfLibModule } from "vendor:pdf-lib";

/* ───── PDF.js (/vendor/pdfjs/pdf.min.mjs) ───── */
export interface PdfjsViewport { width: number; height: number }
export interface PdfjsPage {
  getViewport(o: { scale: number }): PdfjsViewport;
  // canvasContext 는 CanvasRenderingContext2D (워커 tsconfig 에는 DOM 타입이 없어서 넓게 적음)
  render(o: { canvasContext: object; viewport: PdfjsViewport }): { promise: Promise<void> };
  cleanup(): void;
}
export interface PdfjsDocument {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  destroy?(): Promise<void>;
}
export interface PdfjsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(o: {
    data: ArrayBuffer; cMapUrl: string; cMapPacked: boolean; standardFontDataUrl: string;
    isEvalSupported: boolean; enableXfa: boolean;
  }): { promise: Promise<PdfjsDocument> };
}

/* ───── heic-to 1.5.2 CSP 빌드 (/vendor/heic-to-1.5.2-csp.mjs) ───── */
export interface HeicToModule {
  heicTo(o: { blob: Blob; type: string; quality?: number }): Promise<Blob>;
}

/* ───── fflate 0.8.2 (/vendor/fflate-0.8.2.mjs) ───── */
// 스트리밍 Zip(Zip·ZipPassThrough)만 써요 — 모양은 lib.ts 의 FflateStreamModule(워커·시험에서도 같이 써서 거기에 둬요)
export type { FflateStreamModule as FflateModule } from "./lib.js";

/* ───── exifr 7.1.3 (/vendor/exifr-7.1.3.mjs) ───── */
export interface ExifData {
  latitude?: number; longitude?: number;
  Make?: string; Model?: string; LensModel?: string; Software?: string;
  DateTimeOriginal?: Date | string; CreateDate?: Date | string; ModifyDate?: Date | string;
  Artist?: string; Copyright?: string; creator?: string; SerialNumber?: string; BodySerialNumber?: string;
  [key: string]: unknown;
}
export interface Exifr {
  parse(input: Blob, opts: Record<string, boolean>): Promise<ExifData | undefined>;
}
export type ExifrModule = Exifr & { default?: Exifr };

/* ───── @imgly/background-removal 1.7.0 CSP 빌드 (/vendor/bg-removal-1.7.0-csp.mjs) ───── */
export interface BgRemovalModule {
  removeBackground(image: Blob, config: {
    publicPath: string; model: string; device: "cpu" | "gpu";
    output: { format: string };
    progress: (key: string, current: number, total: number) => void;
  }): Promise<Blob>;
}
