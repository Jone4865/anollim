// PDF 작업 전용 워커 (module worker). 화면이 멈추지 않게 무거운 일은 여기서 해요.
import { PDFDocument, degrees } from "vendor:pdf-lib";
import { layoutImage, type PageSize } from "./lib.js";
import type { PdfLibDocument, PdfLibPage } from "./vendor.js";

type Bytes = Uint8Array<ArrayBuffer>;
type Progress = (done: number, total: number) => void;

const PRODUCER = "집문서 (jipmunseo.pages.dev) — 브라우저 안에서 처리";

async function load(buf: ArrayBuffer): Promise<PdfLibDocument> {
  try {
    return await PDFDocument.load(buf, { updateMetadata: false });
  } catch (e) {
    const msg = String(e && (e as Error).message || e);
    if (/encrypt/i.test(msg)) throw new Error("암호가 걸린 PDF예요. 암호를 푼 뒤 다시 넣어 주세요.");
    throw new Error("PDF를 읽지 못했어요. 파일이 깨졌거나 PDF가 아닐 수 있어요.");
  }
}

function fresh(): Promise<PdfLibDocument> {
  return PDFDocument.create().then((d) => { d.setProducer(PRODUCER); d.setCreator("집문서"); return d; });
}

async function save(doc: PdfLibDocument): Promise<Bytes> {
  const bytes = await doc.save({ useObjectStreams: true });
  return bytes;
}

const ops = {
  async count({ buf }: { buf: ArrayBuffer }) {
    const d = await load(buf);
    return { pages: d.getPageCount() };
  },

  async merge({ bufs }: { bufs: ArrayBuffer[] }, progress: Progress) {
    const out = await fresh();
    for (let i = 0; i < bufs.length; i++) {
      const src = await load(bufs[i]);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p: PdfLibPage) => out.addPage(p));
      progress(i + 1, bufs.length);
    }
    return { bytes: await save(out) };
  },

  async pick({ buf, pages }: { buf: ArrayBuffer; pages: number[] }) {
    const src = await load(buf);
    const out = await fresh();
    (await out.copyPages(src, pages)).forEach((p) => out.addPage(p));
    return { bytes: await save(out) };
  },

  async split({ buf, groups }: { buf: ArrayBuffer; groups: number[][] }, progress: Progress) {
    const src = await load(buf);
    const files: Bytes[] = [];
    for (let i = 0; i < groups.length; i++) {
      const out = await fresh();
      (await out.copyPages(src, groups[i])).forEach((p) => out.addPage(p));
      files.push(await save(out));
      progress(i + 1, groups.length);
    }
    return { files };
  },

  async organize({ buf, items }: { buf: ArrayBuffer; items: { idx: number; rot: number }[] }) {
    const src = await load(buf);
    const out = await fresh();
    const copied = await out.copyPages(src, items.map((it) => it.idx));
    copied.forEach((p, i) => {
      const extra = items[i].rot || 0;
      if (extra) p.setRotation(degrees((((p.getRotation().angle + extra) % 360) + 360) % 360));
      out.addPage(p);
    });
    return { bytes: await save(out) };
  },

  async images({ images, pageSize, marginPt }: { images: { bytes: Bytes; mime: string; w: number; h: number }[]; pageSize: PageSize; marginPt: number }, progress: Progress) {
    const out = await fresh();
    for (let i = 0; i < images.length; i++) {
      const im = images[i];
      const emb = im.mime === "image/png" ? await out.embedPng(im.bytes) : await out.embedJpg(im.bytes);
      const L = layoutImage(im.w, im.h, pageSize, marginPt);
      const page = out.addPage([L.pageW, L.pageH]);
      page.drawImage(emb, { x: L.x, y: L.y, width: L.w, height: L.h });
      progress(i + 1, images.length);
    }
    return { bytes: await save(out) };
  },
};

/** 작업 이름 → 함수. 인자 모양은 화면 쪽(runPdf 부르는 곳)이 맞춰 보냄 */
type Op = (args: never, progress: Progress) => Promise<{ bytes?: Bytes; files?: Bytes[]; pages?: number }>;
self.onmessage = async (ev: MessageEvent<{ id: number; op: string; args: unknown }>) => {
  const { id, op, args } = ev.data;
  const progress: Progress = (done, total) => self.postMessage({ id, type: "progress", done, total });
  try {
    const result = await (ops as Record<string, Op>)[op](args as never, progress);
    const transfer: Transferable[] = [];
    if (result.bytes) transfer.push(result.bytes.buffer);
    if (result.files) result.files.forEach((f) => transfer.push(f.buffer));
    self.postMessage({ id, type: "done", result }, transfer);
  } catch (e) {
    self.postMessage({ id, type: "error", message: e && (e as Error).message ? (e as Error).message : String(e) });
  }
};
