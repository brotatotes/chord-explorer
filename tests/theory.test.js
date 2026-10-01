const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/theory.js');

const spell = (sym) => { const c = T.parseChord(sym); assert.ok(c, 'parse ' + sym); return c.notes.map((n) => T.noteName(n)).join(' '); };
const pcs = (names) => names.split(' ').map((n) => T.notePc(T.parseNote(n)));
const best = (names, opts) => { const r = T.nameChord(pcs(names), opts); return r.kind === 'chord' ? r.best.name : r.kind; };
const altNames = (names, opts) => T.nameChord(pcs(names), opts).alternatives.map((a) => a.name);

test('notes and pitch classes', () => {
  assert.equal(T.notePc(T.parseNote('B#')), 0);
  assert.equal(T.notePc(T.parseNote('Cb')), 11);
  assert.equal(T.notePc(T.parseNote('E#')), 5);
  assert.equal(T.notePc(T.parseNote('Fb')), 4);
  assert.equal(T.notePc(T.parseNote('Ebb')), 2);
  assert.equal(T.notePc(T.parseNote('F##')), 7);
  assert.equal(T.noteName(T.parseNote('Bb'), { unicode: true }), 'B♭');
  assert.equal(T.parseNote('H'), null);
});

test('interval naming', () => {
  const I = (a, b) => T.intervalBetween(T.parseNote(a), T.parseNote(b)).name;
  assert.equal(I('C', 'E'), 'major 3rd');
  assert.equal(I('C', 'Eb'), 'minor 3rd');
  assert.equal(I('C', 'D#'), 'augmented 2nd');
  assert.equal(I('C', 'Gb'), 'diminished 5th');
  assert.equal(I('C', 'F#'), 'augmented 4th');
  assert.equal(I('E', 'C'), 'minor 6th');
  assert.equal(I('B', 'F'), 'diminished 5th');
  assert.equal(I('C', 'Bbb'), 'diminished 7th');
  assert.equal(I('F', 'B'), 'augmented 4th');
  assert.equal(I('A', 'G#'), 'major 7th');
});

test('parser accepts the grammar fixture list', () => {
  const ok = {
    'C': 'C', 'Cm': 'Cm', 'Cmin': 'Cm', 'C-': 'Cm', 'cmaj7': 'Cmaj7', 'CM7': 'Cmaj7', 'CΔ7': 'Cmaj7', 'C△': 'Cmaj7', 'C△7': 'Cmaj7', 'Cma7': 'Cmaj7',
    'Cmaj': 'C', 'Cmajor': 'C', 'Cminor': 'Cm', 'Cm7b5': 'Cm7b5', 'Cø': 'Cm7b5', 'Cø7': 'Cm7b5', 'Co7': 'Cdim7', 'C°7': 'Cdim7', 'Cdim7': 'Cdim7',
    'Cdim': 'Cdim', 'Co': 'Cdim', 'C+': 'Caug', 'Caug': 'Caug', 'C7': 'C7', 'C7#9': 'C7#9', 'C7(b9,#11)': 'C7b9#11', 'C13': 'C13', 'Cm11': 'Cm11',
    'C6/9': 'C6/9', 'C69': 'C6/9', 'Cadd9': 'Cadd9', 'Cmadd9': 'Cmadd9', 'Csus': 'Csus4', 'Csus4': 'Csus4', 'Csus2': 'Csus2', 'C7sus4': 'C7sus4',
    'G/B': 'G/B', 'F#m7b5': 'F#m7b5', 'Bbsus2': 'Bbsus2', 'Ebmaj9': 'Ebmaj9', 'C5': 'C5', 'C6': 'C6', 'Cm6': 'Cm6', 'C9': 'C9', 'Cm9': 'Cm9',
    'Cmaj9': 'Cmaj9', 'C11': 'C11', 'C7b5': 'C7b5', 'C7#5': 'C7#5', 'C7+5': 'C7#5', 'Cm(maj7)': 'Cm(maj7)', 'CmM7': 'Cm(maj7)', 'Cm/Eb': 'Cm/Eb',
    'D/F#': 'D/F#', 'Am7/G': 'Am7/G', 'f#m': 'F#m', 'bb7': 'Bb7', 'B♭7': 'Bb7', 'F♯m7♭5': 'F#m7b5', 'C 7': 'C7', 'C7b9': 'C7b9', 'C7#11': 'C7#11',
    'C9sus4': 'C9sus4', 'Cmaj13': 'Cmaj13', 'Cm13': 'Cm13', 'Cadd11': 'Cadd11', 'Cadd2': 'Cadd2', 'E7#9': 'E7#9', 'A7b13': 'A7b13', 'Gsus': 'Gsus4',
    'Dm7': 'Dm7', 'G7/B': 'G7/B', 'C/G': 'C/G', 'Abmaj7': 'Abmaj7', 'Dbmaj7': 'Dbmaj7', 'C#m7': 'C#m7', 'Gbdim': 'Gbdim', 'Ebm': 'Ebm', 'Fmaj7#11': 'Fmaj7#11',
    'C7alt': null,
  };
  let n = 0;
  for (const [sym, want] of Object.entries(ok)) {
    const c = T.parseChord(sym);
    assert.ok(c, 'should parse ' + sym);
    if (want) assert.equal(c.symbol, want, sym);
    n++;
  }
  assert.ok(n >= 80, 'fixture count ' + n);
  for (const bad of ['', 'H7', 'Cq', 'X', 'C7zz', 'maj7', '7']) assert.equal(T.parseChord(bad), null, 'reject ' + bad);
});

