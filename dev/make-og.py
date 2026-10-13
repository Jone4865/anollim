# public/assets/og.svg (1200x630) 만들기 — 바탕 + 커팅 매트 위 도구 카드 + "서버로 보낸 파일 0 B" 배지. PNG 는 dev/render-png.sh
# 일러스트는 dev/art/t-*.svg (먼저 npx tsx dev/export-art.mjs)
import re, os
here = os.path.dirname(os.path.abspath(__file__))
strip = lambda s: re.sub(r'^<svg[^>]*>|</svg>\s*$', '', s.strip())
def art(name):
    return strip(open(os.path.join(here, 'art', f't-{name}.svg')).read())
F = 'font-family="Pretendard, Apple SD Gothic Neo, sans-serif"'
tools = [('pdf-merge', 'PDF 합치기', 664, 150), ('pdf-compress', 'PDF 용량 줄이기', 916, 150), ('id-mask', '신분증 가리기', 664, 340), ('exif-clean', '위치정보 지우기', 916, 340)]
cards = ''
for name, label, x, y in tools:
    cards += f'''<g transform="translate({x},{y})"><rect width="224" height="164" rx="14" fill="#000" opacity=".18" transform="translate(0,8)"/><rect width="224" height="164" rx="14" fill="#fff"/>
<g transform="translate(46,10) scale(1.1)" color="#1f1d1a">{art(name)}</g><text x="112" y="138" text-anchor="middle" {F} font-weight="800" font-size="20" fill="#1f1d1a">{label}</text></g>'''
og = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-opacity=".08"/></pattern>
<pattern id="grid2" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M120 0H0V120" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/></pattern>
</defs>
<rect width="1200" height="630" fill="#f2f0eb"/>
<rect x="620" y="40" width="560" height="560" rx="18" fill="#2e6a50"/><rect x="620" y="40" width="560" height="560" rx="18" fill="url(#grid)"/><rect x="620" y="40" width="560" height="560" rx="18" fill="url(#grid2)"/>
<rect x="626" y="46" width="548" height="548" rx="14" fill="none" stroke="#255a43" stroke-width="10"/>
<text x="664" y="112" {F} font-weight="700" font-size="22" fill="#cfe3d6">작업대 · 쓸 도구를 고르세요</text>
{cards}
<rect x="70" y="224" width="400" height="34" fill="#2563eb" fill-opacity=".24"/>
<text x="72" y="140" {F} font-weight="800" font-size="40" fill="#1f1d1a">집문서</text>
<text x="72" y="250" {F} font-weight="900" font-size="78" fill="#1f1d1a" letter-spacing="-3">업로드 없는</text>
<text x="72" y="345" {F} font-weight="900" font-size="78" fill="#1f1d1a" letter-spacing="-3">파일 도구</text>
<text x="72" y="418" {F} font-weight="600" font-size="28" fill="#67615a">PDF 합치기 · 나누기 · 용량 줄이기</text>
<text x="72" y="458" {F} font-weight="600" font-size="28" fill="#67615a">신분증 가리기 · 제출용 워터마크</text>
<g transform="translate(72,500)"><rect width="392" height="76" rx="16" fill="#2563eb"/>
<g transform="translate(18,16)" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2l18 7v13c0 11-8 19-18 21-10-2-18-10-18-21V9z"/><path d="M14 22l6 6 10-11"/></g>
<text x="80" y="36" {F} font-weight="900" font-size="28" fill="#fff">0 B</text><text x="80" y="60" {F} font-weight="600" font-size="18" fill="#dbe6ff">서버로 보낸 파일 · jipmunseo.pages.dev</text></g>
</svg>'''
open(os.path.join(here, '..', 'public', 'assets', 'og.svg'), 'w').write(og)
print('og.svg written')
