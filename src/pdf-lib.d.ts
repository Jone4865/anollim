// PDF 워커가 쓰는 pdf-lib 1.17.1 (/vendor/pdf-lib-1.17.1.esm.min.js, vite.config.ts 에서 그 주소로 바꿔 둠)
// 쓰는 API 만 적어요.
declare module "vendor:pdf-lib" {
  export interface PdfLibRotation { angle: number }
  export type PdfLibImage = object;
  export interface PdfLibPage {
    getRotation(): PdfLibRotation;
    setRotation(r: PdfLibRotation): void;
    drawImage(img: PdfLibImage, o: { x: number; y: number; width: number; height: number }): void;
  }
  export interface PdfLibDocument {
    getPageCount(): number;
    getPageIndices(): number[];
    copyPages(src: PdfLibDocument, indices: number[]): Promise<PdfLibPage[]>;
    addPage(page?: PdfLibPage | [number, number]): PdfLibPage;
    embedPng(bytes: Uint8Array): Promise<PdfLibImage>;
    embedJpg(bytes: Uint8Array): Promise<PdfLibImage>;
    setProducer(s: string): void;
    setCreator(s: string): void;
    save(o?: { useObjectStreams?: boolean }): Promise<Uint8Array<ArrayBuffer>>;
  }
  export interface PdfLibModule {
    PDFDocument: {
      load(bytes: ArrayBuffer, o?: { updateMetadata?: boolean }): Promise<PdfLibDocument>;
      create(): Promise<PdfLibDocument>;
    };
    degrees(d: number): PdfLibRotation;
  }
  export const PDFDocument: PdfLibModule["PDFDocument"];
  export const degrees: PdfLibModule["degrees"];
}
