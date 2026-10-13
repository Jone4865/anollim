# 집문서 — 업로드 없는 파일 도구

https://jipmunseo.pages.dev (예전 주소 jipkok.vercel.app · anollim.vercel.app 은 새 주소로 308 이동)

PDF 합치기·나누기·회전, 이미지 → PDF, 이미지 압축·변환, 사진 배경 지우기, 사진 정보(EXIF·위치) 지우기를
**브라우저 안에서만** 처리하는 정적 사이트예요. 서버 함수가 없고, `public/_headers`(Cloudflare Pages) 의 CSP(`connect-src 'self' blob: https://staticimgly.com`)로
파일이 다른 곳으로 나가지 못하게 막아둬요. (`staticimgly.com` 은 배경 지우기 모델 파일을 받는 곳이에요.)

## 라이선스

이 저장소는 **GNU AGPL-3.0** 으로 공개합니다 (`LICENSE`).
배경 지우기에 [@imgly/background-removal](https://github.com/imgly/background-removal-js) (AGPL-3.0)을 쓰기 때문이에요.

### @imgly/background-removal 1.7.0 을 고친 부분
- 원본 번들 안의 `ndarray` 가 `new Function` 을 써서 CSP(`unsafe-eval` 금지)에 막혀요.
  그 부분을 `dev/ndarray-shim.cjs` 의 작은 대체 구현으로 바꿔서 다시 묶었어요.
- 결과물: `public/vendor/bg-removal-1.7.0-csp.mjs`
- 다시 만드는 방법: `dev/build-bg.sh` (패치 스크립트 `dev/patch-imgly.py`)

### 그 밖에 쓴 오픈소스 (각자의 라이선스)
pdf-lib (MIT) · PDF.js (Apache-2.0) · fflate (MIT) · exifr (MIT) · heic-to (LGPL-3.0, CSP 빌드) · ONNX Runtime Web (MIT) · rough.js (MIT) · anime.js (MIT) — `public/vendor/` 에 그대로 들어 있어요 (Vite 가 다시 묶지 않고 `/vendor/…` 주소 그대로 배포).

## 개발 (TypeScript + Vite)

- 코드: `src/*.ts` (`strict`). 화면 → `dist/js/` 로 묶이고, PDF 작업은 `src/pdf-worker.ts` 모듈 워커.
- vendor 라이브러리(pdf-lib · PDF.js · fflate · exifr · heic-to · bg-removal)는 `public/vendor/` 의 고정 버전 파일을 **처음 쓸 때** 그 주소 그대로 불러와요(`src/vendor.ts` 의 `vendorImport`). 쓰는 API 만 타입으로 적었어요(`src/vendor.ts`, 워커의 pdf-lib 은 `src/pdf-lib.d.ts`).
- `public/` (vendor · css · assets · `_headers`) 은 같은 경로로 복사돼요. CSS 는 Vite 가 손대지 않아요.

```bash
npm run dev            # Vite 개발 서버
npm test               # 단위 테스트 (Vitest)
npm run typecheck      # tsc (화면 + 워커)
npm run build          # dist/
node dev/serve.mjs     # dist/ 를 vercel.json 과 같은 CSP 로 로컬 확인
npm run deploy         # 빌드 후 Cloudflare Pages(jipmunseo) 배포
```

문의: cowhddnjsdl0@gmail.com · Jone Lab: https://jone-lab.pages.dev
