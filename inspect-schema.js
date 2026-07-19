const Analysis = require('./server/models/Analysis');
const p = Analysis.schema.paths['summary.highlightedMoments'];
console.log(JSON.stringify({
  path: p ? p.path : 'missing',
  instance: p ? p.instance : 'missing',
  caster: p && p.caster ? p.caster.instance : 'none',
  options: p ? p.options : {},
}, null, 2));
