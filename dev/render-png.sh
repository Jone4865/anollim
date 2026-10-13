#!/bin/sh
# SVG → PNG (크롬 헤드리스). 사용: sh dev/render-png.sh   (python3 dev/make-og.py 먼저)
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
A="$PWD/public/assets"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 --window-size="$2" --screenshot="$3" "file://$1" >/dev/null 2>&1; }
shot "$A/og.svg" 1200,630 "$A/og.png"
shot "$A/icon.svg" 512,512 "$A/icon.png"
sips -z 180 180 "$A/icon.png" --out "$A/apple-touch-icon.png" >/dev/null
sips -z 64 64 "$A/icon.png" --out "$A/favicon.png" >/dev/null
echo "png done"
