// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 한컴 전용 영역 글자(PUA) → 보통 유니코드. Word·텍스트로 옮길 때만 써요(화면 SVG 는 rhwp 가 같은 표로 이미 바꿔 그려요).
// 워커가 내보낼 때만 불러요(옛한글 표 약 50KB — 화면·보기에는 싣지 않아요).
//
// 표와 순서는 rhwp v0.8.7 을 그대로 옮겼어요. rhwp: MIT, Copyright (c) 2025-2026 Edward Kim (/vendor/rhwp-0.8.7/LICENSE).
//  - src/renderer/composer.rs `text_surface_replacement`(rhwp 의 텍스트 뽑기용 변환)와 `expand_pua_display_text`(화면용)의 순서
//  - src/renderer/hancom_pua.rs `VERIFIED_HANCOM_PUA_DISPLAY`(한컴 PDF 와 대조해 확인한 기호)
//  - src/renderer/layout/paragraph_layout.rs `map_pua_bullet_char`(글머리·괘선 기호)
//  - src/parser/tags.rs `HANCOM_SYMBOL_BMP_TO_PLANE15`(HWP5 가 0xA000|X 로 싣는 한컴 기호)
//  - src/renderer/pua_oldhangul.rs(옛한글, 원본 KTUG HanyangPuaTableProject — Public Domain) → hwp-pua-oldhangul.ts(자동 생성)
// rhwp 와 같은 원칙: 표에 없는 PUA 는 뜻을 지어내지 않고 그대로 두고, 개수만 세서 안내해요.
import { OLD_HANGUL_FROM, OLD_HANGUL_DATA } from "./hwp-pua-oldhangul.js";
import type { Warn } from "./hwp-export.js";

/** hancom_pua.rs — 한컴 PDF 대조로 뜻이 확정된 기호 */
const VERIFIED: ReadonlyMap<number, string> = new Map([
  [0xF0090, "✺"], [0xF012B, "(인)"],
  [0xF0288, "⓪"], [0xF0289, "①"], [0xF028A, "②"], [0xF028C, "④"], [0xF028D, "⑤"], [0xF028E, "⑥"], [0xF028F, "⑦"], [0xF0290, "⑧"], [0xF0291, "⑨"],
  [0xF02EC, "◇"], [0xF02FB, "▸"], [0xF02FC, "►"], [0xF031C, "■"], [0xF03A0, "↵"], [0xF03A7, "⊟"], [0xF03A8, "⊞"], [0xF03C5, "□"], [0xF03DA, "□"],
  [0xF03EF, "한"], [0xF03F0, "글"], [0xF03F1, "과"], [0xF03F2, "컴"], [0xF03F3, "퓨"], [0xF03F4, "터"], [0xF03FF, "□"],
  [0xF0806, "┌"], [0xF0807, "┬"], [0xF0808, "┐"], [0xF080C, "└"], [0xF080E, "┘"], [0xF0810, "│"], [0xF081C, "┈"], [0xF0832, "═"], [0xF0848, "━"],
]);

/** paragraph_layout.rs map_pua_bullet_char — 평면 15(U+F0000~) 쪽 */
const BULLET15: ReadonlyMap<number, string> = new Map([
  [0xF003B, "↓"], [0xF02EF, "·"],
  [0xF0854, "《"], [0xF0855, "》"], [0xF00DA, "▸"], [0xF080F, "━"], [0xF0811, "┌"], [0xF0817, "└"], [0xF081A, "─"], [0xF0827, "═"],
]);
/** 같은 함수의 U+F020~U+F0FF 쪽(기호 글꼴의 글머리). 키는 아래 두 자리(U+F0xx 의 xx) */
const BULLET_BMP: ReadonlyMap<number, string> = new Map([
  [0x6C, "●"], [0x6D, "●"], [0x6E, "■"], [0x6F, "□"], [0x70, "□"], [0x71, "□"], [0x72, "□"], [0x73, "⬧"], [0x74, "⧫"], [0x75, "◆"], [0x76, "❖"], [0x77, "⬥"],
  [0x9E, "·"], [0x9F, "•"], [0xA0, "·"], [0xA1, "⚪"], [0xA2, "○"], [0xA3, "○"], [0xA4, "◉"], [0xA5, "◎"], [0xA7, "▪"], [0xA8, "◻"],
  [0xAA, "✦"], [0xAB, "★"], [0xAC, "✶"], [0xAD, "✴"], [0xAE, "✹"],
  [0x45, "☜"], [0x46, "☞"], [0x47, "☝"], [0x48, "☟"],
  [0xFB, "✗"], [0xFC, "✔"], [0xFD, "☒"], [0xFE, "☑"],
  [0xE8, "➔"], [0xEF, "⇦"], [0xF0, "⇨"], [0xF1, "⇧"], [0xF2, "⇩"],
  [0x22, "✂"], [0x36, "⌛"], [0x4A, "☺"], [0x4E, "☠"], [0x52, "☼"], [0x54, "❄"], [0x58, "✠"], [0x59, "✡"],
]);
/** tags.rs — HWP5 는 같은 기호를 0xA000|X 로 싣고 HWPX 는 U+F0000|X 로 실어요(한글 실측 값만) */
const HWP5_SYMBOL: ReadonlySet<number> = new Set([
  0xA0E1, 0xA12B,
  0xA289, 0xA28A, 0xA292, 0xA293, 0xA294, 0xA295, 0xA296, 0xA297, 0xA298, 0xA299, 0xA29A, 0xA29B,
  0xA2B1, 0xA2B2, 0xA2B3, 0xA2B4, 0xA2B5, 0xA2B6, 0xA2B7, 0xA2B8, 0xA2B9,
  0xA2BA, 0xA2BB, 0xA2BC, 0xA2BD, 0xA2BE, 0xA2BF, 0xA2C0, 0xA2C3, 0xA2C4, 0xA2C5, 0xA2C6, 0xA2C7, 0xA2C8, 0xA2C9, 0xA2CA, 0xA2CB, 0xA2CC,
  0xA2FC, 0xA3C5, 0xA807, 0xA80A, 0xA80E, 0xA80F, 0xA810, 0xA81A, 0xA832, 0xA852, 0xA853, 0xA854, 0xA855,
]);

