#!/usr/bin/env bash
# rhwp WASM·글꼴을 고정 버전으로 받아 public/vendor/rhwp-$VER/ 에 둬요. 버전을 올릴 땐 VER·해시를 같이 바꿔요.
# 글꼴도 버전 폴더 안에 둬요: /vendor/* 는 1년 immutable 캐시라 같은 주소의 파일을 바꾸면 사용자 브라우저에 옛 파일이 남아요.
# 저장소 맨 위 폴더에서 돌려요: bash dev/update-rhwp.sh
set -euo pipefail
cd "$(dirname "$0")/.."
VER=0.8.7
GF=67bc647ce1910e92f461bcc82aae30f21d21a9cc   # google/fonts 커밋 (OFL.txt 를 이 커밋으로 고정)
TMP=$(mktemp -d)
(cd "$TMP" && npm pack --silent "@rhwp/core@$VER" >/dev/null && tar xzf "rhwp-core-$VER.tgz")
DST=public/vendor/rhwp-$VER; mkdir -p "$DST/fonts"
cp "$TMP/package/rhwp.js" "$TMP/package/rhwp_bg.wasm" "$TMP/package/LICENSE" "$DST/"
curl -fsSL "https://raw.githubusercontent.com/edwardkim/rhwp/v$VER/THIRD_PARTY_LICENSES.md" -o "$DST/THIRD_PARTY_LICENSES.md"
# Bold 두 개는 '제목 굵기 원본처럼'을 켰을 때만 화면이 받아요(HWP_SPEC 0장 결정 3번)
for f in NotoSerifKR-Regular.woff2 NotoSansKR-Regular.woff2 NotoSerifKR-Bold.woff2 NotoSansKR-Bold.woff2; do
  curl -fsSL "https://raw.githubusercontent.com/edwardkim/rhwp/v$VER/assets/fonts/$f" -o "$DST/fonts/$f"
done
curl -fsSL "https://raw.githubusercontent.com/google/fonts/$GF/ofl/notoserifkr/OFL.txt" -o "$DST/fonts/OFL-NotoSerifKR.txt"
curl -fsSL "https://raw.githubusercontent.com/google/fonts/$GF/ofl/notosanskr/OFL.txt" -o "$DST/fonts/OFL-NotoSansKR.txt"
shasum -a 256 -c <<SUMS
70cde06a369fa7fd4fc8bc8f3d6acaee158596ba1a116a2c72159002b0b5654e  $DST/rhwp.js
54cf95014312e605c51b98eb9021247ea79ef2bbd0a7080e11c011d0246e3989  $DST/rhwp_bg.wasm
c9a1e3ac69994d680883b53b1fd83d520733b704792522a932bfaa276117de45  $DST/fonts/NotoSerifKR-Regular.woff2
d1bf8649914a4fe9477a8735bf056383e44e466141fb3d61897252e06d900c1a  $DST/fonts/NotoSansKR-Regular.woff2
504d6af6abb882acd912d47bafa383c4512a6c8c33635e4e8fb37111d9310941  $DST/fonts/NotoSerifKR-Bold.woff2
dab3d492daa687386292cff1499225db580f931f800ee0d124eb0636378c6020  $DST/fonts/NotoSansKR-Bold.woff2
5e0da210fb04058a8c0087985d2d456b931c2579811a49655721d3cf0c36b6d6  $DST/fonts/OFL-NotoSerifKR.txt
1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9  $DST/fonts/OFL-NotoSansKR.txt
SUMS
# 0.8.7 은 글자 폭 콜백(measureTextWidth)을 찾지 않아요. 새 버전에서 다시 찾으면 워커에 측정기를 넣어야 해요(HWP_SPEC 7-4).
if grep -q measureTextWidth "$DST/rhwp.js"; then echo "주의: 새 rhwp.js 가 measureTextWidth 를 찾아요 — src/hwp-worker.ts 를 고쳐야 해요" >&2; exit 1; fi
rm -rf "$TMP"
echo "rhwp $VER 파일을 $DST 에 받았어요"
