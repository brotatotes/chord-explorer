# Chord Explorer — design

A single page that answers four questions instantly: how do I play this chord, what am I playing, what notes are in this scale, and which chords belong to this key. No ads, no sign-up, no network, one file.

## 1. Screen layout

### Desktop (≥ 900 px wide)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Chord Explorer      [Chord] [Name it] [Scale] [Key]     ♪ vol  ◐     │  top bar, mode tabs
├──────────────────────────────┬───────────────────────────────────────┤
│ CONTROL PANEL (left, 360px)  │ INSTRUMENTS (right, stacked)          │
│  mode-specific:              │  Guitar neck (frets 0–15, scrolls)    │
│  • chord search + chips      │  Ukulele neck (frets 0–12)            │
│  • big chord name + notes    │  Piano (2 octaves, C3–B4 + C5)        │
│  • role legend / explanation │  each with a small header: name,      │
│  • shape browser 1/N ‹ ›     │  "show: fingers | notes | degrees"    │
│  • alternatives / key list   │                                       │
└──────────────────────────────┴───────────────────────────────────────┘
```

### Phone portrait (< 900 px)

```
┌────────────────────────┐
│ Chord Explorer   ♪  ◐  │
│ [Chord][Name][Scale][Key]  segmented control
├────────────────────────┤
│ PINNED PANEL (sticky)  │  chord name, notes, one-line explanation
├────────────────────────┤
│ [Guitar][Ukulele][Piano]  instrument tabs, swipe left/right
│  instrument view        │  guitar/ukulele drawn VERTICALLY (chart style,
│                         │  nut on top) for a 5–6 fret window, scrollable
├────────────────────────┤
│ mode controls below     │  search, shape browser, scale / key pickers
└────────────────────────┘
```

Phone landscape uses the desktop two-column layout with a narrower control panel and a horizontal neck.

### Why this shape
- The answer (chord name + notes) is always on screen, pinned on phone.
- One instrument at a time on phone keeps tap targets ≥ 40 px.
- Horizontal necks on wide screens show the whole neck for scales. Vertical chart-style diagrams on phone match printed chord charts players already read.

## 2. The four tasks

### A. Look up a chord ("Chord" mode, default)
1. Type in the search box (autofocused on desktop). Forgiving parse: `cmaj7`, `CM7`, `C△7`, `c major 7`, `F#m7b5`, `Bbsus4`, `G/B`, `C9`, `Cmin`, `C-7`, `Cø`, `Co7`, `C+`.
2. Suggestions appear under the box as chips while typing (root + common qualities). Enter or tap selects.
3. Panel shows the name, spelled notes with roles (C · E · G · B = root · 3rd · 5th · 7th), and a one-line explanation ("A major triad plus a major 7th, eleven half steps above the root. Soft and jazzy.").
4. Instruments show the best shape on guitar and ukulele with finger numbers, barre bar, × and ○ markers. Piano shows a close-position voicing (slash bass in the left octave).
5. Shape browser: "Shape 1 of 8 · Easy · open" with ‹ › buttons and arrow keys. Each instrument browses independently.
6. Tap the chord name or "Play" to strum it.

### B. Name what I'm playing ("Name it" mode)
1. Tap frets (guitar/ukulele: one note per string, tapping again clears, tapping the nut area toggles open/muted) or piano keys (toggle).
2. Every tap updates the name immediately, in the panel and on all three instruments (they share one pitch-class set; guitar/uke keep their own string positions, piano keeps octaves).
3. The panel shows the best name big, each note labelled with its role, and "why": "E is in the bass, so this is C major in first inversion (C/E)."
4. Ambiguity: when more than one name is reasonable, "Also could be: Am7 (if A is the root)" chips appear with a sentence explaining the difference. A key selector ("In the key of: —, C, G …") re-ranks: the candidate whose root is diatonic and whose function fits wins.
5. No fit: "No standard chord name. These notes are C, C#, D — a cluster." Never invent a name.
6. "Clear" button and the Escape key reset.

