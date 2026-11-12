#!/usr/bin/env python3
"""Subset the open-licensed (SIL OFL) fonts used by NEON STRATA into small woff2 files.
   usage: python3 tools/build-fonts.py <dir with @expo-google-fonts packages> <charset.txt>"""
import sys, os, subprocess
src, charset = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts')
sign = open(charset, encoding='utf-8').read()
# KS X 1001 hangul (2350 syllables) + latin + punctuation for UI text
ui = set(sign)
for b1 in range(0xB0, 0xC9):
    for b2 in range(0xA1, 0xFF):
        try: ui.add(bytes([b1, b2]).decode('euc-kr'))
        except Exception: pass
for c in range(0x20, 0x7F): ui.add(chr(c))
for ch in '·…—–‘’“”•→←↑↓▲▼◀▶●○■□◆◇★☆✕✓×÷±°℃㎡㎞㎏№ℓ⌀∞': ui.add(ch)
jobs = [
    ('black-han-sans/400Regular/BlackHanSans_400Regular.ttf', 'sign-black.woff2', sign),
    ('do-hyeon/400Regular/DoHyeon_400Regular.ttf', 'sign-dohyeon.woff2', sign),
    ('jua/400Regular/Jua_400Regular.ttf', 'sign-jua.woff2', sign),
    ('nanum-myeongjo/800ExtraBold/NanumMyeongjo_800ExtraBold.ttf', 'sign-myeongjo.woff2', sign),
    ('nanum-brush-script/400Regular/NanumBrushScript_400Regular.ttf', 'sign-brush.woff2', sign),
    ('noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf', 'ui-400.woff2', ''.join(ui)),
    ('noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf', 'ui-700.woff2', ''.join(ui)),
    ('orbitron/500Medium/Orbitron_500Medium.ttf', 'tech-500.woff2', None),
    ('orbitron/800ExtraBold/Orbitron_800ExtraBold.ttf', 'tech-800.woff2', None),
    ('rajdhani/600SemiBold/Rajdhani_600SemiBold.ttf', 'mono-600.woff2', None),
]
for rel, name, text in jobs:
    path = os.path.join(src, rel); dst = os.path.join(out, name)
    args = ['pyftsubset', path, '--flavor=woff2', '--output-file=' + dst, '--layout-features=*', '--no-hinting']
    if text is None: args.append('--unicodes=U+0020-007E,U+00B7,U+2014,U+25B2,U+25BC')
    else:
        tf = dst + '.txt'; open(tf, 'w', encoding='utf-8').write(text); args.append('--text-file=' + tf)
    subprocess.run(args, check=True)
    if text is not None: os.remove(dst + '.txt')
    print(name, os.path.getsize(dst) // 1024, 'KB')
