// 옛한글 PUA 표 만들기 (개발용): node dev/make-hwp-pua.mjs → src/hwp-pua-oldhangul.ts
// rhwp v0.8.7 렌더러가 화면(SVG)에 쓰는 표(src/renderer/pua_oldhangul.rs)를 버전·해시를 고정해 받아서,
// Word·텍스트 내보내기에서 쓸 수 있게 짧은 글자열 하나로 바꿔요. rhwp 버전을 올릴 때 VER·SHA 를 같이 바꿔요.
//  - rhwp: MIT, Copyright (c) 2025-2026 Edward Kim (/vendor/rhwp-0.8.7/LICENSE)
//  - 표의 원본: KTUG HanyangPuaTableProject hypua2jamocomposed.txt (Public Domain)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

const VER = "0.8.7";
const SHA = "ce25d25f0cdbba64073667a057af70665a6f077ac5756225adacea9feb2cb2a0";
const URL_ = `https://raw.githubusercontent.com/edwardkim/rhwp/v${VER}/src/renderer/pua_oldhangul.rs`;
const src = process.argv[2] ? fs.readFileSync(process.argv[2], "utf8") : await (await fetch(URL_)).text();
const sha = crypto.createHash("sha256").update(src, "utf8").digest("hex");
if (sha !== SHA) { console.error(`해시가 달라요: ${sha} (기대 ${SHA})`); process.exit(1); }

const start = src.indexOf("static PUA_OLDHANGUL_MAP");
const body = src.slice(start, src.indexOf("];", start));
const map = new Map();
for (const m of body.matchAll(/\(\s*0x([0-9A-F]+),\s*&\[([^\]]*)\],?\s*\)/g)) {
  map.set(parseInt(m[1], 16), [...m[2].matchAll(/\\u\{([0-9A-F]+)\}/g)].map((x) => String.fromCodePoint(parseInt(x[1], 16))).join(""));
}
if (map.size !== 5660) { console.error(`항목 수가 달라요: ${map.size} (기대 5660)`); process.exit(1); }
const keys = [...map.keys()].sort((a, b) => a - b);
const from = keys[0], to = keys[keys.length - 1];
// U+E0BC 부터 한 칸에 하나씩, 쉼표로 나눠요(표에 없는 코드는 빈 칸). 자모에는 쉼표가 없어요.
const slots = [];
for (let cp = from; cp <= to; cp++) slots.push(map.get(cp) ?? "");
const data = slots.join(",");

const out = `// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// 자동 생성 — node dev/make-hwp-pua.mjs (손으로 고치지 않아요)
// 한컴 옛한글 PUA(Hanyang-PUA, U+${from.toString(16).toUpperCase()}~U+${to.toString(16).toUpperCase()}) → 첫가끝 자모(KS X 1026-1) 표, ${map.size}개.
// 출처: rhwp v${VER} src/renderer/pua_oldhangul.rs (MIT, Copyright (c) 2025-2026 Edward Kim, sha256 ${SHA.slice(0, 16)}…)
//       ← KTUG HanyangPuaTableProject hypua2jamocomposed.txt (Public Domain)
/** 첫 칸의 코드 */
export const OLD_HANGUL_FROM = 0x${from.toString(16).toUpperCase()};
/** U+${from.toString(16).toUpperCase()} 부터 한 칸씩 쉼표로 나눈 자모 묶음(빈 칸은 표에 없는 코드) */
export const OLD_HANGUL_DATA = ${JSON.stringify(data)};
`;
fs.writeFileSync("src/hwp-pua-oldhangul.ts", out);
console.log("src/hwp-pua-oldhangul.ts", map.size, "개", Buffer.byteLength(out), "바이트");
