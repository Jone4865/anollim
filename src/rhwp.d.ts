// 한글 문서 보기 워커가 쓰는 rhwp 0.8.7 (/vendor/rhwp-0.8.7/rhwp.js, vite.config.ts 에서 그 주소로 바꿔 둠)
// 쓰는 API 만 적어요. convertToEditable·exportHwp*·exportHwpx*·exportHml·편집 API 는 일부러 넣지 않아서 실수로도 못 불러요(HWP_SPEC 5-2).
declare module "vendor:rhwp" {
  export default function init(o: { module_or_path: string | URL | ArrayBuffer | Uint8Array | Response | Promise<Response> }): Promise<unknown>;
  export class HwpDocument {
    constructor(data: Uint8Array);
    static openWithPassword(data: Uint8Array, password: string): HwpDocument;
    pageCount(): number;
    /** JSON {width,height,…} px(96dpi) */
    getPageInfo(page: number): string;
    renderPageSvg(page: number): string;
    free(): void;

    // ── 내보내기(Word·텍스트)용 읽기 전용 API (HWP_SPEC 12-4-2). 편집·exportHwp*·exportHwpx*·exportHml·convertToEditable 은 넣지 않아요 ──
    // 이름이 export…Html 이어도 문서를 바꾸지 않고 클립보드용 문자열만 돌려줘요.
    getPageDef(sec: number): string;     // JSON {width,height,margin*} HWPUNIT
    getSectionCount(): number;
    getParagraphCount(sec: number): number;
    getParagraphLength(sec: number, para: number): number;
    getTextRange(sec: number, para: number, off: number, count: number): string;
    getControls(): string;               // JSON [{ctrlId,userDesc,list,para(전체 번호),pos,controlIndex}]
    exportSelectionHtml(sec: number, sp: number, so: number, ep: number, eo: number): string;
    exportControlHtml(sec: number, para: number, cellPath: string, ci: number): string;
    getTableCellBboxes(sec: number, para: number, ci: number): string;
    getEquationProperties(sec: number, para: number, ci: number, cell: number, cellPara: number): string;
    getCellParagraphCount(sec: number, para: number, ci: number, cell: number): number;
    getCellParagraphLength(sec: number, para: number, ci: number, cell: number, cellPara: number): number;
    getTextInCell(sec: number, para: number, ci: number, cell: number, cellPara: number, off: number, count: number): string;
    // ── 각주·미주·머리말·꼬리말 조회(0장 결정 9번, 0.8.7 실측) ──
    /** JSON number[] — 문단 안 개체마다(controlIndex 순) 글 위치 */
    getControlTextPositions(sec: number, para: number): string;
    /** JSON {number, paraCount, texts[]} */
    getFootnoteInfo(sec: number, para: number, ci: number): string;
    /** JSON {items:[{sectionIdx,isHeader,applyTo}]} — 문서 전체. 인자는 '지금 고른 것' 표시용 */
    getHeaderFooterList(sec: number, isHeader: boolean, applyTo: number): string;
    /** JSON {exists, paraCount, text} */
    getHeaderFooter(sec: number, isHeader: boolean, applyTo: number): string;
    /** JSON {text} */
    getHeaderFooterParaInfo(sec: number, isHeader: boolean, applyTo: number, para: number): string;
    /** JSON {alignment, …} */
    getParaPropertiesInHf(sec: number, isHeader: boolean, applyTo: number, para: number): string;
    /** JSON {fontFamily, fontSize(1/100pt), bold, italic, underline, …} */
    getCharPropertiesInHeaderFooter(sec: number, isHeader: boolean, applyTo: number, para: number, off: number): string;
  }
}