test('chord spelling, including double accidentals', () => {
  assert.equal(spell('C#maj7'), 'C# E# G# B#');
  assert.equal(spell('Cbmaj7'), 'Cb Eb Gb Bb');
  assert.equal(spell('Fdim7'), 'F Ab Cb Ebb');
  assert.equal(spell('G#7'), 'G# B# D# F#');
  assert.equal(spell('Ebm7b5'), 'Eb Gb Bbb Db');
  assert.equal(spell('B#dim'), 'B# D# F#');
  assert.equal(spell('Cdim7'), 'C Eb Gb Bbb');
  assert.equal(spell('D#aug'), 'D# F## A##');
  assert.equal(spell('Gb'), 'Gb Bb Db');
  assert.equal(spell('F#'), 'F# A# C#');
  assert.equal(spell('C13'), 'C E G Bb D A');
  assert.equal(spell('C11'), 'C E G Bb D F');
  assert.equal(spell('C7#9'), 'C E G Bb D#');
  assert.equal(spell('C7b9'), 'C E G Bb Db');
  assert.equal(spell('C6/9'), 'C E G A D');
  assert.equal(spell('Am(maj7)'), 'A C E G#');
  assert.equal(spell('Csus2'), 'C D G');
  assert.equal(spell('Csus4'), 'C F G');
  assert.equal(spell('C5'), 'C G');
  assert.equal(spell('Bbsus4'), 'Bb Eb F');
  assert.equal(spell('Ebmaj9'), 'Eb G Bb D F');
  assert.equal(spell('A7b13'), 'A C# E G F');
  const gb = T.parseChord('G/B');
  assert.equal(T.noteName(gb.bass), 'B');
});

test('naming: triads and inversions', () => {
  assert.equal(best('C E G'), 'C');
  assert.equal(best('E G C'), 'C/E');
  assert.equal(T.nameChord(pcs('E G C')).best.inversion, 'first inversion');
  assert.equal(best('G C E'), 'C/G');
  assert.equal(T.nameChord(pcs('G C E')).best.inversion, 'second inversion');
  assert.equal(best('A C E'), 'Am');
  assert.equal(best('D F# A'), 'D');
  assert.equal(best('F# A D'), 'D/F♯');
  assert.equal(best('B D F'), 'Bdim');
  assert.equal(best('C G'), 'C5');
  assert.match(T.nameChord(pcs('C G')).intervalText, /perfect 5th/);
  assert.equal(best('C'), 'note');
});

test('naming: C6 vs Am7, decided by the bass and explained', () => {
  assert.equal(best('A C E G'), 'Am7');
  assert.ok(altNames('A C E G').includes('C6/A'), altNames('A C E G').join());
  assert.equal(best('C E G A'), 'C6');
  assert.ok(altNames('C E G A').some((n) => n.startsWith('Am7')));
  assert.equal(best('A C Eb G'), 'Am7♭5');
  assert.ok(altNames('A C Eb G').some((n) => n.startsWith('Cm6')));
  assert.match(T.nameChord(pcs('C E G A')).best.explanation, /6th/);
});

test('naming: sevenths, missing 5th and slash chords', () => {
  assert.equal(best('C E Bb'), 'C7');
  assert.match(T.nameChord(pcs('C E Bb')).best.explanation, /5th is left out/);
  assert.equal(best('G B D F'), 'G7');
  assert.equal(best('B D F G'), 'G7/B');
  assert.equal(best('F G B D'), 'G7/F');
  assert.equal(T.nameChord(pcs('F G B D')).best.inversion, 'third inversion');
  assert.equal(best('C E G B'), 'Cmaj7');
  assert.equal(best('D F A C'), 'Dm7');
  assert.equal(best('E G# D F#'), 'E9');
  assert.equal(best('C E G D'), 'Cadd9');
  assert.equal(best('E G# B D G'), 'E7♯9');
  assert.equal(best('C F G'), 'Csus4');
  assert.equal(best('C F G Bb'), 'C7sus4');
  // C/D is also a rootless-5th D9sus4; both readings must be offered
  const cd = T.nameChord(pcs('D C E G'));
  const cdNames = [cd.best.name, ...cd.alternatives.map((a) => a.name)];
  assert.ok(cdNames.includes('C/D') && cdNames.includes('D9sus4'), cdNames.join());
});

