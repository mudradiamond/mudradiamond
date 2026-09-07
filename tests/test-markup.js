// Markup guards.
//
// The Payment Ledger page rendered blank from v4 onward because <input
// id="payment"> in the entry form and <section id="payment"> shared an id:
// getElementById returned the input, so page('payment') put the .show class on
// a text box and the real section stayed hidden. Nothing errored, so it only
// surfaced when someone actually looked at the page.
const fs = require('fs');
const html = fs.readFileSync('F:/MUDRA/index.html', 'utf8');
const app = fs.readFileSync('F:/MUDRA/js/app.js', 'utf8');

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const same = Array.isArray(got) && Array.isArray(want)
    ? got.join(',') === want.join(',') : got === want;
  if (same) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       got  ' + JSON.stringify(got) + '\n       want ' + JSON.stringify(want)); }
};

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);

console.log('Element ids:');
t('every id is unique', [...new Set(dupes)], []);

console.log('\nEvery navigable page exists as a section:');
const navIds = [...app.matchAll(/\{ id: '([a-z]+)',\s+label:/g)].map(m => m[1]);
t('nav is not empty', navIds.length > 0, true);
navIds.forEach(id => {
  const re = new RegExp('<section id="' + id + '"[^>]*class="page');
  t('section exists for "' + id + '"', re.test(html), true);
});

console.log('\nEvery id app.js reaches for exists in the markup:');
// created at runtime rather than declared in the markup
const RUNTIME_IDS = ['toast'];
const wanted = [...new Set([...app.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]))];
const missing = wanted.filter(id => !ids.includes(id) && !RUNTIME_IDS.includes(id));
t('no dangling $() lookups', missing, []);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
