# assets/og.svg (1200x630) 만들기 — 종이 바탕 + 커팅 매트 + 손그림 도구 + "안 나감" 도장. PNG 변환은 resvg 로.
import re, os
os.chdir(os.path.join(os.path.dirname(__file__), '..', 'assets'))
strip = lambda s: re.sub(r'^<svg[^>]*>|</svg>\s*$', '', s.strip())
def art(name):
    s = strip(open(f't-{name}.svg').read())
    return re.sub(r'<defs>.*?</defs>', '', s)
F = 'font-family="Apple SD Gothic Neo"'
tools = [('pdf-merge', 'PDF 합치기', 668, 170, -4), ('pdf-split', 'PDF 나누기', 920, 160, 3), ('img-compress', '이미지 압축', 680, 360, 2), ('exif-clean', '위치정보 지우기', 925, 350, -3)]
cards = ''
for name, label, x, y, r in tools:
    cards += f'''<g transform="translate({x},{y}) rotate({r})"><rect x="-6" y="-6" width="222" height="132" fill="#000" opacity=".18" rx="3" transform="translate(4,6)"/><rect x="-6" y="-6" width="222" height="132" fill="#fffdf7" rx="3"/>
<g transform="translate(46,0) scale(1.05)" color="#2a2622">{art(name)}</g><text x="105" y="114" text-anchor="middle" {F} font-weight="800" font-size="19" fill="#2a2622">{label}</text></g>'''
og = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-opacity=".08"/></pattern>
<pattern id="grid2" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M120 0H0V120" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/></pattern>
<filter id="pencil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter>
<filter id="pen" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>
</defs>
<rect width="1200" height="630" fill="#f6f1e7"/>
<rect x="620" y="40" width="560" height="560" rx="18" fill="#2e6a50"/><rect x="620" y="40" width="560" height="560" rx="18" fill="url(#grid)"/><rect x="620" y="40" width="560" height="560" rx="18" fill="url(#grid2)"/>
<rect x="626" y="46" width="548" height="548" rx="14" fill="none" stroke="#255a43" stroke-width="10"/>
<text x="660" y="110" {F} font-weight="700" font-size="26" fill="#f3efe2">오늘의 작업대</text>
{cards}
<path d="M70 236 C200 214 330 246 470 222 S560 222 590 228 L588 262 C470 254 330 270 200 262 S90 268 72 266 Z" fill="#2563eb" fill-opacity=".28"/>
<text x="72" y="140" {F} font-weight="800" font-size="40" fill="#2a2622">집콕툴</text>
<text x="72" y="250" {F} font-weight="900" font-size="78" fill="#2a2622" letter-spacing="-3">업로드 없는</text>
<text x="72" y="345" {F} font-weight="900" font-size="78" fill="#2a2622" letter-spacing="-3">파일 도구</text>
<text x="72" y="418" {F} font-weight="600" font-size="28" fill="#6f675e">PDF 합치기 · 나누기 · 사진 압축</text>
<text x="72" y="458" {F} font-weight="600" font-size="28" fill="#6f675e">배경 지우기 · 위치 정보 지우기</text>
<g transform="translate(1085,538) rotate(-14) scale(.72)" filter="url(#pen)" fill="none" stroke="#2563eb"><circle r="78" stroke-width="7"/><circle r="64" stroke-width="3"/>
<text y="16" text-anchor="middle" {F} font-weight="900" font-size="40" fill="#2563eb" stroke="none" letter-spacing="-2">안 나감</text></g>
<text x="72" y="572" {F} font-size="22" fill="#6f675e">jipkok.vercel.app · 파일이 내 컴퓨터 밖으로 나가지 않아요</text>
</svg>'''
open('og.svg', 'w').write(og)
