// PDF 용량 줄이기(shrinkPdf): 실제 pdf-lib 1.17.1(vendor 파일 그대로) + 가짜 이미지 코덱(노드엔 캔버스가 없어서)
import { test } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
// @ts-expect-error -- vendor 번들이라 타입 파일이 없어요. 타입은 src/pdf-lib.d.ts 의 "vendor:pdf-lib" 를 써요
import * as PLraw from "../public/vendor/pdf-lib-1.17.1.esm.min.js";
import { shrinkPdf, type ShrinkCodec } from "../src/pdf-shrink.js";

const PL = PLraw as typeof import("vendor:pdf-lib");
const { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, PDFStream, PDFRawStream, PDFRef } = PL;
const lib = { PDFName, PDFNumber, PDFArray, PDFDict, PDFStream, PDFRawStream, PDFRef };
const N = (s: string) => PDFName.of(s);
const jpg = new Uint8Array(fs.readFileSync(new URL("./fixtures/base.jpg", import.meta.url)));

// 잡음 픽셀 (잘 안 눌려서 8KB 기준을 넘김)
const noise = new Uint8Array(crypto.randomBytes(400 * 300 * 3));
const px = (i: number) => noise[i];
// PNG 예측(Up) + zlib 로 묶은 RGB 그림
function flateImageBytes(w: number, h: number) {
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(2);
    for (let x = 0; x < w * 3; x++) rows.push((px(y * w * 3 + x) - (y ? px((y - 1) * w * 3 + x) : 0) + 256) & 255);
  }
  return new Uint8Array(zlib.deflateSync(Uint8Array.from(rows)));
}

async function samplePdf() {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([595, 842]);
  const img = await doc.embedJpg(jpg);
  page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 });
  const ctx = doc.context as unknown as {
    obj(o: Record<string, unknown>): InstanceType<typeof PDFDict>;
    stream(c: Uint8Array, d: Record<string, unknown>): InstanceType<typeof PDFRawStream>;
    flateStream(c: Uint8Array, d: Record<string, unknown>): unknown;
    register(o: unknown): InstanceType<typeof PDFRef>;
  };
  // 압축 안 된 큰 스트림(글자 명령 흉내)
  const text = new TextEncoder().encode("BT /F1 12 Tf 72 712 Td (hello) Tj ET\n".repeat(400));
  ctx.register(ctx.stream(text, {}));
  // Flate + PNG 예측 그림 (마스크 아님)
  const w = 400, h = 300;
  ctx.register(ctx.stream(flateImageBytes(w, h), {
    Type: "XObject", Subtype: "Image", Width: w, Height: h, ColorSpace: "DeviceRGB", BitsPerComponent: 8,
    Filter: "FlateDecode", DecodeParms: { Predictor: 15, Colors: 3, Columns: w },
  }));
  // 다른 그림의 마스크로 쓰이는 회색 그림 → 건드리면 안 됨
  const maskRef = ctx.register(ctx.stream(new Uint8Array(zlib.deflateSync(new Uint8Array(200 * 200).fill(255))), {
    Type: "XObject", Subtype: "Image", Width: 200, Height: 200, ColorSpace: "DeviceGray", BitsPerComponent: 8, Filter: "FlateDecode",
  }));
  ctx.register(ctx.stream(new Uint8Array(zlib.deflateSync(new Uint8Array(200 * 200 * 3).fill(9))), {
    Type: "XObject", Subtype: "Image", Width: 200, Height: 200, ColorSpace: "DeviceRGB", BitsPerComponent: 8, Filter: "FlateDecode", SMask: maskRef,
  }));
  return doc.save({ useObjectStreams: true });
}

function fakeCodec(calls: string[]): ShrinkCodec {
  return {
    canRecode: true,
    async jpeg(bytes, w, h, ow, oh) { calls.push(`jpeg ${w}x${h}->${ow}x${oh}`); return new Uint8Array(4000).fill(1); },
    async pixels(raw, comps, w, h, ow, oh) {
      calls.push(`pixels ${comps} ${w}x${h}->${ow}x${oh} first=${raw[0]},${raw[3]} row2=${raw[w * 3]}`);
      return new Uint8Array(1500).fill(2);
    },
    async inflate(b) { return new Uint8Array(zlib.inflateSync(b)); },
    async deflate(b) { return new Uint8Array(zlib.deflateSync(b)); },
  };
}

