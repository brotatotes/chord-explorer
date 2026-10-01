#!/usr/bin/env python3
"""Features-stage browser check. Loads dist/index.html from file://, does each of the four tasks through the UI,
checks URL round-trips, and measures time-to-interactive and tap latency with 4x CPU throttling (mid-range phone)."""
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = os.environ.get('CE_URL') or (ROOT / 'dist' / 'index.html').as_uri()  # CE_URL checks a served copy
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
report = {'url': 'dist/index.html', 'checks': [], 'errors': [], 'requests': [], 'perf': {}}

def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})

def big(pg):
    return pg.locator('.answer .big').first.inner_text().strip()

TAP_JS = """async (sel) => {
  const el = document.querySelector(sel); if (!el) return -1;
  const t0 = performance.now();
  el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
  el.dispatchEvent(new MouseEvent('click', {bubbles: true}));
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  return performance.now() - t0;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, vp, mobile in [('desktop', (1440, 900), False), ('phone', (390, 844), True)]:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e, l=label: report['errors'].append(f'{l}: {e}'))
        pg.on('console', lambda m, l=label: m.type == 'error' and report['errors'].append(f'{l} console: {m.text}'))
        pg.on('request', lambda r: (not r.url.startswith('file:') and not r.url.startswith('data:') and r.url.split('#')[0] != DIST.split('#')[0]) and report['requests'].append(r.url))
        cdp = ctx.new_cdp_session(pg)
        if mobile:
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        # time to interactive: navigation start until first instrument svg exists and app is wired
        pg.goto(DIST + '#/chord/C')
        pg.wait_for_selector('svg.neck, svg.piano')
        tti = pg.evaluate("performance.now()")
        report['perf'][f'{label}_tti_ms'] = round(tti, 1)
        # Task 1: look up a chord by typing
        pg.locator('#q').fill('')
        pg.locator('#q').type('f sharp minor 7 flat 5' if not mobile else 'f#m7b5')
        pg.locator('#q').press('Enter')
        h = pg.evaluate('location.hash')
        check(f'{label}: typed chord lookup', big(pg) in ('F♯m7♭5', 'F♯ø7') and ('F%23m7b5' in h or 'F#m7b5' in h), f'{big(pg)} {h}')
        pg.locator('#q').fill('bbsu')
        chips = pg.locator('#sugg .chip').all_inner_texts()
        check(f'{label}: suggestions for partial input', any('sus' in c for c in chips), chips[:6])
        nxt = pg.locator('[data-step="guitar:1"]')
        if nxt.count():
            nxt.first.click()
            check(f'{label}: next shape updates URL (1-based)', 'g=2' in pg.evaluate('location.hash'), pg.evaluate('location.hash'))
        pg.screenshot(path=str(OUT / f'{label}-chord.png'), full_page=False)
        # Task 2: name what I'm playing
        pg.locator('[data-mode="name"]').click()
        pg.goto(DIST + '#/name/g:x02010')
        pg.wait_for_selector('svg.neck')
        check(f'{label}: name Am7 from x02010', big(pg) == 'Am7', big(pg))
        alts = pg.locator('.alt').all_inner_texts()
        check(f'{label}: ambiguity shows C6 reading', any('C6' in a for a in alts), alts)
        pg.select_option('#namekey', 'C')
        check(f'{label}: A in bass stays Am7 in key of C (ACCEPTANCE T6)', big(pg) == 'Am7', big(pg))
        check(f'{label}: key in URL', 'key=C' in pg.evaluate('location.hash'), pg.evaluate('location.hash'))
        pg.goto(DIST + '#/name/p:62.65.68.71'); pg.wait_for_selector('.answer .big')
        nokey = big(pg)
        pg.select_option('#namekey', 'Cm')
        check(f'{label}: key settles dim7 (D F Ab B: none={nokey}, C minor=Bdim7/D)', nokey == 'Ddim7' and big(pg) == 'Bdim7/D', big(pg))
        pg.screenshot(path=str(OUT / f'{label}-name.png'), full_page=False)
        # Task 3: scales
        pg.locator('[data-mode="scale"]').click()
        pg.select_option('#stonic', 'F#')
        pg.select_option('#stype', 'dorian')
        notes = pg.locator('.roles.scale b').all_inner_texts()
        check(f'{label}: F# dorian spelled', notes == ['F♯', 'G♯', 'A', 'B', 'C♯', 'D♯', 'E'], notes)
        h = pg.evaluate('location.hash')
        check(f'{label}: scale URL', h.startswith('#/scale/F%23/dorian') or h.startswith('#/scale/F#/dorian'), h)
        pg.select_option('#stonic', 'Gb'); pg.select_option('#stype', 'major')
        notes = pg.locator('.roles.scale b').all_inner_texts()
        check(f'{label}: Gb major has Cb', 'C♭' in notes and len(notes) == 7, notes)
        deg = pg.locator('.deg').first.inner_text()
        check(f'{label}: scale degree chip', deg == 'R', deg)
        pg.screenshot(path=str(OUT / f'{label}-scale.png'), full_page=False)
        # Task 4: chords in this key
        pg.locator('[data-mode="key"]').click()
        pg.select_option('#kkey', 'Eb')
        cards = pg.locator('.kcard .cn').all_inner_texts()
        check(f'{label}: Eb major triads', cards[:7] == ['E♭', 'Fm', 'Gm', 'A♭', 'B♭', 'Cm', 'Ddim'], cards)
        pg.locator('[data-sev="1"]').click()
        cards = pg.locator('.kcard .cn').all_inner_texts()
        check(f'{label}: Eb major sevenths', cards[:7] == ['E♭maj7', 'Fm7', 'Gm7', 'A♭maj7', 'B♭7', 'Cm7', 'Dm7♭5'], cards)
        pg.locator('[data-kc="4"]').click()
        h = pg.evaluate('location.hash')
        check(f'{label}: key chord selection in URL (1-based)', 'c=5' in h and 'sev=1' in h, h)
        pg.screenshot(path=str(OUT / f'{label}-key.png'), full_page=False)
        # URL round-trip: reload each view from its hash in a fresh page
        for url, expect in [('#/chord/G%2FB', 'G/B'), ('#/name/p:62.65.68.71?key=Cm', 'Bdim7/D'), ('#/scale/Eb/minor', 'E♭ natural minor'), ('#/key/Gb/major?sev=1&c=4', None)]:
            q = ctx.new_page(); q.on('pageerror', lambda e, l=label: report['errors'].append(f'{l} rt: {e}'))
            q.goto(DIST + url); q.wait_for_selector('svg.neck, svg.piano')
            got = big(q) if expect else q.locator('.kcard.on .cn').inner_text()
            ok = got.startswith(expect) if expect else got == 'C♭maj7'
            check(f'{label}: round-trip {url}', ok, got)
            q.close()
        # tap latency
        pg.goto(DIST + '#/name/g:x32010'); pg.wait_for_selector('svg.neck')
        lat = []
        sel = '#inst-guitar rect.hit[data-s="1"][data-f="0"]' if not mobile else '#inst-guitar rect.hit'
        for i in range(10):
            lat.append(pg.evaluate(TAP_JS, sel if not mobile else f'#inst-guitar rect.hit[data-s="{i % 6}"][data-f="{1 + i % 3}"]'))
        pg.goto(DIST + '#/key/C/major'); pg.wait_for_selector('.kcard')
        klat = [pg.evaluate(TAP_JS, f'[data-kc="{i % 7}"]') for i in range(7)]
        lat_all = sorted(lat + klat)
        report['perf'][f'{label}_tap_ms'] = {'median': round(lat_all[len(lat_all) // 2], 1), 'max': round(lat_all[-1], 1), 'samples': [round(x, 1) for x in lat + klat], 'cpu_throttle': 4 if mobile else 1}
        check(f'{label}: tap latency median < 50 ms', lat_all[len(lat_all) // 2] < 50, report['perf'][f'{label}_tap_ms'])
        ctx.close()
    b.close()
report['passed'] = all(c['ok'] for c in report['checks']) and not report['errors'] and not report['requests']
print(json.dumps(report, indent=1, ensure_ascii=False))
