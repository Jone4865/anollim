// js/art.js 의 손그림을 assets/t-<도구>.svg 파일로 내보내요. 사용: node dev/export-art.mjs
import fs from "node:fs";
import { ART, ART_VIEWBOX, G } from "../js/art.js";
const dir = new URL("../assets/", import.meta.url);
const filter = `<defs><filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter></defs>`;
for (const [id, body] of Object.entries(ART)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ART_VIEWBOX}" color="#2a2622" style="--acc:#2563eb">${filter}<g filter="url(#pencil)" ${G}>${body.replaceAll("var(--acc, #2563eb)", "#2563eb")}</g></svg>\n`;
  fs.writeFileSync(new URL(`t-${id}.svg`, dir), svg);
}
console.log("exported", Object.keys(ART).length);
