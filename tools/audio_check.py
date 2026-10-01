#!/usr/bin/env python3
"""Sound-stage check. Loads dist/index.html from file:// in Chromium and verifies:
- no AudioContext exists before the first gesture, and one exists after it
- tapping chords, shapes, frets, keys and scales triggers playback calls that return true
- mute, volume and play style persist across reload, and mute blocks playback
- offline renders through the real Web Audio graph for guitar, ukulele and piano are audible and do not clip
Writes JSON to stdout, a WAV clip per instrument to argv[1]."""
import json, os, sys, pathlib, struct, wave
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = os.environ.get('CE_URL') or (ROOT / 'dist' / 'index.html').as_uri()  # CE_URL checks a served copy
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
report = {'checks': [], 'errors': [], 'requests': [], 'renders': {}}

def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)})

SPY = """() => { window.__calls = []; const A = window.CEAudio; if (A.__spied) return; A.__spied = true;
  for (const k of ['note', 'notes', 'scale']) { const f = A[k].bind(A); A[k] = (...a) => { const r = f(...a); window.__calls.push({k, inst: a[1], n: Array.isArray(a[0]) ? a[0].length : 1, r}); return r; }; } }"""
ACOUNT = """() => { window.__ctxCount = 0; const O = window.AudioContext; window.AudioContext = function (...a) { window.__ctxCount++; return new O(...a); }; window.AudioContext.prototype = O.prototype; }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    ctx.add_init_script("(" + ACOUNT + ")()")
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: report['errors'].append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and report['errors'].append('console: ' + m.text))
    pg.on('request', lambda r: (not r.url.startswith('file:') and not r.url.startswith('data:') and r.url.split('#')[0] != DIST.split('#')[0]) and report['requests'].append(r.url))
    pg.goto(DIST + '#/chord/C')
    pg.wait_for_selector('#insts svg')
    check('no audio context before first gesture', pg.evaluate('window.__ctxCount === 0 && !window.CEAudio.ready'), pg.evaluate('window.__ctxCount'))
    check('sound controls present', pg.locator('#mute').count() == 1 and pg.locator('#vol').count() == 1 and pg.locator('#pstyle').count() == 1)
    pg.evaluate(SPY)
    pg.locator('.playname').first.click()
    check('first tap creates one audio context', pg.evaluate('window.__ctxCount === 1 && window.CEAudio.ready'), pg.evaluate('window.__ctxCount'))
    state = pg.evaluate("() => { const A = window.CEAudio; return A.ready ? 'ok' : 'none'; }")
    calls = pg.evaluate('window.__calls')
    check('tapping the chord name plays a six-string guitar strum', any(c['k'] == 'notes' and c['inst'] == 'guitar' and c['n'] >= 5 and c['r'] for c in calls), calls)
    pg.evaluate('window.__calls = []')
    for inst in ['guitar', 'ukulele', 'piano']:
        pg.locator(f'[data-hear="{inst}"]').first.click()
    calls = pg.evaluate('window.__calls')
    check('hear buttons play each instrument', [c['inst'] for c in calls] == ['guitar', 'ukulele', 'piano'] and all(c['r'] for c in calls), calls)
    # name mode: tap a fret, which should sound that note
    pg.goto(DIST + '#/name/g:x32010'); pg.wait_for_selector('svg.neck'); pg.evaluate(SPY)
    hit = pg.locator('#insts rect.hit[data-f="3"]').first
    if hit.count():
        hit.click(); calls = pg.evaluate('window.__calls')
        check('tapping a fret in Name it sounds the note', any(c['k'] == 'note' and c['r'] for c in calls), calls)
    else:
        keys = pg.locator('#insts [data-midi]').first; keys.click(); calls = pg.evaluate('window.__calls')
        check('tapping a key in Name it sounds the note', any(c['k'] == 'note' and c['r'] for c in calls), calls)
    pg.goto(DIST + '#/scale/A/minor'); pg.wait_for_selector('#insts svg'); pg.evaluate(SPY)
    pg.locator('#playscale').click(); calls = pg.evaluate('window.__calls')
    check('scale button plays eight notes', any(c['k'] == 'scale' and c['n'] == 8 and c['r'] for c in calls), calls)
    pg.goto(DIST + '#/key/G/major'); pg.wait_for_selector('.kcard'); pg.evaluate(SPY)
    pg.locator('[data-kc]').nth(4).click(); calls = pg.evaluate('window.__calls')
    check('tapping a chord in Key plays it', any(c['k'] == 'notes' and c['r'] for c in calls), calls)
    # persistence
    pg.locator('#mute').click(); pg.locator('#vol').fill('0.4'); pg.select_option('#pstyle', 'arpeggio')
    pg.reload(); pg.wait_for_selector('#insts svg')
    prefs = pg.evaluate('window.CEAudio.prefs')
    check('mute, volume and style persist across reload', prefs == {'volume': 0.4, 'muted': True, 'style': 'arpeggio'}, prefs)
    check('mute button shows muted state after reload', pg.locator('#mute').get_attribute('aria-pressed') == 'true')
    pg.evaluate(SPY); pg.locator('.playname').first.click(); calls = pg.evaluate('window.__calls')
    check('muted tap makes no sound', calls and not any(c['r'] for c in calls), calls)
    pg.locator('#mute').click(); pg.select_option('#pstyle', 'strum'); pg.locator('#vol').fill('0.7')
    # offline renders through the real graph (compressor + master gain)
    # Each window covers the audible ring of that instrument, so RMS is not diluted by trailing silence.
    clips = {'guitar': ([40, 47, 52, 56, 59, 64], 'strum', 2.5), 'ukulele': ([67, 60, 64, 72], 'strum', 1.5), 'piano': ([48, 60, 64, 67, 71], 'together', 2.5), 'guitar-arpeggio': ([45, 52, 57, 60, 64], 'arpeggio', 3)}
    for name, (midis, style, secs) in clips.items():
        inst = name.split('-')[0]
        st = pg.evaluate(f"window.CEAudio.renderOffline({json.dumps(midis)}, '{inst}', '{style}', {secs})")
        report['renders'][name] = st
        check(f'offline {name} render is audible and does not clip', st['rms'] > 0.02 and st['peak'] < 0.99 and st['clipped'] == 0, st)
    # save audible WAVs from the pure core for listening
    data = pg.evaluate("""() => { const C = window.SynthCore; const out = {};
      const g = C.mixdown(C.schedule([40, 47, 52, 56, 59, 64], 'strum', 'guitar'), 'guitar', 22050, 1);
      const u = C.mixdown(C.schedule([67, 60, 64, 72], 'strum', 'ukulele'), 'ukulele', 22050, 1);
      const p = C.mixdown(C.schedule([48, 60, 64, 67], 'together', 'piano'), 'piano', 22050, 1);
      for (const [k, x] of [['guitar', g], ['ukulele', u], ['piano', p]]) out[k] = Array.from(x.subarray(0, 22050 * 2.5), (v) => Math.round(v * 32767));
      return out; }""")
    for k, xs in data.items():
        with wave.open(str(OUT / f'{k}-E-chord.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050); w.writeframes(struct.pack(f'<{len(xs)}h', *(int(v) for v in xs)))
    b.close()
check('no page errors', not report['errors'], report['errors'])
check('no network requests', not report['requests'], report['requests'])
report['passed'] = sum(c['ok'] for c in report['checks']); report['total'] = len(report['checks'])
print(json.dumps(report, indent=1))
