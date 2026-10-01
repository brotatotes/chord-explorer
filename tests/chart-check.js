// Prints top-shape agreement with chart fixtures. Used by the shape report and the tests.
const S = require('../src/shapes.js'); const F = require('./fixtures/chart-shapes.js');
function check() {
  const out = {};
  for (const inst of ['guitar', 'ukulele']) {
    const rows = [];
    for (const [c, acc] of Object.entries(F[inst])) {
      const sh = S.findShapes(c, inst, 8);
      const list = sh.map((s) => S.fretString(s.frets));
      const pos = list.findIndex((f) => acc.includes(f));
      rows.push({ chord: c, top: list[0] || 'NONE', chart: acc, chartRank: pos + 1, topMatch: pos === 0 });
    }
    out[inst] = rows;
  }
  return out;
}
module.exports = check;
if (require.main === module) {
  const r = check();
  for (const inst in r) {
    const rows = r[inst]; const ok = rows.filter((x) => x.topMatch).length; const top3 = rows.filter((x) => x.chartRank >= 1 && x.chartRank <= 3).length;
    console.log(inst, 'top1', ok + '/' + rows.length, 'top3', top3 + '/' + rows.length);
    rows.filter((x) => !x.topMatch).forEach((x) => console.log('  ', x.chord, 'top', x.top, 'chart', x.chart.join('/'), 'rank', x.chartRank || '>8'));
  }
}
