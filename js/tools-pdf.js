// PDF 도구: 합치기 / 나누기·페이지 빼기 / 회전·순서
import { h, ICONS, icon, iconBtn, dropzone, progress, alertBox, errMsg, resultBox, resultItem, sortable, seg, filterFiles, LIMITS, runPdf, openPdfjs, thumbRenderer, makeZip, toast } from "./ui.js";
import { formatSize, outName, moveItem, parseRanges, rangesToSet, formatRanges, uniqueNames, baseName, safeName, normRotation } from "./lib.js";

const pdfBlob = (bytes) => new Blob([bytes], { type: "application/pdf" });
const sumPages = (list) => list.reduce((a, f) => a + (f.pages || 0), 0);

/* ═════════ 1. PDF 합치기 ═════════ */
export function mountMerge(root) {
  let files = []; // {id, file, pages, error}
  let uid = 0;
  const err = alertBox();
  const prog = progress();
  const listEl = h("ol", { class: "flist", "aria-label": "합칠 PDF 순서" });
  const summary = h("span", { class: "muted" });
  const go = h("button", { type: "button", class: "btn primary big", disabled: true, onclick: run }, "PDF 합치기");
  const clearBtn = h("button", { type: "button", class: "btn ghost sm", onclick: () => { files = []; out.replaceChildren(); render(); } }, "모두 지우기");
  const panel = h("div", { class: "panel", hidden: true },
    h("div", { class: "panel-head" }, h("h2", {}, "합칠 순서"), h("div", { class: "row" }, summary, clearBtn)),
    h("p", { class: "hint", style: "margin:-6px 0 10px" }, "끌어서 놓거나 화살표 버튼으로 순서를 바꿀 수 있어요."),
    listEl);
  const out = h("div");
  const dz = dropzone({ accept: "application/pdf,.pdf", title: "PDF 파일을 여기에 끌어다 놓으세요", sub: "또는 눌러서 고르기 · 여러 개 한꺼번에 가능", onFiles: add });

  root.append(dz, err.el, panel, h("div", { class: "actions" }, go), prog.el, out);
  sortable(listEl, ".fitem", (a, b) => { files = moveItem(files, a, b); render(); });

  async function add(list) {
    err.hide();
    const ok = filterFiles(list, ["pdf"], LIMITS.pdfFile, (m) => err.show(m));
    for (const file of ok) {
      const it = { id: ++uid, file, pages: null, error: null };
      files.push(it);
      render();
      try {
        const buf = await file.arrayBuffer();
        it.pages = (await runPdf("count", { buf }, [buf])).pages;
      } catch (e) { it.error = errMsg(e); }
      render();
    }
  }

  function render() {
    panel.hidden = !files.length;
    dz.setCompact(files.length > 0, "PDF 더 넣기");
    listEl.replaceChildren(...files.map((f, i) => h("li", { class: "fitem", draggable: "true", dataset: { k: "m" + f.id } },
      h("span", { class: "handle", html: ICONS.grip, title: "끌어서 순서 바꾸기" }),
      h("span", { class: "fnum" }, i + 1),
      h("div", { class: "fmeta" },
        h("div", { class: "fname", title: f.file.name }, f.file.name),
        h("div", { class: "fsub" }, f.error ? h("span", { class: "bad" }, f.error) : f.pages == null ? "쪽수 세는 중…" : `${f.pages}쪽`, " · ", formatSize(f.file.size))),
      h("div", { class: "fbtns" },
        iconBtn("up", "위로", () => { files = moveItem(files, i, i - 1); render(); }),
        iconBtn("down", "아래로", () => { files = moveItem(files, i, i + 1); render(); }),
        iconBtn("x", "빼기", () => { files.splice(i, 1); render(); }, "danger")))));
    listEl.querySelectorAll(".fitem")[0]?.querySelector('[aria-label="위로"]')?.setAttribute("disabled", "");
    [...listEl.querySelectorAll(".fitem")].at(-1)?.querySelector('[aria-label="아래로"]')?.setAttribute("disabled", "");
    const good = files.filter((f) => f.pages);
    summary.textContent = `${files.length}개 · 모두 ${sumPages(good)}쪽`;
    go.disabled = good.length < 2 || files.some((f) => f.pages == null && !f.error);
    go.textContent = good.length < 2 ? "PDF를 2개 이상 넣어 주세요" : `${good.length}개 합치기 (${sumPages(good)}쪽)`;
  }

  async function run() {
    err.hide(); out.replaceChildren();
    const good = files.filter((f) => f.pages);
    go.disabled = true;
    try {
      prog.set(0, "파일 읽는 중…");
      const bufs = await Promise.all(good.map((f) => f.file.arrayBuffer()));
      const { bytes } = await runPdf("merge", { bufs }, bufs, (d, t) => prog.set(d / t * 0.9, `${d}/${t} 합치는 중…`));
      prog.set(1, "완료!");
      const name = outName(good[0].file.name, "합침", "pdf");
      const blob = pdfBlob(bytes);
      out.replaceChildren(h("div", { class: "result", id: "result" }, h("h2", {}, icon("ok"), `${sumPages(good)}쪽짜리 PDF가 만들어졌어요`), resultItem({ name, blob, extra: `${good.length}개 파일 합침` })));
      out.querySelector("button.primary")?.focus();
    } catch (e) { err.show(errMsg(e)); }
    finally { setTimeout(() => prog.hide(), 800); render(); }
  }
  render();
  return {};
}

