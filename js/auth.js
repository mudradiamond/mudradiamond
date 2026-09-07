/* Mudra Diamond — Auth, Users & Roles (v5.0)
   NOTE: This is client-side gating for an internal team app. It controls what
   each user can SEE and DO in the UI. The real data boundary must be enforced
   by Supabase RLS policies — see supabase_schema.sql. */

/* ---------------- SHA-256 (pure JS: works on https, http and file://) --------------- */
const SHA256K = new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);

function sha256Bytes(data){
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
                             0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const l = data.length;
  const hi = Math.floor(l / 536870912), lo = (l << 3) >>> 0;
  const padded = Math.ceil((l + 9) / 64) * 64;
  const m = new Uint8Array(padded);
  m.set(data); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(padded - 8, hi); dv.setUint32(padded - 4, lo);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i-15], y = w[i-2];
      const s0 = ((x>>>7)|(x<<25)) ^ ((x>>>18)|(x<<14)) ^ (x>>>3);
      const s1 = ((y>>>17)|(y<<15)) ^ ((y>>>19)|(y<<13)) ^ (y>>>10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256K[i] + w[i]) >>> 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
  return out;
}

const HEX = '0123456789abcdef';

function sha256hex(str){
  const b = sha256Bytes(new TextEncoder().encode(str));
  let s = '';
  for (let i = 0; i < 32; i++) s += HEX[b[i] >> 4] + HEX[b[i] & 15];
  return s;
}

const PW_ITER = 5000;

function randSalt(){
  const a = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (let i = 0; i < 8; i++) s += HEX[a[i] >> 4] + HEX[a[i] & 15];
  return s;
}

function hashPassword(pw, salt, iter){
  salt = salt || randSalt(); iter = iter || PW_ITER;
  let h = sha256hex(salt + ':' + pw);
  for (let i = 1; i < iter; i++) h = sha256hex(salt + ':' + h);
  return 's1$' + iter + '$' + salt + '$' + h;
}

function verifyPassword(pw, stored){
  const p = String(stored || '').split('$');
  if (p.length !== 4 || p[0] !== 's1') return false;
  return hashPassword(pw, p[2], +p[1]) === stored;
}

/* ---------------- Roles ---------------- */
const ROLES = {
  admin: {
    label: 'Admin', gu: 'એડમિન',
    desc: 'બધું — entries, masters, payment, reports, cloud settings અને user management.',
    perms: ['dashboard','entry','entries','parties','processmaster','subprocessmaster',
            'payment','reports','settings','users','create','edit','delete','export','cloud','manageUsers']
  },
  manager: {
    label: 'Manager', gu: 'મેનેજર',
    desc: 'Entry, બધા Master, Payment અને Reports. Cloud Settings અને User Master નહીં.',
    perms: ['dashboard','entry','entries','parties','processmaster','subprocessmaster',
            'payment','reports','create','edit','delete','export']
  },
  operator: {
    label: 'Operator', gu: 'ડેટા એન્ટ્રી',
    desc: 'નવી Jangad entry કરી શકે અને Ledger જોઈ શકે. Delete / Master / Settings નહીં.',
    perms: ['dashboard','entry','entries','create','export']
  },
  viewer: {
    label: 'Viewer', gu: 'ફક્ત જોવા માટે',
    desc: 'ફક્ત વાંચી શકે — Dashboard, Ledger, Payment અને Reports. કંઈ બદલી ન શકે.',
    perms: ['dashboard','entries','payment','reports','export']
  }
};

/* ---------------- User store ---------------- */
const Auth = (function () {
  const UKEY = 'mudra_users_v1', SKEY = 'mudra_session_v1';
  let users = [];
  let session = null;

  function persist(){ localStorage.setItem(UKEY, JSON.stringify(users)); }

  function loadUsers(){
    try { users = JSON.parse(localStorage.getItem(UKEY) || 'null') || []; }
    catch (e) { users = []; }
    if (!Array.isArray(users) || !users.length) {
      users = JSON.parse(JSON.stringify(typeof SEED_USERS !== 'undefined' ? SEED_USERS : []));
      users.forEach(function (u) { u.updated_at = u.updated_at || new Date().toISOString(); });
      persist();
    }
    return users;
  }

  function loadSession(){
    try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); }
    catch (e) { session = null; }
    if (session && !users.some(function (u) {
      return u.username === session.username && u.active !== false;
    })) session = null;
    return session;
  }

  function login(username, password){
    username = String(username || '').trim().toLowerCase();
    const u = users.find(function (x) { return String(x.username).toLowerCase() === username; });
    if (!u) return { ok: false, msg: 'આ Username મળ્યું નથી.' };
    if (u.active === false) return { ok: false, msg: 'આ user બંધ (inactive) છે. Admin નો સંપર્ક કરો.' };
    if (!verifyPassword(password, u.pass)) return { ok: false, msg: 'Password ખોટો છે.' };
    session = { username: u.username, name: u.name, role: u.role, at: new Date().toISOString() };
    localStorage.setItem(SKEY, JSON.stringify(session));
    return { ok: true, user: u, mustChange: !!u.must_change };
  }

  function logout(){ session = null; localStorage.removeItem(SKEY); }
  function current(){ return session; }
  function currentUser(){
    return session ? users.find(function (u) { return u.username === session.username; }) : null;
  }

  function can(perm){
    if (!session) return false;
    const r = ROLES[session.role];
    return !!r && r.perms.indexOf(perm) !== -1;
  }

  function upsert(u){
    u.username = String(u.username).trim().toLowerCase();
    u.updated_at = new Date().toISOString();
    const i = users.findIndex(function (x) { return x.id === u.id || x.username === u.username; });
    if (i >= 0) users[i] = Object.assign({}, users[i], u); else users.push(u);
    persist();
    return i >= 0 ? users[i] : users[users.length - 1];
  }

  function remove(id){
    const u = users.find(function (x) { return x.id === id; });
    if (!u) return false;
    const activeAdmins = users.filter(function (x) { return x.role === 'admin' && x.active !== false; });
    if (u.role === 'admin' && activeAdmins.length <= 1)
      return { err: 'ઓછામાં ઓછો એક active Admin જરૂરી છે.' };
    users = users.filter(function (x) { return x.id !== id; });
    persist();
    return true;
  }

  function setPassword(id, newPw){
    const u = users.find(function (x) { return x.id === id; });
    if (!u) return false;
    u.pass = hashPassword(newPw);
    u.must_change = false;
    u.updated_at = new Date().toISOString();
    persist();
    return true;
  }

  function all(){ return users; }
  function replaceAll(list){ users = list; persist(); }
  function newId(){
    return 'u_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
  }

  loadUsers(); loadSession();

  return { login: login, logout: logout, current: current, currentUser: currentUser,
           can: can, upsert: upsert, remove: remove, setPassword: setPassword,
           all: all, replaceAll: replaceAll, newId: newId, loadUsers: loadUsers,
           persist: persist, ROLES: ROLES };
})();
