#!/usr/bin/env python3
"""Instrument-stage browser check: load dist/index.html from file://, collect errors and network requests,
exercise taps and URL round-trips, and save screenshots at desktop, phone portrait and phone landscape."""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = (ROOT / 'dist' / 'index.html').as_uri()
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
report = {'url': 'dist/index.html', 'checks': [], 'errors': [], 'requests': []}

def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail})

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp, mobile in [('desktop', (1440, 900), False), ('phone-portrait', (390, 844), True), ('phone-landscape', (844, 390), True)]:
        for theme in ['light', 'dark']:
            ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, color_scheme=theme)
            pg = ctx.new_page()
            pg.on('pageerror', lambda e, l=label: report['errors'].append(f'{l}: {e}'))
            pg.on('console', lambda m, l=label: m.type == 'error' and report['errors'].append(f'{l} console: {m.text}'))
            pg.on('request', lambda r: (not r.url.startswith('file:') and not r.url.startswith('data:')) and report['requests'].append(r.url))
            pg.goto(DIST + '#/chord/F')
            pg.wait_for_selector('svg.neck')
            pg.screenshot(path=str(OUT / f'{label}-{theme}-chord-F.png'), full_page=True)
            if theme == 'light':
                n_svg = pg.locator('svg.neck, svg.piano').count()
                check(f'{label}: instruments rendered', n_svg >= (3 if not mobile or label == 'phone-landscape' else 1), f'{n_svg} instrument svgs')
                big = pg.locator('.answer .big').inner_text()
                check(f'{label}: F chord name shown', big == 'F', big)
                # name-it: start from guitar C shape, tap to change into Am (x02210)
                pg.goto(DIST + '#/name/g:x32010')
                pg.wait_for_selector('svg.neck')
                big = pg.locator('.answer .big').inner_text()
                check(f'{label}: name-it C from x32010', big == 'C', big)
                if not mobile or label == 'phone-landscape':
                    def tap(s, f):
                        pg.locator(f'#inst-guitar rect.hit[data-s="{s}"][data-f="{f}"]').dispatch_event('pointerdown')
                    tap(1, 0); tap(3, 2)
                    big = pg.locator('.answer .big').inner_text()
                    check(f'{label}: taps turn C into Am', big == 'Am', f'{big} hash={pg.evaluate("location.hash")}')
                    uk = pg.locator('#inst-ukulele .dot, #inst-ukulele circle.open').count(); pi = pg.locator('#inst-piano .dot').count()
                    check(f'{label}: ukulele and piano follow guitar', uk >= 3 and pi >= 3, f'uke dots {uk}, piano dots {pi}')
                    pg.locator('#inst-piano g.key[data-midi="60"]').dispatch_event('pointerdown')
                    h = pg.evaluate('location.hash')
                    check(f'{label}: piano tap switches source and updates URL', h.startswith('#/name/p:'), h)
                    pg.screenshot(path=str(OUT / f'{label}-light-name-it.png'), full_page=True)
                else:
                    pg.locator('[data-tab="piano"]').click()
                    pg.locator('#inst-piano g.key[data-midi="57"]').dispatch_event('pointerdown')
                    big = pg.locator('.answer .big').inner_text()
                    check(f'{label}: phone piano tab tap renames', big != 'C', big)
                    pg.screenshot(path=str(OUT / f'{label}-light-name-it-piano.png'), full_page=True)
                    pg.locator('[data-tab="guitar"]').click()
                    pg.screenshot(path=str(OUT / f'{label}-light-name-it-guitar.png'), full_page=True)
                pg.goto(DIST + '#/chord/Bm7b5?g=2')
                pg.wait_for_selector('svg.neck')
                sub = pg.locator('.isub').first.inner_text()
                check(f'{label}: URL shape index round-trip', 'Shape 2' in sub or mobile, sub)
            ctx.close()
    b.close()
report['passed'] = all(c['ok'] for c in report['checks']) and not report['errors'] and not report['requests']
print(json.dumps(report, indent=1))
