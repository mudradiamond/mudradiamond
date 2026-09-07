/* Mudra Diamond — Party Jobwork Management (v5.0)
   Local-first data store + role-aware UI. All writes go to localStorage first
   and are queued for Supabase by sync.js, so nothing is lost without internet. */

const DBKEY = 'mudra_db_v5';
const OLDKEY = 'mudra_diamond_v2';
const $ = function (id) { return document.getElementById(id); };

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
function nowISO(){ return new Date().toISOString(); }
function cid(prefix){
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}
function money(n){ return '₹' + (Number(n) || 0).toFixed(2); }
function num(v){ return Number(v) || 0; }
function company(){ return Sync.getConfig().company || 'Mudra Diamond'; }
function whoami(){ const s = Auth.current(); return s ? s.username : 'unknown'; }

/* ---------------- store ---------------- */
let db = { entries: [], parties: [], processes: [], subprocesses: [] };

function loadDB(){
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(DBKEY) || 'null'); } catch (e) { raw = null; }
  if (raw && raw.entries) { db = raw; }
  else { db = migrateOrSeed(); saveDB(false); }
  ['entries','parties','processes','subprocesses'].forEach(function (k) {
    if (!Array.isArray(db[k])) db[k] = [];
  });
}

function migrateOrSeed(){
  let old = null;
  try { old = JSON.parse(localStorage.getItem(OLDKEY) || 'null'); } catch (e) { old = null; }
  const co = company(), t = nowISO();
  if (old && (old.entries || old.parties)) {
    return {
      entries: (old.entries || []).map(function (e) {
        return { client_id: 'e_' + String(e.id), company: co, date: e.date, jangad: e.jangad,
                 party: e.party, process: e.process, subprocess: e.subprocess,
                 pieces: num(e.pieces), pending: num(e.pending), total: num(e.total),
                 weight: num(e.weight), rate: num(e.rate), payment: num(e.payment),
                 status: e.status || 'Pending', remarks: e.remarks || '',
                 user_name: e.user_name || 'migrated', deleted: false, updated_at: t };
      }),
      parties: (old.parties || []).map(function (p) {
        return { client_id: cid('p'), company: co, name: p.name, phone: p.phone || '',
                 note: p.note || '', deleted: false, updated_at: t };
      }),
      processes: (old.processes || []).map(function (p) {
        return { client_id: cid('pr'), company: co, name: p.name, deleted: false, updated_at: t };
      }),
      subprocesses: (old.subprocesses || []).map(function (s) {
        return { client_id: cid('sp'), company: co, process: s.process, name: s.name,
                 deleted: false, updated_at: t };
      })
    };
  }
  return {
    entries: [],
    parties: [
      { client_id: cid('p'), company: co, name: 'Shree Hari Tex', phone: '', note: '', deleted: false, updated_at: t },
      { client_id: cid('p'), company: co, name: 'Jay Ambe Fab',   phone: '', note: '', deleted: false, updated_at: t },
      { client_id: cid('p'), company: co, name: 'Om Textiles',    phone: '', note: '', deleted: false, updated_at: t }
    ],
    processes: ['Cutting','Stitching','Finishing','Checking'].map(function (n) {
      return { client_id: cid('pr'), company: co, name: n, deleted: false, updated_at: t };
    }),
    subprocesses: [
      { client_id: cid('sp'), company: co, process: 'Cutting',    name: 'Final Cutting', deleted: false, updated_at: t },
      { client_id: cid('sp'), company: co, process: 'Stitching',  name: 'Overlock',      deleted: false, updated_at: t },
      { client_id: cid('sp'), company: co, process: 'Finishing',  name: 'Packing',       deleted: false, updated_at: t },
      { client_id: cid('sp'), company: co, process: 'Checking',   name: 'Quality Check', deleted: false, updated_at: t }
    ]
  };
}

function saveDB(){ localStorage.setItem(DBKEY, JSON.stringify(db)); }

/* write-through: save locally AND queue for cloud */
function commit(table, row){
  row.company = company();
  row.updated_at = nowISO();
  saveDB();
  Sync.enqueue(table, row);
}

const live = {
  entries: function () { return db.entries.filter(function (x) { return !x.deleted; }); },
  parties: function () { return db.parties.filter(function (x) { return !x.deleted; }); },
  processes: function () { return db.processes.filter(function (x) { return !x.deleted; }); },
  subprocesses: function () { return db.subprocesses.filter(function (x) { return !x.deleted; }); }
};

/* ---------------- navigation & roles ---------------- */
const NAV = [
  { id: 'dashboard',        label: 'Dashboard' },
  { id: 'entry',            label: '+ New Jangad' },
  { id: 'entries',          label: 'Jangad Ledger' },
  { id: 'parties',          label: 'Party Master' },
  { id: 'processmaster',    label: 'Process Master' },
  { id: 'subprocessmaster', label: 'Sub-process Master' },
  { id: 'payment',          label: 'Payment Ledger' },
  { id: 'reports',          label: 'Reports' },
  { id: 'users',            label: '👥 User Master' },
  { id: 'settings',         label: '⚙️ Settings' }
];

let currentPage = 'dashboard';

function allowedPages(){
  return NAV.filter(function (n) { return Auth.can(n.id); }).map(function (n) { return n.id; });
}

