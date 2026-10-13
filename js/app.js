// 집문서 — 라우터 (#pdf-merge 같은 주소로 도구마다 공유 가능)
import { h, ICONS, filesFromPaste, toast } from "./ui.js";
import { mountMerge, mountSplit, mountOrganize } from "./tools-pdf.js";
import { mountImgToPdf, mountCompress, mountExif } from "./tools-img.js";
import { mountBg } from "./tools-bg.js";
import { art, stamp, FILTERS } from "./art.js";
import { watchWorkspace, landingFx, stampIn, drawIn } from "./fx.js";

const TOOLS = [
  { id: "pdf-merge", title: "PDF 합치기", desc: "여러 PDF를 원하는 순서로 하나로 합쳐요.", mount: mountMerge },
  { id: "pdf-split", title: "PDF 나누기 · 페이지 빼기", desc: "필요한 쪽만 골라 새 PDF로, 한 쪽씩 또는 범위로 나눠요.", mount: mountSplit },
  { id: "pdf-organize", title: "PDF 회전 · 순서 바꾸기", desc: "썸네일을 보면서 돌리고, 옮기고, 지운 뒤 저장해요.", mount: mountOrganize },
  { id: "img-to-pdf", title: "이미지 → PDF", desc: "사진 여러 장을 A4 또는 원본 크기 PDF 하나로 묶어요.", mount: mountImgToPdf },
  { id: "img-compress", title: "이미지 압축 · 변환", desc: "JPG · PNG · WebP · AVIF로 바꾸고 화질 · 크기를 줄여요.", mount: mountCompress },
  { id: "bg-remove", title: "사진 배경 지우기", desc: "기기 안에서 AI가 배경을 지워 투명 PNG로 만들어요.", mount: mountBg },
  { id: "exif-clean", title: "사진 정보 지우기", desc: "사진에 숨은 위치(GPS) · 카메라 · 날짜 정보를 확인하고 지워요.", mount: mountExif },
];
const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// 연필·도장 필터 (한 번만)
document.body.insertAdjacentHTML("afterbegin", FILTERS);
document.getElementById("hero-stamp").innerHTML = stamp("stamp");

// 작업대 위 도구들
document.getElementById("tool-grid").replaceChildren(
  ...TOOLS.map((t) => h("a", { class: "tool-item", href: `#${t.id}` },
    h("span", { html: art(t.id), style: "display:contents" }),
    h("h3", {}, t.title), h("p", {}, t.desc))),
  h("p", { class: "hand bench-memo" }, "필요한 도구가 없나요?", h("br"), h("a", { href: "mailto:cowhddnjsdl0@gmail.com" }, "메일로 알려 주세요 →")));

const home = document.getElementById("home");
const view = document.getElementById("tool-view");
const other = document.getElementById("other-tools");
const baseTitle = document.title;
let active = null;

function route() {
  const id = location.hash.slice(1);
  const tool = byId[id];
  if (active) { try { active.unmount?.(); } catch {} active = null; }
  if (!tool) {
    view.hidden = true; view.replaceChildren();
    home.hidden = false; other.hidden = true;
    document.title = baseTitle;
    if (id && document.getElementById(id)) document.getElementById(id).scrollIntoView();
    else window.scrollTo(0, 0);
    return;
  }
  home.hidden = true; view.hidden = false;
  document.title = `${tool.title} — 집문서`;
  const body = h("div", { class: "tool-body" });
  view.replaceChildren(h("section", { class: "tool", "aria-labelledby": "tool-title" },
    h("a", { class: "back", href: "#" }, h("span", { html: ICONS.back, style: "display:contents" }), "모든 도구"),
    h("div", { class: "tool-head" }, h("span", { html: art(tool.id), style: "display:contents" }),
      h("div", {}, h("h1", { id: "tool-title" }, tool.title), h("p", {}, tool.desc)),
      h("div", { class: "head-stamp", html: stamp("stamp"), title: "파일이 밖으로 안 나가요" })),
    h("div", { class: "mat work" },
      h("p", { class: "promise" }, h("span", { html: ICONS.shield, style: "display:contents" }), "파일은 이 브라우저 안에서만 다뤄요. 어디에도 안 올라가요."),
      body)));
  other.hidden = false;
  other.replaceChildren(...TOOLS.filter((t) => t.id !== id).map((t) => h("a", { href: `#${t.id}` }, t.title)));
  active = tool.mount(body) || {};
  watchWorkspace(body);
  drawIn(view.querySelector(".tool-head .art"));
  stampIn(view.querySelector(".head-stamp"), 300);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
if (!location.hash || !byId[location.hash.slice(1)]) landingFx();

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
