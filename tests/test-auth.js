const fs = require('fs');
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.SEED_USERS = JSON.parse(
  fs.readFileSync('F:/MUDRA/js/seed-users.js', 'utf8').replace(/^[\s\S]*?const SEED_USERS = /, '').replace(/;\s*$/, '')
);
// `const` bindings inside eval() do not leak to module scope, so re-export them.
eval(fs.readFileSync('F:/MUDRA/js/auth.js', 'utf8') + '\nglobal.Auth = Auth; global.ROLES = ROLES;');

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
t('sha256(1M x "a") block-boundary proxy', sha256hex('a'.repeat(1000)),
  '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
t('sha256(utf8 gujarati)', sha256hex('મુદ્રા').length, 64);

console.log('\nPassword hashing:');
const h = hashPassword('Hira@2688%', '202e1be83a4dc2f3');
t('matches python-generated seed hash', h,
  's1$5000$202e1be83a4dc2f3$fc6c05861947c971d95033561a4f90278bdca782f15ec45cae70442b53a71da3');
t('verify correct pw', verifyPassword('Hira@2688%', h), true);
t('reject wrong pw', verifyPassword('Hira@2688', h), false);
t('reject empty pw', verifyPassword('', h), false);
t('reject garbage stored', verifyPassword('x', 'not-a-hash'), false);
const h2 = hashPassword('Hira@2688%');
t('random salt gives different hash', h2 === h, false);
t('random-salt hash still verifies', verifyPassword('Hira@2688%', h2), true);

console.log('\nLogin + roles:');
t('login wrong user', Auth.login('nobody', 'x').ok, false);
t('login wrong pw', Auth.login('admin', 'wrong').ok, false);
const r = Auth.login('admin', 'Hira@2688%');
t('login admin ok', r.ok, true);
t('admin must_change flagged', r.mustChange, true);
t('admin can manageUsers', Auth.can('manageUsers'), true);
t('admin can delete', Auth.can('delete'), true);

Auth.login('entry1', 'Kiran@5179*');
t('operator can create', Auth.can('create'), true);
t('operator CANNOT delete', Auth.can('delete'), false);
t('operator CANNOT see settings', Auth.can('settings'), false);
t('operator CANNOT see parties master', Auth.can('parties'), false);
t('operator CANNOT manageUsers', Auth.can('manageUsers'), false);

Auth.login('viewer', 'Surya@8825$');
t('viewer can see reports', Auth.can('reports'), true);
t('viewer CANNOT create', Auth.can('create'), false);
t('viewer CANNOT edit', Auth.can('edit'), false);
t('viewer CANNOT delete', Auth.can('delete'), false);

Auth.login('manager', 'Ratna@8633#');
t('manager can edit masters', Auth.can('parties'), true);
t('manager can delete', Auth.can('delete'), true);
t('manager CANNOT see settings', Auth.can('settings'), false);
t('manager CANNOT manageUsers', Auth.can('manageUsers'), false);

Auth.logout();
t('after logout no perms', Auth.can('dashboard'), false);

console.log('\nUser management:');
Auth.login('admin', 'Hira@2688%');
const nid = Auth.newId();
Auth.upsert({ id: nid, username: 'Test1', name: 'T', role: 'viewer', pass: hashPassword('abc123'), active: true });
t('username normalised to lowercase', Auth.all().some(u => u.username === 'test1'), true);
t('new user can log in', Auth.login('TEST1', 'abc123').ok, true);
Auth.login('admin', 'Hira@2688%');
Auth.setPassword(nid, 'newpw99');
t('password change works', Auth.login('test1', 'newpw99').ok, true);
t('old password rejected', Auth.login('test1', 'abc123').ok, false);
Auth.login('admin', 'Hira@2688%');
t('remove user', Auth.remove(nid), true);
const adminId = Auth.all().find(u => u.role === 'admin').id;
const res = Auth.remove(adminId);
t('cannot remove last admin', typeof res === 'object' && !!res.err, true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
