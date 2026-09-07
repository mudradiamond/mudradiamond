// Regression test: a fresh device must not restore the published seed password
// over an account that has since been changed and pushed to the cloud.
const fs = require('fs');
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.SEED_USERS = JSON.parse(
  fs.readFileSync('F:/MUDRA/js/seed-users.js', 'utf8')
    .replace(/^[\s\S]*?const SEED_USERS = /, '').replace(/;\s*$/, '')
);
eval(fs.readFileSync('F:/MUDRA/js/auth.js', 'utf8') +
     '\nglobal.Auth = Auth; global.ROLES = ROLES; global.SEED_STAMP = SEED_STAMP;');

// mergeRows + stamp, lifted from app.js so the test exercises the real logic
const appSrc = fs.readFileSync('F:/MUDRA/js/app.js', 'utf8');
const merge = appSrc.slice(appSrc.indexOf('function stamp('), appSrc.indexOf('function applyPull('));
eval(merge + '\nglobal.mergeRows = mergeRows; global.stamp = stamp;');

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       got  ' + got + '\n       want ' + want); }
};

console.log('Seed stamping:');
const seededAdmin = Auth.all().find(u => u.username === 'admin');
t('fresh seeds stamped at the epoch', seededAdmin.updated_at, SEED_STAMP);
t('epoch parses older than any real date',
  stamp(seededAdmin.updated_at) < stamp('2020-01-01T00:00:00Z'), true);

console.log('\nFresh device pulling a changed account from the cloud:');
// the owner changed their password 15 minutes BEFORE this device was set up
const cloudRow = {
  client_id: 'u_seed_admin', username: 'admin', name: 'Rakesh Makani (Owner)',
  role: 'admin', pass: hashPassword('TheRealPassword77'), active: true,
  must_change: false, deleted: false,
  updated_at: '2026-09-07T15:03:01.710614+00:00'   // postgres format
};
const localUsers = Auth.all().map(u => Object.assign({}, u, { client_id: u.id }));
const merged = mergeRows(localUsers, [cloudRow]);
const mergedAdmin = merged.find(u => u.username === 'admin');

t('cloud account wins over the seed', mergedAdmin.pass, cloudRow.pass);
t('seed password is NOT restored', mergedAdmin.pass === seededAdmin.pass, false);
t('no rows are lost in the merge', merged.length, Auth.all().length);

// apply it the way applyPull does, then check the real login
Auth.replaceAll(merged.filter(u => !u.deleted).map(u => ({
  id: u.client_id, username: u.username, name: u.name, role: u.role,
  pass: u.pass, active: u.active !== false, must_change: !!u.must_change,
  updated_at: u.updated_at
})));
t('real password logs in on the fresh device', Auth.login('admin', 'TheRealPassword77').ok, true);
Auth.logout();
t('the shipped bootstrap hash no longer applies',
  Auth.all().find(u => u.username === 'admin').pass ===
  SEED_USERS.find(u => u.username === 'admin').pass, false);

console.log('\nMigration for devices set up by the older build:');
// simulate the broken state: seeds persisted with the install time
const broken = JSON.parse(JSON.stringify(SEED_USERS));
broken.forEach(u => { u.updated_at = '2026-09-07T15:19:08.164Z'; });
store['mudra_users_v1'] = JSON.stringify(broken);
Auth.loadUsers();
t('untouched seeds re-stamped to the epoch',
  Auth.all().every(u => u.updated_at === SEED_STAMP), true);
t('migration is persisted',
  JSON.parse(store['mudra_users_v1']).every(u => u.updated_at === SEED_STAMP), true);

console.log('\nA genuinely changed local account must NOT be demoted:');
const changedAt = new Date().toISOString();
const users2 = JSON.parse(JSON.stringify(SEED_USERS));
users2.forEach(u => { u.updated_at = SEED_STAMP; });
users2.push({ id: 'u_staff', username: 'staff', name: 'Staff', role: 'operator',
              pass: hashPassword('placeholder'), active: true, updated_at: SEED_STAMP });
const idx = users2.findIndex(u => u.username === 'staff');
users2[idx].pass = hashPassword('EntryOwnPassword5');
users2[idx].updated_at = changedAt;
store['mudra_users_v1'] = JSON.stringify(users2);
Auth.loadUsers();
t('changed account keeps its timestamp',
  Auth.all().find(u => u.username === 'staff').updated_at, changedAt);
t('changed account beats an older cloud row',
  mergeRows(
    Auth.all().map(u => Object.assign({}, u, { client_id: u.id })),
    [{ client_id: users2[idx].id, username: 'staff', pass: 'STALE',
       updated_at: '2020-01-01T00:00:00+00:00' }]
  ).find(u => u.username === 'staff').pass !== 'STALE', true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
