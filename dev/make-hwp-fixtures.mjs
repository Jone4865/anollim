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

// 머리말·꼬리말·각주·미주가 든 문서 (Word 내보내기 시험용, HWP_SPEC 0장 결정 9번)
const nd = rhwp.HwpDocument.createEmpty();
nd.createBlankDocument();
nd.insertText(0, 0, 0, "각주가 붙는 문장이에요. 뒤 글도 있어요.");
nd.splitParagraph(0, 0, 23);
nd.insertText(0, 1, 0, "미주가 붙는 둘째 문단");
nd.createHeaderFooter(0, true, 0);
nd.insertTextInHeaderFooter(0, true, 0, 0, 0, "집문서 머리말 <시험>");
nd.createHeaderFooter(0, false, 0);
nd.insertTextInHeaderFooter(0, false, 0, 0, 0, "집문서 꼬리말");
const fn = JSON.parse(nd.insertFootnote(0, 0, 12));
nd.insertTextInFootnote(0, 0, fn.controlIdx, 0, 0, "각주 내용 & <꺾쇠>");
const en = JSON.parse(nd.insertEndnote(0, 1, 3));
nd.insertTextInFootnote(0, 1, en.controlIdx, 0, 0, "미주 내용");
fs.writeFileSync(`${out}/synthetic-notes.hwp`, nd.exportHwp());
fs.writeFileSync(`${out}/synthetic-notes.hwpx`, nd.exportHwpx());
for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(`${out}/${f}`).size);