function buildNav(){
  const allowed = NAV.filter(function (n) { return Auth.can(n.id); });
  $('nav').innerHTML = allowed.map(function (n) {
    return '<button data-page="' + n.id + '" class="' +
           (n.id === currentPage ? 'active' : 'light') + '">' + n.label + '</button>';
  }).join('');
  Array.prototype.forEach.call($('nav').querySelectorAll('button'), function (b) {
    b.onclick = function () { page(b.dataset.page); };
  });
}

function page(id){
  if (!Auth.can(id)) { id = allowedPages()[0] || 'dashboard'; }
  currentPage = id;
  Array.prototype.forEach.call(document.querySelectorAll('.page'), function (p) {
    p.classList.remove('show');
  });
  const el = $(id);
  if (el) el.classList.add('show');
  buildNav();
  if (id === 'settings') loadCloudForm();
  if (id === 'users') renderUsers();
  refresh();
  window.scrollTo(0, 0);
}

/* hide/disable controls the current role may not use */
function applyRole(){
  const s = Auth.current();
  if (!s) return;
  $('whoName').textContent = s.name || s.username;
  const badge = $('whoRole');
  badge.textContent = (ROLES[s.role] || {}).label || s.role;
  badge.className = 'role-badge role-' + s.role;
  Array.prototype.forEach.call(document.querySelectorAll('[data-perm]'), function (el) {
    el.style.display = Auth.can(el.dataset.perm) ? '' : 'none';
  });
  buildNav();
}

/* ---------------- entry form ---------------- */
function lists(){
  const parties = live.parties(), procs = live.processes();
  const p = $('party');
  if (p) {
    const keep = p.value;
    p.innerHTML = parties.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('');
    if (keep) p.value = keep;
  }
  const ps = $('processSelect');
  if (ps) {
    const keep = ps.value;
    ps.innerHTML = procs.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('');
    if (keep) ps.value = keep;
    loadSubProcesses();
  }
  const rp = $('reportParty');
  if (rp) {
    const keep = rp.value;
    rp.innerHTML = '<option value="">All Parties</option>' +
      parties.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('');
    rp.value = keep;
  }
  const spp = $('subProcParent');
  if (spp) {
    const keep = spp.value;
    spp.innerHTML = procs.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('');
    if (keep) spp.value = keep;
  }
}

function loadSubProcesses(){
  const proc = $('processSelect') ? $('processSelect').value : '';
  const subs = live.subprocesses().filter(function (x) { return x.process === proc; });
  const el = $('subprocess');
  if (!el) return;
  el.innerHTML = '<option value="">Select Sub-process</option>' +
    subs.map(function (x) { return '<option>' + esc(x.name) + '</option>'; }).join('');
}

function autoPayment(){
  const completed = Math.max(0, num($('pieces').value) - num($('pending').value));
  $('total').value = completed;
  $('payment').value = (completed * num($('rate').value)).toFixed(2);
}

function clearForm(){
  $('jangad').value = ''; $('subprocess').value = '';
  ['pieces','pending','weight','rate','payment'].forEach(function (k) { $(k).value = 0; });
  $('remarks').value = '';
  $('editingId').value = '';
  $('entryFormTitle').textContent = 'New Jobwork / Jangad Entry';
  $('saveBtn').textContent = 'Save Jangad';
  autoPayment();
}

function save(){
  if (!Auth.can('create')) return alert('તમને entry કરવાની permission નથી.');
  autoPayment();
  const editing = $('editingId').value;
  const jangad = $('jangad').value.trim();
  if (!jangad) return alert('Jangad No. જરૂરી છે');

  const clash = live.entries().some(function (x) {
    return String(x.jangad).trim().toLowerCase() === jangad.toLowerCase() && x.client_id !== editing;
  });
  if (clash) return alert('આ Jangad Number પહેલેથી ઉપયોગમાં છે. કૃપા કરીને બીજો નંબર દાખલ કરો.');

  const row = {
    client_id: editing || cid('e'),
    company: company(),
    date: $('date').value,
    jangad: jangad,
    party: $('party').value,
    process: $('processSelect').value,
    subprocess: $('subprocess').value,
    pieces: num($('pieces').value),
    pending: num($('pending').value),
    total: num($('total').value),
    weight: num($('weight').value),
    rate: num($('rate').value),
    payment: num($('payment').value),
    status: $('status').value,
    remarks: $('remarks').value,
    user_name: whoami(),
    deleted: false
  };

  const i = db.entries.findIndex(function (x) { return x.client_id === row.client_id; });
  if (i >= 0) db.entries[i] = Object.assign({}, db.entries[i], row);
  else db.entries.unshift(row);

  commit('jobwork_entries', i >= 0 ? db.entries[i] : db.entries[0]);
  toast(editing ? 'Jangad update થઈ' : 'Jangad save થઈ');
  clearForm();
  refresh();
}

function editEntry(id){
  if (!Auth.can('edit')) return alert('તમને edit કરવાની permission નથી.');
  const e = db.entries.find(function (x) { return x.client_id === id; });
  if (!e) return;
  page('entry');
  $('editingId').value = e.client_id;
  $('date').value = e.date; $('jangad').value = e.jangad;
  $('party').value = e.party; $('processSelect').value = e.process;
  loadSubProcesses(); $('subprocess').value = e.subprocess || '';
  $('pieces').value = e.pieces; $('pending').value = e.pending;
  $('weight').value = e.weight; $('rate').value = e.rate; $('status').value = e.status;
  $('remarks').value = e.remarks || '';
  autoPayment();
  $('entryFormTitle').textContent = 'Jangad Edit — ' + e.jangad;
  $('saveBtn').textContent = 'Update Jangad';
}

