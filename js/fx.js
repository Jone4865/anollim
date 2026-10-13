// 손그림(rough.js) + 작은 움직임(anime.js). 라이브러리가 안 불러와져도 화면은 그대로 동작해요.
import { stamp } from "./art.js";

const reduce = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// 숨은 탭에서 멈춰 있다가 반쯤 그려진 채로 남지 않게
if (window.anime) window.anime.suspendWhenDocumentHidden = false;
const anim = (o) => (!reduce() && window.anime ? window.anime(o) : null);
const SVGNS = "http://www.w3.org/2000/svg";

/* ───── rough.js 테두리 ───── */
const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver((ents) => ents.forEach((e) => e.target.__sketch?.())) : null;

export function sketchBox(el, { stroke = "rgba(255,255,255,.75)", strokeWidth = 1.8, roughness = 1.6, seed = 7 } = {}) {
  if (!window.rough || el.__sketch) return;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "rough-overlay");
  svg.setAttribute("aria-hidden", "true");
  el.prepend(svg);
  el.classList.add("sketched");
  const rc = window.rough.svg(svg);
  el.__sketch = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.replaceChildren(rc.rectangle(4, 4, w - 8, h - 8, { stroke, strokeWidth, roughness, bowing: 1.2, seed, strokeLineDash: [10, 7] }));
  };
  el.__sketch();
  ro?.observe(el);
}

export function sketchCircle(el, { stroke = "#2563eb", strokeWidth = 2.2, seed = 3 } = {}) {
  if (!window.rough || el.__sketch) return;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "rough-overlay");
  svg.setAttribute("aria-hidden", "true");
  el.append(svg);
  const rc = window.rough.svg(svg);
  el.__sketch = () => {
    const w = el.clientWidth + 28, h = el.clientHeight + 24;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const g = rc.ellipse(w / 2, h / 2, w - 6, h - 4, { stroke, strokeWidth, roughness: 1.4, seed });
    svg.replaceChildren(g);
    return g;
  };
  const g = el.__sketch();
  ro?.observe(el);
  // 펜으로 동그라미 치는 움직임
  const paths = g?.querySelectorAll("path");
  if (paths?.length && window.anime && !reduce()) {
    paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      anim({ targets: [...paths], strokeDashoffset: [window.anime.setDashoffset, 0], duration: 700, easing: "easeInOutSine", delay: window.anime.stagger(250) });
    }, { threshold: 0.6 });
    io.observe(el);
  }
}

/* ───── 도장 쾅 ───── */
export function stampIn(holder, delay = 0) {
  const svg = holder.querySelector("svg");
  if (!svg) return;
  anim({ targets: svg, scale: [2.4, 1], opacity: [0, 1], duration: 420, delay, easing: "easeOutQuad",
    complete: () => anim({ targets: svg, translateX: [0, -2, 2, 0], duration: 180, easing: "linear" }) });
}

/* ───── 연필 선이 그려지는 효과 ───── */
export function drawIn(svg, delay = 0) {
  if (!window.anime || reduce()) return;
  const paths = [...svg.querySelectorAll("path, circle, ellipse")].filter((p) => p.getAttribute("stroke") !== "none" && !p.getAttribute("stroke-dasharray") && p.getAttribute("fill-opacity") == null);
  paths.forEach((p) => { try { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; } catch {} });
  anim({ targets: paths, strokeDashoffset: [window.anime.setDashoffset, 0], duration: 650, delay: window.anime.stagger(40, { start: delay }), easing: "easeInOutSine",
    complete: () => paths.forEach((p) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; }) });
}

/* ───── 도구 화면: 새 종이가 놓이면 살짝 떨어지는 움직임, 결과엔 도장 ───── */
const seen = new WeakSet();
const seenKeys = new Set();
export function watchWorkspace(root) {
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (!(n instanceof Element)) continue;
      n.querySelectorAll?.(".drop").forEach((d) => sketchBox(d));
      if (n.matches?.(".drop")) sketchBox(n);
      const items = n.matches?.(".fitem[data-k]") ? [n] : [...(n.querySelectorAll?.(".fitem[data-k]") || [])];
      const fresh = items.filter((it) => !seenKeys.has(it.dataset.k));
      fresh.forEach((it) => seenKeys.add(it.dataset.k));
      if (fresh.length) anim({ targets: fresh, translateY: [-18, 0], rotate: () => [window.anime.random(-4, 4), 0], opacity: [0, 1], duration: 380, delay: window.anime.stagger(60), easing: "easeOutCubic" });
      const results = n.matches?.(".result") ? [n] : [...(n.querySelectorAll?.(".result") || [])];
      for (const r of results) {
        if (seen.has(r)) continue;
        seen.add(r);
        const hold = document.createElement("div");
        hold.className = "res-stamp";
        hold.innerHTML = stamp("stamp");
        r.prepend(hold);
        anim({ targets: r, translateY: [14, 0], opacity: [0, 1], duration: 320, easing: "easeOutCubic" });
        stampIn(hold, 260);
      }
    }
  });
  mo.observe(root, { childList: true, subtree: true });
  root.querySelectorAll(".drop").forEach((d) => sketchBox(d));
}

/* ───── 처음 화면 ───── */
export function landingFx() {
  const hs = document.getElementById("hero-stamp");
  if (hs) stampIn(hs, 450);
  const c = document.getElementById("circ");
  if (c) sketchCircle(c);
  if (window.anime && !reduce()) {
    anim({ targets: ".hero-sheet", translateY: [-30, 0], rotate: (el) => (el.classList.contains("s1") ? [-14, -6] : [12, 5]), opacity: [0, 1], duration: 500, delay: window.anime.stagger(140), easing: "easeOutCubic" });
    document.querySelectorAll(".tool-item .art").forEach((s, i) => drawIn(s, 150 + i * 70));
  }
}
