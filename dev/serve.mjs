// 로컬 미리보기: vercel.json 의 헤더(CSP 포함)를 그대로 붙여서 정적 파일을 서빙해요.
// 사용: node dev/serve.mjs 4403
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const port = Number(process.argv[2] || 4403);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".heic": "image/heic", ".bcmap": "application/octet-stream", ".pfb": "application/octet-stream", ".ttf": "font/ttf", ".webp": "image/webp" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const rule of cfg.headers) {
    const re = new RegExp("^" + rule.source.replace("(.*)", ".*") + "$");
    if (re.test(u)) for (const { key, value } of rule.headers) res.setHeader(key, value);
  }
  let f = path.join(root, u);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.setHeader("Content-Type", MIME[path.extname(f).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