function del(id){
  if (!Auth.can('delete')) return alert('તમને delete કરવાની permission નથી.');
  const e = db.entries.find(function (x) { return x.client_id === id; });
  if (!e) return;
  const msg = 'Jangad Delete Confirmation\n\nJangad No.: ' + e.jangad +
              '\nParty: ' + e.party + '\nDate: ' + e.date + '\nProcess: ' + e.process +
              '\nTotal Pieces: ' + e.total + '\nPayment: ' + money(e.payment) +
              '\n\nઆ Jangad કાયમ માટે delete કરવી છે?';
  if (!confirm(msg)) return;
  e.deleted = true;
  commit('jobwork_entries', e);
  refresh();
}

function duplicate(id){
  if (!Auth.can('create')) return alert('તમને entry કરવાની permission નથી.');
  const e = db.entries.find(function (x) { return x.client_id === id; });
  if (!e) return;
  const copy = Object.assign({}, e, {
    client_id: cid('e'), jangad: e.jangad + '-COPY',
    date: new Date().toISOString().slice(0, 10), user_name: whoami(), deleted: false
  });
  db.entries.unshift(copy);
  commit('jobwork_entries', copy);
  refresh();
}

/* ---------------- ledger / dashboard ---------------- */
function data(){
  const q = ($('q') ? $('q').value : '').toLowerCase();
  const f = $('from') ? $('from').value : '';
  const t = $('to') ? $('to').value : '';
  return live.entries().filter(function (e) {
    const hay = [e.jangad, e.party, e.process, e.subprocess].join(' ').toLowerCase();
    return (!q || hay.indexOf(q) !== -1) && (!f || e.date >= f) && (!t || e.date <= t);
  });
}

function table(rows){
  const canEdit = Auth.can('edit'), canDel = Auth.can('delete'), canNew = Auth.can('create');
  const showAction = canEdit || canDel || canNew;
  return '<div class=table><table><tr><th>Date</th><th>Jangad</th><th>Party</th><th>Process</th>' +
    '<th>Sub</th><th>Pieces</th><th>Pending</th><th>Total</th><th>Weight</th><th>Rate</th>' +
    '<th>Payment</th><th>Status</th><th>By</th>' + (showAction ? '<th>Action</th>' : '') + '</tr>' +
    rows.map(function (e) {
      let act = '';
      if (showAction) {
        act = '<td>' +
          (canEdit ? '<button class=light onclick="editEntry(\'' + e.client_id + '\')">Edit</button> ' : '') +
          (canNew ? '<button class=light onclick="duplicate(\'' + e.client_id + '\')">Copy</button> ' : '') +
          (canDel ? '<button class=danger onclick="del(\'' + e.client_id + '\')">Delete</button>' : '') +
          '</td>';
      }
      return '<tr><td>' + esc(e.date) + '</td><td>' + esc(e.jangad) + '</td><td>' + esc(e.party) +
        '</td><td>' + esc(e.process) + '</td><td>' + esc(e.subprocess) +
        '</td><td class=num>' + e.pieces + '</td><td class=num>' + e.pending +
        '</td><td class=num><b>' + e.total + '</b></td><td class=num>' + e.weight +
        '</td><td class=num>' + money(e.rate) + '</td><td class=num>' + money(e.payment) +
        '</td><td><span class=pill>' + esc(e.status) + '</span></td><td>' + esc(e.user_name || '') +
        '</td>' + act + '</tr>';
    }).join('') + '</table></div>';
}

function renderDash(d){
  d = d || live.entries();
  $('stJ').textContent = d.length;
  $('stP').textContent = d.reduce(function (a, e) { return a + num(e.pieces); }, 0);
  $('stPend').textContent = d.reduce(function (a, e) { return a + num(e.pending); }, 0);
  $('stW').textContent = d.reduce(function (a, e) { return a + num(e.weight); }, 0).toFixed(3);
  $('stA').textContent = money(d.reduce(function (a, e) { return a + num(e.rate) * num(e.total); }, 0));
  $('stDue').textContent = money(d.reduce(function (a, e) {
    return a + Math.max(0, num(e.rate) * num(e.total) - num(e.payment));
  }, 0));
  $('dashTable').innerHTML = table(d.slice(0, 8));
}

function render(){
  const d = data();
  if ($('entryTable')) $('entryTable').innerHTML = table(d);
  renderDash(d);
  renderPayments();
  renderReports();
}

/* ---------------- party master ---------------- */
function addParty(){
  if (!Auth.can('parties')) return;
  const n = $('newParty').value.trim();
  if (!n) return alert('Party name જરૂરી છે');
  if (live.parties().some(function (x) { return x.name.toLowerCase() === n.toLowerCase(); }))
    return alert('આ Party પહેલેથી છે');
  const row = { client_id: cid('p'), company: company(), name: n,
                phone: $('partyPhone').value.trim(), note: $('partyNote').value.trim(), deleted: false };
  db.parties.push(row);
  commit('parties', row);
  $('newParty').value = ''; $('partyPhone').value = ''; $('partyNote').value = '';
  refresh();
  toast('Party added');
}

