// 집문서 아이콘 — 시스템 컬러 이모지 대신 쓰는 직접 그린 SVG(24 격자, 2px 둥근 선, currentColor).
// 화면 코드는 여기 것만 써요. 정적 HTML(index.html·public/*.html)에 그대로 붙여 넣은 것은 test/icons.test.ts 가 같은지 봐요.
// 모든 아이콘은 꾸밈(aria-hidden)이에요 — 뜻은 옆 글자나 버튼 aria-label 이 전해요.
const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
export const ICONS: Record<string, string> = {
  up: `<svg viewBox="0 0 24 24" ${P}><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
  down: `<svg viewBox="0 0 24 24" ${P}><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
  left: `<svg viewBox="0 0 24 24" ${P}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`,
  right: `<svg viewBox="0 0 24 24" ${P}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${P}><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  rotL: `<svg viewBox="0 0 24 24" ${P}><path d="M4 4v5h5"/><path d="M4.5 13a8 8 0 1 0 2.3-6.2L4 9"/></svg>`,
  rotR: `<svg viewBox="0 0 24 24" ${P}><path d="M20 4v5h-5"/><path d="M19.5 13a8 8 0 1 1-2.3-6.2L20 9"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${P} stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`,
  dl: `<svg viewBox="0 0 24 24" ${P}><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`,
  upload: `<svg class="drop-ico" viewBox="0 0 80 60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20 h26 l8 8 v30 h-34 z" stroke-opacity=".5"/><path d="M18 24 h26 l8 8 v26 h-34 z" fill="rgba(255,255,255,.1)"/><path d="M44 24 v8 h8"/><path d="M36 2 v24 M29 19 l7 7 l7 -7" stroke-width="3"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${P}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  back: `<svg viewBox="0 0 24 24" ${P} width="16" height="16"><path d="M15 6l-6 6 6 6"/></svg>`,
  next: `<svg viewBox="0 0 24 24" ${P} width="16" height="16"><path d="M9 6l6 6-6 6"/></svg>`,
  /** 글 속 화살표(→ 자리). 크기는 CSS .arr svg */
  arrow: `<svg viewBox="0 0 24 24" ${P}><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/></svg>`,
  /** 후원 링크 커피잔: 반듯한 머그 + 받침 + 김 두 줄 */
  cup: `<svg class="ic-cup" viewBox="0 0 24 24" ${P}><path d="M9 3.2c-.9 1 .9 1.8 0 2.8M12.6 3.2c-.9 1 .9 1.8 0 2.8"/><path d="M4.5 9h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2a4.5 4.5 0 0 1-4.5-4.5z"/><path d="M15.5 10.5h1.3a2.3 2.3 0 0 1 0 4.6h-1.5"/><path d="M3.5 21h14"/></svg>`,
};
