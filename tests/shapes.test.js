// Shape finder tests. Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/theory.js');
const S = require('../src/shapes.js');
const F = require('./fixtures/chart-shapes.js');
const check = require('./chart-check.js');

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALS = ['', 'm', '7', 'maj7', 'm7', 'sus4', 'sus2', 'dim', 'aug', 'm7b5', 'dim7', '6', 'm6', '9', 'add9', '5', '7sus4'];
const ALL = [];
for (const r of ROOTS) for (const q of QUALS) ALL.push(r + q);
ALL.push('D/F#', 'G/B', 'C/E', 'Am/G', 'C/G', 'F/A', 'E7#9', 'C13', 'G7b9', 'Bb7#5');

test('fixtures cover at least 60 guitar and 40 ukulele chords', () => {
  assert.ok(Object.keys(F.guitar).length >= 60);
  assert.ok(Object.keys(F.ukulele).length >= 40);
});

for (const inst of ['guitar', 'ukulele']) {
  test(inst + ': every shown shape is reachable, complete and well fingered', () => {
    let count = 0;
    for (const sym of ALL) {
      const chord = T.parseChord(sym);
      assert.ok(chord, 'parses ' + sym);
      const shapes = S.findShapes(chord, inst, 8);
      assert.ok(shapes.length >= 1, inst + ' has a shape for ' + sym);
      const chordPcs = new Set(chord.notes.map(T.notePc));
      if (chord.bass) chordPcs.add(T.notePc(chord.bass));
      const req = S.requiredTokens(chord, S.INSTRUMENTS[inst]);
      for (const s of shapes) {
        count++;
        const fs = S.fretString(s.frets);
        assert.ok(S.isReachable(s.frets, inst), sym + ' ' + fs + ' reachable');
        assert.ok(s.fingerCount <= 4, sym + ' ' + fs + ' uses at most four fingers');
        s.frets.forEach((f, i) => {
          if (f > 0) assert.ok(s.fingers[i] === 'T' || (s.fingers[i] >= 1 && s.fingers[i] <= 4), sym + ' ' + fs + ' finger on string ' + i);
          else assert.equal(s.fingers[i], 0);
          if (f >= 0) assert.ok(chordPcs.has(((S.INSTRUMENTS[inst].midi[i] + f) % 12)), sym + ' ' + fs + ' only chord tones');
        });
        const toks = new Set(s.tokens.filter(Boolean));
        for (const t of req) assert.ok(toks.has(t), sym + ' ' + fs + ' contains ' + t);
        const fr = s.frets.filter((f) => f > 0);
        if (fr.length) assert.ok(Math.max(...fr) - Math.min(...fr) <= 4, sym + ' span');
        if (inst === 'guitar') {
          const want = T.notePc(chord.bass || chord.root);
          const low = Math.min(...s.midi.filter((m) => m !== null));
          assert.equal(low % 12, want, sym + ' ' + fs + ' has the right bass note');
        }
      }
    }
    assert.ok(count > 1500, 'checked ' + count + ' shapes');
  });
}

test('chart agreement meets thresholds', () => {
  const r = check();
  const g = r.guitar; const u = r.ukulele;
  const top1 = (rows) => rows.filter((x) => x.topMatch).length;
  const top3 = (rows) => rows.filter((x) => x.chartRank >= 1 && x.chartRank <= 3).length;
  assert.ok(top1(g) >= 55, 'guitar top1 ' + top1(g));
  assert.ok(top3(g) >= 66, 'guitar top3 ' + top3(g));
  assert.ok(top1(u) >= 40, 'ukulele top1 ' + top1(u));
  assert.ok(top3(u) >= 43, 'ukulele top3 ' + top3(u));
});

test('the classic open and barre shapes come first', () => {
  const top = (c, i) => S.fretString(S.findShapes(c, i || 'guitar', 1)[0].frets);
  assert.equal(top('C'), 'x32010');
  assert.equal(top('G').startsWith('3200'), true);
  assert.equal(top('E'), '022100');
  assert.equal(top('Am'), 'x02210');
  assert.equal(top('D'), 'xx0232');
  assert.equal(top('F'), '133211');
  assert.equal(top('Bm'), 'x24432');
  assert.ok(['2x0232', '200232'].includes(top('D/F#')));
  assert.equal(top('C', 'ukulele'), '0003');
  assert.equal(top('G', 'ukulele'), '0232');
  assert.equal(top('F', 'ukulele'), '2010');
});

test('finger assignment', () => {
  const f = S.assignFingers([1, 3, 3, 2, 1, 1]);
  assert.deepEqual(f.fingers, [1, 3, 4, 2, 1, 1]);
  assert.equal(f.barres[0].fret, 1);
  assert.deepEqual(S.assignFingers([-1, 3, 2, 0, 1, 0]).fingers, [0, 3, 2, 0, 1, 0]);
  const dfs = S.assignFingers([2, -1, 0, 2, 3, 2]);
  assert.equal(dfs.fingers[0], 'T');
  assert.equal(S.isReachable([1, 6, 6, 1, 1, 1], 'guitar'), false, 'five-fret stretch is rejected');
  assert.equal(S.isReachable([0, -1, 2, -1, 1, 0], 'guitar'), false, 'two muted inner strings rejected');
});

test('piano voicing', () => {
  const v = S.pianoVoicing('G/B');
  assert.equal(v[0].name, 'B');
  assert.ok(v[0].midi < v[1].midi);
  assert.deepEqual(S.pianoVoicing('Cmaj7').map((n) => n.name), ['C', 'E', 'G', 'B']);
});