/* ═════════ PDF 하나를 열어 썸네일 격자 만드는 공통부 ═════════ */
async function openOne(file, prog) {
  prog.set(null, "PDF 여는 중…");
  const buf = await file.arrayBuffer();
  const doc = await openPdfjs(buf.slice(0));
  return { buf, doc, pages: doc.numPages };
}

/* ═════════ 2. 나누기 / 페이지 빼기 ═════════ */
export function mountSplit(root) {
  let cur = null; // {file, buf, doc, pages, renderer}
  let mode = "pick"; // pick | each | ranges
  let keep = "keep"; // keep | remove
  let sel = new Set();
  const err = alertBox();
  const prog = progress();
  const out = h("div");
  const dz = dropzone({ accept: "application/pdf,.pdf", multiple: false, title: "나눌 PDF 하나를 끌어다 놓으세요", sub: "또는 눌러서 고르기", onFiles: (f) => load(f[0]) });

  const modeSeg = seg([
    { value: "pick", label: "골라서 빼기" },
    { value: "each", label: "한 쪽씩 나누기" },
    { value: "ranges", label: "범위로 나누기" },
  ], mode, (v) => { mode = v; update(); });
  const keepSeg = seg([{ value: "keep", label: "고른 쪽만 새 PDF로" }, { value: "remove", label: "고른 쪽 지우고 저장" }], keep, (v) => { keep = v; update(); });
  const rangeIn = h("input", { class: "input", type: "text", inputmode: "text", placeholder: "예) 1-3, 5, 8-10", "aria-label": "페이지 범위", autocomplete: "off" });
  const rangeHint = h("div", { class: "hint" });
  const selInfo = h("span", { class: "muted" });
  const allBtn = h("button", { type: "button", class: "btn sm", onclick: () => { sel = new Set([...Array(cur.pages).keys()]); syncSel(true); } }, "전체 선택");
  const noneBtn = h("button", { type: "button", class: "btn sm", onclick: () => { sel.clear(); syncSel(true); } }, "선택 해제");
  const pickTools = h("div", { class: "row" }, selInfo, allBtn, noneBtn);
  const go = h("button", { type: "button", class: "btn primary big", onclick: run }, "만들기");
  const grid = h("div", { class: "thumbs" });
  const fileLine = h("div", { class: "muted" });
  const optKeep = h("div", { class: "opt" }, h("span", { class: "lbl" }, "어떻게 저장할까요?"), keepSeg);
  const optRange = h("div", { class: "opt" }, h("label", {}, "페이지 범위"), rangeIn, rangeHint);
  const work = h("div", { hidden: true },
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, fileLine, h("button", { type: "button", class: "btn ghost sm", onclick: reset }, "다른 PDF")),
      h("div", { class: "opts" }, h("div", { class: "opt" }, h("span", { class: "lbl" }, "방법"), modeSeg), optKeep, optRange)),
    h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", {}, "페이지"), pickTools), grid),
    h("div", { class: "actions" }, go));
  root.append(dz, err.el, work, prog.el, out);

  rangeIn.addEventListener("input", () => {
    if (mode === "pick") {
      try { sel = new Set(rangesToSet(parseRanges(rangeIn.value, cur.pages))); rangeHint.className = "hint"; syncSel(false); }
      catch (e) { if (rangeIn.value.trim()) { rangeHint.className = "hint bad"; rangeHint.textContent = errMsg(e); } else { sel.clear(); syncSel(false); } }
    } else update();
  });

  function reset() {
    cur?.renderer.destroy(); cur = null; sel.clear(); out.replaceChildren(); err.hide();
    work.hidden = true; dz.hidden = false; rangeIn.value = "";
  }

  async function load(file) {
    err.hide(); out.replaceChildren();
    if (!filterFiles([file], ["pdf"], LIMITS.pdfFile, (m) => err.show(m)).length) return;
    reset();
    try {
      const o = await openOne(file, prog);
      cur = { file, ...o, renderer: thumbRenderer(o.doc) };
      dz.hidden = true; work.hidden = false;
      fileLine.replaceChildren(h("b", { style: "color:var(--text)" }, file.name), ` · ${cur.pages}쪽 · ${formatSize(file.size)}`);
      grid.replaceChildren(...Array.from({ length: cur.pages }, (_, i) => {
        const box = h("div", { class: "tbox", dataset: { page: i } }, h("div", { class: "ph" }));
        const card = h("div", { class: "thumb", dataset: { i }, role: "checkbox", "aria-checked": "false", tabindex: "0", "aria-label": `${i + 1}쪽` },
          h("span", { class: "check", html: ICONS.check }), box, h("div", { class: "tlabel" }, h("b", {}, `${i + 1}쪽`)));
        const toggle = () => { if (mode !== "pick") return; sel.has(i) ? sel.delete(i) : sel.add(i); syncSel(true); };
        card.addEventListener("click", toggle);
        card.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
        cur.renderer.observe(box);
        return card;
      }));
      update();
    } catch (e) { err.show(errMsg(e)); reset(); }
    finally { prog.hide(); }
  }

  function syncSel(writeInput) {
    grid.querySelectorAll(".thumb").forEach((c) => { const on = sel.has(Number(c.dataset.i)); c.classList.toggle("sel", on); c.setAttribute("aria-checked", String(on)); });
    if (writeInput) { rangeIn.value = formatRanges([...sel]); rangeHint.className = "hint"; }
    update();
  }

  function groupsForRanges() {
    return parseRanges(rangeIn.value, cur.pages);
  }

  function update() {
    if (!cur) return;
    const pick = mode === "pick";
    optKeep.hidden = !pick;
    optRange.hidden = mode === "each";
    pickTools.hidden = !pick;
    grid.querySelectorAll(".thumb").forEach((c) => c.classList.toggle("selectable", pick));
    if (!pick) grid.querySelectorAll(".thumb").forEach((c) => c.classList.remove("sel"));
    else syncSelClasses();
    rangeIn.placeholder = pick ? "예) 1-3, 5 (썸네일을 눌러도 돼요)" : "예) 1-3, 5, 8-10 → 파일 3개";
    selInfo.textContent = `${sel.size}쪽 고름`;
    if (pick) {
      if (rangeHint.className !== "hint bad") rangeHint.textContent = "썸네일을 누르거나 범위를 적어서 고르세요.";
      const n = keep === "keep" ? sel.size : cur.pages - sel.size;
      go.disabled = !sel.size || n < 1;
      go.textContent = !sel.size ? "페이지를 골라 주세요" : n < 1 ? "모든 쪽을 지울 순 없어요" : keep === "keep" ? `${sel.size}쪽으로 새 PDF 만들기` : `${sel.size}쪽 지우고 저장 (${n}쪽 남음)`;
    } else if (mode === "each") {
      go.disabled = cur.pages < 2;
      go.textContent = cur.pages < 2 ? "1쪽짜리는 나눌 게 없어요" : `${cur.pages}개 파일로 나누기`;
    } else {
      try {
        const g = groupsForRanges();
        rangeHint.className = "hint";
        rangeHint.textContent = `파일 ${g.length}개: ` + g.map((x) => x.length === 1 ? `${x[0] + 1}쪽` : `${x[0] + 1}-${x.at(-1) + 1}쪽`).join(", ");
        go.disabled = false; go.textContent = `${g.length}개 파일로 나누기`;
      } catch (e) {
        rangeHint.className = rangeIn.value.trim() ? "hint bad" : "hint";
        rangeHint.textContent = rangeIn.value.trim() ? errMsg(e) : "쉼표로 나눈 묶음마다 파일 하나가 돼요.";
        go.disabled = true; go.textContent = "범위를 적어 주세요";
      }
    }
  }
  function syncSelClasses() { grid.querySelectorAll(".thumb").forEach((c) => c.classList.toggle("sel", sel.has(Number(c.dataset.i)))); }

  async function run() {
    err.hide(); out.replaceChildren(); go.disabled = true;
    const base = safeName(baseName(cur.file.name));
    try {
      if (mode === "pick") {
        const chosen = [...sel].sort((a, b) => a - b);
        const pages = keep === "keep" ? chosen : [...Array(cur.pages).keys()].filter((i) => !sel.has(i));
        prog.set(null, "새 PDF 만드는 중…");
        const buf = cur.buf.slice(0);
        const { bytes } = await runPdf("pick", { buf, pages }, [buf]);
        const name = outName(cur.file.name, keep === "keep" ? `${formatRanges(chosen).replace(/\s/g, "")}쪽` : "페이지삭제", "pdf");
        out.replaceChildren(h("div", { class: "result", id: "result" }, h("h2", {}, icon("ok"), `${pages.length}쪽짜리 PDF가 만들어졌어요`), resultItem({ name, blob: pdfBlob(bytes) })));
      } else {
        const groups = mode === "each" ? [...Array(cur.pages).keys()].map((i) => [i]) : groupsForRanges();
        const pad = String(cur.pages).length;
        const names = uniqueNames(groups.map((g) => {
          const a = g[0] + 1, b = g.at(-1) + 1;
          return mode === "each" ? `${base}-${String(a).padStart(pad, "0")}쪽.pdf` : `${base}-${a === b ? a : `${a}-${b}`}쪽.pdf`;
        }));
        const buf = cur.buf.slice(0);
        const { files } = await runPdf("split", { buf, groups }, [buf], (d, t) => prog.set(d / t * 0.9, `${d}/${t} 나누는 중…`));
        const items = files.map((b, i) => ({ name: names[i], blob: pdfBlob(b) }));
        prog.set(0.95, "ZIP으로 묶는 중…");
        const zip = await makeZip(items);
        const zipName = `${base}-나눔.zip`;
        const box = h("div", { class: "result", id: "result" }, h("h2", {}, icon("ok"), `파일 ${items.length}개로 나눴어요`),
          resultItem({ name: zipName, blob: zip, extra: `PDF ${items.length}개 묶음` }));
        const shown = items.slice(0, 50);
        box.append(...shown.map((it) => resultItem(it)));
        if (items.length > shown.length) box.append(h("p", { class: "hint" }, `나머지 ${items.length - shown.length}개는 ZIP에 들어 있어요.`));
        out.replaceChildren(box);
      }
      prog.set(1, "완료!");
    } catch (e) { err.show(errMsg(e)); }
    finally { setTimeout(() => prog.hide(), 800); update(); }
  }
  return { unmount: () => cur?.renderer.destroy() };
}