let oldHangul: string[] | null = null;
const isPua = (cp: number) => (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0xFFFFD) || (cp >= 0x100000 && cp <= 0x10FFFD);
/** 바꿀 게 있을 수 있는 글자(BMP PUA · 평면 15·16 의 앞 서로게이트 · HWP5 기호 자리) */
const MAYBE = /[\uE000-\uF8FF\uDB80-\uDBFF\uA0E1-\uA855]/;

/** 글자 하나(코드 포인트) → 바꾼 글. 표에 없는 PUA 면 null */
export function puaChar(cp0: number): string | null {
  // HWP5 의 한컴 기호 자리는 평면 15 로 맞춰요(HWPX 와 같은 글자). 그대로 두면 이 글자(이족 문자 등)로 보여요
  const cp = HWP5_SYMBOL.has(cp0) ? 0xF0000 | (cp0 & 0xFFF) : cp0;
  // composer.rs text_surface_replacement: 네모 안 숫자 1~20 → ①~⑳, 네모 0 → ⓪, U+F02C5 → ⑫(한글 실측)
  if (cp >= 0xF02B1 && cp <= 0xF02C4) return String.fromCodePoint(0x2460 + cp - 0xF02B1);
  if (cp === 0xF02B0) return "⓪";
  if (cp === 0xF02C5) return "⑫";
  const v = VERIFIED.get(cp); if (v) return v;
  // 반전 사각형 안 숫자(글자 겹치기용) → 숫자
  if (cp >= 0xF02CE && cp <= 0xF02E1) return String(cp - 0xF02CD);
  if (cp >= OLD_HANGUL_FROM && cp <= 0xF8FF) {
    oldHangul ??= OLD_HANGUL_DATA.split(",");
    const j = oldHangul[cp - OLD_HANGUL_FROM]; if (j) return j; // 표 밖(끝 뒤)이면 undefined
  }
  const b = cp >= 0xF0000 ? BULLET15.get(cp) : cp >= 0xF020 && cp <= 0xF0FF ? BULLET_BMP.get(cp - 0xF000) : undefined;
  if (b) return b;
  if (cp !== cp0) return String.fromCodePoint(cp); // 평면 15 로 맞춘 한컴 기호(뜻 모름) — 아래에서 PUA 로 세요
  return null;
}

/** 글 하나를 바꿔요. unknown 은 바꾸지 못한(그대로 둔) PUA 글자 수 */
export function puaToText(s: string): { text: string; unknown: number } {
  if (!MAYBE.test(s)) return { text: s, unknown: 0 };
  let out = "", unknown = 0;
  for (const ch of s) {
    const t = puaChar(ch.codePointAt(0) as number) ?? ch;
    if (isPua(t.codePointAt(0) as number)) unknown++; // 바꾼 글은 PUA 로 시작하지 않아요
    out += t;
  }
  return { text: out, unknown };
}

/** 내보내기용: 바꾸면서 못 바꾼 개수를 warn.pua 에 더해요 */
export function puaFixer(warn: Warn): (s: string) => string {
  return (s) => {
    const r = puaToText(s);
    if (r.unknown) warn.pua = (warn.pua ?? 0) + r.unknown;
    return r.text;
  };
}
