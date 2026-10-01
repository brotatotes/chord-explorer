#!/usr/bin/env python3
"""Verify-stage browser review. file:// only, no network. Desktop, phone portrait and landscape with real touch taps,
keyboard-only use of every instrument, and WCAG contrast of text against its background in light and dark themes."""
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = os.environ.get('CE_URL') or (ROOT / 'dist' / 'index.html').as_uri()  # CE_URL checks a served copy
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
R = {'checks': [], 'errors': [], 'requests': [], 'contrast': {}}

def check(name, ok, detail=''):
    R['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})

def big(pg):
    return pg.locator('.answer .big').first.inner_text().strip()

CONTRAST_JS = """() => {
  const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
  const bgOf = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; const a = b.match(/[\\d.]+/g); if (a && (a.length < 4 || +a[3] > .5)) return b; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  const out = []; const seen = new Set();
  for (const el of document.querySelectorAll('body *:not(svg):not(svg *)')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const fg = cs.color; const bg = bgOf(el); const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700; const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5; const key = el.tagName + '|' + el.className + '|' + fg + '|' + bg;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''), text: el.textContent.trim().slice(0, 30), ratio: Math.round(ratio * 100) / 100, need });
  }
  return out;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    cfgs = [('desktop', (1440, 900), False), ('phone-portrait', (390, 844), True), ('phone-landscape', (844, 390), True)]
    for label, vp, mobile in cfgs:
        ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e, l=label: R['errors'].append(f'{l}: {e}'))
        pg.on('console', lambda m, l=label: m.type == 'error' and R['errors'].append(f'{l} console: {m.text}'))
        pg.on('request', lambda r: (not r.url.startswith('file:') and not r.url.startswith('data:') and r.url.split('#')[0] != DIST.split('#')[0]) and R['requests'].append(r.url))
        # Task 1 by touch: tap chips
        pg.goto(DIST + '#/chord/C'); pg.wait_for_selector('svg.neck, svg.piano')
        pg.locator('#q').fill('G7')
        pg.locator('#sugg .chip').first.tap() if mobile else pg.locator('#sugg .chip').first.click()
        check(f'{label}: chord via suggestion chip', big(pg) == 'G7', big(pg))
        pg.screenshot(path=str(OUT / f'{label}-chord.png'))
        # Task 2 by touch: tap frets x32010 on guitar
        pg.goto(DIST + '#/name/g:xxxxxx'); pg.wait_for_selector('svg.neck')
        if mobile and pg.locator('[data-tab="guitar"]').count():
            pg.locator('[data-tab="guitar"]').tap()
        for s, f in [(1, 3), (2, 2), (3, 0), (4, 1), (5, 0)]:
            loc = pg.locator(f'#inst-guitar rect.hit[data-s="{s}"][data-f="{f}"]')
            loc.scroll_into_view_if_needed()
            if mobile: loc.tap()
            else: loc.click()
        check(f'{label}: tapped x32010 names C', big(pg) == 'C', big(pg) + ' ' + pg.evaluate('location.hash'))
        pg.screenshot(path=str(OUT / f'{label}-name.png'))
        # Task 3 and 4 by touch on mode buttons
        tap = (lambda l: l.tap()) if mobile else (lambda l: l.click())
        tap(pg.locator('[data-mode="scale"]')); pg.select_option('#stonic', 'Bb'); pg.select_option('#stype', 'mixolydian')
        notes = pg.locator('.roles.scale b').all_inner_texts()
        check(f'{label}: Bb mixolydian', notes == ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A♭'], notes)
        pg.screenshot(path=str(OUT / f'{label}-scale.png'))
        tap(pg.locator('[data-mode="key"]')); pg.select_option('#kkey', 'Am')
        cards = pg.locator('.kcard .cn').all_inner_texts()
        check(f'{label}: A minor diatonic triads', cards[:7] == ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'], cards)
        tap(pg.locator('[data-kc="4"]'))
        check(f'{label}: key chord tap selects Em', pg.locator('.kcard.on .cn').inner_text() == 'Em', pg.evaluate('location.hash'))
        pg.screenshot(path=str(OUT / f'{label}-key.png'))
        # horizontal overflow
        ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        check(f'{label}: no horizontal page overflow', ov <= 1, ov)
        if mobile and label == 'phone-portrait':
            pg.goto(DIST + '#/chord/C'); pg.wait_for_selector('svg.neck, svg.piano')
            box = pg.locator('#insts').bounding_box()
            y = box['y'] + min(box['height'], 300) / 2
            cdp = ctx.new_cdp_session(pg)
            for typ, x in [('touchStart', 320), ('touchMove', 200), ('touchEnd', 60)]:
                cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [] if typ == 'touchEnd' else [{'x': x, 'y': y}]})
            sel = pg.locator('[role="tab"][aria-selected="true"]').inner_text()
            check(f'{label}: swipe left changes tab', sel.lower() == 'ukulele', sel)
            pinned = pg.locator('.answer .big').first.bounding_box()
            check(f'{label}: chord name visible above fold', pinned and pinned['y'] < 844, pinned)
        ctx.close()
    # keyboard-only desktop flow
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: R['errors'].append(f'kb: {e}'))
    pg.goto(DIST + '#/name/g:xxxxxx'); pg.wait_for_selector('svg.neck')
    stops = []
    for i in range(40):
        pg.keyboard.press('Tab')
        stops.append(pg.evaluate("(document.activeElement.id || document.activeElement.dataset.mode || document.activeElement.tagName)"))
    check('keyboard: Tab reaches mode buttons, guitar, ukulele and piano', all(x in stops for x in ['kb-guitar', 'kb-ukulele', 'kb-piano']) and 'scale' in stops, stops)
    pg.focus('#kb-guitar')
    # cursor starts at low E open. Build C: A3 D2 G0 B1 e0 (low E muted)
    def k(*keys):
        for key in keys: pg.keyboard.press(key)
    k('ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter')  # A string fret 3
    k('ArrowUp', 'ArrowLeft', 'Enter')  # D fret 2
    k('ArrowUp', 'ArrowLeft', 'ArrowLeft', 'Enter')  # G open
    k('ArrowUp', 'ArrowRight', 'Enter')  # B fret 1
    k('ArrowUp', 'ArrowLeft', 'Enter')  # e open
    check('keyboard: build C on guitar with arrows and Enter', big(pg) == 'C', big(pg) + ' ' + pg.evaluate('location.hash'))
    check('keyboard: focus stays on neck after re-render', pg.evaluate('document.activeElement.id') == 'kb-guitar', pg.evaluate('document.activeElement.id'))
    pg.screenshot(path=str(OUT / 'keyboard-focus.png'))
    pg.goto(DIST + '#/name/p:'); pg.wait_for_selector('svg.piano'); pg.focus('#kb-piano')
    k('Enter', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter')
    check('keyboard: build C on piano (C4 E4 G4)', big(pg) == 'C', big(pg) + ' ' + pg.evaluate('location.hash'))
    pg.goto(DIST + '#/chord/C'); pg.wait_for_selector('svg.neck'); pg.locator('body').click(position={'x': 5, 'y': 5})
    k('ArrowRight')
    check('keyboard: arrow steps to next guitar shape', 'g=2' in pg.evaluate('location.hash'), pg.evaluate('location.hash'))
    ctx.close()
    # contrast in both themes over all four views
    for theme in ['light', 'dark']:
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, color_scheme=theme); pg = ctx.new_page()
        bad = []; n = 0
        for url in ['#/chord/F%23m7b5', '#/name/g:x02010', '#/scale/Gb/major', '#/key/Eb/major?sev=1&c=2']:
            pg.goto(DIST + url); pg.wait_for_selector('svg.neck, svg.piano')
            res = pg.evaluate(CONTRAST_JS); n += len(res)
            bad += [dict(r, view=url) for r in res if r['ratio'] < r['need']]
        R['contrast'][theme] = {'elements_checked': n, 'failures': bad}
        check(f'contrast {theme}: all text meets WCAG AA', not bad, bad[:8])
        ctx.close()
    b.close()
R['passed'] = all(c['ok'] for c in R['checks']) and not R['errors'] and not R['requests']
print(json.dumps(R, indent=1, ensure_ascii=False))
