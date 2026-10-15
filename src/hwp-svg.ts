// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// rhwp 가 그린 쪽 SVG 를 <img> 로 띄우기 전에 손봐요(순수 함수, DOM 없음 — vitest 로 시험).
//  - <img> 속 SVG 는 페이지의 웹 글꼴을 못 써서 @font-face 를 data URI 로 SVG 안에 넣어요.
//  - 글꼴 목록 맨 앞에 우리 이름(JMSerif/JMSans)을 붙여 기기마다 같은 모양이 되게 해요.
//  - 굵은 글꼴(Bold)은 켰을 때만 같은 이름에 font-weight 700 으로 더 넣어요. 끄면 브라우저가 흉내 낸 굵기로 그려요.
//  - 문서에서 나온 SVG 는 페이지 DOM 에 넣지 않아요(<img> 라서 스크립트가 돌 틈이 없어요).

/** 글꼴 파일 자리. rhwp 버전을 올릴 때 vendor:rhwp 경로(vite.config.ts)와 같이 바꿔요 */
export const FONT_BASE = "/vendor/rhwp-0.8.7/fonts/";
export interface FontFace { family: string; mime: "font/woff2"; base64: string; weight?: 400 | 700 }
const SERIF = "Noto Serif KR", SANS = "Noto Sans KR";
export const FAMILY = { serif: "JMSerif", sans: "JMSans" } as const;
/** 쪽에서 쓰는 묶음만 넣으려고. 굵은 글자(font-weight bold·600 이상)를 쓰는 묶음도 따로 봐요(굵은 글꼴을 켰을 때만 넣어요) */
export function usedGroups(svg: string): { serif: boolean; sans: boolean; serifBold?: true; sansBold?: true } {
  const r: { serif: boolean; sans: boolean; serifBold?: true; sansBold?: true } = { serif: svg.includes(SERIF), sans: svg.includes(SANS) };
  for (const m of svg.matchAll(/<[a-zA-Z]+\s[^>]*?font-weight="(?:bold|bolder|[6-9]00)"[^>]*>/g)) {
    const fam = /font-family="([^"]*)"/.exec(m[0])?.[1] ?? "";
    if (fam.includes(SERIF)) r.serifBold = true; else if (fam.includes(SANS)) r.sansBold = true; // preferBundledFonts 와 같은 순서(명조 먼저)
  }
  return r;
}
/** font-family 목록 맨 앞에 집문서 글꼴 이름 (rhwp 목록에 Noto Serif KR / Noto Sans KR 가 들어 있는 것만) */
export function preferBundledFonts(svg: string): string {
  return svg.replace(/font-family="([^"]*)"/g, (m, list: string) =>
    list.includes(SERIF) ? `font-family="&apos;${FAMILY.serif}&apos;,${list}"`
    : list.includes(SANS) ? `font-family="&apos;${FAMILY.sans}&apos;,${list}"` : m);
}
/** rhwp 가 못 그린 옛 차트 자리의 영어 안내를 한국어로 */
export function koreanPlaceholders(svg: string): { svg: string; charts: number } {
  let charts = 0;
  const out = svg.replace(/>([^<]*legacy HWP chart[^<]*)</g, () => { charts++; return ">이 차트는 표시하지 못했어요<"; });
  return { svg: out, charts };
}
/** <svg …> 바로 뒤에 @font-face(data URI). <img> 속 SVG 는 바깥 글꼴을 못 써서요 */
export function embedFonts(svg: string, faces: FontFace[]): string {
  if (!faces.length) return svg;
  const css = faces.map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight ?? 400};src:url(data:${f.mime};base64,${f.base64}) format('woff2')}`).join("");
  const i = svg.indexOf(">", svg.indexOf("<svg"));
  return i < 0 ? svg : svg.slice(0, i + 1) + `<style>${css}</style>` + svg.slice(i + 1);
}
export const pxToPt = (px: number) => px * 0.75;

/** 집문서가 넣는 글꼴. 굵은 것(serifBold·sansBold)은 사용자가 '제목 굵기 원본처럼'을 켰을 때만 받아요(0장 결정 3번) */
export interface Fonts { serif?: FontFace; sans?: FontFace; serifBold?: FontFace; sansBold?: FontFace }
/** 쪽 SVG 를 <img> 에 띄울 모양으로: 차트 안내 한국어로 → 글꼴 이름 앞붙이기 → 쓰는 묶음 글꼴만 넣기 */
export function prepareSvg(svg: string, fonts: Fonts): { svg: string; charts: number } {
  const k = koreanPlaceholders(svg);
  const used = usedGroups(k.svg);
  const faces: FontFace[] = [];
  if (used.serif && fonts.serif) faces.push(fonts.serif);
  if (used.sans && fonts.sans) faces.push(fonts.sans);
  if (used.serifBold && fonts.serifBold) faces.push(fonts.serifBold);
  if (used.sansBold && fonts.sansBold) faces.push(fonts.sansBold);
  return { svg: embedFonts(preferBundledFonts(k.svg), faces), charts: k.charts };
}