/* ═════════ 3. 회전 · 순서 바꾸기 · 삭제 ═════════ */
export function mountOrganize(root) {
  let cur = null;
  let items = []; // {idx, rot}
  const thumbsByIdx = new Map(); // idx → tbox element (캔버스 재사용)
  const err = alertBox();
  const prog = progress();
  const out = h("div");
  const dz = dropzone({ accept: "application/pdf,.pdf", multiple: false, title: "정리할 PDF 하나를 끌어다 놓으세요", sub: "또는 눌러서 고르기", onFiles: (f) => load(f[0]) });
  const grid = h("div", { class: "thumbs", "aria-label": "페이지 순서" });
  const fileLine = h("div", { class: "muted" });
  const info = h("span", { class: "muted" });
  const go = h("button", { type: "button", class: "btn primary big", onclick: run }, "저장하기");
  const work = h("div", { hidden: true },
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, fileLine, h("button", { type: "button", class: "btn ghost sm", onclick: reset }, "다른 PDF")),
      h("div", { class: "row" },
        h("button", { type: "button", class: "btn sm", onclick: () => { items.forEach((it) => (it.rot = normRotation(it.rot - 90))); render(); } }, icon("rotL"), "모두 왼쪽으로"),
        h("button", { type: "button", class: "btn sm", onclick: () => { items.forEach((it) => (it.rot = normRotation(it.rot + 90))); render(); } }, icon("rotR"), "모두 오른쪽으로"),
        h("button", { type: "button", class: "btn sm ghost", onclick: () => { items = [...Array(cur.pages).keys()].map((idx) => ({ idx, rot: 0 })); render(); toast("처음 상태로 되돌렸어요"); } }, "처음 상태로"))),
    h("div", { class: "panel" }, h("div", { class: "panel-head" }, h("h2", {}, "페이지"), info),
      h("p", { class: "hint", style: "margin:-6px 0 10px" }, "썸네일을 끌어서 순서를 바꾸거나, 아래 버튼으로 돌리기 · 옮기기 · 지우기를 할 수 있어요."), grid),
    h("div", { class: "actions" }, go));
  root.append(dz, err.el, work, prog.el, out);
  sortable(grid, ".thumb", (a, b) => { items = moveItem(items, a, b); render(); }, { horizontal: true });

  function reset() {
    cur?.renderer.destroy(); cur = null; items = []; thumbsByIdx.clear(); out.replaceChildren(); err.hide();
    work.hidden = true; dz.hidden = false;
  }
  async function load(file) {
    err.hide(); out.replaceChildren();
    if (!filterFiles([file], ["pdf"], LIMITS.pdfFile, (m) => err.show(m)).length) return;
    reset();
    try {
      const o = await openOne(file, prog);
      cur = { file, ...o, renderer: thumbRenderer(o.doc) };
      items = [...Array(cur.pages).keys()].map((idx) => ({ idx, rot: 0 }));
      for (const it of items) {
        const box = h("div", { class: "tbox", dataset: { page: it.idx } }, h("div", { class: "ph" }));
        thumbsByIdx.set(it.idx, box);
        cur.renderer.observe(box);
      }
      dz.hidden = true; work.hidden = false;
      fileLine.replaceChildren(h("b", { style: "color:var(--text)" }, file.name), ` · ${cur.pages}쪽 · ${formatSize(file.size)}`);
      render();
    } catch (e) { err.show(errMsg(e)); reset(); }
    finally { prog.hide(); }
  }
  function render() {
    const n = items.length;
    grid.replaceChildren(...items.map((it, i) => {
      const box = thumbsByIdx.get(it.idx);
      // 같은 페이지 썸네일 박스를 재사용 (복제 시 두 번째부터는 사본)
      box.style.setProperty("--rot", it.rot + "deg");
      const inner = box.firstElementChild;
      if (inner && inner.tagName !== "DIV") inner.style.transform = `rotate(${it.rot}deg) scale(${it.rot % 180 ? 0.75 : 1})`;
      return h("div", { class: "thumb", draggable: "true", dataset: { i } },
        it.rot ? h("span", { class: "rot-badge" }, `${it.rot}°`) : null,
        box,
        h("div", { class: "tlabel" }, h("b", {}, `${i + 1}`), it.idx !== i ? h("span", {}, `원래 ${it.idx + 1}쪽`) : null),
        h("div", { class: "tbtns" },
          iconBtn("rotL", "왼쪽으로 돌리기", () => { it.rot = normRotation(it.rot - 90); render(); }),
          iconBtn("rotR", "오른쪽으로 돌리기", () => { it.rot = normRotation(it.rot + 90); render(); }),
          iconBtn("left", "앞으로", () => { items = moveItem(items, i, i - 1); render(); }),
          iconBtn("right", "뒤로", () => { items = moveItem(items, i, i + 1); render(); }),
          iconBtn("x", "이 쪽 지우기", () => { if (items.length === 1) return toast("마지막 한 쪽은 지울 수 없어요"); items.splice(i, 1); render(); }, "danger")));
    }));
    grid.querySelectorAll(".thumb").forEach((t, i) => {
      if (i === 0) t.querySelector('[aria-label="앞으로"]').disabled = true;
      if (i === n - 1) t.querySelector('[aria-label="뒤로"]').disabled = true;
    });
    const removed = cur ? cur.pages - n : 0;
    const rotated = items.filter((x) => x.rot).length;
    const moved = items.some((x, i) => x.idx !== i);
    info.textContent = `${n}쪽` + (removed ? ` · ${removed}쪽 지움` : "") + (rotated ? ` · ${rotated}쪽 돌림` : "") + (moved ? " · 순서 바뀜" : "");
    go.disabled = !(removed || rotated || moved);
    go.textContent = go.disabled ? "바꾼 게 아직 없어요" : "바꾼 대로 저장하기";
  }
  // 썸네일이 늦게 그려지면 회전 다시 적용
  grid.addEventListener("rendered", (e) => {
    const it = items.find((x) => x.idx === Number(e.target.dataset.page));
    const c = e.target.firstElementChild;
    if (it && c) c.style.transform = `rotate(${it.rot}deg) scale(${it.rot % 180 ? 0.75 : 1})`;
  }, true);

  async function run() {
    err.hide(); out.replaceChildren(); go.disabled = true;
    try {
      prog.set(null, "저장하는 중…");
      const buf = cur.buf.slice(0);
      const { bytes } = await runPdf("organize", { buf, items: items.map((x) => ({ idx: x.idx, rot: x.rot })) }, [buf]);
      prog.set(1, "완료!");
      out.replaceChildren(h("div", { class: "result", id: "result" }, h("h2", {}, icon("ok"), `${items.length}쪽짜리 PDF로 저장했어요`), resultItem({ name: outName(cur.file.name, "편집", "pdf"), blob: pdfBlob(bytes) })));
    } catch (e) { err.show(errMsg(e)); }
    finally { setTimeout(() => prog.hide(), 800); render(); }
  }
  return { unmount: () => cur?.renderer.destroy() };
}
