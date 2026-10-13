# 집문서 — 업로드 없는 파일 도구

https://jipmunseo.pages.dev (Cloudflare Pages · 예전 `*.vercel.app` 주소는 정리돼서 열리지 않아요)

PDF 합치기·나누기·회전·**용량 줄이기**, **신분증 가리기·"OO 제출용" 워터마크**, 이미지 → PDF, 이미지 압축·변환,
사진 배경 지우기, 사진 정보(EXIF·위치) 지우기를 **브라우저 안에서만** 처리하는 정적 사이트예요.
서버 함수가 없고, 우리 코드는 파일을 어디로도 보내지 않아요.

## 보안 정책 (`public/_headers`)
- `script-src 'self' 'wasm-unsafe-eval' blob:` — 실행되는 스크립트는 이 사이트 파일뿐이에요(외부 CDN 스크립트 없음).
  `blob:` 는 배경 지우기 라이브러리가 IMG.LY 에서 받은 실행 파일을 워커로 돌릴 때 필요해요.
- `connect-src 'self' blob: https://staticimgly.com` — 데이터를 보낼 수 있는 곳은 이 사이트와 배경 지우기 모델을 받는 곳뿐.
- 글꼴 Pretendard 는 jsDelivr 의 `pretendard@v1.3.9/` 경로만 허용하고, `index.html`·`licenses.html` 에서 SRI(`integrity`)로 확인해요.
  CSS 를 바꾸면 해시도 다시: `curl -s <주소> | openssl dgst -sha384 -binary | openssl base64 -A`
- `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `form-action 'none'`, `object-src 'none'`, `Referrer-Policy: no-referrer`.

## 도구
| 주소 | 하는 일 | 코드 |
|---|---|---|
| `#pdf-merge` · `#pdf-split` · `#pdf-organize` | 합치기 / 나누기·쪽 빼기 / 회전·순서 | `src/tools-pdf.ts` → `src/pdf-worker.ts` |
| `#pdf-compress` | 용량 줄이기: **사진만 줄이기**(글자·링크 그대로, 안의 JPEG·Flate 사진을 긴 변·화질 기준으로 다시 저장 + 압축 안 된 스트림 Flate) / **쪽을 통째로 이미지로**(PDF.js 로 dpi 맞춰 그려서 JPEG 쪽 PDF) | `src/pdf-shrink.ts`(워커에서 실행, 노드 테스트) |
| `#id-mask` | 서류 사본 가리기(끌어서 검은 네모, 그림 위에 칠해 저장 → 밑 글자 안 남음) + "OO 제출용 · 날짜 · 다른 용도 사용 금지" 대각선 반복 워터마크. 사진 → JPG·A4 PDF, PDF(10쪽까지) → 이미지 PDF | `src/tools-mask.ts` |
| `#img-to-pdf` · `#img-compress` · `#exif-clean` | 이미지 → PDF / 압축·변환 / 정보 지우기 | `src/tools-img.ts` |
| `#bg-remove` | 배경 지우기 (기기 안 AI, 처음 한 번 모델 약 56MB) | `src/tools-bg.ts` |

결과 PDF 에는 제작 도구 이름(Producer·Creator)을 넣지 않아요.

## 라이선스

이 저장소는 **GNU AGPL-3.0** 으로 공개합니다 (`LICENSE`).
배경 지우기에 [@imgly/background-removal](https://github.com/imgly/background-removal-js) (AGPL-3.0)을 쓰기 때문이에요.

### @imgly/background-removal 1.7.0 을 고친 부분
- 원본 번들 안의 `ndarray` 가 `new Function` 을 써서 CSP(`unsafe-eval` 금지)에 막혀요.
  그 부분을 `dev/ndarray-shim.cjs` 의 작은 대체 구현으로 바꿔서 다시 묶었어요.
- 결과물: `public/vendor/bg-removal-1.7.0-csp.mjs`
- 다시 만드는 방법: `dev/build-bg.sh` (패치 스크립트 `dev/patch-imgly.py`)

### 그 밖에 쓴 오픈소스 (각자의 라이선스)
pdf-lib (MIT) · PDF.js (Apache-2.0) · fflate (MIT) · exifr (MIT) · heic-to (LGPL-3.0, CSP 빌드) · ONNX Runtime Web (MIT) — `public/vendor/` 에 그대로 들어 있어요 (Vite 가 다시 묶지 않고 `/vendor/…` 주소 그대로 배포). 글꼴 Pretendard (OFL) 는 jsDelivr 에서 불러와요.

- **라이선스 고지**: `public/third-party-licenses.txt` (→ `/third-party-licenses.txt`, 저작권 문구 + MIT·Apache-2.0·LGPL-3.0·GPL-3.0·AGPL-3.0 원문 전체)와
  `public/licenses.html` (→ `/licenses`, 한국어 요약 · LGPL 원본 소스 안내). 푸터에서 링크해요. **vendor 파일을 바꾸면 두 파일도 같이 고쳐요.**

## 개발 (TypeScript + Vite)

- 코드: `src/*.ts` (`strict`). 화면 → `dist/js/` 로 묶이고, PDF 작업은 `src/pdf-worker.ts` 모듈 워커.
- vendor 라이브러리(pdf-lib · PDF.js · fflate · exifr · heic-to · bg-removal)는 `public/vendor/` 의 고정 버전 파일을 **처음 쓸 때** 그 주소 그대로 불러와요(`src/vendor.ts` 의 `vendorImport`). 쓰는 API 만 타입으로 적었어요(`src/vendor.ts`, 워커의 pdf-lib 은 `src/pdf-lib.d.ts`).
- `public/` (vendor · css · assets · `_headers`) 은 같은 경로로 복사돼요. CSS 는 Vite 가 손대지 않아요.
- 디자인: 초록 커팅 매트 위 반듯한 카드, 포인트 파랑 `#2563eb`. 손글씨·연필·도장 장식은 쓰지 않아요(Jone Lab 가이드 3차 개정).
- 공유 이미지·아이콘: `dev/make-og.py`(→ `public/assets/og.svg`), `dev/export-art.mjs`(일러스트 → `dev/art/`), PNG 는 `dev/render-png.sh`(크롬 헤드리스).

```bash
npm run dev            # Vite 개발 서버
npm test               # 단위 테스트 (Vitest) — 순수 함수 + PDF 용량 줄이기(실제 pdf-lib, 가짜 코덱)
npm run typecheck      # tsc (화면 + 워커)
npm run build          # dist/
node dev/serve.mjs     # dist/ 를 public/_headers 와 같은 헤더(CSP)로 로컬 확인
npm run deploy         # 빌드 후 Cloudflare Pages(jipmunseo) 배포
```

문의: cowhddnjsdl0@gmail.com · Jone Lab: https://jone-lab.pages.dev