function editParty(id){
  if (!Auth.can('edit')) return;
  const p = db.parties.find(function (x) { return x.client_id === id; });
  if (!p) return;
  const n = prompt('Party name', p.name);
  if (n === null || !n.trim()) return;
  const phone = prompt('Mobile', p.phone || '');
  const old = p.name;
  p.name = n.trim(); p.phone = phone || '';
  commit('parties', p);
  if (old !== p.name) {
    db.entries.forEach(function (e) {
      if (e.party === old) { e.party = p.name; commit('jobwork_entries', e); }
    });
  }
  refresh();
}

function deleteParty(id){
  if (!Auth.can('delete')) return;
  const p = db.parties.find(function (x) { return x.client_id === id; });
  if (!p) return;
  const used = live.entries().some(function (e) { return e.party === p.name; });
  const msg = used
    ? 'આ પાર્ટી સાથે entries છે. Party Masterમાંથી delete કરવાથી જૂની entries સુરક્ષિત રહેશે. Delete કરવું છે?'
    : 'આ પાર્ટી delete કરવી છે?';
  if (!confirm(msg)) return;
  p.deleted = true;
  commit('parties', p);
  refresh();
}

function renderParties(){
  if (!$('partyTable')) return;
  const canEdit = Auth.can('edit'), canDel = Auth.can('delete');
  $('partyTable').innerHTML = '<div class=table><table><tr><th>Party</th><th>Mobile</th>' +
    '<th>Entries</th><th>Total Amount</th>' + (canEdit || canDel ? '<th>Action</th>' : '') + '</tr>' +
    live.parties().map(function (p) {
      const d = live.entries().filter(function (e) { return e.party === p.name; });
      const amt = d.reduce(function (a, e) { return a + num(e.rate) * num(e.total); }, 0);
      return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.phone) + '</td><td>' + d.length +
        '</td><td>' + money(amt) + '</td>' +
        (canEdit || canDel ? '<td>' +
          (canEdit ? '<button class=light onclick="editParty(\'' + p.client_id + '\')">Edit</button> ' : '') +
          (canDel ? '<button class=danger onclick="deleteParty(\'' + p.client_id + '\')">Delete</button>' : '') +
          '</td>' : '') + '</tr>';
    }).join('') + '</table></div>';
}

/* ---------------- process master ---------------- */
function addProcess(){
  if (!Auth.can('processmaster')) return;
  const n = $('newProc').value.trim();
  if (!n) return alert('Process name જરૂરી છે');
  if (live.processes().some(function (x) { return x.name.toLowerCase() === n.toLowerCase(); }))
    return alert('આ Process પહેલેથી છે');
  const row = { client_id: cid('pr'), company: company(), name: n, deleted: false };
  db.processes.push(row);
  commit('processes', row);
  $('newProc').value = '';
  refresh();
  toast('Process added');
}

function editProcess(id){
  if (!Auth.can('edit')) return;
  const p = db.processes.find(function (x) { return x.client_id === id; });
  if (!p) return;
  const n = prompt('Process name', p.name);
  if (n === null || !n.trim()) return;
  const old = p.name;
  p.name = n.trim();
  commit('processes', p);
  if (old !== p.name) {
    db.subprocesses.forEach(function (s) {
      if (s.process === old) { s.process = p.name; commit('subprocesses', s); }
    });
    db.entries.forEach(function (e) {
      if (e.process === old) { e.process = p.name; commit('jobwork_entries', e); }
    });
  }
  refresh();
}

function deleteProcess(id){
  if (!Auth.can('delete')) return;
  const p = db.processes.find(function (x) { return x.client_id === id; });
  if (!p) return;
  const used = live.entries().some(function (e) { return e.process === p.name; });
  const msg = used
    ? 'આ Process સાથે જૂની Jangad entries છે. Process અને તેના Sub-process delete થશે, પરંતુ જૂની entries સુરક્ષિત રહેશે. Delete કરવું છે?'
    : 'આ Process અને તેના બધા Sub-process delete કરવા છે?';
  if (!confirm(msg)) return;
  p.deleted = true;
  commit('processes', p);
  db.subprocesses.forEach(function (s) {
    if (s.process === p.name && !s.deleted) { s.deleted = true; commit('subprocesses', s); }
  });
  refresh();
}

function renderProcs(){
  if (!$('procTable')) return;
  const canEdit = Auth.can('edit'), canDel = Auth.can('delete');
  $('procTable').innerHTML = '<div class=table><table><tr><th>Process</th><th>Sub-process Count</th>' +
    '<th>Entries</th><th>Total Pieces</th>' + (canEdit || canDel ? '<th>Action</th>' : '') + '</tr>' +
    live.processes().map(function (p) {
      const d = live.entries().filter(function (e) { return e.process === p.name; });
      const s = live.subprocesses().filter(function (x) { return x.process === p.name; });
      return '<tr><td>' + esc(p.name) + '</td><td>' + s.length + '</td><td>' + d.length +
        '</td><td>' + d.reduce(function (a, e) { return a + num(e.total); }, 0) + '</td>' +
        (canEdit || canDel ? '<td>' +
          (canEdit ? '<button class=light onclick="editProcess(\'' + p.client_id + '\')">Edit</button> ' : '') +
          (canDel ? '<button class=danger onclick="deleteProcess(\'' + p.client_id + '\')">🗑️ Delete</button>' : '') +
          '</td>' : '') + '</tr>';
    }).join('') + '</table></div>';
}

