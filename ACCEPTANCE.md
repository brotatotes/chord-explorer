# Chord Explorer — acceptance checks

Each check is automated unless marked (visual), which means a screenshot reviewed with the image tool.

## Theory engine (node tests)
- T1 Parser accepts every symbol in the grammar fixture list (≥ 80 symbols, including `C`, `Cm`, `Cmin`, `C-`, `CM7`, `Cmaj7`, `CΔ7`, `C△`, `Cm7b5`, `Cø`, `Cø7`, `Co7`, `C°7`, `Cdim`, `C+`, `Caug`, `C7#9`, `C7(b9,#11)`, `C13`, `Cm11`, `C6/9`, `C69`, `Cadd9`, `Cmadd9`, `Csus`, `C7sus4`, `G/B`, `F#m7b5`, `Bbsus2`, `Ebmaj9`, `C5`) and rejects garbage (`H7`, `Cq`, empty).
- T2 Spelling: C#maj7 = C# E# G# B#; Cbmaj7 = Cb Eb Gb Bb; Fdim7 = F Ab Cb Ebb; G#7 = G# B# D# F#; Ebm7b5 = Eb Gb Bbb Db; B#dim = B# D# F#.
- T3 Naming: {C E G} → C; {E G C} bass E → C/E, 1st inversion; {A C E G} bass A → Am7, alternative C6; {C E G A} bass C → C6, alternative Am7/C; {C E Bb} → C7 (no 5th); {B D F Ab} → Bdim7 named from bass, with the other three listed as equal; {C E G#} → Caug with E+ and G#+ alternatives; {C C# D} → no name.
- T4 Scales: F# major = F# G# A# B C# D# E#; Gb major = Gb Ab Bb Cb Db Eb F; D dorian = D E F G A B C; A harmonic minor contains G#; Eb melodic minor = Eb F Gb Ab Bb C D; all 7 modes of C, both pentatonics and blues correct.
- T5 Diatonic chords: C major triads I ii iii IV V vi vii° with correct names; sevenths Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bm7b5; A minor uses natural minor with V shown as E (harmonic) plus note; function text present for every degree.
- T6 Key re-ranking: with key G, {A C E G} still Am7 (ii7); in key C, {C E G A} → C6 still first; key changes ranking of an ambiguous set in at least one tested case.

## Shapes (node tests)
- S1 Top guitar shape matches the standard chart shape for ≥ 60 common chords at ≥ 85 % exact match; every mismatch is listed with a judgment.
- S2 Top ukulele shape matches for ≥ 40 common chords at ≥ 85 %.
- S3 Every shape returned by the shape finder passes reachability: span ≤ 3 (≤ 4 above fret 7), ≤ 4 fingers, finger numbers assigned 1–4, barre consistent.
- S4 At least 3 shapes for every common chord on guitar.

## UI (Playwright, file://)
- U1 Loads with zero page errors and zero network requests other than the file itself.
- U2 Chord task: type `f#m7b5`, select, panel shows "F#m7♭5" with notes F# A C E; guitar shows a shape; next-shape button changes the shape and the URL.
- U3 Name task: tap guitar frets for x32010 → panel shows "C"; add fret 3 on the low E… (x→3) still C; switch to ukulele 0003 → C; tap piano keys C E G A → C6 with Am7 alternative.
- U4 Scale task: choose D dorian → 7 notes listed, neck shows highlighted tonic; labels switch to degrees.
- U5 Key task: choose Eb major → 7 cards Eb Fm Gm Ab Bb Cm D°; tapping V shows Bb on instruments; sevenths toggle shows Bb7.
- U6 URL round-trip: for each mode, reload the page with the current hash and get the same view.
- U7 Instruments stay in sync: a note added on piano appears on guitar and ukulele as highlighted pitch-class positions.
- U8 Perf: time to interactive < 300 ms desktop, < 1000 ms with 4× CPU throttle; median tap-to-paint < 50 ms under 4× throttle.
- U9 Keyboard: Tab reaches mode tabs, search, shape buttons, frets and keys; Enter/Space toggles; visible focus ring.
- U10 Contrast: text and controls ≥ 4.5:1 in both themes (computed from CSS colours).
- U11 (visual) Desktop 1440×900, phone 390×844 portrait and 844×390 landscape, light and dark: nothing overlaps or clips, tap targets visibly large, typography serif.

## Sound
- A1 No AudioContext before the first gesture.
- A2 Offline renders of guitar, ukulele, piano for C major: peak between 0.05 and 0.99, RMS above 0.005, no NaN.
- A3 Volume and mute persist across reload.

## Package and publish
- P1 dist/index.html is one self-contained file < 400 KB; no external URLs in src/href; no private home-directory paths, tokens or emails.
- P2 Public repo index.html byte-identical to dist/index.html; PLAN.md absent.
- P3 Live Pages site: hash matches; desktop and phone run U2–U5 with no page errors.
