# Chord Explorer

Fast, ad-free chords and scales for guitar, ukulele and piano. There are no ads, sign-ups or trackers. The whole app is one small page that loads instantly and works offline.

Use it here: https://brotatotes.github.io/chord-explorer/

## What it does

- **Look up a chord.** Type a name such as `Cmaj7`, `F#m7b5`, `Bbsus4`, `G/B` or `C9`. Playable shapes are ranked from easiest to hardest, with finger numbers, barres and muted strings, and a sensible piano voicing.
- **Name what you're playing.** Tap frets or keys on any instrument. The chord is named live, each note is labelled with its role, and a short explanation says why. When a set of notes has more than one reasonable name, the likeliest comes first and the alternatives are explained. Choosing a key settles it.
- **Scales.** Major, natural minor, the modes, both pentatonics, blues, harmonic minor and melodic minor, spelled correctly for each key and shown on all three instruments.
- **Chords in a key.** Diatonic triads and sevenths with roman numerals, a plain description of each chord's job, and a few common progressions.

Guitar, ukulele and piano stay in sync. Every view has a shareable link. Sound is synthesized in the browser and starts after your first tap.

## How it is built

The source is plain JavaScript with no dependencies.

- `src/theory.js` is the music theory engine. It handles spelling, intervals, the chord-symbol parser, chord naming, scales and keys, and has no DOM code.
- `src/shapes.js` searches frets 0 to 15 for guitar and ukulele fingerings and scores them for playability.
- `src/audio.js` holds the Web Audio plucked-string and piano voices.
- `src/app.js` and `src/style.css` are the interface.
- `node tools/build.js` inlines everything into one self-contained `dist/index.html`. The published `index.html` is a copy of that file and makes no network requests.
- Run the unit tests with `node --test tests/audio.test.js tests/theory.test.js tests/shapes.test.js`. The Python files in `tools/` are Playwright browser checks.

`DESIGN.md` describes the screens, link format, naming rules and shape scoring. `ACCEPTANCE.md` lists the checks the app was tested against.

## Font notices

- EB Garamond by Georg Duffner is embedded as a subset under the SIL Open Font License 1.1. See `fonts/EB-Garamond-OFL.txt`.
- The sharp, flat and natural signs come from a tiny subset of GNU FreeSerif, which is licensed under the GPL version 3 or later with the font exception that permits embedding in documents.
