// 손그림 문구류 일러스트 (연필 선). 색: currentColor = 잉크, --acc = 포인트(파랑)
// 같은 그림을 assets/t-*.svg 로도 내보내요 (dev/export-art.mjs).

const S = 'stroke-width="2.3"'; // 기본 fill="none" stroke="currentColor" 는 바깥 <g> 에서 줘요
const A = 'fill="var(--acc, #2563eb)" fill-opacity=".22" stroke="none"';

export const ART = {
  // 스테이플러 = 합치기
  "pdf-merge": `
    <path ${A} d="M20 47 L95 39 Q104 38 104 45 L104 47 L22 55 Z"/>
    <path ${S} d="M28 76 l58 -3 l3 9 l-58 3 z" stroke-opacity=".55"/>
    <path ${S} d="M24 73 l58 -4 l4 9 l-58 4 z" fill="#fffdf7"/>
    <path ${S} d="M12 70 Q12 64 18 64 L102 63 Q108 63 108 68 L108 70 Q108 74 103 74 L16 75 Q12 75 12 70 Z"/>
    <path ${S} d="M19 60 Q18 46 30 44 L96 37 Q105 36 105 44 Q105 50 97 51 L36 58"/>
    <path ${S} d="M95 51 l1 12"/>
    <circle ${S} cx="22" cy="58" r="5.5"/>
    <path ${S} d="M40 44 l-1 -4 M58 42 l-1 -4 M76 40 l-1 -4" stroke-opacity=".5"/>`,
  // 가위 = 나누기
  "pdf-split": `
    <path ${S} d="M14 22 l62 -6 l4 58 l-62 6 z" fill="#fffdf7"/>
    <path ${S} d="M17 50 l6 -0.5 M28 49 l6 -0.5 M39 48 l6 -0.5 M50 47 l6 -0.5 M61 46 l6 -0.5" stroke="var(--acc, #2563eb)"/>
    <path ${A} d="M70 44 L110 30 L108 36 Z"/>
    <path ${S} d="M70 46 L111 29 Q112 33 108 37 L74 50"/>
    <path ${S} d="M70 46 L109 64 Q107 68 103 66 L74 52"/>
    <ellipse ${S} cx="58" cy="35" rx="9" ry="7" transform="rotate(-20 58 35)"/>
    <ellipse ${S} cx="58" cy="62" rx="9" ry="7" transform="rotate(20 58 62)"/>
    <path ${S} d="M65 39 L72 47 M65 58 L72 50"/>
    <circle cx="73" cy="48.5" r="1.8" fill="currentColor"/>`,
  // 돌리기·순서
  "pdf-organize": `
    <path ${S} d="M40 18 l40 4 l-5 52 l-40 -4 z" fill="#fffdf7" transform="rotate(8 60 46)"/>
    <path ${S} d="M48 32 h22 M47 40 h20 M46 48 h23 M45 56 h14" stroke-opacity=".45" transform="rotate(8 60 46)"/>
    <path ${S} d="M22 52 Q16 22 44 12" stroke="var(--acc, #2563eb)"/>
    <path ${S} d="M36 8 l9 4 l-6 8" stroke="var(--acc, #2563eb)"/>
    <path ${S} d="M100 36 Q106 66 78 78" stroke="var(--acc, #2563eb)"/>
    <path ${S} d="M86 82 l-9 -4 l6 -8" stroke="var(--acc, #2563eb)"/>`,
  // 사진 → PDF
  "img-to-pdf": `
    <path ${S} d="M10 26 l42 -4 l3 34 l-42 4 z" fill="#fffdf7"/>
    <path ${S} d="M15 54 l11 -13 l8 8 l5 -5 l11 11"/>
    <circle ${S} cx="41" cy="33" r="3.5"/>
    <path ${S} d="M60 44 q8 -6 16 0" stroke="var(--acc, #2563eb)"/>
    <path ${S} d="M71 39 l6 5 l-7 4" stroke="var(--acc, #2563eb)"/>
    <path ${S} d="M82 16 l20 0 l9 9 l0 50 l-29 0 z" fill="#fffdf7"/>
    <path ${S} d="M102 16 l0 9 l9 0"/>
    <path ${A} d="M85 50 h23 v12 h-23 z"/>
    <path d="M88 60 v-8 h3 q3 0 3 3 t-3 3 h-3 M97 52 v8 h2 q4 0 4 -4 t-4 -4 h-2 M106 60 v-8 h4 M106 56 h3" stroke-width="1.6"/>`,
  // 프레스 = 압축
  "img-compress": `
    <path ${S} d="M20 82 L100 82 M24 82 L24 16 M96 82 L96 16 M18 16 L102 16"/>
    <path ${S} d="M60 16 L60 40 M54 22 l12 3 M54 28 l12 3 M54 34 l12 3"/>
    <path d="M44 8 L76 8" stroke-width="3"/>
    <circle cx="44" cy="8" r="3" fill="currentColor"/><circle cx="76" cy="8" r="3" fill="currentColor"/>
    <path ${A} d="M34 40 h52 v7 h-52 z"/>
    <path ${S} d="M34 40 h52 v7 h-52 z"/>
    <path ${S} d="M36 70 l48 0 l0 10 l-48 0 z" fill="#fffdf7"/>
    <path ${S} d="M38 64 l44 -1 M38 67 l44 0" stroke-opacity=".6"/>
    <path ${S} d="M40 52 l0 6 l-3 -3 M40 58 l3 -3 M80 52 l0 6 l-3 -3 M80 58 l3 -3" stroke="var(--acc, #2563eb)"/>`,
  // 칼 + 오린 사람 = 배경 지우기
  "bg-remove": `
    <path ${S} d="M10 14 l58 0 l0 66 l-58 0 z" stroke-opacity=".5" stroke-dasharray="3 5"/>
    <path ${A} d="M24 80 Q24 56 39 54 Q50 56 54 80 Z"/>
    <circle ${A} cx="39" cy="40" r="10"/>
    <path ${S} d="M24 80 Q24 56 39 54 Q50 56 54 80 M39 30 a10 10 0 1 1 -0.1 0" />
    <path ${S} d="M104 18 L78 60 L72 62 L74 56 L100 14 Z" fill="#fffdf7"/>
    <path ${S} d="M100 14 L112 4 Q116 6 114 10 L104 18" />
    <path ${S} d="M74 56 L60 70" stroke="var(--acc, #2563eb)" stroke-dasharray="2 4"/>`,
  // 지우개 = 위치 정보 지우기
  "exif-clean": `
    <path ${S} d="M36 72 C24 58 16 48 16 36 a20 20 0 0 1 40 0 c0 12 -8 22 -20 36 z" stroke-dasharray="5 4" stroke-opacity=".55"/>
    <circle ${S} cx="36" cy="36" r="7" stroke-opacity=".55"/>
    <path ${S} d="M58 66 L90 26 L110 42 L80 82 Z" fill="#fffdf7"/>
    <path ${A} d="M58 66 L70 51 L90 67 L80 82 Z"/>
    <path ${S} d="M70 51 L90 67"/>
    <path ${S} d="M18 84 q10 -4 20 0 t20 0" stroke-opacity=".45"/>
    <circle cx="46" cy="76" r="1.5" fill="currentColor"/><circle cx="52" cy="80" r="1.2" fill="currentColor"/><circle cx="40" cy="80" r="1" fill="currentColor"/>`,
};

