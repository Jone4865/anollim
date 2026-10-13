// 집문서 — 라우터 (#pdf-merge 같은 주소로 도구마다 공유 가능)
import { h, ICONS, filesFromPaste, toast } from "./ui.js";
import { mountMerge, mountSplit, mountOrganize, mountPdfCompress } from "./tools-pdf.js";
import { mountImgToPdf, mountCompress, mountExif } from "./tools-img.js";
import { mountBg } from "./tools-bg.js";
import { mountMask } from "./tools-mask.js";
import { art } from "./art.js";

/** 도구 화면이 돌려주는 것 (없으면 {}) */
export interface Mounted { unmount?: () => void; onPaste?: (files: File[]) => void }
interface Tool { id: string; title: string; desc: string; mount: (body: HTMLElement) => Mounted | void }
const TOOLS: Tool[] = [
  { id: "pdf-merge", title: "PDF 합치기", desc: "여러 PDF를 원하는 순서로 하나로 합쳐요.", mount: mountMerge },
  { id: "pdf-split", title: "PDF 나누기 · 페이지 빼기", desc: "필요한 쪽만 골라 새 PDF로, 한 쪽씩 또는 범위로 나눠요.", mount: mountSplit },
  { id: "pdf-organize", title: "PDF 회전 · 순서 바꾸기", desc: "썸네일을 보면서 돌리고, 옮기고, 지운 뒤 저장해요.", mount: mountOrganize },
  { id: "pdf-compress", title: "PDF 용량 줄이기", desc: "안의 사진을 다시 저장해서 메일·제출 용량에 맞춰요.", mount: mountPdfCompress },
  { id: "id-mask", title: "신분증 가리기 · 워터마크", desc: "주민번호 뒷자리를 가리고 ‘OO 제출용’을 넣은 사본을 만들어요.", mount: mountMask },
  { id: "img-to-pdf", title: "이미지 → PDF", desc: "사진 여러 장을 A4 또는 원본 크기 PDF 하나로 묶어요.", mount: mountImgToPdf },
  { id: "img-compress", title: "이미지 압축 · 변환", desc: "JPG · PNG · WebP · AVIF로 바꾸고 화질 · 크기를 줄여요.", mount: mountCompress },
  { id: "bg-remove", title: "사진 배경 지우기", desc: "기기 안에서 AI가 배경을 지워 투명 PNG로 만들어요.", mount: mountBg },
  { id: "exif-clean", title: "사진 정보 지우기", desc: "사진에 숨은 위치(GPS) · 카메라 · 날짜 정보를 확인하고 지워요.", mount: mountExif },
];
const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// 아래 id 들은 index.html 에 항상 있음
const $id = (id: string) => document.getElementById(id) as HTMLElement;

// 작업대 위 도구들
$id("tool-grid").replaceChildren(
  ...TOOLS.map((t) => h("a", { class: "tool-item", href: `#${t.id}` },
    h("span", { html: art(t.id), style: "display:contents" }),
    h("h3", {}, t.title), h("p", {}, t.desc))),
  h("p", { class: "bench-memo" }, "필요한 도구가 없나요? ", h("a", { href: "mailto:cowhddnjsdl0@gmail.com" }, "메일로 알려 주세요 →")));

const home = $id("home");
const view = $id("tool-view");
const other = $id("other-tools");
const baseTitle = document.title;
let active: Mounted | null = null;

function route() {
  const id = location.hash.slice(1);
  const tool = byId[id];
  if (active) { try { active.unmount?.(); } catch {} active = null; }
  if (!tool) {
    view.hidden = true; view.replaceChildren();
    home.hidden = false; other.hidden = true;
    document.title = baseTitle;
    if (id && document.getElementById(id)) $id(id).scrollIntoView();
    else window.scrollTo(0, 0);
    return;
  }
  home.hidden = true; view.hidden = false;
  document.title = `${tool.title} — 집문서`;
  const body = h("div", { class: "tool-body" });
  view.replaceChildren(h("section", { class: "tool", "aria-labelledby": "tool-title" },
    h("a", { class: "back", href: "#" }, h("span", { html: ICONS.back, style: "display:contents" }), "모든 도구"),
    h("div", { class: "tool-head" }, h("span", { html: art(tool.id), style: "display:contents" }),
      h("div", {}, h("h1", { id: "tool-title" }, tool.title), h("p", {}, tool.desc))),
    h("div", { class: "mat work" },
      h("p", { class: "promise" }, h("span", { html: ICONS.shield, style: "display:contents" }), "파일은 이 브라우저 안에서만 다뤄요. 어디에도 안 올라가요."),
      body)));
  other.hidden = false;
  other.replaceChildren(...TOOLS.filter((t) => t.id !== id).map((t) => h("a", { href: `#${t.id}` }, t.title)));
  active = tool.mount(body) || {};
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();

// 클립보드 붙여넣기 (이미지 도구)
document.addEventListener("paste", (e) => {
  if (!active?.onPaste) return;
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
  const files = filesFromPaste(e);
  if (files.length) { e.preventDefault(); active.onPaste(files); toast(`붙여넣은 이미지 ${files.length}개를 넣었어요`); }
});

// 도구 밖에 파일을 떨어뜨려도 브라우저가 파일을 열어버리지 않게
window.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
window.addEventListener("drop", (e) => {
  if (!e.defaultPrevented && [...(e.dataTransfer?.types || [])].includes("Files")) {
    e.preventDefault();
    toast(active ? "점선 상자 안에 놓아 주세요" : "먼저 쓸 도구를 골라 주세요");
  }
});
