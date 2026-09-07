// Password hashing, login, and what each role is allowed to do.
// Deliberately builds its own accounts: the shipped seed file holds only an
// emergency admin whose password is not in the repository, and tests must not
// depend on any published credential.
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

let pass = 0, fail = 0;
function t(name, got, want) {
  if (got === want) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       got  ' + got + '\n       want ' + want); }
}

console.log('SHA-256 known vectors:');
t('sha256("")', sha256hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
t('sha256("abc")', sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
t('sha256(448-bit msg)', sha256hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
  '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
t('sha256(multi-block)', sha256hex('a'.repeat(1000)),
  '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
t('sha256(utf8 gujarati)', sha256hex('મુદ્રા').length, 64);

console.log('\nPassword hashing:');
const h = hashPassword('Correct Horse 99', 'aabbccdd00112233');
t('deterministic for a given salt', hashPassword('Correct Horse 99', 'aabbccdd00112233'), h);
t('verify correct pw', verifyPassword('Correct Horse 99', h), true);
t('reject wrong pw', verifyPassword('Correct Horse 9', h), false);
t('reject empty pw', verifyPassword('', h), false);
t('reject garbage stored', verifyPassword('x', 'not-a-hash'), false);
t('reject truncated stored', verifyPassword('x', 's1$5000$abc'), false);
const h2 = hashPassword('Correct Horse 99');
t('random salt gives a different hash', h2 === h, false);
t('random-salt hash still verifies', verifyPassword('Correct Horse 99', h2), true);

console.log('\nShipped seed file:');
t('seeds exactly one bootstrap account', SEED_USERS.length, 1);
t('and it is the admin', SEED_USERS[0].username, 'admin');
t('no starter accounts for staff roles',
  SEED_USERS.some(u => ['manager', 'entry1', 'entry2', 'viewer'].includes(u.username)), false);
t('no plaintext password in the file',
  /"pass":\s*"s1\$/.test(fs.readFileSync('F:/MUDRA/js/seed-users.js', 'utf8')), true);

/* ---- accounts this suite owns ---- */
const PW = { boss: 'boss-pw-1', mgr: 'mgr-pw-1', op: 'op-pw-1', view: 'view-pw-1' };
function seedTestUsers() {
  Auth.replaceAll([
    { id: 'u_boss', username: 'boss',   name: 'Boss',   role: 'admin',    pass: hashPassword(PW.boss), active: true },
    { id: 'u_mgr',  username: 'mgr',    name: 'Mgr',    role: 'manager',  pass: hashPassword(PW.mgr),  active: true },
    { id: 'u_op',   username: 'op',     name: 'Op',     role: 'operator', pass: hashPassword(PW.op),   active: true },
    { id: 'u_view', username: 'viewer1', name: 'View',  role: 'viewer',   pass: hashPassword(PW.view), active: true }
  ]);
}
seedTestUsers();

console.log('\nLogin:');
t('unknown user', Auth.login('nobody', 'x').ok, false);
t('wrong password', Auth.login('boss', 'wrong').ok, false);
t('correct password', Auth.login('boss', PW.boss).ok, true);
t('username is case-insensitive', Auth.login('BOSS', PW.boss).ok, true);
Auth.upsert({ id: 'u_off', username: 'off', name: 'Off', role: 'viewer', pass: hashPassword('x1x1x1'), active: false });
t('inactive account is refused', Auth.login('off', 'x1x1x1').ok, false);

console.log('\nRoles:');
Auth.login('boss', PW.boss);
t('admin can manage users', Auth.can('manageUsers'), true);
t('admin can reach settings', Auth.can('settings'), true);
t('admin can delete', Auth.can('delete'), true);

Auth.login('mgr', PW.mgr);
t('manager can edit masters', Auth.can('parties'), true);
t('manager can delete', Auth.can('delete'), true);
t('manager CANNOT reach settings', Auth.can('settings'), false);
t('manager CANNOT manage users', Auth.can('manageUsers'), false);

Auth.login('op', PW.op);
t('operator can create', Auth.can('create'), true);
t('operator can view the ledger', Auth.can('entries'), true);
t('operator CANNOT edit', Auth.can('edit'), false);
t('operator CANNOT delete', Auth.can('delete'), false);
t('operator CANNOT reach masters', Auth.can('parties'), false);
t('operator CANNOT reach settings', Auth.can('settings'), false);

Auth.login('viewer1', PW.view);
t('viewer can read reports', Auth.can('reports'), true);
t('viewer can read the payment ledger', Auth.can('payment'), true);
t('viewer CANNOT create', Auth.can('create'), false);
t('viewer CANNOT edit', Auth.can('edit'), false);
t('viewer CANNOT delete', Auth.can('delete'), false);

Auth.logout();
t('no permissions once logged out', Auth.can('dashboard'), false);

console.log('\nUser management:');
Auth.login('boss', PW.boss);
const nid = Auth.newId();
Auth.upsert({ id: nid, username: 'Test1', name: 'T', role: 'viewer', pass: hashPassword('abc123'), active: true });
t('username normalised to lowercase', Auth.all().some(u => u.username === 'test1'), true);
t('new user can log in', Auth.login('TEST1', 'abc123').ok, true);
Auth.login('boss', PW.boss);
Auth.setPassword(nid, 'newpw99');
t('password change works', Auth.login('test1', 'newpw99').ok, true);
t('old password rejected', Auth.login('test1', 'abc123').ok, false);
Auth.login('boss', PW.boss);
t('remove user', Auth.remove(nid), true);
const bossId = Auth.all().find(u => u.role === 'admin').id;
const res = Auth.remove(bossId);
t('cannot remove the last admin', typeof res === 'object' && !!res.err, true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
