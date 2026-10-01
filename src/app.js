/* Chord Explorer UI. Needs Theory and Shapes globals. */
(function () {
  'use strict';
  const T = window.Theory; const S = window.Shapes;
  const mod = (n, m) => ((n % m) + m) % m;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const NS = 'http://www.w3.org/2000/svg';
  const PC_SHARP = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  const state = {
    mode: 'chord', symbol: 'C', g: 0, u: 0, labels: 'fingers', phoneTab: 'guitar',
    // name-it positions; -1 muted
    gFrets: [-1, 3, 2, 0, 1, 0], uFrets: [0, 0, 0, 3], piano: [], source: 'guitar', key: null,
    query: null, scaleTonic: 'C', scaleType: 'major', keyTonic: 'C', keyMode: 'major', sev: false, kc: 0, prog: null,
  };
  const shapeCache = new Map();
  function shapesFor(sym, inst, n) {
    const k = sym + '|' + inst; let v = shapeCache.get(k);
    if (!v) { v = S.findShapes(sym, inst, 12); shapeCache.set(k, v); }
    return n ? v.slice(0, n) : v;
  }
  const TONIC_CHOICES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'];
  const SCALE_GROUPS = [['Everyday', ['major', 'minor', 'majorPentatonic', 'minorPentatonic', 'blues']], ['Modes', ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian']], ['Minor colours', ['harmonicMinor', 'melodicMinor']]];
  const pn = (s) => s.replace(/#/g, '♯').replace(/b/g, '♭');
  function keyObj(str) { if (!str) return null; const m = /^([A-G](?:#|b)?)(m?)$/.exec(str); if (!m) return null; return { tonic: T.parseNote(m[1]), mode: m[2] ? 'minor' : 'major' }; }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function roleClass(token) {
    if (!token) return 'r-x';
    const n = token.replace(/[b#]/g, '');
    if (n === '1') return 'r-1';
    if (n === '3' || n === '2' || n === '4') return 'r-3';
    if (n === '5') return 'r-5';
    if (n === '7' || n === '6') return 'r-7';
    return 'r-x';
  }
  function effLabels() { return state.labels === 'fingers' && (state.mode === 'name' || state.mode === 'scale') ? 'notes' : state.labels; }
  function short(token) { return token ? token.replace('b', '♭').replace('#', '♯').replace(/^1$/, 'R') : ''; }
  const isPhone = () => window.matchMedia('(max-width: 899px)').matches && window.matchMedia('(orientation: portrait)').matches;

  // ---------- derived data for the current view ----------
  function progText(cs) {
    const names = cs.map((c) => c.name);
    if (names.length <= 6) return names.join(' – ');
    const bars = []; for (let i = 0; i < names.length; i += 4) bars.push(names.slice(i, i + 4).join(' '));
    return bars.join(' | ');
  }
  function keyView() {
    const d = T.diatonicChords(state.keyTonic, state.keyMode, state.sev);
    const cards = d.chords.slice(); if (d.extra) cards.push(d.extra);
    state.kc = Math.min(Math.max(0, state.kc), cards.length - 1);
    const sel = cards[state.kc];
    return Object.assign(chordView(sel.symbol), { d, cards, sel });
  }
  function progChords(d, prog) {
    return prog.degrees.map((deg) => {
      if (deg === 'V') return d.extra;
      const c = d.chords[deg - 1];
      if (prog.dominant) { const sym = T.noteName(c.root) + '7'; return Object.assign({}, c, { symbol: sym, name: T.noteName(c.root, { unicode: true }) + '7', roman: c.roman.toUpperCase() + '7' }); }
      if (prog.sevenths && !state.sev) { const d7 = T.diatonicChords(state.keyTonic, state.keyMode, true); return d7.chords[deg - 1]; }
      return c;
    });
  }
  function scaleView() {
    const notes = T.scaleNotes(state.scaleTonic, state.scaleType) || T.scaleNotes('C', 'major');
    const sc = T.SCALES[state.scaleType] || T.SCALES.major;
    const byPc = new Map(); notes.forEach((n, i) => byPc.set(T.notePc(n), { note: n, token: sc.intervals[i].token }));
    return { notes, sc, byPc };
  }
  function chordView(sym) {
    sym = sym || state.symbol;
    const chord = T.parseChord(sym);
    if (!chord) return { chord: null };
    const gs = shapesFor(sym, 'guitar');
    const us = shapesFor(sym, 'ukulele');
    state.g = Math.min(state.g, Math.max(0, gs.length - 1)); state.u = Math.min(state.u, Math.max(0, us.length - 1));
    return { chord, gs, us, piano: S.pianoVoicing(chord) };
  }
  function sourceMidi() {
    if (state.source === 'piano') return state.piano.slice().sort((a, b) => a - b);
    const inst = S.INSTRUMENTS[state.source];
    const fr = state.source === 'guitar' ? state.gFrets : state.uFrets;
    return fr.map((f, i) => (f < 0 ? null : inst.midi[i] + f)).filter((x) => x != null);
  }
  function nameView() {
    const midi = sourceMidi();
    const sorted = midi.slice().sort((a, b) => a - b);
    const res = sorted.length ? T.nameChord(sorted, { bass: sorted[0], key: keyObj(state.key) }) : { kind: 'empty' };
    let symbol = null;
    if (res.kind === 'chord') {
      const b = res.best; symbol = T.noteName(b.root) + b.suffix + (b.slash ? '/' + T.noteName(b.slash) : '');
    }
    return { midi: sorted, res, symbol };
  }

  // ---------- neck rendering ----------
  // marks: [{s, f, token, label, finger, ghost}] ; opts: {inst, from, to, vertical, onTap, barres, baseFret}
  const kbCursor = {};
  function drawNeck(host, instKey, marks, opts) {
    const inst = S.INSTRUMENTS[instKey]; const n = inst.strings.length;
    const from = opts.from; const to = opts.to; const vertical = opts.vertical;
    const cell = vertical ? 46 : 56; const gap = vertical ? 44 : 34; const head = vertical ? 52 : 54; const pad = vertical ? 30 : 24; const side = vertical ? 26 : 0; const foot = vertical ? 4 : 20;
    const frets = to - from + (from === 0 ? 0 : 1);
    const along = (f) => head + (from === 0 ? f : f - from + 1) * cell; // position of fret wire f
    const centerOf = (f) => (f === 0 && from === 0 ? head - 17 : along(f) - cell / 2);
    const boardEnd = head + frets * cell;
    const len = boardEnd; const wid = pad * 2 + gap * (n - 1);
    const W = vertical ? wid + side : len + 4; const H = vertical ? len + 6 : wid + foot;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, style: vertical ? `max-width:${W * 1.25}px` : '', class: 'neck ' + (vertical ? 'vert' : 'horiz'), role: 'group', 'aria-label': inst.name + ' neck' });
    // string index i: 0 = lowest. Horizontal: high string on top. Vertical: low string on the left.
    const sPos = (i) => pad + gap * (vertical ? i : n - 1 - i);
    const P = (a, c) => (vertical ? { x: c, y: a } : { x: a, y: c });
    const board0 = P(head, pad - 19); const boardLen = frets * cell; const boardWid = gap * (n - 1) + 38;
    el('rect', Object.assign({ class: 'board', rx: 3 }, vertical ? { x: board0.x, y: board0.y, width: boardWid, height: boardLen } : { x: board0.x, y: board0.y, width: boardLen, height: boardWid }), svg);
    const inlays = [3, 5, 7, 9, 15];
    const clash = (f, y) => marks.some((m) => !m.muted && m.f === f && Math.abs(sPos(m.s) - y) < 20);
    for (let f = Math.max(from, 1); f <= to; f++) {
      const c = centerOf(f); const mid = pad + gap * (n - 1) / 2;
      if (inlays.includes(f) && !clash(f, mid)) { const p = P(c, mid); el('circle', { cx: p.x, cy: p.y, r: 4.5, class: 'inlay' }, svg); }
      if (f === 12) { for (const o of [-gap, gap]) { if (clash(f, mid + o)) continue; const p = P(c, mid + o); el('circle', { cx: p.x, cy: p.y, r: 5, class: 'inlay' }, svg); } }
      if (!vertical) { const t = el('text', { x: c, y: H - 4, class: 'fretno' + (inlays.includes(f) || f === 12 ? ' strong' : ''), 'text-anchor': 'middle' }, svg); t.textContent = f; }
    }
    for (let f = from === 0 ? 0 : from - 1; f <= to; f++) {
      const a = f === from - 1 ? head : along(f);
      const p1 = P(a, pad - 19); const p2 = P(a, pad + gap * (n - 1) + 19);
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: f === 0 ? 'nut' : 'fret' }, svg);
    }
        if (vertical) for (let f = Math.max(from, 1); f <= to; f++) { const t = el('text', { x: wid + 4, y: centerOf(f) + 5, class: 'fretno' + (f === from && from > 1 ? ' strong' : '') }, svg); t.textContent = f; }
    for (let i = 0; i < n; i++) {
      const p1 = P(head, sPos(i)); const p2 = P(boardEnd, sPos(i));
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'string', 'stroke-width': instKey === 'guitar' ? 2.4 - i * 0.3 : 1.6 }, svg);
      const t = el('text', { x: vertical ? sPos(i) : 3, y: vertical ? 12 : sPos(i) + 5, class: 'strname', 'text-anchor': vertical ? 'middle' : 'start' }, svg);
      t.textContent = instKey === 'guitar' && i === n - 1 ? 'e' : inst.strings[i];
    }
    const barreLater = [];
    for (const b of opts.barres || []) {
      const c = centerOf(b.fret); const a = P(c, sPos(b.from)); const z = P(c, sPos(b.to));
      const t = 14; const lo = Math.min(sPos(b.from), sPos(b.to)) - 12; const hi = Math.max(sPos(b.from), sPos(b.to)) + 12;
      el('rect', Object.assign({ class: 'barre', rx: t }, vertical ? { x: lo, y: c - t, width: hi - lo, height: 2 * t } : { x: c - t, y: lo, width: 2 * t, height: hi - lo }), svg);
      barreLater.push([a, z]);
    }
    // tap targets
    if (opts.onTap) {
      for (let i = 0; i < n; i++) for (let f = from === 0 ? 0 : from; f <= to; f++) {
        const c = f === 0 ? head - 17 : centerOf(f); const p = P(c, sPos(i));
        const w = vertical ? gap : (f === 0 ? 28 : cell); const h = vertical ? (f === 0 ? 30 : cell) : gap;
        const r = el('rect', { x: p.x - w / 2, y: p.y - h / 2, width: w, height: h, class: 'hit', 'data-s': i, 'data-f': f, tabindex: -1 }, svg);
        r.addEventListener('pointerdown', (e) => { e.preventDefault(); opts.onTap(i, f); });
      }
      // keyboard: the neck is one focusable grid with a roving cursor
      const f0 = from === 0 ? 0 : from; const cur = kbCursor[instKey] || (kbCursor[instKey] = { s: 0, f: f0 });
      cur.s = Math.max(0, Math.min(n - 1, cur.s)); cur.f = Math.max(f0, Math.min(to, cur.f));
      const ring = el('rect', { class: 'kbcur', rx: 6 }, svg);
      const place = () => { const c = cur.f === 0 ? head - 17 : centerOf(cur.f); const p = P(c, sPos(cur.s)); ring.setAttribute('x', p.x - 18); ring.setAttribute('y', p.y - 18); ring.setAttribute('width', 36); ring.setAttribute('height', 36); svg.setAttribute('aria-label', inst.name + ' neck. Arrow keys move, Enter toggles. At ' + (instKey === 'guitar' && cur.s === n - 1 ? 'high e' : inst.strings[cur.s]) + ' string, ' + (cur.f === 0 ? 'open' : 'fret ' + cur.f)); };
      place();
      svg.setAttribute('tabindex', '0'); svg.setAttribute('id', 'kb-' + instKey); svg.setAttribute('role', 'application');
      svg.addEventListener('keydown', (e) => {
        const along = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
        const across = vertical ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowUp: 1, ArrowDown: -1 };
        if (e.key in along) { cur.f = Math.max(f0, Math.min(to, cur.f + along[e.key])); place(); }
        else if (e.key in across) { cur.s = Math.max(0, Math.min(n - 1, cur.s + across[e.key])); place(); }
        else if (e.key === 'Enter' || e.key === ' ') opts.onTap(cur.s, cur.f);
        else return;
        e.preventDefault(); e.stopPropagation();
      });
    }
    for (const m of marks) {
      const c = centerOf(m.f); const p = P(c, sPos(m.s));
      if (m.muted) { const t = el('text', { x: p.x, y: p.y + 6, class: 'mute', 'text-anchor': 'middle' }, svg); t.textContent = '×'; continue; }
      if (m.f === 0 && from === 0) {
        const oc = 'open ' + (m.cls || roleClass(m.token)) + (m.ghost ? ' ghost' : '');
        if (m.token === '1') el('rect', { x: p.x - 9.5, y: p.y - 9.5, width: 19, height: 19, rx: 4, class: oc }, svg); else el('circle', { cx: p.x, cy: p.y, r: 10, class: oc }, svg);
        if (m.label) { const t = el('text', { x: p.x, y: p.y + 4.5, class: 'olabel', 'text-anchor': 'middle' }, svg); t.textContent = m.label; }
        continue;
      }
      const g = el('g', { class: 'dot ' + (m.cls || roleClass(m.token)) + (m.ghost ? ' ghost' : '') + (m.token === '1' ? ' root' : '') }, svg);
      if (m.token === '1') el('rect', { x: p.x - 14.5, y: p.y - 14.5, width: 29, height: 29, rx: 6 }, g); else el('circle', { cx: p.x, cy: p.y, r: 15 }, g);
      if (m.label) { const t = el('text', { x: p.x, y: p.y + 5.5, 'text-anchor': 'middle' }, g); t.textContent = m.label; }
    }
    host.appendChild(svg);
  }

  function drawPiano(host, marks, opts) {
    const lo = opts.lo; const hi = opts.hi;
    const whites = []; for (let m = lo; m <= hi; m++) if (![1, 3, 6, 8, 10].includes(mod(m, 12))) whites.push(m);
    const ww = 38; const wh = 150; const bw = 24; const bh = 94;
    const svg = el('svg', { viewBox: `0 0 ${whites.length * ww + 2} ${wh + 22}`, class: 'piano', role: 'group', 'aria-label': 'Piano keyboard' });
    const byMidi = new Map(marks.map((m) => [m.midi, m]));
    const xOf = new Map();
    whites.forEach((m, i) => xOf.set(m, 1 + i * ww));
    const keyEl = (m, black) => {
      const x = black ? xOf.get(m - 1) + ww - bw / 2 : xOf.get(m);
      const g = el('g', { class: 'key ' + (black ? 'black' : 'white'), 'data-midi': m }, svg);
      el('rect', { x, y: 1, width: black ? bw : ww, height: black ? bh : wh, rx: 3 }, g);
      const mk = byMidi.get(m);
      if (mk) {
        const cx = x + (black ? bw : ww) / 2; const cy = black ? bh - 16 : wh - 20;
        const d = el('g', { class: 'dot ' + (mk.cls || roleClass(mk.token)) + (mk.ghost ? ' ghost' : '') + (mk.token === '1' ? ' root' : '') }, g);
        const r = black ? 10.5 : 14;
        if (mk.token === '1') el('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 5 }, d); else el('circle', { cx, cy, r }, d);
        if (mk.label) { const t = el('text', { x: cx, y: cy + (black ? 4 : 5), 'text-anchor': 'middle', class: black ? 'small' : '' }, d); t.textContent = mk.label; }
      }
      if (!black && mod(m, 12) === 0) { const t = el('text', { x: x + ww / 2, y: wh + 17, class: 'cname', 'text-anchor': 'middle' }, g); t.textContent = 'C' + (Math.floor(m / 12) - 1); }
      if (opts.onTap) g.addEventListener('pointerdown', (e) => { e.preventDefault(); opts.onTap(m); });
    };
    whites.forEach((m) => keyEl(m, false));
    for (let m = lo; m <= hi; m++) if ([1, 3, 6, 8, 10].includes(mod(m, 12)) && xOf.has(m - 1)) keyEl(m, true);
    if (opts.onTap) {
      const cur = kbCursor.piano || (kbCursor.piano = { m: Math.max(lo, Math.min(hi, 60)) }); cur.m = Math.max(lo, Math.min(hi, cur.m));
      const ring = el('rect', { class: 'kbcur', rx: 4 }, svg);
      const place = () => { const black = !xOf.has(cur.m); const x = black ? xOf.get(cur.m - 1) + ww - bw / 2 : xOf.get(cur.m); ring.setAttribute('x', x + 2); ring.setAttribute('y', 5); ring.setAttribute('width', (black ? bw : ww) - 4); ring.setAttribute('height', (black ? bh : wh) - 8); svg.setAttribute('aria-label', 'Piano keyboard. Arrow keys move, Enter toggles. At ' + T.noteName(T.spellChordRoot(mod(cur.m, 12), ['1'], null)) + (Math.floor(cur.m / 12) - 1)); };
      place();
      svg.setAttribute('tabindex', '0'); svg.setAttribute('id', 'kb-piano'); svg.setAttribute('role', 'application');
      svg.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 12, ArrowDown: -12 }[e.key];
        if (d) { cur.m = Math.max(lo, Math.min(hi, cur.m + d)); place(); }
        else if (e.key === 'Enter' || e.key === ' ') opts.onTap(cur.m);
        else return;
        e.preventDefault(); e.stopPropagation();
      });
    }
    host.appendChild(svg);
  }

  // ---------- label helpers ----------
  function labelFor(token, noteName, finger) {
    const l = effLabels();
    if (l === 'notes') return noteName || '';
    if (l === 'degrees') return short(token);
    return finger ? String(finger) : (noteName || '');
  }
  function shapeMarks(shape) {
    const marks = [];
    shape.frets.forEach((f, i) => {
      if (f < 0) marks.push({ s: i, f: 0, muted: true });
      else marks.push({ s: i, f, token: shape.tokens[i], label: f === 0 ? (effLabels() === 'fingers' ? '' : labelFor(shape.tokens[i], prettyNote(shape.notes[i]))) : labelFor(shape.tokens[i], prettyNote(shape.notes[i]), shape.fingers[i]) });
    });
    return marks;
  }
  function prettyNote(n) { return n ? n.replace(/#/g, '♯').replace(/b/g, '♭') : ''; }
  function windowFor(shape, instKey) {
    const fretted = shape.frets.filter((f) => f > 0);
    if (!fretted.length || Math.max(...fretted) <= 5) return { from: 0, to: 5 };
    const lo = Math.min(...fretted); return { from: lo, to: Math.max(lo + 4, Math.max(...fretted)) };
  }

  // ---------- rendering ----------
  let rendering = false;
  function render() {
    const app = $('#app');
    const view = state.mode === 'name' ? nameView() : state.mode === 'scale' ? scaleView() : state.mode === 'key' ? keyView() : chordView();
    const focus = document.activeElement && document.activeElement.id; const selStart = focus === 'q' ? document.activeElement.selectionStart : null;
    const phone = isPhone();
    rendering = true; app.innerHTML = ''; rendering = false;
    app.insertAdjacentHTML('beforeend', `
      <header class="top"><h1>Chord Explorer</h1>
        <nav class="modes" aria-label="Mode">${[['chord', 'Chord'], ['name', 'Name it'], ['scale', 'Scale'], ['key', 'Key']].map(([k, l]) => `<button data-mode="${k}" aria-pressed="${state.mode === k}">${l}</button>`).join('')}</nav>
        <div class="tools">${window.CEAudio ? window.CEAudio.controlsHTML() : ''}<button id="theme" aria-label="Switch light or dark">◑</button></div>
      </header>
      <main class="layout mode-${state.mode}"><section class="panel" id="panel"></section><section class="insts" id="insts"></section><section class="below" id="below"></section></main>`);
    const panel = $('#panel'); const insts = $('#insts');
    renderPanel(panel, view);
    const labelKinds = state.mode === 'chord' || state.mode === 'key' ? ['fingers', 'notes', 'degrees'] : ['notes', 'degrees'];
    const eff = effLabels();
    const labelBar = `<div class="labelbar" role="radiogroup" aria-label="Dot labels">${labelKinds.map((k) => `<button data-labels="${k}" aria-pressed="${eff === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`;
    if (phone) insts.insertAdjacentHTML('beforeend', `<div class="tabs" role="tablist">${['guitar', 'ukulele', 'piano'].map((k) => `<button role="tab" data-tab="${k}" aria-selected="${state.phoneTab === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>`);
    if (state.mode !== 'key' || !phone) panel.insertAdjacentHTML('beforeend', labelBar);
    for (const k of ['guitar', 'ukulele', 'piano']) {
      if (phone && state.phoneTab !== k) continue;
      const card = document.createElement('div'); card.className = 'inst'; card.id = 'inst-' + k;
      card.innerHTML = `<div class="ihead"><h2>${k[0].toUpperCase() + k.slice(1)}</h2><span class="isub"></span></div><div class="iview"></div>`;
      insts.appendChild(card);
      renderInstrument(k, card, view, phone);
    }
    wire(app);
    if (focus) { const f = document.getElementById(focus); if (f) { f.focus({ preventScroll: true }); if (selStart != null && f.setSelectionRange) f.setSelectionRange(selStart, selStart); } }
  }

  function renderInstrument(k, card, view, phone) {
    const host = $('.iview', card); const sub = $('.isub', card);
    if (state.mode === 'name') {
      const best = view.symbol; const src = state.source === k;
      if (k === 'piano') {
        const marks = src ? view.midi.map((m) => tokMark(view, m, { midi: m })) : (best ? S.pianoVoicing(best).map((v) => ({ midi: v.midi, token: v.token, label: labelFor(v.token, prettyNote(v.name)) })) : pcGhosts(view, 48, 76));
        sub.textContent = src ? 'Tap keys to add or remove notes' : (best ? 'Same chord on piano' : 'Notes you picked');
        const lo = Math.min(48, ...marks.map((x) => x.midi - mod(x.midi, 12))); drawPiano(host, marks, { lo, hi: Math.max(lo + (phone ? 24 : 28), ...marks.map((x) => x.midi)), onTap: (m) => tapPiano(m) });
        return;
      }
      const inst = S.INSTRUMENTS[k]; const to = 12;
      let marks; let barres = [];
      if (src) {
        const fr = k === 'guitar' ? state.gFrets : state.uFrets;
        marks = fr.map((f, i) => (f < 0 ? { s: i, f: 0, muted: true } : tokMark(view, inst.midi[i] + f, { s: i, f })));
        sub.textContent = 'Tap a fret to place a note. Tap the open space left of the nut to switch open or muted.';
      } else if (best) {
        const shapes = S.findShapes(best, k, 1);
        if (shapes[0]) { marks = shapeMarks(shapes[0]); barres = shapes[0].barres; sub.textContent = 'Same chord on ' + k + '. Tap to edit here instead.'; } else { marks = []; sub.textContent = 'No easy ' + k + ' shape for this chord.'; }
      } else { marks = []; sub.textContent = 'Tap to start naming here'; }
      drawNeck(host, k, marks, { from: 0, to, vertical: phone, barres, onTap: (s, f) => tapString(k, s, f) });
      return;
    }
    if (state.mode === 'scale') {
      const mk = (midi, base) => { const hit = view.byPc.get(mod(midi, 12)); if (!hit) return null; return Object.assign({ token: hit.token, cls: hit.token === '1' ? 'r-1' : 'r-s', label: effLabels() === 'degrees' ? short(hit.token) : T.noteName(hit.note, { unicode: true }) }, base); };
      if (k === 'piano') {
        const lo = 48; const hi = phone ? 72 : 76; const marks = [];
        for (let m = lo; m <= hi; m++) { const x = mk(m, { midi: m }); if (x) marks.push(x); }
        sub.textContent = 'Two octaves from C3';
        drawPiano(host, marks, { lo, hi, onTap: (m) => window.CEAudio && window.CEAudio.note(m, 'piano') });
        return;
      }
      const inst = S.INSTRUMENTS[k]; const marks = [];
      inst.midi.forEach((open, i) => { for (let f = 0; f <= 12; f++) { const x = mk(open + f, { s: i, f }); if (x) marks.push(x); } });
      sub.textContent = 'Every scale note, frets 0 to 12. Square marks the home note.';
      drawNeck(host, k, marks, { from: 0, to: 12, vertical: phone, onTap: (s, f) => window.CEAudio && window.CEAudio.note(inst.midi[s] + f, k) });
      return;
    }
    // chord and key mode
    if (!view.chord) { host.textContent = ''; return; }
    if (k === 'piano') {
      sub.innerHTML = 'Close voicing' + (view.chord.bass ? ' with the bass note below' : '') + ' <button class="hear" data-hear="piano" aria-label="Hear this piano voicing">▶ Hear</button>';
      const pm = view.piano.map((v) => ({ midi: v.midi, token: v.token === 'bass' ? null : v.token, label: labelFor(v.token, prettyNote(v.name)) })); const plo = Math.min(...pm.map((x) => x.midi - mod(x.midi, 12)));
      drawPiano(host, pm, { lo: plo, hi: Math.max(plo + (phone ? 23 : 28), ...pm.map((x) => x.midi)) });
      return;
    }
    const list = k === 'guitar' ? view.gs : view.us; const idx = k === 'guitar' ? state.g : state.u;
    const shape = list[idx];
    if (!shape) { sub.textContent = 'No playable shape found'; return; }
    sub.innerHTML = `<button class="nav" data-step="${k}:-1" aria-label="Previous ${k} shape" ${idx === 0 ? 'disabled' : ''}>‹</button> Shape ${idx + 1} of ${list.length} · ${shape.difficulty} <span class="frets" aria-label="Frets low to high ${esc(shape.frets.map((f) => (f < 0 ? 'muted' : f)).join(' '))}">${esc(shape.frets.map((f) => (f < 0 ? '×' : String(f))).join(shape.frets.some((f) => f > 9) ? '-' : ' '))}</span> <button class="nav" data-step="${k}:1" aria-label="Next ${k} shape" ${idx >= list.length - 1 ? 'disabled' : ''}>›</button> <button class="hear" data-hear="${k}" aria-label="Hear this ${k} shape">▶ Hear</button>`;
    const win = phone ? windowFor(shape, k) : { from: 0, to: Math.min(15, Math.max(12, Math.max(...shape.frets) + 2)) };
    drawNeck(host, k, shapeMarks(shape), Object.assign({ vertical: phone, barres: shape.barres }, win));
  }

  function tokMark(view, midi, base) {
    let token = null; let name = PC_SHARP[mod(midi, 12)];
    if (view.res && view.res.kind === 'chord') {
      const t = view.res.best.tones.find((x) => x.pc === mod(midi, 12));
      if (t) { token = t.token; name = T.noteName(t.note, { unicode: true }); }
      else if (view.res.best.slash) name = T.noteName(view.res.best.slash, { unicode: true });
    }
    return Object.assign({ token, label: effLabels() === 'degrees' ? (short(token) || name) : name }, base);
  }
  function pcGhosts(view, lo, hi) {
    const pcs = new Set(view.midi.map((m) => mod(m, 12))); const out = [];
    for (let m = lo; m <= hi; m++) if (pcs.has(mod(m, 12))) out.push({ midi: m, ghost: true, label: PC_SHARP[mod(m, 12)] });
    return out;
  }

  function keyPicker(id, value, withNone) {
    const opts = [];
    if (withNone) opts.push(`<option value="">No key</option>`);
    for (const mode of ['major', 'minor']) for (const t of T.KEY_TONICS[mode]) { const v = t + (mode === 'minor' ? 'm' : ''); opts.push(`<option value="${v}" ${v === value ? 'selected' : ''}>${pn(t)} ${mode}</option>`); }
    return `<select id="${id}" aria-label="Key">${opts.join('')}</select>`;
  }
  function chordDesc(c) {
    const t = T.TEMPLATE_BY_SUFFIX[c.suffix];
    const nm = T.noteName(c.root, { unicode: true }) + T.prettySuffix(c.suffix);
    let s = t ? nm + ' is ' + t.desc : '';
    if (c.bass) { const bi = c.notes.findIndex((n) => T.notePc(n) === T.notePc(c.bass)); s += ' ' + T.noteName(c.bass, { unicode: true }) + (bi > 0 ? ' (the chord\u2019s ' + T.roleOf(c.intervals[bi].token) + ') is played in the bass.' : ' is added in the bass.'); }
    return s;
  }
  function chordAnswer(c) {
    return `<p class="big"><button class="playname" data-play="chord" aria-label="Play ${esc(c.symbol)}">${esc(T.noteName(c.root, { unicode: true }) + T.prettySuffix(c.suffix) + (c.bass ? '/' + T.noteName(c.bass, { unicode: true }) : ''))}</button></p><ul class="roles">${c.notes.map((n, i) => `<li class="${roleClass(c.intervals[i].token)}"><b>${esc(T.noteName(n, { unicode: true }))}</b> ${esc(T.roleOf(c.intervals[i].token))}</li>`).join('')}</ul><p class="why">${esc(chordDesc(c))}</p>`;
  }
  function renderPanel(panel, view) {
    if (state.mode === 'name') {
      const r = view.res; let h = '';
      if (r.kind === 'empty') h = '<p class="big">—</p><p class="why">Tap notes on any instrument and the chord is named here.</p>';
      else if (r.kind === 'note') h = `<p class="big">${esc(T.noteName(r.note, { unicode: true }))}</p><p class="why">${esc(r.text)}</p>`;
      else if (r.kind === 'none') h = `<p class="big">No chord name</p><p class="why">${esc(r.text)}</p>`;
      else {
        const b = r.best;
        h = `<p class="big">${esc(b.name)}</p><ul class="roles">${b.tones.map((t) => `<li class="${roleClass(t.token)}"><b>${esc(T.noteName(t.note, { unicode: true }))}</b> ${esc(t.role)}</li>`).join('')}</ul><p class="why">${esc(b.explanation)}</p>`;
        if (r.intervalText) h += `<p class="why">${esc(r.intervalText)}</p>`;
        if (r.alternatives.length) h += `<div class="alts"><p class="altshead">Could also be read as</p>${r.alternatives.map((a) => `<p class="alt"><b>${esc(a.name)}</b> ${esc(altWhy(a, b))}</p>`).join('')}<p class="hint">Same notes, different job. Pick a key below and the name that fits the key comes first.</p></div>`;
      }
      panel.innerHTML = `<div class="answer" aria-live="polite">${h}</div><div class="row"><button id="hearname" data-play="name" aria-label="Hear the notes you picked" ${r.kind === 'empty' ? 'disabled' : ''}>▶ Hear</button><button id="clear">Clear</button></div><div class="row"><label class="inline">In the key of ${keyPicker('namekey', state.key || '', true)}</label></div>`;
      return;
    }
    if (state.mode === 'scale') {
      const v = view; const tonic = T.noteName(v.notes[0], { unicode: true });
      const scOpts = SCALE_GROUPS.map(([g, ks]) => `<optgroup label="${g}">${ks.map((k) => `<option value="${k}" ${k === state.scaleType ? 'selected' : ''}>${T.SCALES[k].name}</option>`).join('')}</optgroup>`).join('');
      panel.innerHTML = `<div class="pickers"><label class="inline">Home note <select id="stonic" aria-label="Home note">${TONIC_CHOICES.map((t) => `<option value="${t}" ${t === state.scaleTonic ? 'selected' : ''}>${pn(t)}</option>`).join('')}</select></label><label class="inline">Scale <select id="stype" aria-label="Scale">${scOpts}</select></label></div>
        <div class="answer" aria-live="polite"><p class="big">${esc(tonic + ' ' + v.sc.name.toLowerCase())}</p>
        <ul class="roles scale">${v.notes.map((n, i) => `<li class="${i === 0 ? 'r-1' : 'r-s'}"><b>${esc(T.noteName(n, { unicode: true }))}</b><span class="deg">${esc(short(v.sc.intervals[i].token))}</span></li>`).join('')}</ul>
        <p class="why">${esc(v.sc.desc)}</p><p class="steps" title="W = whole step (2 frets), H = half step (1 fret)">Steps: ${T.stepPattern(state.scaleType).join(' ')} <span class="hint">W = 2 frets, H = 1 fret</span></p></div>
        <div class="row"><button id="playscale" data-play="scale">▶ Play scale</button></div>`;
      return;
    }
    if (state.mode === 'key') {
      const v = view; const d = v.d; const kname = T.noteName(d.notes[0], { unicode: true }) + ' ' + state.keyMode;
      const card = (c, i) => `<button class="kcard${i === state.kc ? ' on' : ''}" data-kc="${i}" aria-pressed="${i === state.kc}"><span class="rn">${esc(c.roman)}</span><span class="cn">${esc(c.name)}</span></button>`;
      const progs = T.PROGRESSIONS[state.keyMode].map((p, i) => `<button class="prog" data-prog="${i}"><b>${esc(p.name)}</b> <span>${esc(progText(progChords(d, p)))}</span></button>`).join('');
      panel.innerHTML = `<div class="pickers"><label class="inline">Key ${keyPicker('kkey', state.keyTonic + (state.keyMode === 'minor' ? 'm' : ''), false)}</label><div class="seg" role="radiogroup" aria-label="Chord size"><button data-sev="0" aria-pressed="${!state.sev}">Triads</button><button data-sev="1" aria-pressed="${state.sev}">7ths</button></div></div>
        <p class="keynotes">${esc(kname)}: ${d.notes.map((n) => esc(T.noteName(n, { unicode: true }))).join(' ')}</p>
        <div class="kgrid">${v.cards.map(card).join('')}</div>
        <div class="answer" aria-live="polite"><p class="fn"><b>${esc(v.sel.roman)}</b> ${esc(v.sel.function)}</p>${v.chord ? chordAnswer(v.chord) : ''}</div>
        <div class="progs"><p class="altshead">Common progressions</p>${progs}</div>`;
      return;
    }
    const c = view.chord;
    const sugg = T.suggestChords(state.query != null ? state.query : '', 8);
    panel.innerHTML = `<label class="search"><span>Chord</span><input id="q" value="${esc(state.query != null ? state.query : state.symbol)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Chord name" aria-describedby="sugg"></label>
      <div class="chips" id="sugg" aria-label="Suggestions">${sugg.map((x) => `<button class="chip" data-sym="${esc(x)}">${esc(pn(x).replace(/♭(?=[0-9])/, '♭'))}</button>`).join('')}</div>
      <div class="answer" aria-live="polite">${c ? chordAnswer(c) : `<p class="big">?</p><p class="why">That doesn't look like a chord name yet. Try C, Am7, F♯m7♭5, G/B or "B flat minor".</p>`}</div>`;
  }
  function altWhy(a, best) {
    const root = T.noteName(a.root, { unicode: true });
    if (a.bassNonChord) return 'if you hear ' + root + ' as the root and the bass as an extra note.';
    if (a.rootPc !== best.rootPc && a.template && best.template && a.template === best.template) return 'if ' + root + ' is heard as the root. Same chord type, just a different starting note.';
    if (a.rootPc !== best.rootPc) return 'if ' + root + ' is heard as the root. ' + (a.template ? a.template.desc.replace(/^a /, 'That makes it a ').replace(/^an /, 'That makes it an ') : '');
    return a.template ? a.template.desc : '';
  }

  // ---------- interactions ----------
  function tapString(k, s, f) {
    if (state.source !== k) {
      const cur = nameView();
      if (k === 'piano') return;
      // start editing on this instrument from its displayed shape when one exists
      let fr = null;
      if (cur.symbol) { const sh = S.findShapes(cur.symbol, k, 1)[0]; if (sh) fr = sh.frets.slice(); }
      if (!fr) fr = new Array(S.INSTRUMENTS[k].strings.length).fill(-1);
      if (k === 'guitar') state.gFrets = fr; else state.uFrets = fr;
      state.source = k;
    }
    const fr = k === 'guitar' ? state.gFrets : state.uFrets;
    if (f === 0) fr[s] = fr[s] === 0 ? -1 : 0; else fr[s] = fr[s] === f ? -1 : f;
    if (fr[s] >= 0 && window.CEAudio) window.CEAudio.note(S.INSTRUMENTS[k].midi[s] + fr[s], k);
    commit();
  }
  function tapPiano(m) {
    if (state.source !== 'piano') { state.piano = sourceMidi(); state.source = 'piano'; }
    const i = state.piano.indexOf(m); if (i >= 0) state.piano.splice(i, 1); else { state.piano.push(m); if (window.CEAudio) window.CEAudio.note(m, 'piano'); }
    commit();
  }
  function commit() { writeHash(true); render(); }

  function setChord(sym, push) {
    const c = T.parseChord(sym); if (!c) return false;
    state.symbol = c.symbol; state.query = null; state.g = 0; state.u = 0; writeHash(!push); render(); return true;
  }
  function playInst(inst) {
    const A = window.CEAudio; if (!A) return; const sh = chordView(state.mode === 'key' ? keyView().sel.symbol : state.symbol); if (!sh.chord) return;
    const shape = inst === 'guitar' ? sh.gs[state.g] : inst === 'ukulele' ? sh.us[state.u] : null;
    if (inst === 'piano' || !shape) A.notes(sh.piano.map((n) => n.midi), 'piano'); else A.notes(shape.midi.filter((m) => m != null), inst);
  }
  function soundInst() { return state.phoneTab === 'ukulele' || state.phoneTab === 'piano' ? state.phoneTab : 'guitar'; }
  function play(kind, extra) {
    const A = window.CEAudio; if (!A) return;
    const inst = soundInst();
    if (kind === 'chord') {
      const sh = state.mode === 'key' || state.mode === 'chord' ? chordView(extra || (state.mode === 'key' ? keyView().sel.symbol : state.symbol)) : null;
      if (!sh || !sh.chord) return;
      const shape = inst === 'guitar' ? sh.gs[state.g] : inst === 'ukulele' ? sh.us[state.u] : null;
      const midis = inst === 'piano' || !shape ? sh.piano.map((n) => n.midi) : shape.midi.filter((m) => m != null);
      A.notes(midis, shape ? inst : 'piano');
    }
    if (kind === 'name') { const m = nameView().midi; if (m.length) A.notes(m, state.source === 'piano' ? 'piano' : state.source); }
    if (kind === 'scale') {
      const notes = scaleView().notes; const base = (inst === 'guitar' ? 48 : 60) + T.notePc(notes[0]);
      const midis = []; let last = base - 1;
      notes.forEach((n) => { let m = base - 12 + T.notePc(n); while (m <= last) m += 12; midis.push(m); last = m; });
      midis.push(base + 12); A.scale(midis, inst);
    }
  }
  let progTimer = null;
  function playProgression(i) {
    clearTimeout(progTimer);
    const d = keyView().d; const prog = T.PROGRESSIONS[state.keyMode][i]; const chords = progChords(d, prog);
    let n = 0;
    const step = () => {
      const c = chords[n]; const cards = keyView().cards;
      let idx = cards.findIndex((x) => x.symbol === c.symbol); if (idx < 0) idx = cards.findIndex((x) => x.root.letter === c.root.letter && x.root.acc === c.root.acc);
      state.kc = Math.max(0, idx); state.g = 0; state.u = 0; render(); play('chord', c.symbol);
      const btn = document.querySelector(`[data-prog="${i}"]`); if (btn) btn.classList.add('playing');
      n++; if (n < chords.length) progTimer = setTimeout(step, 1100); else { progTimer = setTimeout(() => { writeHash(true); render(); }, 1100); }
    };
    step();
  }
  function wire(app) {
    app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { if (state.mode === b.dataset.mode) return; state.mode = b.dataset.mode; state.g = 0; state.u = 0; writeHash(false); render(); }));
    app.querySelectorAll('[data-labels]').forEach((b) => b.addEventListener('click', () => { state.labels = b.dataset.labels; render(); }));
    app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.phoneTab = b.dataset.tab; render(); }));
    app.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { const [k, d] = b.dataset.step.split(':'); if (k === 'guitar') state.g += +d; else state.u += +d; writeHash(true); render(); }));
    app.querySelectorAll('[data-sym]').forEach((b) => b.addEventListener('click', () => { setChord(b.dataset.sym, true); play('chord'); }));
    app.querySelectorAll('[data-hear]').forEach((b) => b.addEventListener('click', () => playInst(b.dataset.hear)));
    app.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => play(b.dataset.play)));
    app.querySelectorAll('[data-kc]').forEach((b) => b.addEventListener('click', () => { clearTimeout(progTimer); state.kc = +b.dataset.kc; state.g = 0; state.u = 0; writeHash(true); render(); play('chord'); }));
    app.querySelectorAll('[data-sev]').forEach((b) => b.addEventListener('click', () => { state.sev = b.dataset.sev === '1'; writeHash(true); render(); }));
    app.querySelectorAll('[data-prog]').forEach((b) => b.addEventListener('click', () => playProgression(+b.dataset.prog)));
    const q = $('#q');
    if (q) {
      q.addEventListener('input', () => {
        state.query = q.value; const c = T.parseChord(q.value) || T.parseChord(T.suggestChords(q.value, 1)[0] || '');
        if (c && c.symbol !== state.symbol) { state.symbol = c.symbol; state.g = 0; state.u = 0; writeHash(true); }
        render();
      });
      q.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const first = T.suggestChords(q.value, 1)[0]; if (first) { setChord(first, true); q.blur(); play('chord'); } }
        if (e.key === 'Escape') { state.query = null; render(); }
      });
      q.addEventListener('blur', () => { if (rendering) return; if (state.query != null && T.parseChord(state.query)) { state.query = null; } });
    }
    const nk = $('#namekey'); if (nk) nk.addEventListener('change', () => { state.key = nk.value || null; writeHash(true); render(); });
    const kk = $('#kkey'); if (kk) kk.addEventListener('change', () => { const m = /^(.+?)(m?)$/.exec(kk.value); state.keyTonic = m[1]; state.keyMode = m[2] ? 'minor' : 'major'; state.kc = 0; writeHash(true); render(); });
    const st = $('#stonic'); if (st) st.addEventListener('change', () => { state.scaleTonic = st.value; writeHash(true); render(); });
    const sy = $('#stype'); if (sy) sy.addEventListener('change', () => { state.scaleType = sy.value; writeHash(true); render(); });
    const clr = $('#clear'); if (clr) clr.addEventListener('click', clearName);
    if (window.CEAudio) window.CEAudio.wire(app);
    $('#theme').addEventListener('click', () => { const d = document.documentElement; const next = (d.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark'; d.dataset.theme = next; try { localStorage.setItem('ce-theme', next); } catch (e) { /* private mode */ } });
    let x0 = null; let y0 = null; const insts = $('#insts');
    insts.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    insts.addEventListener('touchend', (e) => {
      if (x0 == null || !isPhone()) return; const dx = e.changedTouches[0].clientX - x0; const dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return; const order = ['guitar', 'ukulele', 'piano'];
      const i = order.indexOf(state.phoneTab) + (dx < 0 ? 1 : -1); if (i >= 0 && i < 3) { state.phoneTab = order[i]; render(); }
    }, { passive: true });
  }
  function clearName() { state.gFrets = [-1, -1, -1, -1, -1, -1]; state.uFrets = [-1, -1, -1, -1]; state.piano = []; commit(); }
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    if (e.key === 'Escape' && state.mode === 'name') { clearName(); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && state.mode === 'chord') {
      const v = chordView(); if (!v.chord) return; const d = e.key === 'ArrowRight' ? 1 : -1; const k = isPhone() && state.phoneTab === 'ukulele' ? 'u' : 'g';
      const n = (k === 'g' ? v.gs : v.us).length; state[k] = Math.max(0, Math.min(n - 1, state[k] + d)); writeHash(true); render();
    }
  });

  // ---------- URL state ----------
  const FRET_CH = '0123456789abcdef';
  function writeHash(replace) {
    let h;
    if (state.mode === 'name') {
      const enc = (fr) => fr.map((f) => (f < 0 ? 'x' : FRET_CH[f])).join('');
      h = '#/name/' + (state.source === 'piano' ? 'p:' + state.piano.join('.') : (state.source === 'guitar' ? 'g:' + enc(state.gFrets) : 'u:' + enc(state.uFrets))) + (state.key ? '?key=' + encodeURIComponent(state.key) : '');
    } else if (state.mode === 'scale') {
      h = '#/scale/' + encodeURIComponent(state.scaleTonic) + '/' + state.scaleType;
    } else if (state.mode === 'key') {
      const qs = []; if (state.sev) qs.push('sev=1'); if (state.kc) qs.push('c=' + (state.kc + 1));
      h = '#/key/' + encodeURIComponent(state.keyTonic) + '/' + state.keyMode + (qs.length ? '?' + qs.join('&') : '');
    } else {
      h = '#/chord/' + encodeURIComponent(state.symbol) + (state.g || state.u ? `?g=${state.g + 1}&u=${state.u + 1}` : '');
    }
    if (location.hash !== h) history[replace ? 'replaceState' : 'pushState'](null, '', h);
  }
  function readHash() {
    const m = location.hash.match(/^#\/(\w+)\/([^?]*)(?:\?(.*))?$/); if (!m) return;
    const q = new URLSearchParams(m[3] || '');
    if (m[1] === 'chord') { state.mode = 'chord'; state.query = null; const sym = decodeURIComponent(m[2]) || 'C'; const c = T.parseChord(sym); state.symbol = c ? c.symbol : sym; state.g = Math.max(0, (+q.get('g') || 1) - 1); state.u = Math.max(0, (+q.get('u') || 1) - 1); }
    if (m[1] === 'name') {
      state.mode = 'name'; const [kind, data] = m[2].split(':');
      const dec = (s, n) => { const a = s.split('').map((c) => (c === 'x' ? -1 : FRET_CH.indexOf(c))); return a.length === n && a.every((f) => f >= -1) ? a : null; };
      if (kind === 'g' && data && dec(data, 6)) { state.gFrets = dec(data, 6); state.source = 'guitar'; }
      if (kind === 'u' && data && dec(data, 4)) { state.uFrets = dec(data, 4); state.source = 'ukulele'; }
      if (kind === 'p') { state.piano = (data || '').split('.').filter(Boolean).map(Number).filter((x) => x >= 21 && x <= 108); state.source = 'piano'; }
      const k = q.get('key'); state.key = k && keyObj(k) ? k : null;
    }
    if (m[1] === 'scale') {
      const [t, ty] = m[2].split('/'); const tonic = decodeURIComponent(t || 'C');
      state.mode = 'scale'; state.scaleTonic = T.parseNote(tonic) ? tonic[0].toUpperCase() + tonic.slice(1) : 'C'; state.scaleType = T.SCALES[ty] ? (ty === 'aeolian' ? 'minor' : ty === 'ionian' ? 'major' : ty) : 'major';
    }
    if (m[1] === 'key') {
      const [t, md] = m[2].split('/'); const tonic = decodeURIComponent(t || 'C');
      state.mode = 'key'; state.keyMode = md === 'minor' ? 'minor' : 'major';
      state.keyTonic = T.KEY_TONICS[state.keyMode].includes(tonic) ? tonic : (T.parseNote(tonic) ? tonic : 'C');
      state.sev = q.get('sev') === '1'; state.kc = Math.max(0, (+q.get('c') || 1) - 1);
    }
  }

  try { const t = localStorage.getItem('ce-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  readHash();
  window.addEventListener('hashchange', () => { readHash(); render(); });
  let lastPhone = null;
  window.addEventListener('resize', () => { const p = isPhone(); if (p !== lastPhone) { lastPhone = p; render(); } });
  lastPhone = isPhone();
  render();
  window.__ce = { state, render, chordView, scaleView, keyView };
})();
