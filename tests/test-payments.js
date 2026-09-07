// Payment maths: amount billed, money received, money still owed.
// Before v5.1 `payment` was auto-set to pieces x rate, so "paid" always equalled
// "amount" and the Pending column could never show anything but zero.
const fs = require('fs');
const src = fs.readFileSync('F:/MUDRA/js/app.js', 'utf8');

// pull the pure helpers out of app.js so this runs without a DOM
const pick = name => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('helper not found: ' + name);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
};
eval([pick('num'), pick('amountOf'), pick('paidOf'), pick('dueOf'), pick('todayLocal')].join('\n'));

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       got  ' + got + '\n       want ' + want); }
};

console.log('Amount:');
t('pieces x rate', amountOf({ total: 100, rate: 12 }), 1200);
t('zero rate', amountOf({ total: 100, rate: 0 }), 0);
t('missing fields', amountOf({}), 0);

console.log('\nPaid and still owed:');
const pending = { total: 100, rate: 10, status: 'Pending', paid: 0 };
const partial = { total: 100, rate: 10, status: 'Partial', paid: 400 };
const settled = { total: 100, rate: 10, status: 'Paid',    paid: 1000 };
t('nothing received yet', paidOf(pending), 0);
t('owed in full', dueOf(pending), 1000);
t('part received', paidOf(partial), 400);
t('remainder owed', dueOf(partial), 600);
t('fully settled', paidOf(settled), 1000);
t('nothing owed', dueOf(settled), 0);

console.log('\nOverpayment must not show as negative:');
t('paid more than billed', dueOf({ total: 10, rate: 10, paid: 500 }), 0);

console.log('\nRows written before `paid` existed:');
// they carried only `payment` (== amount) plus a status
t('old row marked Paid counts as settled',
  paidOf({ total: 100, rate: 10, payment: 1000, status: 'Paid' }), 1000);
t('old row marked Pending owes the full amount',
  dueOf({ total: 100, rate: 10, payment: 1000, status: 'Pending' }), 1000);
t('old row marked Partial is treated as unpaid, not fully paid',
  paidOf({ total: 100, rate: 10, payment: 1000, status: 'Partial' }), 0);
t('an explicit paid of 0 is honoured over the status',
  paidOf({ total: 100, rate: 10, paid: 0, status: 'Paid' }), 0);

console.log('\nLedger totals across a party:');
const rows = [pending, partial, settled];
t('billed', rows.reduce((a, e) => a + amountOf(e), 0), 3000);
t('received', rows.reduce((a, e) => a + paidOf(e), 0), 1400);
t('outstanding', rows.reduce((a, e) => a + dueOf(e), 0), 1600);

console.log('\nDate is the local calendar day, not UTC:');
const d = new Date();
const local = d.getFullYear() + '-' +
              String(d.getMonth() + 1).padStart(2, '0') + '-' +
              String(d.getDate()).padStart(2, '0');
t('matches the machine calendar', todayLocal(), local);
t('no UTC clock in the helper', /toISOString/.test(pick('todayLocal')), false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