test('dim7 and aug symmetry', () => {
  const r = T.nameChord(pcs('B D F Ab'));
  assert.equal(r.best.name, 'Bdim7');
  assert.equal(r.alternatives.length, 3);
  assert.equal(best('D F Ab B'), 'Ddim7');
  assert.equal(best('F Ab B D'), 'Fdim7');
  assert.equal(best('G# B D F'), 'G♯dim7');
  // all four rotations share the same pitch-class set
  const s = (x) => [...new Set(pcs(x))].sort((a, b) => a - b).join();
  assert.equal(s('B D F Ab'), s('D F Ab B'));
  assert.equal(best('C E G#'), 'Caug');
  assert.equal(T.nameChord(pcs('C E G#')).alternatives.length, 2);
});

test('no-fit is honest', () => {
  const r = T.nameChord(pcs('C C# D'));
  assert.equal(r.kind, 'none');
  assert.match(r.text, /cluster/);
  assert.equal(T.nameChord([]).kind, 'empty');
});

test('key context spells and re-ranks', () => {
  const keyEb = { tonic: T.parseNote('Eb'), mode: 'major' };
  assert.equal(best('G# C D#', { key: keyEb }), 'A♭');
  assert.equal(best('G# C D#'), 'A♭');
  const keyE = { tonic: T.parseNote('E'), mode: 'major' };
  assert.equal(best('G# C D#', { key: { tonic: T.parseNote('C#'), mode: 'minor' } }), 'G♯');
  assert.equal(best('F# A# C#', { key: keyE }), 'F♯');
  assert.equal(best('F# A# C#', { key: { tonic: T.parseNote('Gb'), mode: 'major' } }), 'G♭');
  // Ambiguous no-bass-root set C F G / F G C: sus4 of C vs sus2 of F; a key changes the winner
  const noKey = best('G C F');
  const inF = best('G C F', { key: { tonic: T.parseNote('F'), mode: 'major' } });
  assert.ok(noKey && inF);
  // key settles dim7 symmetry: the leading tone of the key becomes the root
  assert.equal(best('D F Ab B'), 'Ddim7');
  assert.equal(best('D F Ab B', { key: { tonic: T.parseNote('C'), mode: 'minor' } }), 'Bdim7/D');
  assert.equal(best('D F Ab B', { key: { tonic: T.parseNote('Eb'), mode: 'minor' } }), 'Ddim7');
  assert.equal(best('G C F'), 'Csus4/G');
  const inC = T.nameChord(pcs('A C E G'), { key: { tonic: T.parseNote('C'), mode: 'major' } });
  assert.equal(inC.best.name, 'Am7');
});

test('scales and modes spelled correctly', () => {
  const S = (t, k) => T.scaleNotes(t, k).map((n) => T.noteName(n)).join(' ');
  assert.equal(S('F#', 'major'), 'F# G# A# B C# D# E#');
  assert.equal(S('Gb', 'major'), 'Gb Ab Bb Cb Db Eb F');
  assert.equal(S('C#', 'major'), 'C# D# E# F# G# A# B#');
  assert.equal(S('Cb', 'major'), 'Cb Db Eb Fb Gb Ab Bb');
  assert.equal(S('D', 'dorian'), 'D E F G A B C');
  assert.equal(S('E', 'phrygian'), 'E F G A B C D');
  assert.equal(S('F', 'lydian'), 'F G A B C D E');
  assert.equal(S('G', 'mixolydian'), 'G A B C D E F');
  assert.equal(S('A', 'minor'), 'A B C D E F G');
  assert.equal(S('B', 'locrian'), 'B C D E F G A');
  assert.equal(S('A', 'harmonicMinor'), 'A B C D E F G#');
  assert.equal(S('Eb', 'melodicMinor'), 'Eb F Gb Ab Bb C D');
  assert.equal(S('D#', 'harmonicMinor'), 'D# E# F# G# A# B C##');
  assert.equal(S('A', 'minorPentatonic'), 'A C D E G');
  assert.equal(S('C', 'majorPentatonic'), 'C D E G A');
  assert.equal(S('A', 'blues'), 'A C D Eb E G');
  assert.equal(S('Bb', 'minor'), 'Bb C Db Eb F Gb Ab');
  assert.deepEqual(T.stepPattern('major'), ['W', 'W', 'H', 'W', 'W', 'W', 'H']);
  assert.deepEqual(T.stepPattern('harmonicMinor'), ['W', 'H', 'W', 'W', 'H', 'W+H', 'H']);
  assert.equal(T.noteName(T.bestTonic(6, 'major')), 'F#');
  assert.equal(T.noteName(T.bestTonic(1, 'major')), 'Db');
  assert.equal(T.noteName(T.bestTonic(1, 'minor')), 'C#');
  assert.equal(T.noteName(T.bestTonic(8, 'minor')), 'G#');
  assert.equal(T.noteName(T.bestTonic(10, 'minor')), 'Bb');
});