/* ---------------- sub-process master ---------------- */
function addSubProcess(){
  if (!Auth.can('subprocessmaster')) return;
  const proc = $('subProcParent').value, n = $('newSubMaster').value.trim();
  if (!proc) return alert('Process પસંદ કરો');
  if (!n) return alert('Sub-process name જરૂરી છે');
  if (live.subprocesses().some(function (x) {
    return x.process === proc && x.name.toLowerCase() === n.toLowerCase();
  })) return alert('આ Sub-process પહેલેથી છે');
  const row = { client_id: cid('sp'), company: company(), process: proc, name: n, deleted: false };
  db.subprocesses.push(row);
  commit('subprocesses', row);
  $('newSubMaster').value = '';
  refresh();
  toast('Sub-process added');
}

function editSubProcess(id){
  if (!Auth.can('edit')) return;
  const s = db.subprocesses.find(function (x) { return x.client_id === id; });
  if (!s) return;
  const n = prompt('Sub-process name', s.name);
  if (n === null || !n.trim()) return;
  const proc = prompt('Process', s.process);
  if (proc === null) return;
  if (!live.processes().some(function (p) { return p.name === proc.trim(); }))
    return alert('Process Masterમાં આ Process નથી');
  s.name = n.trim(); s.process = proc.trim();
  commit('subprocesses', s);
  refresh();
}

function deleteSubProcess(id){
  if (!Auth.can('delete')) return;
  const s = db.subprocesses.find(function (x) { return x.client_id === id; });
  if (!s) return;
  const used = live.entries().some(function (e) {
    return e.process === s.process && e.subprocess === s.name;
  });
  const msg = used
    ? 'આ Sub-process જૂની entriesમાં વપરાયેલ છે. Masterમાંથી delete કરશો? જૂની entries સુરક્ષિત રહેશે.'
    : 'આ Sub-process delete કરવો છે?';
  if (!confirm(msg)) return;
  s.deleted = true;
  commit('subprocesses', s);
  refresh();
}

function renderSubProcs(){
  if (!$('subProcTable')) return;
  const canEdit = Auth.can('edit'), canDel = Auth.can('delete');
  $('subProcTable').innerHTML = '<div class=table><table><tr><th>Process</th><th>Sub-process</th>' +
    '<th>Entries</th>' + (canEdit || canDel ? '<th>Action</th>' : '') + '</tr>' +
    live.subprocesses().map(function (s) {
      const d = live.entries().filter(function (e) {
        return e.process === s.process && e.subprocess === s.name;
      });
      return '<tr><td>' + esc(s.process) + '</td><td>' + esc(s.name) + '</td><td>' + d.length + '</td>' +
        (canEdit || canDel ? '<td>' +
          (canEdit ? '<button class=light onclick="editSubProcess(\'' + s.client_id + '\')">Edit</button> ' : '') +
          (canDel ? '<button class=danger onclick="deleteSubProcess(\'' + s.client_id + '\')">🗑️ Delete</button>' : '') +
          '</td>' : '') + '</tr>';
    }).join('') + '</table></div>';
}

/* ---------------- payment ledger ---------------- */
function renderPayments(){
  if (!$('paymentTable')) return;
  const q = ($('payQ') ? $('payQ').value : '').toLowerCase();
  const ents = live.entries();
  const names = Object.keys(ents.reduce(function (a, e) { a[e.party] = 1; return a; }, {}))
    .filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; });
  $('paymentTable').innerHTML = '<div class=table><table><tr><th>Party</th><th>Total Amount</th>' +
    '<th>Paid</th><th>Pending</th><th>Jangad</th></tr>' +
    names.map(function (n) {
      const d = ents.filter(function (e) { return e.party === n; });
      const a = d.reduce(function (s, e) { return s + num(e.rate) * num(e.total); }, 0);
      const p = d.reduce(function (s, e) { return s + num(e.payment); }, 0);
      return '<tr><td>' + esc(n) + '</td><td>' + money(a) + '</td><td>' + money(p) +
        '</td><td>' + money(Math.max(0, a - p)) + '</td><td>' + d.length + '</td></tr>';
    }).join('') + '</table></div>';
}