export const ART_VIEWBOX = "0 0 120 90";
export const G = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

/** 인라인 SVG 문자열 (잉크색 = currentColor) */
export function art(id, cls = "art") {
  return `<svg class="${cls}" viewBox="${ART_VIEWBOX}" aria-hidden="true"><g filter="url(#pencil)" ${G}>${ART[id] || ""}</g></svg>`;
}

/** "안 나감" 도장 */
export function stamp(cls = "stamp", sub = "파일은 여기 그대로") {
  return `<svg class="${cls}" viewBox="0 0 160 160" aria-hidden="true">
    <defs><path id="stamp-arc" d="M28 80 a52 52 0 1 1 104 0 a52 52 0 1 1 -104 0"/></defs>
    <g filter="url(#ink)" fill="none" stroke="currentColor">
      <circle cx="80" cy="80" r="72" stroke-width="5"/>
      <circle cx="80" cy="80" r="62" stroke-width="2"/>
      <circle cx="80" cy="80" r="40" stroke-width="2"/>
      <text fill="currentColor" stroke="none" font-size="13" font-weight="800" letter-spacing="3"><textPath href="#stamp-arc" startOffset="2%">${sub} · ${sub} ·</textPath></text>
      <text x="80" y="91" text-anchor="middle" fill="currentColor" stroke="none" font-size="30" font-weight="900" letter-spacing="-1">안 나감</text>
    </g></svg>`;
}

/** 페이지 공통 SVG 필터 (연필 흔들림, 도장 잉크 번짐) */
export const FILTERS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
  <filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.3" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="c"/><feTurbulence type="fractalNoise" baseFrequency="0.05" seed="7" result="w"/><feDisplacementMap in="c" in2="w" scale="2.5"/></filter>
</defs></svg>`;