### C. Scales ("Scale" mode)
1. Pick a tonic (12 buttons, spelled per scale: the picker offers F# and Gb separately, choosing the spelling with fewer accidentals by default) and a scale from a short grouped list.
2. All three instruments show every scale note across the neck, tonic highlighted, labels switchable between note names and degrees (1 2 ♭3 …).
3. Panel lists notes, the step pattern (W W H W W W H) and a one-line character note ("Dorian: minor with a raised 6th; bright for a minor sound").
4. "Play scale" plays up and back down.

### D. Chords in this key ("Key" mode)
1. Pick key tonic + major / minor.
2. A grid of seven cards: roman numeral, chord name, function text ("V — dominant, pulls home to I"). Toggle triads ↔ sevenths.
3. Tapping a card shows that chord on the instruments (best shapes) and plays it.
4. "Common progressions" row: I–V–vi–IV, ii–V–I, I–vi–IV–V, vi–IV–I–V, 12-bar blues (major), i–VI–III–VII and i–iv–V (minor). Tapping plays it chord by chord, stepping the instruments.

## 3. URL state (hash, shareable, back-button friendly)

`#/<mode>/<args>?<options>`; all values URL-encoded.

- `#/chord/Cmaj7?g=2&u=1` chord lookup, guitar shape index 2, ukulele shape 1 (1-based, default 1).
- `#/name/g:x32010?key=C` guitar frets low→high (x muted, 0–9 single digit, `(10)` style tokens beyond 9 written as letters a=10 … f=15).
- `#/name/u:0003` ukulele frets G C E A.
- `#/name/p:48.52.55` piano MIDI numbers.
- `#/scale/D/dorian?labels=deg`
- `#/key/Eb/major?sev=1`
- Theme and volume live in localStorage, not the URL.

`history.replaceState` for intermediate taps, `pushState` when mode or chord changes, so back is meaningful but not noisy.

## 4. Chord-name grammar

```
symbol   := root quality? ext? alt* add* sus? ("/" bass)?
root     := [A-G] accidental?          accidental := "#" | "b" | "♯" | "♭" | "x" | "bb"
quality  := maj | M | Δ | △ | ma | major | m | min | - | minor | dim | ° | o | aug | + | ø | m7b5 | 5
ext      := 6 | 7 | 9 | 11 | 13 | 6/9 | 69
alt      := (b|#|♭|♯)(5|9|11|13)   in optional parentheses, comma separated
add      := add(2|4|9|11|13) | (b|#)?add...
sus      := sus | sus2 | sus4 (sus alone = sus4)
```
Normalisation: case-insensitive for quality words but "M" vs "m" is significant when it is the single quality letter (CM7 vs Cm7). Spaces ignored. Unicode accidentals accepted.

Interval sets (semitones from root): maj {0,4,7}; m {0,3,7}; dim {0,3,6}; aug {0,4,8}; sus2 {0,2,7}; sus4 {0,5,7}; 5 {0,7}; 6 adds 9; 7 adds 10; maj7 adds 11; dim7 = {0,3,6,9}; m7b5 = {0,3,6,10}; 9 = 7 + 14; 11 = 9 + 17; 13 = 11 + 21 (3rd of an 11 chord is omitted in voicings, but the spelling lists it). Alterations replace the natural degree.

Spelling: each chord tone is spelled by its interval's letter distance from the root (3rd = root letter + 2), so C#maj7 = C# E# G# B#, Cbmaj7 = Cb Eb Gb Bb, Fdim7 = F Ab Cb Ebb.

## 5. Naming and ambiguity rules (notes → chord)

1. Collect pitch classes and the bass (lowest sounding pitch).
2. For each pitch class as candidate root, and each chord template, score matches. Exact match required on all sounded notes; template notes may be missing only if allowed (the 5th of any chord; the 9th/11th in 13ths; the root never).
3. Ranking (higher is better):
   - root = bass: +30 (root position)
   - fewer missing tones: −12 per missing tone
   - template commonness prior (triads and 7ths > 6ths > extended > altered)
   - simpler symbol (shorter) wins ties
   - if a key is chosen: root diatonic +15, chord diatonic +20
4. If the root is not the bass, show a slash chord (C/E) and name the inversion when the bass is a chord tone (1st, 2nd, 3rd inversion); otherwise call it "over a non-chord bass".
5. Show top candidate + up to 3 alternatives within 25 points. Classic pairs explained: C6 ↔ Am7, Cm6 ↔ Am7b5, dim7 (four equal roots, named from the bass), aug (three equal roots), sus2 ↔ sus4 of the 5th.
6. Two notes: name the interval ("a perfect 5th — a power chord C5"). One note: just the note.
7. Enharmonic spelling of the result follows the selected key; with no key, pick the root spelling with fewer accidentals that keeps all chord tones off double accidentals.

## 6. Shape scoring (guitar EADGBE, ukulele GCEA re-entrant)

Search: for each string choose muted or one fret in a window of up to 4 frets (start fret 1–12) plus open strings, frets 0–15. Keep voicings that contain the root and the 3rd (or the sus tone), and all other tones except an optional 5th.

Hard reachability limits: fretted span ≤ 3 frets (≤ 4 above fret 7 where frets are narrower), at most 4 fretting fingers with a barre counting as one finger on the lowest fretted fret, no muted string between sounding strings unless it can be damped (allowed for one inner string, penalised), lowest sounding guitar string should be the root or the slash bass (guitar), no more than 2 muted strings on guitar at the bass side.

Score (lower = easier, shown as Easy / Medium / Hard):
- span × 2, start fret × 0.6 (above 1), fingers × 1.5
- barre needed +3 (+2 more if a partial barre is not on the lowest fret)
- each open string −1 (in open position)
- each muted inner string +4, each muted outer string +1 (guitar treble side +2)
- bass not root +6 (unless slash chord asks for that bass, then bass mismatch +20)
- missing 5th +1.5, doubled 3rd +0.5
- all strings sounding +0 vs fewer strings: guitar +1.5 per string under 5

Finger assignment: barre (finger 1) when ≥2 strings share the lowest fret and a barre is consistent (no lower-fret notes on strings above it); remaining notes sorted by fret then string get fingers 1–4 in order, never more than 4.

## 7. Sound

- Off until the first user gesture (AudioContext created on first tap/keypress). A speaker button shows state.
- Guitar/ukulele: Karplus-Strong plucked string rendered into AudioBuffers per pitch (cached), with a gentle low-pass, ukulele brighter and shorter.
- Piano: additive partials (1, 2, 3, 4 with slight inharmonicity) with a fast attack and exponential decay plus a hammer-noise transient.
- Strum (down, 30 ms per string) or arpeggio (140 ms per note) toggle. Master gain with a limiter (DynamicsCompressor). Volume and mute persist in localStorage.

## 8. Visual style

- EB Garamond, embedded as a subset WOFF2/WOFF data URL (regular + semibold) so the file works offline. Numbers in tabular lining figures.
- Warm paper light theme (#faf6ef background, #2b2118 ink, accent oxblood #8c2f1c) and a dark theme (#1b1714 background, #efe6d8 ink, accent amber #e0a96d). Follows prefers-color-scheme, with a toggle.
- Fretboards: rosewood-tinted fingerboard, ivory inlays at 3 5 7 9 12 15, nut drawn thicker. Dots: filled accent for chord tones, root as a ring-in-dot, finger number inside; muted × and open ○ above the nut.
- Role colours are paired with text labels (never colour alone): root, 3rd, 5th, 7th, extensions.
- Large targets: frets ≥ 44 px on phone, piano white keys ≥ 36 px wide.
- All SVG, no images. One HTML file, target < 250 KB.