/* ---------------- reports ---------------- */
function renderReports(){
  if (!$('reportTable')) return;
  const p = $('reportParty') ? $('reportParty').value : '';
  const d = p ? live.entries().filter(function (e) { return e.party === p; }) : live.entries();
  const grouped = {};
  d.forEach(function (e) {
    const k = e.party + '||' + e.process + '||' + (e.subprocess || '');
    if (!grouped[k]) grouped[k] = { party: e.party, process: e.process,
                                    subprocess: e.subprocess || '-', rate: num(e.rate),
                                    p: 0, w: 0, a: 0, paid: 0, pending: 0 };
    const x = grouped[k];
    x.p += num(e.total); x.w += num(e.weight);
    x.a += num(e.rate) * num(e.total); x.paid += num(e.payment);
    x.pending += Math.max(0, num(e.rate) * num(e.total) - num(e.payment));
    x.rate = num(e.rate);
  });
  const rows = Object.keys(grouped).map(function (k) { return grouped[k]; });
  const gt = rows.reduce(function (t, x) {
    return { p: t.p + x.p, w: t.w + x.w, a: t.a + x.a, paid: t.paid + x.paid, pending: t.pending + x.pending };
  }, { p: 0, w: 0, a: 0, paid: 0, pending: 0 });

  $('reportTable').innerHTML = '<div class=table><table><tr><th>Party</th><th>Process</th>' +
    '<th>Sub-process</th><th>Rate / ભાવ</th><th>Total Pieces</th><th>Weight</th>' +
    '<th>Amount</th><th>Paid</th><th>Pending</th></tr>' +
    rows.map(function (x) {
      return '<tr><td>' + esc(x.party) + '</td><td>' + esc(x.process) + '</td><td>' +
        esc(x.subprocess) + '</td><td>' + money(x.rate) + '</td><td>' + x.p +
        '</td><td>' + x.w.toFixed(3) + '</td><td>' + money(x.a) + '</td><td>' +
        money(x.paid) + '</td><td>' + money(x.pending) + '</td></tr>';
    }).join('') +
    '<tr class=grand-total><td colspan=4><b>GRAND TOTAL</b></td><td><b>' + gt.p +
    '</b></td><td><b>' + gt.w.toFixed(3) + '</b></td><td><b>' + money(gt.a) +
    '</b></td><td><b>' + money(gt.paid) + '</b></td><td><b>' + money(gt.pending) +
    '</b></td></tr></table></div>';
}

function printReport(){
  const old = document.title;
  document.title = 'Mudra Diamond - Report';
  window.print();
  document.title = old;
}