const images = (doc: Awaited<ReturnType<typeof PDFDocument.load>>) => doc.context.enumerateIndirectObjects()
  .map(([, o]) => o)
  .filter((o): o is InstanceType<typeof PDFRawStream> => o instanceof PDFRawStream && o.dict.get(N("Subtype")) === N("Image"))
  .map((s) => ({
    w: (s.dict.get(N("Width")) as InstanceType<typeof PDFNumber>).asNumber(),
    filter: String(s.dict.get(N("Filter"))), cs: String(s.dict.get(N("ColorSpace"))), size: s.contents.length,
    parms: s.dict.has(N("DecodeParms")),
  }));

test("shrinkPdf: JPEG·Flate 사진만 다시 저장하고, 마스크는 그대로, 안 묶인 스트림은 Flate 로", async () => {
  const before = await samplePdf();
  const doc = await PDFDocument.load(before.buffer as ArrayBuffer, { updateMetadata: false });
  const calls: string[] = [];
  const stats = await shrinkPdf(lib, doc, { maxSide: 1000, quality: 0.6 }, fakeCodec(calls));
  assert.equal(stats.images, 4);
  assert.equal(stats.recompressed, 2, "JPEG 1 + Flate RGB 1 (마스크·마스크 쓰는 작은 그림은 크기 기준 미달 또는 마스크)");
  assert.equal(stats.deflated, 1);
  assert.ok(calls.some((c) => /^jpeg \d+x\d+->\d+x\d+$/.test(c)));
  assert.ok(calls.includes(`pixels 3 400x300->400x300 first=${px(0)},${px(3)} row2=${px(400 * 3)}`), calls.join(" | "));

  const after = await doc.save({ useObjectStreams: true });
  const re = await PDFDocument.load(after.buffer as ArrayBuffer, { updateMetadata: false });
  assert.equal(re.getPageCount(), 1);
  const ims = images(re);
  const dct = ims.filter((i) => i.filter === "/DCTDecode");
  assert.equal(dct.length, 2);
  assert.ok(dct.every((i) => !i.parms), "DecodeParms 는 지워요");
  assert.ok(dct.some((i) => i.size === 4000) && dct.some((i) => i.size === 1500));
  const mask = ims.find((i) => i.cs === "/DeviceGray");
  assert.ok(mask && mask.filter === "/FlateDecode", "마스크 그림은 회색 Flate 그대로");
  // 다시 읽은 원래 JPEG 은 긴 변이 1000 이하로
  const big = dct.find((i) => i.size === 4000);
  assert.ok(big && big.w <= 1000);
});

test("shrinkPdf: 캔버스가 없으면 사진은 그대로 두고 스트림만 묶어요", async () => {
  const before = await samplePdf();
  const doc = await PDFDocument.load(before.buffer as ArrayBuffer, { updateMetadata: false });
  const calls: string[] = [];
  const stats = await shrinkPdf(lib, doc, { maxSide: 1000, quality: 0.6 }, { ...fakeCodec(calls), canRecode: false });
  assert.deepEqual([stats.recompressed, stats.deflated, stats.canRecode], [0, 1, false]);
  assert.equal(calls.length, 0);
});

test("shrinkPdf: 더 커지면 바꾸지 않아요", async () => {
  const before = await samplePdf();
  const doc = await PDFDocument.load(before.buffer as ArrayBuffer, { updateMetadata: false });
  const codec = fakeCodec([]);
  codec.jpeg = async () => new Uint8Array(jpg.length + 10);
  codec.pixels = async () => null;
  const stats = await shrinkPdf(lib, doc, { maxSide: 4000, quality: 0.9 }, codec);
  assert.equal(stats.recompressed, 0);
});
