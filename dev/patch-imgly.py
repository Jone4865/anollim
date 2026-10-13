# @imgly/background-removal 1.7.0 dist 안에 묶여 있는 ndarray(new Function 사용)를
# dev/ndarray-shim.cjs 로 바꾼 사본을 만들어요. 사용: python3 patch-imgly.py <dist/index.mjs> <out.mjs> <shim.cjs>
import re, sys
src, out, shim = sys.argv[1:4]
s = open(src).read()
start = s.index('// ../../node_modules/.pnpm/ndarray@1.0.19/node_modules/ndarray/ndarray.js')
end = s.index('// ', s.index('var require_ndarray', start) + 10)
body = open(shim).read()
s = s[:start] + 'var require_ndarray = __commonJS({ "ndarray-shim"(exports, module) {\n' + body + '\n} });\n\n' + s[end:]
open(out, 'w').write(s)
