import { test } from "vitest";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import {
  COMPRESS_PRESETS, scaleToMaxSide, pngUnpredict, kstDateLabel, watermarkLines, watermarkMetrics, normRect, rectAt,
} from "../src/lib.js";

test("scaleToMaxSide: 긴 변 기준으로만 줄여요", () => {
  assert.deepEqual(scaleToMaxSide(4000, 3000, 2000), { width: 2000, height: 1500, scale: 0.5 });
  assert.deepEqual(scaleToMaxSide(1000, 3000, 1500), { width: 500, height: 1500, scale: 0.5 });
  assert.deepEqual(scaleToMaxSide(800, 600, 2000), { width: 800, height: 600, scale: 1 }, "확대 안 함");
  assert.deepEqual(scaleToMaxSide(800, 600, 0), { width: 800, height: 600, scale: 1 }, "0 이면 그대로");
});

test("COMPRESS_PRESETS: 강할수록 작게", () => {
  const im = COMPRESS_PRESETS.images, ra = COMPRESS_PRESETS.raster;
  assert.ok(im.light.maxSide > im.normal.maxSide && im.normal.maxSide > im.strong.maxSide);
  assert.ok(ra.light.dpi > ra.normal.dpi && ra.normal.dpi > ra.strong.dpi);
  for (const p of [im.light, im.strong, ra.light, ra.strong]) assert.ok(p.quality > 0.4 && p.quality < 0.95);
});

test("pngUnpredict: 5가지 PNG 필터를 zlib/PNG 규칙대로 풀어요", () => {
  // 3×2 RGB. 원본 픽셀
  const raw = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 15, 25, 35, 200, 210, 220, 5, 6, 7]);
  const cols = 3, colors = 3, rowLen = 9;
  // 각 줄을 필터 f 로 인코딩
  const enc = (f: number) => {
    const out: number[] = [];
    for (let r = 0; r < 2; r++) {
      out.push(f);
      for (let i = 0; i < rowLen; i++) {
        const x = raw[r * rowLen + i];
        const a = i >= colors ? raw[r * rowLen + i - colors] : 0;
        const b = r > 0 ? raw[(r - 1) * rowLen + i] : 0;
        const c = r > 0 && i >= colors ? raw[(r - 1) * rowLen + i - colors] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        out.push((x - pred + 256) & 255);
      }
    }
    return Uint8Array.from(out);
  };
  for (const f of [0, 1, 2, 3, 4]) assert.deepEqual([...(pngUnpredict(enc(f), cols, colors) as Uint8Array)], [...raw], `필터 ${f}`);
  assert.equal(pngUnpredict(Uint8Array.from([9, 1, 2, 3]), 1, 3), null, "모르는 필터");
  assert.equal(pngUnpredict(new Uint8Array(2), 3, 3), null, "너무 짧음");
  // zlib 로 묶었다 풀어도 같은지 (FlateDecode 흐름)
  const z = zlib.inflateSync(zlib.deflateSync(enc(4)));
  assert.deepEqual([...(pngUnpredict(new Uint8Array(z), cols, colors) as Uint8Array)], [...raw]);
});

test("kstDateLabel: 한국 시간 날짜", () => {
  assert.equal(kstDateLabel(Date.parse("2026-10-13T14:59:59Z")), "2026.10.13");
  assert.equal(kstDateLabel(Date.parse("2026-10-13T15:00:00Z")), "2026.10.14");
});

test("watermarkLines: 제출처 · 날짜 · 다른 용도 금지", () => {
  assert.deepEqual(watermarkLines({ to: " OO은행 " }), ["OO은행 제출용"]);
  assert.deepEqual(watermarkLines({ to: "OO부동산 제출용" }), ["OO부동산 제출용"], "제출용을 두 번 붙이지 않음");
  assert.deepEqual(watermarkLines({ to: "" }), ["제출용"]);
  assert.deepEqual(watermarkLines({ to: "회사\n인사팀", date: "2026.10.13", forbid: true }), ["회사 인사팀 제출용", "2026.10.13", "다른 용도 사용 금지"]);
  assert.equal(watermarkLines({ to: "가".repeat(50) })[0].length, 30 + 4);
});

test("watermarkMetrics: 크기 단계 · 최소 글자 크기", () => {
  const s = watermarkMetrics(1240, 1754, "s"), m = watermarkMetrics(1240, 1754, "m"), l = watermarkMetrics(1240, 1754, "l");
  assert.ok(s.fontPx < m.fontPx && m.fontPx < l.fontPx);
  assert.equal(m.angle, -30);
  assert.equal(watermarkMetrics(10, 10, "s").fontPx, 14);
  assert.ok(m.lineGap > m.fontPx);
});

test("normRect / rectAt: 이미지 안으로 자르고, 거꾸로 끌어도 같아요", () => {
  assert.deepEqual(normRect(50, 40, 10, 10, 100, 100), { x: 10, y: 10, w: 40, h: 30 });
  assert.deepEqual(normRect(-20, -5, 30, 500, 100, 200), { x: 0, y: 0, w: 30, h: 200 });
  assert.equal(normRect(10, 10, 12, 50, 100, 100), null, "너무 좁음");
  assert.equal(normRect(200, 200, 300, 300, 100, 100), null, "이미지 밖");
  const rs = [{ x: 0, y: 0, w: 50, h: 50 }, { x: 40, y: 40, w: 20, h: 20 }];
  assert.equal(rectAt(rs, 45, 45), 1, "겹치면 나중에 그린 것");
  assert.equal(rectAt(rs, 5, 5), 0);
  assert.equal(rectAt(rs, 90, 90), -1);
});
