// 로컬 미리보기: public/_headers(Cloudflare Pages 헤더, CSP 포함)를 그대로 붙여서 dist/ 를 서빙해요.
// 사용: npm run build 후 node dev/serve.mjs 4403
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "dist");
const port = Number(process.argv[2] || 4403);

// _headers: 들여쓰지 않은 줄 = 경로 패턴(* 는 아무 글자), 들여쓴 "이름: 값" 줄 = 그 경로의 헤더
const rules = [];
for (const line of fs.readFileSync(path.join(repo, "public", "_headers"), "utf8").split("\n")) {
  if (!line.trim() || line.trim().startsWith("#")) continue;
  if (!/^\s/.test(line)) rules.push({ re: new RegExp("^" + line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"), headers: [] });
  else { const i = line.indexOf(":"); rules.at(-1)?.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".heic": "image/heic", ".bcmap": "application/octet-stream", ".pfb": "application/octet-stream", ".ttf": "font/ttf", ".webp": "image/webp", ".txt": "text/plain; charset=utf-8", ".wasm": "application/wasm", ".woff2": "font/woff2", ".md": "text/markdown; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".zip": "application/zip" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  for (const r of rules) if (r.re.test(u)) for (const [k, v] of r.headers) res.setHeader(k, v);
  let f = path.join(root, u);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html"; // Pages 처럼 /licenses → licenses.html
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.setHeader("Content-Type", MIME[path.extname(f).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
