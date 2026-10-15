# 집문서 — 업로드 없는 파일 도구

https://jipmunseo.pages.dev (Cloudflare Pages · 예전 `*.vercel.app` 주소는 정리돼서 열리지 않아요)

**한글 문서(HWP·HWPX) 보기·PDF·Word·쪽 그림·텍스트 저장**, PDF 합치기·나누기·회전·**용량 줄이기**, **신분증 가리기·"OO 제출용" 워터마크**, 이미지 → PDF, 이미지 압축·변환,
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
| `#hwp-view` | **HWP 보기 · 변환**: HWP 5.0·HWPX·HWP 3.0을 rhwp(WASM, 워커)로 열어 쪽 SVG 를 `<img>`(blob)로 보여 줘요(문서 마크업을 페이지 DOM 에 넣지 않음). 내보내기 4형식: 그림 PDF(150/200/300dpi, 쪽 고르기) · **Word .docx**(rhwp 읽기 전용 HTML → 우리 OOXML 쓰기 + fflate, 표 병합·그림·머리말·꼬리말·각주·미주, 워커 안) · 쪽 그림 PNG(여러 장이면 ZIP, 휴대폰은 공유 시트 30장까지) · 텍스트 .txt(UTF-8 BOM + CRLF, 표는 탭). 암호 문서는 기기 안에서 암호로 열기, DRM·인증서 보안 문서는 열지 않음, 배포용 문서는 복사·인쇄 제한 플래그를 직접 읽어 화면은 PNG 로만·인쇄방지면 저장·인쇄 막기, 배포용은 Word 로 옮기지 않고 복사방지면 텍스트도 막기. 화질·굵은 글꼴 설정만 `localStorage`(`jms.hwp.dpi`·`jms.hwp.bold`)에 기억해요. 검색용 안내 페이지: `/hwp`(`public/hwp.html`, 정적, 도구 코드 없음) | `src/tools-hwp.ts` · `src/hwp-lib.ts`(판별·정책) · `src/hwp-svg.ts` · `src/hwp-export.ts`(블록 모델·텍스트) · `src/hwp-docx.ts`(Word) · `src/hwp-export-ui.ts` · `src/hwp-worker.ts` · `src/hwp-client.ts` |
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

