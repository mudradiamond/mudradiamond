/* Mudra Diamond — Offline-first cloud sync (v5.0)

   Guarantee: a save NEVER depends on the network.
     1. Every change is written to localStorage first (instant, always succeeds).
     2. The same change is appended to a durable write-queue in localStorage.
     3. The queue is flushed to Supabase whenever the device is online.
     4. The queue survives app close, phone restart and failed uploads.
   So if the internet is down, nothing is lost — it uploads by itself later. */

const Sync = (function () {
  const CKEY = 'mudra_cloud_v2';
  const QKEY = 'mudra_queue_v1';
  const MKEY = 'mudra_lastpull_v1';

  const TABLES = ['jobwork_entries', 'parties', 'processes', 'subprocesses', 'app_users'];

  let cfg = { url: '', key: '', company: 'Mudra Diamond' };
  let queue = [];
  let state = 'local';          // local | syncing | ok | pending | off | error
  let lastError = '';
  let lastPull = '';
  let listeners = [];
  let pullHandler = null;
  let timer = null;

  /* ---------------- persistence ---------------- */
  function loadCfg(){
    // A deployment can ship its own connection so nobody has to type one in.
    // Anything the user saved on this device still wins over the default.
    if (typeof CLOUD_DEFAULTS !== 'undefined' && CLOUD_DEFAULTS.url && CLOUD_DEFAULTS.key) {
      cfg.url = String(CLOUD_DEFAULTS.url).replace(/\/+$/, '');
      cfg.key = CLOUD_DEFAULTS.key;
      cfg.company = CLOUD_DEFAULTS.company || cfg.company;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(CKEY) || '{}');
      if (saved.disconnected) { cfg.url = ''; cfg.key = ''; }
      else if (saved.url && saved.key) cfg = Object.assign(cfg, saved);
      if (saved.company) cfg.company = saved.company;
    } catch (e) { /* keep defaults */ }
    try { queue = JSON.parse(localStorage.getItem(QKEY) || '[]') || []; }
    catch (e) { queue = []; }
    lastPull = localStorage.getItem(MKEY) || '';
  }
  function saveCfg(){ localStorage.setItem(CKEY, JSON.stringify(cfg)); }
  function saveQueue(){ localStorage.setItem(QKEY, JSON.stringify(queue)); }

  function configured(){ return !!(cfg.url && cfg.key); }
  function getConfig(){ return Object.assign({}, cfg); }
  function setConfig(next){
    cfg.url = String(next.url || '').trim().replace(/\/+$/, '');
    cfg.key = String(next.key || '').trim();
    cfg.company = String(next.company || '').trim() || 'Mudra Diamond';
    cfg.disconnected = false;
    saveCfg();
    setState(configured() ? 'pending' : 'local');
  }
  // Sticky: without the flag a deployment default would silently reconnect
  // this device on the next reload.
  function disconnect(){
    cfg = { url: '', key: '', company: cfg.company, disconnected: true };
    saveCfg();
    setState('local');
  }

  /* ---------------- status ---------------- */
  function setState(s, err){
    state = s;
    lastError = err || '';
    listeners.forEach(function (fn) { try { fn(status()); } catch (e) {} });
  }
  function status(){
    return {
      state: state,
      pending: queue.length,
      configured: configured(),
      online: navigator.onLine !== false,
      lastPull: lastPull,
      error: lastError,
      company: cfg.company
    };
  }
  function onStatus(fn){ listeners.push(fn); fn(status()); }
  function onPull(fn){ pullHandler = fn; }

  /* ---------------- queue ---------------- */
  function enqueue(table, row){
    if (TABLES.indexOf(table) === -1) return;
    // collapse: one pending write per (table, client_id) — the newest wins
    queue = queue.filter(function (q) {
      return !(q.table === table && q.row.client_id === row.client_id);
    });
    queue.push({
      qid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      table: table, row: row, ts: new Date().toISOString(), tries: 0
    });
    saveQueue();
    setState(configured() ? 'pending' : 'local');
    scheduleFlush(1200);
  }
  function queueSize(){ return queue.length; }
  function pendingRows(){ return queue.slice(); }
  function clearQueue(){ queue = []; saveQueue(); setState(configured() ? 'ok' : 'local'); }

  /* ---------------- REST ---------------- */
  function headers(extra){
    return Object.assign({
      apikey: cfg.key,
      Authorization: 'Bearer ' + cfg.key,
      'Content-Type': 'application/json'
    }, extra || {});
  }

  async function testConnection(){
    if (!configured()) return { ok: false, msg: 'Supabase URL અને anon key બંને જરૂરી છે.' };
    try {
      const r = await fetch(cfg.url + '/rest/v1/jobwork_entries?select=client_id&limit=1',
                            { headers: headers() });
      if (!r.ok) return { ok: false, msg: 'HTTP ' + r.status + ' — ' + (await r.text()).slice(0, 200) };
      return { ok: true, msg: 'Connection સફળ.' };
    } catch (e) {
      return { ok: false, msg: 'Network error: ' + e.message };
    }
  }

  async function flush(){
    if (!configured()) { setState('local'); return { ok: false, reason: 'not-configured' }; }
    if (navigator.onLine === false) { setState('off'); return { ok: false, reason: 'offline' }; }
    if (!queue.length) { setState('ok'); return { ok: true, sent: 0 }; }

    setState('syncing');
    // group by table so each table uploads in one request
    const byTable = {};
    queue.forEach(function (q) { (byTable[q.table] = byTable[q.table] || []).push(q); });

    let sent = 0, failed = false;
    for (const table of Object.keys(byTable)) {
      const items = byTable[table];
      const rows = items.map(function (q) { return q.row; });
      try {
        const r = await fetch(cfg.url + '/rest/v1/' + table + '?on_conflict=client_id', {
          method: 'POST',
          headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(rows)
        });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
        const ids = {};
        items.forEach(function (q) { ids[q.qid] = 1; });
        queue = queue.filter(function (q) { return !ids[q.qid]; });
        sent += rows.length;
        saveQueue();
      } catch (e) {
        failed = true;
        items.forEach(function (q) { q.tries = (q.tries || 0) + 1; });
        saveQueue();
        setState('pending', e.message);
      }
    }
    if (!failed) setState(queue.length ? 'pending' : 'ok');
    return { ok: !failed, sent: sent, pending: queue.length };
  }

  async function pull(){
    if (!configured()) return { ok: false, reason: 'not-configured' };
    if (navigator.onLine === false) { setState('off'); return { ok: false, reason: 'offline' }; }
    try {
      setState('syncing');
      const company = encodeURIComponent(cfg.company);
      const result = {};
      for (const table of TABLES) {
        const r = await fetch(
          cfg.url + '/rest/v1/' + table + '?select=*&company=eq.' + company,
          { headers: headers() });
        if (!r.ok) throw new Error(table + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
        result[table] = await r.json();
      }
      lastPull = new Date().toISOString();
      localStorage.setItem(MKEY, lastPull);
      if (pullHandler) pullHandler(result);
      setState(queue.length ? 'pending' : 'ok');
      return { ok: true, data: result };
    } catch (e) {
      setState('error', e.message);
      return { ok: false, msg: e.message };
    }
  }

  /* pull first, then push local pending changes on top */
  async function syncNow(){
    const p = await pull();
    const f = await flush();
    return { pull: p, flush: f };
  }

  /* ---------------- scheduling ---------------- */
  function scheduleFlush(delay){
    clearTimeout(timer);
    timer = setTimeout(function () { flush(); }, delay || 1500);
  }

  function start(){
    loadCfg();
    setState(configured() ? (navigator.onLine === false ? 'off' : 'pending') : 'local');

    window.addEventListener('online', function () { setState('pending'); syncNow(); });
    window.addEventListener('offline', function () { setState('off'); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && configured()) flush();
    });
    // periodic: push queued writes often, pull fresh data less often
    setInterval(function () { if (configured() && queue.length) flush(); }, 30000);
    setInterval(function () { if (configured() && !document.hidden) pull(); }, 120000);

    if (configured()) setTimeout(syncNow, 800);
  }

  return {
    start: start, getConfig: getConfig, setConfig: setConfig, disconnect: disconnect,
    configured: configured, testConnection: testConnection,
    enqueue: enqueue, flush: flush, pull: pull, syncNow: syncNow,
    status: status, onStatus: onStatus, onPull: onPull,
    queueSize: queueSize, pendingRows: pendingRows, clearQueue: clearQueue,
    TABLES: TABLES
  };
})();
