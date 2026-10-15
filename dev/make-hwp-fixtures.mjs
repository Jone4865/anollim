// 합성 시험 파일 만들기 (개발용): node dev/make-hwp-fixtures.mjs → test/fixtures/hwp/
// rhwp 로 직접 만든 파일이라 저작권·개인정보 걱정이 없어요. 서비스 화면에서는 편집·내보내기 API 를 쓰지 않아요.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const rhwp = await import("../public/vendor/rhwp-0.8.7/rhwp.js");
await rhwp.default({ module_or_path: fs.readFileSync("public/vendor/rhwp-0.8.7/rhwp_bg.wasm") });
const out = "test/fixtures/hwp"; fs.mkdirSync(out, { recursive: true });
const doc = rhwp.HwpDocument.createEmpty();
doc.createBlankDocument();
doc.insertText(0, 0, 0, "집문서 시험 문서예요. 가나다라마바사 ABC 123");
doc.splitParagraph(0, 0, 25);
doc.createTable(0, 1, 0, 2, 3);
doc.insertTextInCell(0, 1, 0, 0, 0, 0, "칸1");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
doc.insertPicture(0, 0, 0, "", new Uint8Array(png), 2000, 2000, 1, 1, "png", "점");
fs.writeFileSync(`${out}/synthetic.hwp`, doc.exportHwp());
fs.writeFileSync(`${out}/synthetic.hwpx`, doc.exportHwpx());
fs.writeFileSync(`${out}/synthetic-pw1234.hwp`, doc.exportHwpWithPassword("1234"));
for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(`${out}/${f}`).size);