### 한글 문서 보기 (rhwp · Noto 글꼴 · 한컴 고지)
- [rhwp](https://github.com/edwardkim/rhwp) `@rhwp/core` 0.8.7 (MIT) — `public/vendor/rhwp-0.8.7/` 에 고치지 않은 npm 배포본(`rhwp.js`·`rhwp_bg.wasm`)과 `LICENSE`·`THIRD_PARTY_LICENSES.md`(안의 Rust 크레이트 목록)를 둬요. 받기·해시 확인: `bash dev/update-rhwp.sh`.
- 글꼴 Noto Serif KR·Noto Sans KR Regular·Bold (SIL OFL 1.1, rhwp v0.8.7 `assets/fonts` 의 서브셋) — `public/vendor/rhwp-0.8.7/fonts/`(버전 폴더 안: `/vendor/*` 는 1년 immutable 캐시라서). 쪽 SVG 안에 data URI 로 넣어 기기마다 같은 모양으로 그려요. Bold 두 개(1.6MB)는 화면에서 '제목 굵기 원본처럼'을 켰을 때만 받아요.
- Word(.docx)는 `docx` 패키지 없이 `src/hwp-docx.ts` 가 OOXML 부품을 직접 쓰고 이미 있는 fflate 로 묶어요(작성자·회사·만든 시각 없음, zip 시각 1980-01-01 고정). 이유: HWP_SPEC 12-4-5(무게·CSP·묶인 패키지 수).
- 서비스 코드는 rhwp 의 편집·다시 저장·배포용 풀기(`convertToEditable`·`exportHwp*`·`exportHwpx*`)를 부르지 않아요(`src/rhwp.d.ts` 에도 없어요). 배포용 문서를 끄는 스위치: `src/hwp-lib.ts` 의 `HWP_ALLOW_DISTRIBUTION`.
- 시험 파일 `test/fixtures/hwp/` 는 `node dev/make-hwp-fixtures.mjs` 로 rhwp 가 직접 만든 합성 문서예요(머리말·꼬리말·각주·미주가 든 `synthetic-notes.*` 포함).
- 한컴 공개 문서 이용 조건에 따른 고지:
  - 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
  - 본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
- 한글·한컴·HWP·HWPX는 ㈜한컴(옛 ㈜한글과컴퓨터)의 상표예요. 집문서는 한컴과 제휴·후원·승인 관계가 없는 독립 도구예요. Microsoft Word는 Microsoft Corporation의 상표이고, 카카오톡은 ㈜카카오의 상표예요.

### 그 밖에 쓴 오픈소스 (각자의 라이선스)
pdf-lib (MIT) · PDF.js (Apache-2.0) · fflate (MIT) · exifr (MIT) · heic-to (LGPL-3.0, CSP 빌드) · ONNX Runtime Web (MIT) — `public/vendor/` 에 그대로 들어 있어요 (Vite 가 다시 묶지 않고 `/vendor/…` 주소 그대로 배포). 글꼴 Pretendard (OFL) 는 jsDelivr 에서 불러와요.

- **라이선스 고지**: `public/third-party-licenses.txt` (→ `/third-party-licenses.txt`, 저작권 문구 + MIT·Apache-2.0·LGPL-3.0·GPL-3.0·AGPL-3.0 원문 전체)와
  `public/licenses.html` (→ `/licenses`, 한국어 요약 · LGPL 원본 소스 안내). 푸터에서 링크해요. **vendor 파일을 바꾸면 두 파일도 같이 고쳐요.**

## 개발 (TypeScript + Vite)

- 코드: `src/*.ts` (`strict`). 화면 → `dist/js/` 로 묶이고, PDF 작업은 `src/pdf-worker.ts`, 한글 문서는 `src/hwp-worker.ts` 모듈 워커(`vendor:rhwp` → `/vendor/rhwp-0.8.7/rhwp.js` 그대로, `vite.config.ts`).
- vendor 라이브러리(pdf-lib · PDF.js · fflate · exifr · heic-to · bg-removal · rhwp)는 `public/vendor/` 의 고정 버전 파일을 **처음 쓸 때** 그 주소 그대로 불러와요(`src/vendor.ts` 의 `vendorImport`). 쓰는 API 만 타입으로 적었어요(`src/vendor.ts`, 워커의 pdf-lib 은 `src/pdf-lib.d.ts`).
- `public/` (vendor · css · assets · `_headers`) 은 같은 경로로 복사돼요. CSS 는 Vite 가 손대지 않아요.
- 디자인: 초록 커팅 매트 위 반듯한 카드, 포인트 파랑 `#2563eb`. 손글씨·연필·도장 장식은 쓰지 않아요(Jone Lab 가이드 3차 개정).
- 공유 이미지·아이콘: `dev/make-og.py`(→ `public/assets/og.svg`), `dev/export-art.mjs`(일러스트 → `dev/art/`), PNG 는 `dev/render-png.sh`(크롬 헤드리스).

```bash
npm run dev            # Vite 개발 서버
npm test               # 단위 테스트 (Vitest) — 순수 함수 + PDF 용량 줄이기(실제 pdf-lib, 가짜 코덱) + 한글 문서(실제 rhwp WASM, 합성 문서)
npm run typecheck      # tsc (화면 + 워커)
npm run build          # dist/
node dev/serve.mjs     # dist/ 를 public/_headers 와 같은 헤더(CSP)로 로컬 확인
npm run deploy         # 빌드 후 Cloudflare Pages(jipmunseo) 배포
```

문의: cowhddnjsdl0@gmail.com · Jone Lab: https://jone-lab.pages.dev
