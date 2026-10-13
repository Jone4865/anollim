// src/art.ts 의 도구 일러스트를 dev/art/t-<도구>.svg 로 내보내요 (공유 이미지 만들 때 씀). 사용: npx tsx dev/export-art.mjs
import fs from "node:fs";
import { ART, ART_VIEWBOX, G } from "../src/art.ts";
const dir = new URL("./art/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
for (const [id, body] of Object.entries(ART)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ART_VIEWBOX}" color="#1f1d1a"><g ${G}>${body.replaceAll("var(--acc, #2563eb)", "#2563eb")}</g></svg>\n`;
  fs.writeFileSync(new URL(`t-${id}.svg`, dir), svg);
}
console.log("exported", Object.keys(ART).length);
