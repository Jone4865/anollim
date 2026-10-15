// 한글 문서 보기 워커가 쓰는 rhwp 0.8.7 (/vendor/rhwp-0.8.7/rhwp.js, vite.config.ts 에서 그 주소로 바꿔 둠)
// 쓰는 API 만 적어요. convertToEditable·exportHwp*·exportHwpx*·exportHml·편집 API 는 일부러 넣지 않아서 실수로도 못 불러요(HWP_SPEC 5-2).
// 내보내기(Word·텍스트)용 읽기 전용 API 는 그 단계에서 더해요(HWP_SPEC 12-4-2).
declare module "vendor:rhwp" {
  export default function init(o: { module_or_path: string | URL | ArrayBuffer | Uint8Array }): Promise<unknown>;
  export class HwpDocument {
    constructor(data: Uint8Array);
    static openWithPassword(data: Uint8Array, password: string): HwpDocument;
    pageCount(): number;
    /** JSON {width,height,…} px(96dpi) */
    getPageInfo(page: number): string;
    renderPageSvg(page: number): string;
    free(): void;
  }
}
