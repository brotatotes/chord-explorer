/* Chord Explorer sound. The synth core is pure JS that renders Float32Arrays, so it is testable in node.
   The browser layer plays those buffers through Web Audio. No sound until the first user gesture. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Small seeded PRNG so renders are repeatable in tests.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Karplus-Strong plucked string with a fractional delay for accurate tuning,
  // a softened noise burst, pick-position comb and a gentle loss filter.
  const PLUCK = {
    guitar: { dur: 2.6, decay: 0.9965, bright: 0.55, pick: 0.18, tone: 0.5, gain: 0.32 },
    ukulele: { dur: 1.5, decay: 0.993, bright: 0.65, pick: 0.25, tone: 0.55, gain: 0.34 },
  };
  function renderPluck(midi, sr, kind, seed) {
    const p = PLUCK[kind] || PLUCK.guitar;
    const f = midiHz(midi);
    const len = Math.round(sr * p.dur);
    const out = new Float32Array(len);
    // Loop delay is size - frac - 0.5 samples (fractional read plus the two-point average), so size - frac = period + 0.5.
    const x = sr / f + 0.5;
    const size = Math.max(3, Math.ceil(x));
    const frac = size - x;
    const N = size;
    const buf = new Float32Array(size);
    const rand = rng(seed || (midi * 7919 + 17));
    // Excitation: noise, low-passed by brightness, then comb-filtered for pick position.
    let lp = 0;
    const tmp = new Float32Array(size);
    for (let i = 0; i < size; i++) { lp += p.bright * ((rand() * 2 - 1) - lp); tmp[i] = lp; }
    const d = Math.max(1, Math.round(p.pick * N));
    let mean = 0;
    for (let i = 0; i < size; i++) { buf[i] = tmp[i] - (i >= d ? tmp[i - d] : 0); mean += buf[i]; }
    mean /= size; for (let i = 0; i < size; i++) buf[i] -= mean;
    // Higher notes lose energy per cycle faster in real strings; keep a similar ring time across the neck.
    const rho = Math.pow(p.decay, 110 / Math.max(80, f) * 0.5 + 0.5);
    let r = 0; let prev = 0; let tone = 0;
    for (let n = 0; n < len; n++) {
      const a = buf[r]; const b = buf[(r + 1) % size]; const c = buf[(r + 2) % size];
      const s = a + frac * (b - a); // fractional read
      const nxt = rho * 0.5 * (s + (b + frac * (c - b)));
      buf[r] = nxt;
      r = (r + 1) % size;
      tone += p.tone * (s - tone); // body softening
      out[n] = tone;
      prev = s;
    }
    void prev;
    // Short fade in (avoid click) and fade out at the end.
    const fi = Math.min(len, Math.round(sr * 0.002)); for (let i = 0; i < fi; i++) out[i] *= i / fi;
    const fo = Math.min(len, Math.round(sr * 0.08)); for (let i = 0; i < fo; i++) out[len - 1 - i] *= i / fo;
    return normalize(out, p.gain);
  }

  // Piano-like tone: slightly inharmonic partials, faster decay for higher partials, a soft hammer thump.
  function renderPiano(midi, sr) {
    const f = midiHz(midi);
    const dur = Math.max(1.4, Math.min(3.2, 3.2 - (midi - 48) * 0.035));
    const len = Math.round(sr * dur);
    const out = new Float32Array(len);
    const B = 0.0004;
    const partials = [];
    for (let k = 1; k <= 8; k++) {
      const fk = f * k * Math.sqrt(1 + B * k * k);
      if (fk > sr * 0.45) break;
      partials.push({ w: TAU * fk / sr, amp: Math.pow(k, -1.4) * (k === 2 ? 1.25 : 1), tau: dur / (1.6 + k * 0.9), det: 1 + (k % 2 ? 0.0007 : -0.0005) });
    }
    const atk = Math.round(sr * 0.006);
    for (const pt of partials) {
      // Two-stage piano decay: a quick initial drop, then a long quieter aftersound.
      const w2 = pt.w * pt.det; const fast = Math.exp(-1 / (pt.tau * 0.12 * sr)); const slow = Math.exp(-1 / (pt.tau * sr));
      let e1 = pt.amp * 0.65; let e2 = pt.amp * 0.35;
      for (let n = 0; n < len; n++) {
        out[n] += (e1 + e2) * 0.5 * (Math.sin(pt.w * n) + Math.sin(w2 * n));
        e1 *= fast; e2 *= slow;
      }
    }
    const rand = rng(midi * 104729 + 3); let lp = 0; const th = Math.round(sr * 0.03);
    for (let n = 0; n < th; n++) { lp += 0.2 * ((rand() * 2 - 1) - lp); out[n] += lp * 0.15 * (1 - n / th); }
    for (let n = 0; n < atk; n++) out[n] *= n / atk;
    const fo = Math.round(sr * 0.1); for (let i = 0; i < fo; i++) out[len - 1 - i] *= i / fo;
    return normalize(out, 0.3);
  }

  function normalize(x, target) {
    let pk = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; }
    if (pk > 0) { const g = target / pk; for (let i = 0; i < x.length; i++) x[i] *= g; }
    return x;
  }
  function renderNote(midi, inst, sr) { return inst === 'piano' ? renderPiano(midi, sr) : renderPluck(midi, sr, inst); }

  // Timing for a group of notes. Strum: quick low-to-high sweep. Arpeggio: one note at a time.
  function schedule(midis, style, inst) {
    const list = midis.filter((m) => m != null);
    if (style === 'together' || (inst === 'piano' && style === 'strum')) return list.map((m) => ({ midi: m, t: 0 }));
    const gap = style === 'arpeggio' ? 0.22 : (inst === 'piano' ? 0.012 : 0.035);
    return list.map((m, i) => ({ midi: m, t: i * gap }));
  }

  // Mix scheduled notes into one buffer with headroom, for tests and offline checks.
  function mixdown(events, inst, sr, gain) {
    let end = 0; const bufs = events.map((e) => { const b = renderNote(e.midi, inst, sr); end = Math.max(end, Math.round(e.t * sr) + b.length); return b; });
    const out = new Float32Array(end);
    const g = (gain == null ? 1 : gain) * busGain(events.length);
    events.forEach((e, i) => { const o = Math.round(e.t * sr); const b = bufs[i]; for (let n = 0; n < b.length; n++) out[o + n] += b[n] * g; });
    return out;
  }
  // Per-voice gain so dense chords stay well below full scale.
  function busGain(voices) { return 1 / Math.sqrt(Math.max(1, voices)) * 0.9; }
  function stats(x) {
    let pk = 0; let ss = 0; let clip = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; ss += x[i] * x[i]; if (a >= 0.999) clip++; }
    return { peak: pk, rms: Math.sqrt(ss / Math.max(1, x.length)), clipped: clip, samples: x.length };
  }

  const Core = { midiHz, renderPluck, renderPiano, renderNote, schedule, mixdown, busGain, stats };

  // ---------- Browser layer ----------
  const icon = (muted) => '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/>'
    + (muted ? '<path d="M16 9l5 6M21 9l-5 6"/>' : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>') + '</svg>';
  function makePlayer() {
    const KEY = 'ce-sound';
    let prefs = { volume: 0.7, muted: false, style: 'strum' };
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) prefs = Object.assign(prefs, s); } catch (e) { /* private mode */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
    let ctx = null; let master = null; let unlocked = false; const cache = new Map(); let voices = [];
    const AC = global.AudioContext || global.webkitAudioContext;

    function build(c) {
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      const m = c.createGain(); m.gain.value = prefs.muted ? 0 : prefs.volume;
      m.connect(comp); comp.connect(c.destination);
      return m;
    }
    function unlock() {
      if (unlocked || !AC) return;
      unlocked = true;
      try { ctx = new AC(); master = build(ctx); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
    }
    // Sound is off until the first real gesture on the page.
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => global.addEventListener && global.addEventListener(ev, unlock, { capture: true, passive: true }));

    function buffer(c, midi, inst) {
      const k = inst + midi + '@' + c.sampleRate; let b = cache.get(k);
      if (!b) { const data = renderNote(midi, inst, c.sampleRate); b = c.createBuffer(1, data.length, c.sampleRate); b.copyToChannel(data, 0); if (c === ctx) cache.set(k, b); }
      return b;
    }
    function playEvents(c, dest, events, inst, t0) {
      const g = busGain(events.length);
      events.forEach((e) => {
        const src = c.createBufferSource(); src.buffer = buffer(c, e.midi, inst);
        const vg = c.createGain(); vg.gain.value = g;
        src.connect(vg); vg.connect(dest); src.start(t0 + e.t);
        if (c === ctx) { voices.push({ src, vg }); src.onended = () => { voices = voices.filter((v) => v.src !== src); }; }
      });
    }
    function stopAll() {
      if (!ctx) return; const t = ctx.currentTime;
      voices.forEach((v) => { try { v.vg.gain.setTargetAtTime(0, t, 0.03); v.src.stop(t + 0.2); } catch (e) { /* already stopped */ } });
      voices = [];
    }
    function go(events, inst) {
      if (!ctx || prefs.muted || !events.length) return false;
      if (ctx.state === 'suspended') ctx.resume();
      if (voices.length > 24) stopAll();
      playEvents(ctx, master, events, inst, ctx.currentTime + 0.01);
      return true;
    }
    const api = {
      core: Core,
      get prefs() { return Object.assign({}, prefs); },
      get ready() { return !!ctx; },
      unlock,
      note(midi, inst) { return go([{ midi, t: 0 }], inst || 'piano'); },
      notes(midis, inst, style) { stopAll(); return go(schedule(midis, style || prefs.style, inst), inst); },
      scale(midis, inst) { stopAll(); return go(midis.map((m, i) => ({ midi: m, t: i * 0.28 })), inst || 'piano'); },
      stop: stopAll,
      setVolume(v) { prefs.volume = Math.max(0, Math.min(1, +v)); save(); if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.02); },
      setMuted(m) { prefs.muted = !!m; save(); if (m) stopAll(); if (master) master.gain.setTargetAtTime(prefs.muted ? 0 : prefs.volume, ctx.currentTime, 0.02); },
      setStyle(s) { if (['strum', 'arpeggio', 'together'].includes(s)) { prefs.style = s; save(); } },
      // Render through the same graph offline, for automated checks.
      async renderOffline(midis, inst, style, seconds) {
        const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext; const sr = 44100;
        const c = new OAC(1, Math.round(sr * (seconds || 3)), sr);
        const m = build(c); m.gain.value = prefs.volume;
        playEvents(c, m, schedule(midis, style || prefs.style, inst), inst, 0);
        const b = await c.startRendering();
        return stats(b.getChannelData(0));
      },
      controlsHTML() {
        const p = prefs;
        return `<div class="sound"><button id="mute" aria-pressed="${p.muted}" aria-label="${p.muted ? 'Unmute sound' : 'Mute sound'}" title="${p.muted ? 'Sound off' : 'Sound on'}">${icon(p.muted)}</button>`
          + `<input id="vol" type="range" min="0" max="1" step="0.05" value="${p.volume}" aria-label="Volume">`
          + `<select id="pstyle" aria-label="How chords play">${[['strum', 'Strum'], ['arpeggio', 'Arpeggio'], ['together', 'Together']].map(([k, l]) => `<option value="${k}"${p.style === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`;
      },
      wire(root) {
        const q = (s) => root.querySelector(s);
        const mute = q('#mute'); const vol = q('#vol'); const st = q('#pstyle');
        if (mute) mute.addEventListener('click', () => { api.setMuted(!prefs.muted); mute.setAttribute('aria-pressed', String(prefs.muted)); mute.innerHTML = icon(prefs.muted); mute.setAttribute('aria-label', prefs.muted ? 'Unmute sound' : 'Mute sound'); });
        if (vol) vol.addEventListener('input', () => api.setVolume(vol.value));
        if (st) st.addEventListener('change', () => api.setStyle(st.value));
      },
    };
    return api;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else { global.SynthCore = Core; global.CEAudio = makePlayer(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
