// PDF 워커가 쓰는 pdf-lib 1.17.1 (/vendor/pdf-lib-1.17.1.esm.min.js, vite.config.ts 에서 그 주소로 바꿔 둠)
// 쓰는 API 만 적어요. 아래 class 들은 실제로 내보내는 것이라 instanceof 로 확인할 수 있어요.
declare module "vendor:pdf-lib" {
  export interface PdfLibRotation { angle: number }
  export type PdfLibImage = object;
  /** PDF 안의 값 하나 (이름 · 수 · 배열 · 사전 · 참조 · 스트림 …) */
  export interface PdfLibObject { toString(): string }
  export class PDFName implements PdfLibObject {
    static of(name: string): PDFName;
    asString(): string;
  }
  export class PDFNumber implements PdfLibObject {
    static of(n: number): PDFNumber;
    asNumber(): number;
  }
  export class PDFRef implements PdfLibObject {}
  export class PDFArray implements PdfLibObject {
    size(): number;
    get(i: number): PdfLibObject;
  }
  export class PDFDict implements PdfLibObject {
    get(key: PDFName): PdfLibObject | undefined;
    set(key: PDFName, value: PdfLibObject): void;
    delete(key: PDFName): boolean;
    has(key: PDFName): boolean;
    clone(context?: PdfLibContext): PDFDict;
  }
  export class PDFStream implements PdfLibObject {
    dict: PDFDict;
  }
  export class PDFRawStream extends PDFStream {
    contents: Uint8Array;
    static of(dict: PDFDict, contents: Uint8Array): PDFRawStream;
  }
  export interface PdfLibContext {
    enumerateIndirectObjects(): [PDFRef, PdfLibObject][];
    lookup(obj: PdfLibObject | undefined): PdfLibObject | undefined;
    assign(ref: PDFRef, obj: PdfLibObject): void;
  }
  export interface PdfLibPage {
    getRotation(): PdfLibRotation;
    setRotation(r: PdfLibRotation): void;
    drawImage(img: PdfLibImage, o: { x: number; y: number; width: number; height: number }): void;
  }
  export interface PdfLibDocument {
    context: PdfLibContext;
    getPageCount(): number;
    getPageIndices(): number[];
    copyPages(src: PdfLibDocument, indices: number[]): Promise<PdfLibPage[]>;
    addPage(page?: PdfLibPage | [number, number]): PdfLibPage;
    embedPng(bytes: Uint8Array): Promise<PdfLibImage>;
    embedJpg(bytes: Uint8Array): Promise<PdfLibImage>;
    save(o?: { useObjectStreams?: boolean }): Promise<Uint8Array<ArrayBuffer>>;
  }
  export interface PdfLibModule {
    PDFDocument: {
      load(bytes: ArrayBuffer, o?: { updateMetadata?: boolean }): Promise<PdfLibDocument>;
      create(o?: { updateMetadata?: boolean }): Promise<PdfLibDocument>;
    };
    degrees(d: number): PdfLibRotation;
  }
  export const PDFDocument: PdfLibModule["PDFDocument"];
  export const degrees: PdfLibModule["degrees"];
}