function exportCSV(){
  if (!Auth.can('export')) return;
  const d = data();
  const head = ['Date','Jangad','Party','Process','Sub-process','Pieces','Pending','Total',
                'Weight','Rate','Amount','Payment','Status','Entered By'];
  const rows = d.map(function (e) {
    return [e.date, e.jangad, e.party, e.process, e.subprocess, e.pieces, e.pending, e.total,
            e.weight, e.rate, num(e.rate) * num(e.total), e.payment, e.status, e.user_name || ''];
  });
  const csv = '﻿' + [head].concat(rows).map(function (r) {
    return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'Mudra_Diamond_Jobwork_Report.csv';
  a.click();
}

/* ---------------- user master (admin only) ---------------- */
function renderUsers(){
  if (!Auth.can('manageUsers') || !$('userTable')) return;
  const me = Auth.current();
  $('userTable').innerHTML = '<div class=table><table><tr><th>Username</th><th>Name</th>' +
    '<th>Role</th><th>Status</th><th>Action</th></tr>' +
    Auth.all().map(function (u) {
      const r = ROLES[u.role] || { label: u.role };
      return '<tr><td><b>' + esc(u.username) + '</b>' +
        (u.username === me.username ? ' <span class=pill>તમે</span>' : '') +
        '</td><td>' + esc(u.name) + '</td>' +
        '<td><span class="role-badge role-' + esc(u.role) + '">' + esc(r.label) + '</span></td>' +
        '<td>' + (u.active === false ? '<span class=pill>Inactive</span>' : '<span class=pill>Active</span>') + '</td>' +
        '<td><button class=light onclick="userEdit(\'' + u.id + '\')">Edit</button> ' +
        '<button class=light onclick="userPassword(\'' + u.id + '\')">🔑 Password</button> ' +
        '<button class=danger onclick="userDelete(\'' + u.id + '\')">Delete</button></td></tr>';
    }).join('') + '</table></div>';

  $('roleHelp').innerHTML = Object.keys(ROLES).map(function (k) {
    return '<p class=note><span class="role-badge role-' + k + '">' + ROLES[k].label +
           '</span> ' + esc(ROLES[k].desc) + '</p>';
  }).join('');

  const sel = $('uRole');
  if (sel && !sel.options.length) {
    sel.innerHTML = Object.keys(ROLES).map(function (k) {
      return '<option value="' + k + '">' + ROLES[k].label + ' — ' + ROLES[k].gu + '</option>';
    }).join('');
  }
}

function userSave(){
  if (!Auth.can('manageUsers')) return;
  const id = $('uEditId').value;
  const username = $('uName').value.trim().toLowerCase();
  const name = $('uFull').value.trim();
  const role = $('uRole').value;
  const pw = $('uPass').value;

  if (!username) return alert('Username જરૂરી છે');
  if (!/^[a-z0-9._-]{3,20}$/.test(username))
    return alert('Username 3-20 અક્ષર, ફક્ત a-z 0-9 . _ - વાપરો');
  if (!name) return alert('પૂરું નામ જરૂરી છે');
  const dup = Auth.all().some(function (u) { return u.username === username && u.id !== id; });
  if (dup) return alert('આ Username પહેલેથી છે');
  if (!id && pw.length < 6) return alert('Password ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ');

  const rec = { id: id || Auth.newId(), username: username, name: name, role: role,
                active: $('uActive').value === '1' };
  if (pw) { rec.pass = hashPassword(pw); rec.must_change = false; }
  const saved = Auth.upsert(rec);
  pushUser(saved);
  $('uEditId').value = ''; $('uName').value = ''; $('uFull').value = ''; $('uPass').value = '';
  $('uActive').value = '1'; $('userSaveBtn').textContent = '＋ Add User';
  renderUsers();
  toast(id ? 'User update થયો' : 'User add થયો');
}

function userEdit(id){
  const u = Auth.all().find(function (x) { return x.id === id; });
  if (!u) return;
  $('uEditId').value = u.id; $('uName').value = u.username; $('uFull').value = u.name;
  $('uRole').value = u.role; $('uActive').value = u.active === false ? '0' : '1';
  $('uPass').value = '';
  $('userSaveBtn').textContent = 'Update User';
  window.scrollTo(0, 0);
}

function userPassword(id){
  const u = Auth.all().find(function (x) { return x.id === id; });
  if (!u) return;
  const pw = prompt('“' + u.username + '” માટે નવો password (ઓછામાં ઓછા 6 અક્ષર):');
  if (pw === null) return;
  if (pw.length < 6) return alert('Password ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ');
  Auth.setPassword(u.id, pw);
  pushUser(Auth.all().find(function (x) { return x.id === id; }));
  alert('Password બદલાઈ ગયો.\n\nUsername: ' + u.username + '\nNew password: ' + pw +
        '\n\nઆ password user ને જણાવો.');
}

function userDelete(id){
  const u = Auth.all().find(function (x) { return x.id === id; });
  if (!u) return;
  if (u.username === Auth.current().username) return alert('તમે તમારો પોતાનો account delete ન કરી શકો.');
  if (!confirm('User “' + u.username + '” delete કરવો છે?')) return;
  const res = Auth.remove(id);
  if (res && res.err) return alert(res.err);
  const ghost = Object.assign({}, u, { deleted: true });
  pushUser(ghost);
  renderUsers();
}

function pushUser(u){
  if (!u) return;
  Sync.enqueue('app_users', {
    client_id: u.id, company: company(), username: u.username, name: u.name,
    role: u.role, pass: u.pass, active: u.active !== false,
    must_change: !!u.must_change, deleted: !!u.deleted, updated_at: nowISO()
  });
}

/* ---------------- change own password ---------------- */
function openChangePw(force){
  $('cpOld').value = ''; $('cpNew').value = ''; $('cpNew2').value = '';
  $('cpForce').style.display = force ? 'block' : 'none';
  $('cpCancel').style.display = force ? 'none' : '';
  $('pwModal').classList.add('show');
}
function closeChangePw(){ $('pwModal').classList.remove('show'); }
function submitChangePw(){
  const u = Auth.currentUser();
  if (!u) return;
  if (!verifyPassword($('cpOld').value, u.pass)) return alert('જૂનો password ખોટો છે.');
  const n = $('cpNew').value;
  if (n.length < 6) return alert('નવો password ઓછામાં ઓછો 6 અક્ષરનો હોવો જોઈએ');
  if (n !== $('cpNew2').value) return alert('બંને નવા password સરખા નથી.');
  Auth.setPassword(u.id, n);
  pushUser(Auth.all().find(function (x) { return x.id === u.id; }));
  closeChangePw();
  alert('Password બદલાઈ ગયો.');
}

/* ---------------- cloud settings ---------------- */
function loadCloudForm(){
  const c = Sync.getConfig();
  if ($('sbUrl')) { $('sbUrl').value = c.url; $('sbKey').value = c.key; $('companyName').value = c.company; }
  renderSyncDetail();
}

async function saveCloudConfig(){
  if (!Auth.can('cloud')) return;
  Sync.setConfig({ url: $('sbUrl').value, key: $('sbKey').value, company: $('companyName').value });
  setSync('Testing connection...');
  const t = await Sync.testConnection();
  if (!t.ok) { setSync('❌ ' + t.msg); return; }
  setSync('✅ ' + t.msg + ' હવે Sync Now દબાવો.');
  renderSyncDetail();
}

async function manualSync(){
  setSync('Sync ચાલુ છે...');
  const r = await Sync.syncNow();
  if (r.pull.ok) setSync('✅ Sync પૂરો. Pending upload: ' + Sync.queueSize());
  else setSync('⚠️ ' + (r.pull.msg || r.pull.reason || 'Sync નિષ્ફળ') + ' — તમારો data સુરક્ષિત છે, પછી ફરી try થશે.');
  refresh();
  renderSyncDetail();
}

function disconnectCloud(){
  if (!confirm('Cloud disconnect કરવું છે? Local data deviceમાં રહેશે.')) return;
  Sync.disconnect();
  loadCloudForm();
  setSync('Cloud disconnected. Local data હજુ deviceમાં સુરક્ષિત છે.');
}

function setSync(msg){ if ($('syncStatus')) $('syncStatus').textContent = msg; }

function renderSyncDetail(){
  if (!$('syncDetail')) return;
  const s = Sync.status();
  $('syncDetail').innerHTML =
    '<p class=note>Cloud: <b>' + (s.configured ? 'Connected' : 'Not configured (local only)') + '</b></p>' +
    '<p class=note>Device: <b>' + (s.online ? 'Online' : 'Offline') + '</b></p>' +
    '<p class=note>Upload બાકી: <b>' + s.pending + '</b> change</p>' +
    '<p class=note>છેલ્લો Sync: <b>' + (s.lastPull ? new Date(s.lastPull).toLocaleString() : '—') + '</b></p>' +
    (s.error ? '<p class=note style="color:#9d2820">છેલ્લી ભૂલ: ' + esc(s.error) + '</p>' : '');
}

/* ---------------- sync status pill + merge ---------------- */
function paintSyncPill(s){
  const el = $('syncPill');
  if (!el) return;
  let cls = 'local', txt = '⚪ Local only';
  if (!s.configured) { cls = 'local'; txt = '⚪ Local only'; }
  else if (!s.online) { cls = 'off'; txt = '🔴 Offline — ' + s.pending + ' બાકી'; }
  else if (s.state === 'syncing') { cls = 'pending'; txt = '🔄 Sync…'; }
  else if (s.pending) { cls = 'pending'; txt = '🟡 ' + s.pending + ' બાકી'; }
  else if (s.state === 'error') { cls = 'off'; txt = '⚠️ Sync error'; }
  else { cls = 'ok'; txt = '🟢 Synced'; }
  el.className = cls;
  el.textContent = txt;
  renderSyncDetail();
}

function mergeRows(localArr, remoteRows){
  const byId = {};
  localArr.forEach(function (r) { byId[r.client_id] = r; });
  (remoteRows || []).forEach(function (rr) {
    if (!rr.client_id) return;
    const l = byId[rr.client_id];
    if (!l || String(rr.updated_at || '') > String(l.updated_at || '')) byId[rr.client_id] = rr;
  });
  return Object.keys(byId).map(function (k) { return byId[k]; });
}

function applyPull(result){
  db.entries      = mergeRows(db.entries,      result.jobwork_entries);
  db.parties      = mergeRows(db.parties,      result.parties);
  db.processes    = mergeRows(db.processes,    result.processes);
  db.subprocesses = mergeRows(db.subprocesses, result.subprocesses);
  saveDB();

  if (result.app_users && result.app_users.length) {
    const localUsers = Auth.all().map(function (u) {
      return Object.assign({}, u, { client_id: u.id });
    });
    const merged = mergeRows(localUsers, result.app_users)
      .filter(function (u) { return !u.deleted; })
      .map(function (u) {
        return { id: u.client_id, username: u.username, name: u.name, role: u.role,
                 pass: u.pass, active: u.active !== false, must_change: !!u.must_change,
                 updated_at: u.updated_at };
      });
    if (merged.some(function (u) { return u.role === 'admin' && u.active !== false; }))
      Auth.replaceAll(merged);
  }
  refresh();
}

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg){
  let el = $('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:#111;color:#fff;padding:11px 18px;border-radius:24px;font-weight:700;' +
      'font-size:13px;z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.3)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.style.display = 'none'; }, 2200);
}

/* ---------------- refresh ---------------- */
function refresh(){
  lists();
  render();
  renderParties();
  renderProcs();
  renderSubProcs();
}

/* ---------------- login screen ---------------- */
function showLogin(){
  $('loginScreen').classList.remove('hide');
  $('app').style.display = 'none';
  $('liUser').value = '';
  $('liPass').value = '';
  setTimeout(function () { $('liUser').focus(); }, 100);
}

function doLogin(){
  const err = $('loginErr');
  const btn = $('liBtn');
  btn.disabled = true;
  btn.textContent = 'ચેક થઈ રહ્યું છે...';
  setTimeout(function () {
    const r = Auth.login($('liUser').value, $('liPass').value);
    btn.disabled = false;
    btn.textContent = 'Login';
    if (!r.ok) {
      err.textContent = r.msg;
      err.classList.add('show');
      $('liPass').value = '';
      $('liPass').focus();
      return;
    }
    err.classList.remove('show');
    startApp(r.mustChange);
  }, 30);
}

function doLogout(){
  if (!confirm('Logout કરવું છે?')) return;
  Auth.logout();
  showLogin();
}

function startApp(mustChange){
  $('loginScreen').classList.add('hide');
  $('app').style.display = '';
  applyRole();
  loadDB();
  page(allowedPages()[0] || 'dashboard');
  if (mustChange) {
    setTimeout(function () { openChangePw(true); }, 400);
  }
}

/* ---------------- boot ---------------- */
function boot(){
  Sync.onPull(applyPull);
  Sync.onStatus(paintSyncPill);
  Sync.start();

  $('date').value = new Date().toISOString().slice(0, 10);

  ['pieces','pending','rate'].forEach(function (k) {
    $(k).addEventListener('input', autoPayment);
    $(k).addEventListener('change', autoPayment);
  });
  $('processSelect').addEventListener('change', loadSubProcesses);

  $('liBtn').onclick = doLogin;
  $('liPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  $('liUser').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('liPass').focus(); });
  $('showPw').onclick = function () {
    const p = $('liPass');
    p.type = p.type === 'password' ? 'text' : 'password';
    $('showPw').textContent = p.type === 'password' ? '👁' : '🙈';
  };
  $('syncPill').onclick = manualSync;

  // Enter key moves through the entry form
  const order = ['date','jangad','party','processSelect','subprocess','pieces','pending',
                 'weight','rate','status','remarks'];
  order.forEach(function (id, i) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i === order.length - 1) { save(); return; }
      const nx = $(order[i + 1]);
      if (nx) { nx.focus(); if (nx.select && nx.tagName === 'INPUT' && nx.type !== 'date') nx.select(); }
    });
  });

  if (Auth.current()) startApp(false); else showLogin();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
