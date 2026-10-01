const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/audio.js');
const SR = 44100;

// Estimate fundamental by autocorrelation over a window after the attack.
function pitch(x, sr, lo, hi) {
  const s = Math.round(sr * 0.15); const n = 4096; let best = 0; let bestLag = 0;
  for (let lag = Math.floor(sr / hi); lag <= Math.ceil(sr / lo); lag++) {
    let c = 0; for (let i = 0; i < n; i++) c += x[s + i] * x[s + i + lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  // parabolic refinement
  const ac = (L) => { let c = 0; for (let i = 0; i < n; i++) c += x[s + i] * x[s + i + L]; return c; };
  const a = ac(bestLag - 1); const b = ac(bestLag); const c = ac(bestLag + 1);
  const off = (a - c) / (2 * (a - 2 * b + c));
  return sr / (bestLag + off);
}
const cents = (f, ref) => 1200 * Math.log2(f / ref);

test('pluck is in tune across guitar and ukulele range', () => {
  for (const [m, inst] of [[40, 'guitar'], [45, 'guitar'], [52, 'guitar'], [59, 'guitar'], [64, 'guitar'], [76, 'guitar'], [60, 'ukulele'], [67, 'ukulele'], [69, 'ukulele'], [79, 'ukulele']]) {
    const x = A.renderPluck(m, SR, inst); const f0 = A.midiHz(m);
    const f = pitch(x, SR, f0 * 0.8, f0 * 1.25);
    assert.ok(Math.abs(cents(f, f0)) < 5, `${inst} ${m}: ${f.toFixed(2)} Hz vs ${f0.toFixed(2)} (${cents(f, f0).toFixed(1)} cents)`);
  }
});

test('piano tone is in tune', () => {
  for (const m of [48, 60, 64, 72]) {
    const x = A.renderPiano(m, SR); const f0 = A.midiHz(m);
    const f = pitch(x, SR, f0 * 0.8, f0 * 1.25);
    assert.ok(Math.abs(cents(f, f0)) < 5, `piano ${m}: ${cents(f, f0).toFixed(1)} cents`);
  }
});

test('single notes are audible, never clip, decay, and start without a click', () => {
  for (const inst of ['guitar', 'ukulele', 'piano']) for (const m of [43, 55, 64, 72]) {
    const x = A.renderNote(m, inst, SR); const st = A.stats(x);
    assert.ok(st.peak > 0.2 && st.peak <= 0.35, `${inst} ${m} peak ${st.peak}`);
    assert.ok(st.rms > 0.01, `${inst} ${m} rms ${st.rms}`);
    assert.strictEqual(st.clipped, 0);
    assert.ok(Math.abs(x[0]) < 1e-3, 'starts at silence');
    const early = A.stats(x.subarray(0, SR * 0.3)).rms; const late = A.stats(x.subarray(x.length - SR * 0.3)).rms;
    assert.ok(late < early * 0.35, `${inst} ${m} decays (${early.toFixed(3)} -> ${late.toFixed(3)})`);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-3, 'ends at silence');
    let dc = 0; for (const v of x) dc += v; assert.ok(Math.abs(dc / x.length) < 0.01, 'no DC offset');
  }
});

test('strum, arpeggio and together schedules', () => {
  const g = [40, 45, 50, 55, 59, 64];
  const s = A.schedule(g, 'strum', 'guitar');
  assert.deepStrictEqual(s.map((e) => e.midi), g); assert.ok(s[5].t > 0.1 && s[5].t < 0.3, 'strum sweep under 0.3 s');
  const a = A.schedule(g, 'arpeggio', 'guitar'); assert.ok(a[1].t - a[0].t >= 0.2);
  assert.ok(A.schedule(g, 'together', 'guitar').every((e) => e.t === 0));
  assert.ok(A.schedule([60, 64, 67], 'strum', 'piano').every((e) => e.t === 0), 'piano strum plays as a block');
  assert.deepStrictEqual(A.schedule([null, 48, 52], 'strum', 'guitar').map((e) => e.midi), [48, 52], 'muted strings skipped');
});

test('six-string chord mixdown stays below full scale', () => {
  for (const style of ['strum', 'together', 'arpeggio']) {
    const x = A.mixdown(A.schedule([40, 47, 52, 56, 59, 64], style, 'guitar'), 'guitar', SR, 1);
    const st = A.stats(x); assert.ok(st.peak < 0.95 && st.clipped === 0 && st.rms > 0.02, `${style} ${JSON.stringify(st)}`);
  }
  const p = A.stats(A.mixdown(A.schedule([48, 60, 64, 67, 71, 74], 'together', 'piano'), 'piano', SR, 1));
  assert.ok(p.peak < 0.95 && p.rms > 0.02, JSON.stringify(p));
});

test('renders are deterministic', () => {
  const a = A.renderPluck(52, SR, 'guitar'); const b = A.renderPluck(52, SR, 'guitar');
  assert.strictEqual(a.length, b.length); for (let i = 0; i < a.length; i += 997) assert.strictEqual(a[i], b[i]);
});

test('piano decays like a struck string, upper partials faster', () => {
  const x = A.mixdown(A.schedule([48, 60, 64, 67], 'together', 'piano'), 'piano', SR, 1);
  const w = SR / 4; const db = (i) => { let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j]; return 10 * Math.log10(s / w); };
  const hi = (i) => { let s = 0; for (let j = i + 1; j < i + w; j++) { const d = x[j] - x[j - 1]; s += d * d; } return 10 * Math.log10(s / w); };
  const drop = db(0) - db(SR * 2); const hiDrop = hi(0) - hi(SR * 2);
  assert.ok(drop > 20, `overall drop over 2 s: ${drop.toFixed(1)} dB`);
  assert.ok(hiDrop > drop + 3, `high band drops faster: ${hiDrop.toFixed(1)} vs ${drop.toFixed(1)} dB`);
});