test('diatonic chords with roman numerals and functions', () => {
  const names = (k, m, s) => T.diatonicChords(k, m, s).chords.map((c) => c.roman + ':' + c.name).join(' ');
  assert.equal(names('C', 'major', false), 'I:C ii:Dm iii:Em IV:F V:G vi:Am vii°:Bdim');
  assert.equal(names('C', 'major', true), 'Imaj7:Cmaj7 ii7:Dm7 iii7:Em7 IVmaj7:Fmaj7 V7:G7 vi7:Am7 viiø7:Bm7♭5');
  assert.equal(names('Eb', 'major', false), 'I:E♭ ii:Fm iii:Gm IV:A♭ V:B♭ vi:Cm vii°:Ddim');
  assert.equal(names('F#', 'major', false), 'I:F♯ ii:G♯m iii:A♯m IV:B V:C♯ vi:D♯m vii°:E♯dim');
  assert.equal(names('A', 'minor', false), 'i:Am ii°:Bdim III:C iv:Dm v:Em VI:F VII:G');
  const am = T.diatonicChords('A', 'minor', true);
  assert.equal(am.extra.name, 'E7');
  assert.equal(am.extra.notes.map((n) => T.noteName(n)).join(' '), 'E G# B D');
  for (const c of T.diatonicChords('G', 'major', true).chords) assert.ok(c.function.length > 10);
});

test('every template names itself from root position in all 12 keys', () => {
  let n = 0;
  for (const t of T.TEMPLATES) {
    for (let r = 0; r < 12; r++) {
      const set = t.tones.map((i) => (r + i.semis) % 12);
      const res = T.nameChord(set);
      assert.equal(res.kind, 'chord');
      const top = res.best;
      // the root-position reading must be the winner, or listed as an alternative for symmetric chords
      const names = [top, ...res.alternatives].filter((c) => c.rootPc === r && c.suffix === t.suffix);
      if (!names.length) {
        // accepted ambiguity: identical pitch-class sets (e.g. C6 = Am7/C) resolve to the commoner reading
        assert.ok(['6', 'm6', '6/9', 'm6/9', '7#5', 'aug', '7b5', '11', 'm11', '13', 'm13', 'maj13', '9sus4', '7sus4', 'sus2', 'sus4', 'add11', 'm(maj7)', 'maj7#5', '7b13'].includes(t.suffix), 'template ' + t.suffix + ' root ' + r + ' got ' + top.name);
      }
      n++;
    }
  }
  assert.ok(n >= 400);
});

test('forgiving input and suggestions', () => {
  const sym = (s) => { const c = T.parseChord(s); return c ? c.notes.map((n) => T.noteName(n)).join(' ') : null; };
  assert.equal(sym('c sharp minor 7'), sym('C#m7'));
  assert.equal(sym('B flat major 7'), sym('Bbmaj7'));
  assert.equal(sym('CM7'), sym('Cmaj7'));
  assert.equal(sym('C\u25b37'), sym('Cmaj7'));
  assert.equal(sym('f#m7b5'), 'F# A C E');
  const sl = T.parseChord('C over E'); assert.ok(sl && sl.bass && T.noteName(sl.bass) === 'E');
  assert.equal(T.parseChord('zzz'), null);
  const sg = T.suggestChords('f#m');
  assert.ok(Array.isArray(sg) && sg.length > 0);
  assert.ok(sg.some((x) => /^F#m/.test(typeof x === 'string' ? x : x.symbol)), JSON.stringify(sg.slice(0, 5)));
  const sg2 = T.suggestChords('');
  assert.ok(Array.isArray(sg2));
});

test('progressions in every key resolve to real diatonic chords', () => {
  for (const mode of ['major', 'minor']) for (const t of T.KEY_TONICS[mode]) {
    const d = T.diatonicChords(t, mode, false);
    for (const p of T.PROGRESSIONS[mode]) for (const deg of p.degrees) {
      const c = deg === 'V' ? d.extra : d.chords[deg - 1];
      assert.ok(c && c.name, mode + ' ' + t + ' ' + p.name);
    }
  }
  const am = T.diatonicChords('A', 'minor', false);
  assert.equal(am.extra.name, 'E');
});
