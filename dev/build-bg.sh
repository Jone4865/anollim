#!/bin/sh
# vendor/bg-removal-1.7.0-csp.mjs 다시 만들기.
# npm i @imgly/background-removal@1.7.0 onnxruntime-web@1.21.0 esbuild 를 한 폴더에서 실행: sh build-bg.sh <jipkok 폴더 경로>
# 묶여 있는 ndarray 가 new Function 을 써서 CSP(unsafe-eval 금지)에 막히므로 shim 으로 바꿔요.
D=node_modules/@imgly/background-removal/dist
python3 "$1/dev/patch-imgly.py" $D/index.mjs $D/patched.mjs "$1/dev/ndarray-shim.cjs"
npx esbuild $D/patched.mjs --bundle --format=esm --minify --outfile="$1/vendor/bg-removal-1.7.0-csp.mjs"
