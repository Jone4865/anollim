// index.html 에서 CDN 으로 불러오는 rough.js · anime.js (전역). 안 불러와져도 화면은 동작해요.
interface RoughSVG {
  rectangle(x: number, y: number, w: number, h: number, o: Record<string, unknown>): SVGGElement;
  ellipse(x: number, y: number, w: number, h: number, o: Record<string, unknown>): SVGGElement;
}
interface AnimeStatic {
  (params: Record<string, unknown>): unknown;
  suspendWhenDocumentHidden: boolean;
  setDashoffset: unknown;
  stagger(value: number, o?: { start?: number }): unknown;
  random(min: number, max: number): number;
}
interface Window {
  anime?: AnimeStatic;
  rough?: { svg(svg: SVGSVGElement): RoughSVG };
}
interface Element {
  /** rough.js 테두리를 다시 그리는 함수 (fx.ts) */
  __sketch?: () => SVGGElement | undefined;
}

