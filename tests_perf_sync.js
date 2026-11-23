/**
 * tests_perf_sync.js - Performance, Delta Sync, CacheService & Integrity Test Suite (v2.8.0)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */
(function () {
  'use strict';
  const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
  const Logic = require('./logic.js');
  const readF = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');

  const results = [], asyncTests = [];
  let passed = 0, failed = 0;
  const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'Assertion failed'); };
  const assertEq = (a, e, msg) => { if (a !== e) throw new Error(`${msg || 'assertEq'}: expected [${e}] got [${a}]`); };
  const test = (suite, name, fn) => { try { fn(); passed++; results.push({ suite, name, ok: true }); } catch (e) { failed++; results.push({ suite, name, ok: false, err: e.message }); } };
  const testAsync = (suite, name, fn) => {
    asyncTests.push(Promise.resolve().then(fn).then(
      () => { passed++; results.push({ suite, name, ok: true }); },
      e => { failed++; results.push({ suite, name, ok: false, err: e.message }); }
    ));
  };

  // --- Shared GAS Realistic Multi-Request Simulator ---
  const codeGsSrc = readF('gas', 'Code.gs');
  function createGasEnv() {
    const sheets = {}, cacheStore = new Map(), propStore = { API_PASSCODE: '' }, fetchCalls = [];
    const metrics = { sheetReads: 0, sheetWrites: 0, cacheGets: 0, cachePuts: 0, cacheGetAlls: 0, cachePutAlls: 0, cacheRemoves: 0, propGets: 0, propSets: 0 };
    let onBeforeRead = null;

    const resetMetrics = () => Object.keys(metrics).forEach(k => { metrics[k] = 0; });
    const ensureRows = name => (sheets[name] || (sheets[name] = []));

    const makeRange = (name, r0, c0, nr, nc) => ({
      setNumberFormat() { return this; },
      setFontWeight() { return this; },
      setValue(v) {
        metrics.sheetWrites++;
        const rows = ensureRows(name);
        while (rows.length <= r0) rows.push([]);
        while (rows[r0].length <= c0) rows[r0].push('');
        rows[r0][c0] = String(v == null ? '' : v);
        return this;
      },
      setValues(vals) {
        metrics.sheetWrites++;
        const rows = ensureRows(name);
        for (let r = 0; r < vals.length; r++) {
          while (rows.length <= r0 + r) rows.push([]);
          for (let c = 0; c < vals[r].length; c++) {
            while (rows[r0 + r].length <= c0 + c) rows[r0 + r].push('');
            rows[r0 + r][c0 + c] = String(vals[r][c] == null ? '' : vals[r][c]);
          }
        }
        return this;
      },
      getDisplayValues() {
        metrics.sheetReads++;
        if (onBeforeRead) onBeforeRead(name);
        const rows = ensureRows(name), out = [];
        for (let r = r0; r < r0 + nr; r++) {
          const src = rows[r] || [], row = [];
          for (let c = c0; c < c0 + nc; c++) row.push(String(src[c] == null ? '' : src[c]));
          out.push(row);
        }
        return out;
      }
    });

    const makeSheet = name => ({
      getName: () => name,
      getLastRow: () => ensureRows(name).length,
      getLastColumn: () => ensureRows(name).reduce((m, r) => Math.max(m, r.length), 0),
      getMaxRows: () => Math.max(ensureRows(name).length, 500),
      setFrozenRows() {},
      appendRow(arr) {
        metrics.sheetWrites++;
        ensureRows(name).push(arr.map(x => String(x == null ? '' : x)));
      },
      deleteRow(rowNum) {
        metrics.sheetWrites++;
        const rows = ensureRows(name);
        if (rowNum >= 1 && rowNum <= rows.length) rows.splice(rowNum - 1, 1);
      },
      getDataRange() {
        const rows = ensureRows(name), nr = Math.max(rows.length, 1), nc = Math.max(rows.reduce((m, r) => Math.max(m, r.length), 0), 1);
        return makeRange(name, 0, 0, nr, nc);
      },
      getRange(r, c, nr, nc) { return makeRange(name, r - 1, c - 1, nr || 1, nc || 1); }
    });

    const checkCacheBytes = (k, v) => {
      if (Buffer.byteLength(String(v), 'utf8') > 100000) throw new Error(`Argument too large: value for ${k}`);
    };

    const scriptCache = {
      get(k) { metrics.cacheGets++; return cacheStore.has(k) ? cacheStore.get(k) : null; },
      put(k, v) { metrics.cachePuts++; checkCacheBytes(k, v); cacheStore.set(k, String(v)); },
      getAll(keys) { metrics.cacheGetAlls++; const o = {}; keys.forEach(k => { if (cacheStore.has(k)) o[k] = cacheStore.get(k); }); return o; },
      putAll(obj) { metrics.cachePutAlls++; Object.keys(obj).forEach(k => { checkCacheBytes(k, obj[k]); cacheStore.set(k, String(obj[k])); }); },
      remove(k) { metrics.cacheRemoves++; cacheStore.delete(k); }
    };

    const scriptProps = {
      getProperty: k => { metrics.propGets++; return propStore[k] || null; },
      getProperties: () => { metrics.propGets++; return { ...propStore }; },
      setProperty: (k, v) => { metrics.propSets++; propStore[k] = String(v); },
      deleteProperty: k => { metrics.propSets++; delete propStore[k]; }
    };

    const newCtx = () => {
      const sb = {
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] ? makeSheet(n) : null, insertSheet: n => { sheets[n] = []; return makeSheet(n); } }) },
        CacheService: { getScriptCache: () => scriptCache },
        PropertiesService: { getScriptProperties: () => scriptProps },
        LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
        Utilities: {
          DigestAlgorithm: { SHA_256: 'SHA-256' }, Charset: { UTF_8: 'utf8' },
          computeDigest: (_, s) => Array.from(crypto.createHash('sha256').update(String(s), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
          getUuid: () => 'uuid-' + Math.random().toString(36).slice(2)
        },
        ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: t => ({ _text: t, setMimeType() { return this; } }) },
        UrlFetchApp: { fetch: (u, o) => { fetchCalls.push({ url: u, payload: o && o.payload ? JSON.parse(o.payload) : null }); return { getResponseCode: () => 200, getContentText: () => '{}' }; }, fetchAll: reqs => reqs.map(() => ({ getResponseCode: () => 200, getContentText: () => '{}' })) },
        ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => ({ getUniqueId: () => 't1' }) }) }), everyHours: () => ({ create: () => ({ getUniqueId: () => 't2' }) }), at: () => ({ create: () => ({ getUniqueId: () => 't3' }) }) }) }), deleteTrigger() {} },
        Session: { getScriptTimeZone: () => 'Asia/Bangkok' }
      };
      vm.runInNewContext(codeGsSrc, sb);
      return sb;
    };

    const callPost = (bodyObj, params = {}) => {
      const sb = newCtx();
      const res = sb.doPost({ postData: { contents: JSON.stringify(bodyObj) }, parameter: params });
      return JSON.parse(res._text);
    };

    // Bootstrap sheets
    newCtx().setupDatabase();
    resetMetrics();
    return { sheets, cacheStore, propStore, fetchCalls, metrics, resetMetrics, newCtx, callPost, setOnBeforeRead: fn => { onBeforeRead = fn; } };
  }

  // --- Suite A: GAS Delta Sync, CacheService & Batch I/O ---
  test('A1. GAS Sync & Cache', 'Cold list อ่านชีตด้วย 1 RPC/ชีต, เติม CacheService และคืน rev', () => {
    const env = createGasEnv();
    const r = env.callPost({ action: 'list' });
    assert(r.ok && r.data.rev && Array.isArray(r.data.appointments), 'list ต้องคืน bundle พร้อม rev');
    assert(env.metrics.sheetReads === 4, `Cold list ควรอ่านแค่ 4 ชีต (1 RPC/ชีต) แต่ได้ ${env.metrics.sheetReads}`);
    assert(env.metrics.cacheGetAlls === 1 && env.metrics.cacheGets <= 4, `prewarmSc_ ต้องไม่ยิง c.get ซ้ำเมื่อ cache miss (getAll=${env.metrics.cacheGetAlls}, get=${env.metrics.cacheGets})`);
    assert(env.cacheStore.has('CAL_M') && env.cacheStore.has('CAL_U') && env.cacheStore.has('CAL_A'), 'ต้องเติม CacheService');
  });

  test('A2. GAS Sync & Cache', 'Conditional list พร้อม sinceRev ที่ตรงกัน -> ตอบ unchanged ด้วย 0 Sheet reads', () => {
    const env = createGasEnv();
    const first = env.callPost({ action: 'list' });
    env.resetMetrics();
    const second = env.callPost({ action: 'list', sinceRev: first.data.rev });
    assert(second.ok && second.data.unchanged === true && second.data.rev === first.data.rev, 'ต้องคืน unchanged: true');
    assertEq(env.metrics.sheetReads, 0, 'Conditional sync ที่ rev ตรงต้องอ่านชีต 0 ครั้ง');
  });

  test('A3. GAS Sync & Cache', 'Warm Cache list (เครื่องที่ 2 ไม่มี sinceRev) -> ได้ข้อมูลครบด้วย 0 Sheet reads', () => {
    const env = createGasEnv();
    env.callPost({ action: 'create', payload: { title: 'นัดเครื่องแรก', appointmentDate: '2026-12-01', appointmentTime: '10:00', location: 'ห้อง A', contactPerson: 'คุณ ก' }, notifyLine: false });
    const list1 = env.callPost({ action: 'list' });
    assertEq(list1.data.appointments.length, 1, 'เครื่องที่ 1 ต้องเห็น 1 งาน');
    env.resetMetrics();
    const list2 = env.callPost({ action: 'list' });
    assert(list2.ok && list2.data.appointments.length === 1 && list2.data.rev === list1.data.rev, 'เครื่องที่ 2 ต้องได้ข้อมูลครบ');
    assertEq(env.metrics.sheetReads, 0, 'Warm Cache list ต้องอ่านชีต 0 ครั้ง');
  });

  test('A4. GAS Sync & Cache', 'Forced list (force: true) ต้องทะลุ CacheService อ่านชีตสดเสมอ', () => {
    const env = createGasEnv();
    const r1 = env.callPost({ action: 'list' });
    env.resetMetrics();
    const r2 = env.callPost({ action: 'list', sinceRev: r1.data.rev, force: true });
    assert(r2.ok && !r2.data.unchanged && Array.isArray(r2.data.appointments), 'force: true ต้องไม่ตอบ unchanged');
    assert(env.metrics.sheetReads === 4, `force: true ต้องอ่านชีตใหม่ทั้ง 4 ชีต (ได้ ${env.metrics.sheetReads})`);
  });

  test('A5. GAS Sync & Cache', 'ทุก Mutation (create/update/delete/saveUser/updateMeta) ต้องขยับ rev และคืน prevRev ถูกต้อง', () => {
    const env = createGasEnv();
    const l0 = env.callPost({ action: 'list' }).data.rev;
    const c = env.callPost({ action: 'create', payload: { title: 'งาน 1', appointmentDate: '2026-12-02', appointmentTime: '09:00', location: 'B', contactPerson: 'ค' }, notifyLine: false }).data;
    assert(c.prevRev === l0 && c.rev && c.rev !== l0, 'create ต้องคืน prevRev เดิมและ rev ใหม่');
    const u = env.callPost({ action: 'update', id: c.appointment.id, payload: { location: 'ห้อง C' }, notifyLine: false }).data;
    assert(u.prevRev === c.rev && u.rev !== c.rev, 'update ต้องขยับ rev ต่อเนื่อง');
    const m = env.callPost({ action: 'updateMeta', meta: { DAILY_DIGEST_HOUR: '9' } }).data;
    assert(m.prevRev === u.rev && m.rev !== u.rev, 'updateMeta ต้องขยับ rev');
    const su = env.callPost({ action: 'saveUser', userPayload: { isNew: true, username: 'new01', displayName: 'คุณใหม่', password: '1234', role: 'STAFF' } }).data;
    assert(su.prevRev === m.rev && su.rev !== m.rev, 'saveUser ต้องขยับ rev');
    env.callPost({ action: 'list' }); // warm all 4 caches (CAL_A, CAL_U, CAL_M, CAL_L)
    const del = env.callPost({ action: 'delete', id: c.appointment.id, updatedBy: 'admin' }).data;
    assert(del.prevRev === su.rev && del.rev !== su.rev, 'delete ต้องขยับ rev');
    // Scope isolation: after delete ('apts','relogs'), CAL_M and CAL_U must still hit CacheService!
    env.resetMetrics();
    env.callPost({ action: 'list' });
    assertEq(env.metrics.sheetReads, 2, 'หลังแก้ Appointments ควรอ่านซ้ำเฉพาะ Appointments+RescheduleLogs (CAL_M/CAL_U ยังอุ่น)');
  });

  test('A6. GAS Sync & Cache', 'omitImgEcho: true ต้องละ imageUrl ใน response แต่ยังคงบันทึกรูปลง Google Sheets ครบถ้วน', () => {
    const env = createGasEnv();
    const img = 'data:image/jpeg;base64,' + 'A'.repeat(2500);
    const c = env.callPost({ action: 'create', omitImgEcho: true, notifyLine: false, payload: { title: 'งานมีรูป', appointmentDate: '2026-12-05', appointmentTime: '11:00', location: 'ห้อง 1', contactPerson: 'คุณ ก', imageUrl: img } });
    assert(c.ok && c.data.appointment._imgOmitted === true && c.data.appointment.imageUrl === '', 'Response ต้องตัด imageUrl และติดธง _imgOmitted');
    const fetched = env.callPost({ action: 'list', force: true });
    assertEq(fetched.data.appointments[0].imageUrl, img, 'ข้อมูลใน Google Sheets ต้องยังมี imageUrl ครบถ้วน');
  });

  test('A7. GAS Sync & Cache', 'CacheService Chunking (> 95 KB) แบ่งเก็บหลายก้อนและรวมกลับ 100% รวมถึง fallback เมื่อ chunk หาย', () => {
    const env = createGasEnv();
    const sb = env.newCtx();
    const bigItems = Array.from({ length: 120 }, (_, i) => ({ id: `APT-BIG-${i}`, title: 'ทดสอบข้อความภาษาไทยและข้อมูลขนาดใหญ่ ' + 'ก'.repeat(350) + i }));
    const r0 = sb.getDataRev_();
    sb.cacheWriteObj_('CAL_A', r0, 'a', bigItems, 180);
    const head = env.cacheStore.get('CAL_A');
    assert(head && head.startsWith(`M:${r0}:`), `ต้องแบ่ง chunk เมื่อเกิน 88KB (head=${head})`);
    const restored = sb.cacheReadObj_('CAL_A', r0);
    assert(Array.isArray(restored) && restored.length === 120 && restored[119].id === 'APT-BIG-119', 'ต้องประกอบข้อมูลทุก chunk กลับมาครบ 100%');
    // Delete chunk 1 -> must safely return null instead of throwing
    env.cacheStore.delete('CAL_A_1');
    assertEq(sb.cacheReadObj_('CAL_A', r0), null, 'หาก chunk หายต้องคืน null เพื่อ fallback ไปอ่าน Sheets');
  });

  test('A8. GAS Sync & Cache', 'Anti-Poisoning Guard ป้องกันเขียนแคชทับเมื่อ rev เปลี่ยนระหว่างกำลังอ่านชีต', () => {
    const env = createGasEnv();
    env.callPost({ action: 'create', notifyLine: false, payload: { title: 'งานแรก', appointmentDate: '2026-12-06', appointmentTime: '10:00', location: 'ห้อง A', contactPerson: 'คุณ ก' } });
    env.cacheStore.delete('CAL_A');
    const sb = env.newCtx();
    // Simulate another request bumping rev while Appointments sheet is being read
    env.setOnBeforeRead(shName => {
      if (shName === 'Appointments') {
        const cur = JSON.parse(env.cacheStore.get('CAL_REV'));
        cur.a = 'REV-NEWER'; cur.g = 'REV-NEWER';
        env.cacheStore.set('CAL_REV', JSON.stringify(cur));
      }
    });
    sb.readAllApts_(false, false);
    assert(!env.cacheStore.has('CAL_A'), 'CAS Guard ต้องไม่เขียน stale data ลง CAL_A เมื่อ rev เปลี่ยนระหว่างอ่าน');
  });

  test('A9. GAS Sync & Cache', 'updateMeta_ แก้ไข 4 คีย์ เขียนลงชีตแบบ Batch ใน 1 RPC เดียว', () => {
    const env = createGasEnv();
    const sb = env.newCtx();
    env.resetMetrics();
    sb.updateMeta_({ DAILY_DIGEST_HOUR: '9', ENABLE_LINE_BOT_QUERY: 'FALSE', PRIVACY_MASK_CONTACT: 'TRUE', NOTIFY_ON_STATUS_CHANGE: 'TRUE' });
    assertEq(env.metrics.sheetWrites, 1, 'updateMeta_ อัปเดต 4 คีย์เดิมต้องเขียนชีตแค่ 1 ครั้ง');
    const verify = sb.getMetaMap_();
    assert(verify.DAILY_DIGEST_HOUR === '9' && verify.ENABLE_LINE_BOT_QUERY === 'FALSE' && verify.PRIVACY_MASK_CONTACT === 'TRUE' && verify.NOTIFY_ON_STATUS_CHANGE === 'TRUE', 'ค่าทุกคีย์ต้องอัปเดตครบ');
  });

  test('A10. GAS Sync & Cache', 'applySlotUpdates_ อัปเดต 5 นัดหมายพร้อมกันใน 1 Batch Write RPC เดียว', () => {
    const env = createGasEnv();
    for (let i = 1; i <= 5; i++) {
      env.callPost({ action: 'create', notifyLine: false, payload: { title: 'งาน ' + i, appointmentDate: '2026-12-10', appointmentTime: '09:0' + i, location: 'ห้อง ' + i, contactPerson: 'คุณ ' + i } });
    }
    const list = env.callPost({ action: 'list', force: true }).data.appointments;
    const sb = env.newCtx();
    sb.getSheetData_('Appointments', sb.APT_COLS);
    env.resetMetrics();
    sb.applySlotUpdates_(list.map(a => ({ id: a.id, dSlot: '2026-12-10', hSlot: '2026-12-10T' + a.appointmentTime })));
    assertEq(env.metrics.sheetWrites, 1, 'applySlotUpdates_ 5 รายการต้องเขียนชีตแค่ 1 Batch RPC');
  });

  test('A11. GAS Sync & Cache', 'LINE Webhook ข้อความแชทธรรมดา (ไม่ใช่คำสั่ง) ต้อง Early Exit ด้วย 0 CacheService และ 0 Sheet reads', () => {
    const env = createGasEnv();
    env.resetMetrics();
    const res = env.callPost({ events: [{ type: 'message', webhookEventId: 'ev-chat-1', replyToken: 'rt1', source: { groupId: 'G1', userId: 'U1' }, message: { type: 'text', text: 'สวัสดีครับทุกท่าน วันนี้ประชุมเรียบร้อยดี' } }] });
    assert(res.ok === true, 'Webhook ต้องตอบ ok: true');
    assertEq(env.metrics.cacheGets + env.metrics.cachePuts, 0, 'ข้อความคุยทั่วไปต้องไม่เรียก CacheService');
    assertEq(env.metrics.sheetReads + env.metrics.sheetWrites, 0, 'ข้อความคุยทั่วไปต้องไม่แตะ Google Sheets');
  });

  // --- Suite B: Frontend Sync Safety, Multi-Tab & Storage Recovery ---
  function createFrontendHarness(fetchImpl) {
    const lsMap = new Map(), winListeners = {}, docListeners = {};
    const makeEl = id => ({ id, value: '', checked: false, disabled: false, textContent: '', innerHTML: '', href: '', src: '', style: {}, attributes: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); }, contains(c) { return this._s.has(c); } }, setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k] ?? null; }, addEventListener() {}, appendChild() {}, remove() {}, closest: () => null, querySelectorAll: () => [] });
    const elCache = new Map();
    const getEl = id => elCache.get(id) || (elCache.set(id, makeEl(id)), elCache.get(id));
    let quotaThrowOnce = false, listRenderCount = 0;

    const sandbox = {
      console, Math, Date, JSON, Array, Object, String, Number, Boolean, Map, Set, RegExp, Error, Promise, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
      AbortController,
      setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: fn => setTimeout(fn, 0), cancelAnimationFrame: id => clearTimeout(id),
      localStorage: {
        getItem: k => lsMap.has(k) ? lsMap.get(k) : null,
        setItem: (k, v) => { if (quotaThrowOnce && k === 'CAL_LIVE_CACHE_V2') { quotaThrowOnce = false; throw new Error('QuotaExceededError'); } lsMap.set(k, String(v)); },
        removeItem: k => lsMap.delete(k)
      },
      Notification: undefined,
      navigator: { userAgent: 'node-test' },
      document: {
        visibilityState: 'visible',
        documentElement: { setAttribute() {} },
        head: { appendChild() {} },
        body: { appendChild() {} },
        getElementById: getEl,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => makeEl('dyn'),
        addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
      },
      window: {
        CalendarLogic: Logic,
        location: { hash: '', protocol: 'https:' },
        matchMedia: () => ({ matches: false }),
        navigator: {},
        addEventListener: (ev, fn) => { (winListeners[ev] || (winListeners[ev] = [])).push(fn); }
      },
      fetch: fetchImpl
    };
    sandbox.window.window = sandbox.window;
    let appSrc = readF('app.js').replace("window.addEventListener('DOMContentLoaded', initApp); })();", "globalThis.__APP_T__ = { state, pendingIds, syncWithServer, applySyncBundle, applyMutationRev, saveLiveCache, loadLiveCache, callGasApi, initApp, findApt, renderActiveTab, getListRenderCount: () => __rc }; })();");
    appSrc = 'let __rc = 0;\n' + appSrc.replace('function renderListTab(cachedNowBkk) {', 'function renderListTab(cachedNowBkk) { __rc++;');
    vm.runInNewContext(appSrc, sandbox);
    const api = sandbox.__APP_T__;
    api.state.currentUser = { userId: 'USR-001', username: 'admin', displayName: 'ผู้ดูแลระบบ', role: 'ADMIN' };
    api.state.isLive = true;
    api.state.gasUrl = 'https://script.google.com/macros/s/test/exec';
    return { api, lsMap, winListeners, docListeners, triggerQuotaOnce: () => { quotaThrowOnce = true; } };
  }

  testAsync('B1. Frontend Sync', 'Delta Sync (unchanged: true) ต้องไม่กระตุกหรือวาด DOM ใหม่ซ้ำ', async () => {
    let calls = 0;
    const h = createFrontendHarness(async () => { calls++; return { json: async () => ({ ok: true, version: Logic.API_VERSION, data: { unchanged: true, rev: 'r1' } }) }; });
    h.api.state.syncRev = 'r1';
    h.api.state.appointments = [{ id: 'APT-1', title: 'เดิม', status: Logic.STATUS.CONFIRMED }];
    const beforeRc = h.api.getListRenderCount();
    await h.api.syncWithServer(true, true);
    assertEq(calls, 1, 'ต้องยิง API 1 ครั้ง');
    assertEq(h.api.getListRenderCount(), beforeRc, 'unchanged: true ต้องไม่เรียก render ซ้ำ');
    assertEq(h.api.state.appointments.length, 1, 'appointments ต้องคงเดิม');
  });

  testAsync('B2. Frontend Sync', 'เรียก syncWithServer ซ้อนพร้อมกันต้องยุบเหลือ 1 HTTP fetch เดียว', async () => {
    let calls = 0;
    const h = createFrontendHarness(() => {
      calls++;
      return new Promise(r => setTimeout(() => r({ json: async () => ({ ok: true, version: Logic.API_VERSION, data: { appointments: [], users: [], rescheduleLogs: [], meta: {}, rev: 'r2' } }) }), 25));
    });
    await Promise.all([h.api.syncWithServer(true), h.api.syncWithServer(true), h.api.syncWithServer(true)]);
    assertEq(calls, 1, 'Concurrent background sync ต้องยุบเหลือ 1 request');
    assertEq(h.api.state.syncRev, 'r2', 'syncRev ต้องอัปเดตเป็น r2');
  });

  testAsync('B3. Frontend Sync', 'Background sync ข้ามเมื่อมี pendingIds และ applySyncBundle ไม่ทับข้อมูล Optimistic', async () => {
    let calls = 0;
    const h = createFrontendHarness(async () => { calls++; return { json: async () => ({ ok: true, data: {} }) }; });
    h.api.pendingIds.add('APT-1');
    h.api.state.appointments = [
      { id: 'APT-1', title: 'หัวข้อใหม่ที่กำลังบันทึก', status: Logic.STATUS.COMPLETED },
      { id: 'APT-NEW', title: 'สร้างใหม่ที่กำลังบันทึก', status: Logic.STATUS.CONFIRMED }
    ];
    h.api.pendingIds.add('APT-NEW');
    await h.api.syncWithServer(true, true);
    assertEq(calls, 0, 'ต้องข้าม auto-sync ขณะยังมี pendingIds');
    h.api.applySyncBundle({ appointments: [{ id: 'APT-1', title: 'หัวข้อเก่าจากเซิร์ฟเวอร์', status: Logic.STATUS.CONFIRMED }, { id: 'APT-TEAM', title: 'งานทีม', status: Logic.STATUS.CONFIRMED }], rev: 'r5' });
    assertEq(h.api.state.appointments.find(a => a.id === 'APT-1').title, 'หัวข้อใหม่ที่กำลังบันทึก', 'ต้องคงค่า optimistic ของ pendingIds');
    assert(h.api.state.appointments.some(a => a.id === 'APT-NEW') && h.api.state.appointments.some(a => a.id === 'APT-TEAM'), 'ต้องรวมทั้งงานใหม่ฝั่งเราและงานใหม่จากทีม');
  });

  testAsync('B4. Frontend Sync', 'applyMutationRev ต้องเลื่อน syncRev เมื่อ prevRev ตรง และแจ้ง follow-up sync เมื่อไม่ตรง', async () => {
    let calls = 0;
    const h = createFrontendHarness(async () => { calls++; return { json: async () => ({ ok: true, version: Logic.API_VERSION, data: { appointments: [{ id: 'APT-X', title: 'งานจากเพื่อน', status: Logic.STATUS.CONFIRMED }], rev: 'r9' } }) }; });
    h.api.state.syncRev = 'r1';
    h.api.applyMutationRev({ prevRev: 'r1', rev: 'r2' });
    assertEq(h.api.state.syncRev, 'r2', 'prevRev ตรงต้อง fast-forward syncRev ทันที');
    assertEq(calls, 0, 'ไม่ต้องยิง sync เพิ่มเมื่อ prevRev ตรง');
    h.api.applyMutationRev({ prevRev: 'r8', rev: 'r9' });
    assertEq(h.api.state.syncRev, 'r2', 'prevRev ไม่ตรงต้องยังไม่ fast-forward จนกว่าจะ sync');
    // Simulate runBgTask finishing: calling syncWithServer directly if follow-up needed
    await h.api.syncWithServer(true, true);
    assertEq(calls, 1, 'ต้องซิงก์ข้อมูลล่าสุดเมื่อมีคนแก้ไขแทรก');
    assertEq(h.api.state.syncRev, 'r9', 'หลังซิงก์ต้องได้ rev r9');
  });

  test('B5. Frontend Sync', 'Multi-Tab storage event ต้องอัปเดตข้อมูลข้ามแท็บทันทีโดย 0 network calls', () => {
    let calls = 0;
    const h = createFrontendHarness(async () => { calls++; });
    h.api.initApp();
    h.api.state.currentUser = { userId: 'USR-001', username: 'admin', displayName: 'ผู้ดูแลระบบ', role: 'ADMIN' };
    h.api.state.isLive = true;
    const cacheBundle = { user: 'admin', rev: 'r77', appointments: [{ id: 'APT-TAB', title: 'อัปเดตจากอีกแท็บ', appointmentDate: '2026-12-12', appointmentTime: '10:00', status: Logic.STATUS.CONFIRMED }], rescheduleLogs: [], users: [], meta: {} };
    h.lsMap.set('CAL_LIVE_CACHE_V2', JSON.stringify(cacheBundle));
    h.winListeners.storage.forEach(fn => fn({ key: 'CAL_LIVE_CACHE_V2', newValue: h.lsMap.get('CAL_LIVE_CACHE_V2') }));
    assertEq(calls, 0, 'Multi-tab sync ต้องไม่ยิง network');
    assertEq(h.api.state.syncRev, 'r77', 'syncRev ต้องอัปเดตจากแท็บอื่นทันที');
    assertEq(h.api.findApt('APT-TAB').title, 'อัปเดตจากอีกแท็บ', 'findApt O(1) Index ต้องรีเฟรชเป็นข้อมูลล่าสุดทันที');
  });

  test('B6. Frontend Sync', 'saveLiveCache ต้องกู้คืนจาก QuotaExceededError โดยตัดเฉพาะ data: imageUrl', () => {
    const h = createFrontendHarness(async () => {});
    h.api.state.appointments = [{ id: 'APT-IMG', title: 'มีรูป', imageUrl: 'data:image/jpeg;base64,AAAA' }];
    h.api.state.syncRev = 'r3';
    h.triggerQuotaOnce();
    h.api.saveLiveCache();
    const saved = JSON.parse(h.lsMap.get('CAL_LIVE_CACHE_V2'));
    assert(saved && saved.rev === 'r3' && saved.appointments[0].imageUrl === '', 'Fallback ต้องตัดเฉพาะ data: imageUrl เพื่อไม่ให้แคชพัง');
  });

  testAsync('B7. Frontend Sync', 'callGasApi ต้อง timeout ด้วย AbortController อย่างสะอาดเมื่อเซิร์ฟเวอร์ค้าง', async () => {
    const origSetTimeout = global.setTimeout;
    let errMsg = '';
    const src2 = readF('app.js').replace('25000', '10').replace("window.addEventListener('DOMContentLoaded', initApp); })();", 'globalThis.__TEST_CALL__ = callGasApi; globalThis.__TEST_ST__ = state; })();');
    const sb2 = { console, Math, Date, JSON, Array, Object, String, Number, Boolean, Map, Set, RegExp, Error, Promise, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, AbortController, setTimeout: origSetTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, Notification: undefined, navigator: {}, document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: { setAttribute() {} } }, window: { CalendarLogic: Logic, location: { hash: '', protocol: 'https:' }, matchMedia: () => ({ matches: false }), addEventListener() {} }, fetch: (_, opts) => new Promise((__, reject) => { opts.signal.addEventListener('abort', () => { const e = new Error('Aborted'); e.name = 'AbortError'; reject(e); }); }) };
    sb2.window.window = sb2.window;
    vm.runInNewContext(src2, sb2);
    sb2.__TEST_ST__.gasUrl = 'https://script.google.com/macros/s/test/exec';
    try { await sb2.__TEST_CALL__('list', {}); } catch (e) { errMsg = e.message; }
    assert(errMsg.includes('ใช้เวลานานเกินกำหนด'), `ต้องโยน error timeout ภาษาไทยชัดเจน (ได้: ${errMsg})`);
  });

  // --- Suite C: Logic Performance, Edge Cases & Asset Integrity ---
  test('C1. Logic Perf & Accuracy', 'queryMultiYearOverview 5 ปี x 2,000 นัดหมาย (< 35ms) และตรงกับ queryByYear 100%', () => {
    const bulk = Array.from({ length: 2000 }, (_, i) => ({
      id: `APT-${i}`, title: `งาน ${i}`, appointmentDate: `${2025 + (i % 5)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: i % 4 === 0 ? Logic.STATUS.COMPLETED : Logic.STATUS.CONFIRMED, createdBy: 'คุณสมชาย'
    }));
    const t0 = Date.now();
    const multi = Logic.queryMultiYearOverview(bulk, 2025, 2029, { nowIso: '2026-11-19T10:00:00+07:00' });
    const ms = Date.now() - t0;
    assert(ms < 50, `queryMultiYearOverview 2,000 รายการควร < 50ms (ใช้จริง ${ms}ms)`);
    assertEq(multi.years.length, 5, 'ต้องมี 5 ปี');
    for (let y = 0; y < 5; y++) {
      const solo = Logic.queryByYear(bulk, 2025 + y, { nowIso: '2026-11-19T10:00:00+07:00' });
      assertEq(multi.years[y].stats.total, solo.stats.total, `ยอดรวมปี ${2025 + y} ต้องตรงกัน`);
      assertEq(multi.years[y].stats.completed, solo.stats.completed, `ยอดสำเร็จปี ${2025 + y} ต้องตรงกัน`);
    }
  });

  test('C2. Logic Perf & Accuracy', 'bangkokSlotToEpochMs / daysBetweenDates / isPastBkkSlot edge cases & 10,000-call benchmark (< 35ms)', () => {
    assertEq(Logic.daysBetweenDates('2028-02-28', '2028-03-01'), 2, 'ปีอธิกสุรทิน 2028 ต้องห่าง 2 วัน');
    assertEq(Logic.daysBetweenDates('2026-02-28', '2026-03-01'), 1, 'ปีปกติ 2026 ต้องห่าง 1 วัน');
    assertEq(Logic.bangkokSlotToEpochMs('2026-02-29', '10:00'), null, '29 ก.พ. 2026 ไม่ถูกต้องต้องคืน null');
    assert(Logic.bangkokSlotToEpochMs('2569-11-20', '09:00') === Logic.bangkokSlotToEpochMs('2026-11-20', '09:00'), 'ปี พ.ศ. 2569 ต้องแปลงเป็น 2026 ถูกต้อง');
    const bkk = Logic.getBangkokParts('2026-11-19T10:30:15+07:00');
    assert(!Logic.isOverdue({ appointmentDate: '2026-11-19', appointmentTime: '10:31', status: Logic.STATUS.CONFIRMED }, bkk.isoStr), '10:31 ต้องยังไม่เลยกำหนดเมื่อเวลา 10:30:15');
    assert(Logic.isOverdue({ appointmentDate: '2026-11-19', appointmentTime: '10:30', status: Logic.STATUS.CONFIRMED }, bkk.isoStr), '10:30 ต้องเลยกำหนดเมื่อเวลา 10:30:15');
    const t0 = Date.now();
    for (let i = 0; i < 10000; i++) {
      Logic.bangkokSlotToEpochMs('2026-11-20', '09:30');
      Logic.daysBetweenDates('2026-11-19', '2026-11-25');
    }
    const ms = Date.now() - t0;
    assert(ms < 60, `20,000 epoch/day calls ควร < 60ms (ใช้จริง ${ms}ms)`);
  });

  test('C3. Asset & Sprite Audit', 'ทุก <use href="#..."/> ใน index.html และ app.js ต้องมี <symbol id="..."> ครบ 100% + Zero-Emoji + Syntax', () => {
    const html = readF('index.html'), appJs = readF('app.js'), swJs = readF('sw.js'), pnJs = readF('patchnotes.js'), css = readF('style.css');
    const symbols = new Set();
    let m; const symRe = /<symbol\s+id="([^"]+)"/g;
    while ((m = symRe.exec(html)) !== null) symbols.add(m[1]);
    assert(symbols.size >= 25, `ต้องมี SVG symbol อย่างน้อย 25 ตัว (พบ ${symbols.size})`);
    const missingHtml = [], useRe = /<use\s+href="#([^"]+)"/g;
    while ((m = useRe.exec(html)) !== null) if (!symbols.has(m[1])) missingHtml.push(m[1]);
    assertEq(missingHtml.length, 0, `พบ <use> ใน index.html ที่ไม่มี symbol: ${missingHtml.join(', ')}`);
    const icoRe = /mkI\(\d+,\s*'([^']+)'/g, missingJs = [];
    while ((m = icoRe.exec(appJs)) !== null) if (!symbols.has('i-' + m[1])) missingJs.push('i-' + m[1]);
    assertEq(missingJs.length, 0, `พบ ICO ใน app.js ที่ไม่มี symbol: ${missingJs.join(', ')}`);
    // Syntax & Zero-Emoji on new file
    new vm.Script(readF('tests_perf_sync.js'), { filename: 'tests_perf_sync.js' });
    new vm.Script(pnJs, { filename: 'patchnotes.js' });
    new vm.Script(swJs, { filename: 'sw.js' });
    assert(!Logic.hasEmoji(readF('tests_perf_sync.js')), 'tests_perf_sync.js ต้องไม่มีอิโมจิ');
    assert(!css.includes('background-attachment:fixed') && !css.includes('background-attachment: fixed'), 'style.css ต้องไม่ใช้ background-attachment: fixed');
    assert(css.includes('.settings-toggles') && /[^\}]*\.settings-toggles[^\{]*\{display:flex;flex-direction:column\}/.test(css), 'style.css ต้องคง display:flex;flex-direction:column ให้ .settings-toggles');
    assert(codeGsSrc.includes('อย่างน้อย 4 ตัวอักษร') && codeGsSrc.includes('แล้ว กรุณาใช้ชื่ออื่น'), 'gas/Code.gs ต้องคงช่องว่างข้อความภาษาไทย E_PW4 และ E_DUP_UN ครบถ้วน');
    assert(!html.includes('unpkg.com/leaflet') && !html.includes('src="patchnotes.js"'), 'index.html ต้องโหลด Leaflet และ patchnotes.js แบบ Lazy ไม่ขวาง First Paint');
  });

  testAsync('B8. Frontend Sync', 'renderPatchNotes เมื่อโหลด patchnotes.js ล้มเหลวต้องไม่วนโหลดซ้ำไม่รู้จบ', async () => {
    let scriptAppends = 0;
    const container = { innerHTML: '' };
    const src = readF('app.js').replace("window.addEventListener('DOMContentLoaded', initApp); })();", 'globalThis.__TEST_PN__ = renderPatchNotes; })();');
    const sb = {
      console, Math, Date, JSON, Array, Object, String, Number, Boolean, Map, Set, RegExp, Error, Promise, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
      setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, Notification: undefined, navigator: {},
      document: {
        documentElement: { setAttribute() {} },
        head: { appendChild: el => { scriptAppends++; setTimeout(() => { if (typeof el.onerror === 'function') el.onerror(); }, 5); } },
        body: { appendChild() {} },
        getElementById: id => id === 'patchNotesContainer' ? container : null,
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ src: '', onload: null, onerror: null }),
        addEventListener() {}
      },
      window: { CalendarLogic: Logic, location: { hash: '', protocol: 'https:' }, matchMedia: () => ({ matches: false }), addEventListener() {} }
    };
    sb.window.window = sb.window;
    vm.runInNewContext(src, sb);
    sb.__TEST_PN__();
    await new Promise(r => setTimeout(r, 40));
    assertEq(scriptAppends, 1, `ต้องพยายามโหลด patchnotes.js แค่ 1 ครั้งเมื่อ error (โหลดไป ${scriptAppends} ครั้ง)`);
    assert(container.innerHTML.includes('ไม่สามารถโหลดประวัติการอัปเดตได้'), 'ต้องแสดงข้อความแจ้งเตือนเมื่อโหลดไม่สำเร็จ');
  });

  // --- Suite D: GAS v2.8.0 Features (Optional Contact, Timed Suspension, Hard Delete, LINE OTP Reset) ---
  test('D1. GAS v2.8.0 Optional Contact', 'สร้างและแก้ไขนัดหมายใน GAS โดยไม่กรอก contactPerson ได้สำเร็จ', () => {
    const env = createGasEnv();
    const c = env.callPost({ action: 'create', notifyLine: false, payload: { title: 'ประชุมทีมภายใน', appointmentDate: '2026-12-10', appointmentTime: '10:00', location: 'ห้อง A' } });
    assert(c.ok && c.data.appointment.contactPerson === '', 'createApt_ ต้องสร้างสำเร็จเมื่อเว้นว่าง contactPerson');
    const u = env.callPost({ action: 'update', id: c.data.appointment.id, notifyLine: false, payload: { location: 'ห้อง B', contactPerson: '' } });
    assert(u.ok && u.data.appointment.location === 'ห้อง B' && u.data.appointment.contactPerson === '', 'updateApt_ ต้องแก้ไขสำเร็จเมื่อ contactPerson ว่าง');
  });

  test('D2. GAS v2.8.0 Timed Suspension', 'ระงับสมาชิก 1/3/7/15 วัน/ถาวร บล็อก Login และปลดระงับอัตโนมัติเมื่อครบเวลา', () => {
    const env = createGasEnv();
    const staffAttempt = env.callPost({ action: 'suspendUser', actorUserId: 'USR-002', userId: 'USR-003', duration: '1d', reason: 'ทดสอบ' });
    assert(!staffAttempt.ok && staffAttempt.error.includes('ADMIN'), 'STAFF ต้องระงับสมาชิกไม่ได้');
    assert(!env.callPost({ action: 'suspendUser', actorUserId: 'USR-001', userId: 'USR-001', duration: '1d' }).ok, 'ADMIN ต้องระงับตัวเองหรือ admin หลักไม่ได้');

    const s3 = env.callPost({ action: 'suspendUser', actorUserId: 'USR-001', userId: 'USR-003', duration: '3d', reason: 'ลาพักร้อน' });
    assert(s3.ok && s3.data.user.isActive === false && s3.data.user.suspendedUntil && s3.data.user.suspendReason === 'ลาพักร้อน', 'ระงับ 3 วันสำเร็จและคืน suspendedUntil');

    const badLogin = env.callPost({ action: 'login', username: 'wipada', password: '1234' });
    assert(!badLogin.ok && badLogin.error.includes('ระงับการใช้งานชั่วคราว'), 'ต้องบล็อกการล็อกอินระหว่างถูกระงับ');
    assert(!env.callPost({ action: 'requestPasswordReset', username: 'wipada' }).ok, 'บัญชีที่ถูกระงับต้องขอรีเซ็ตรหัสผ่านไม่ได้');

    // Simulate suspension expiry in Users sheet -> auto-unblock on login
    const uRows = env.sheets.Users, hdrs = uRows[0], suspIdx = hdrs.indexOf('suspendedUntil'), rIdx = uRows.findIndex(r => r[0] === 'USR-003');
    uRows[rIdx][suspIdx] = '2020-01-01T00:00:00+07:00';
    env.cacheStore.clear();
    const okLogin = env.callPost({ action: 'login', username: 'wipada', password: '1234' });
    assert(okLogin.ok && okLogin.data.user.username === 'wipada', 'เมื่อครบกำหนดระงับต้องปลดระงับและล็อกอินได้อัตโนมัติ');
    assertEq(uRows[rIdx][hdrs.indexOf('isActive')], 'TRUE', 'คอลัมน์ isActive ในชีต Users ต้องถูกอัปเดตกลับเป็น TRUE');
    assertEq(uRows[rIdx][suspIdx], '', 'คอลัมน์ suspendedUntil ในชีต Users ต้องถูกล้าง');

    const perm = env.callPost({ action: 'suspendUser', actorUserId: 'USR-001', userId: 'USR-003', duration: 'PERMANENT', reason: 'ยกเลิกสิทธิ์' });
    assert(perm.ok && perm.data.user.isActive === false && perm.data.user.suspendedUntil === '', 'ระงับถาวรสำเร็จ');
    assert(!env.callPost({ action: 'login', username: 'wipada', password: '1234' }).ok, 'บัญชีระงับถาวรต้องเข้าไม่ได้');
    const unsusp = env.callPost({ action: 'suspendUser', actorUserId: 'USR-001', userId: 'USR-003', duration: 'UNSUSPEND' });
    assert(unsusp.ok && unsusp.data.user.isActive === true, 'ปลดระงับทันทีสำเร็จ');
  });

  test('D3. GAS v2.8.0 Hard Account Deletion', 'ลบบัญชีถาวรออกจากชีต Users จริง ไม่ใช้เลข USR ซ้ำ และคงประวัตินัดหมายเดิม', () => {
    const env = createGasEnv();
    env.callPost({ action: 'create', notifyLine: false, payload: { title: 'งานของสมชาย', appointmentDate: '2026-12-12', appointmentTime: '09:00', location: 'กทม.', createdBy: 'คุณสมชาย' } });
    const countBefore = env.sheets.Users.length;
    assert(!env.callPost({ action: 'deleteUser', actorUserId: 'USR-001', userId: 'USR-001' }).ok, 'ห้ามลบ admin หลัก');
    assert(!env.callPost({ action: 'deleteUser', actorUserId: 'USR-002', userId: 'USR-003' }).ok, 'STAFF ห้ามลบบัญชี');

    const del = env.callPost({ action: 'deleteUser', actorUserId: 'USR-001', userId: 'USR-004' });
    assert(del.ok && del.data.result.deleted === true, 'deleteUser ต้องลบสำเร็จ');
    assertEq(env.sheets.Users.length, countBefore - 1, 'จำนวนแถวในชีต Users ต้องลดลงจริง');
    assert(!env.callPost({ action: 'login', username: 'naphatsorn', password: '1234' }).ok, 'บัญชีที่ถูกลบต้องล็อกอินไม่ได้');
    assert(!env.callPost({ action: 'requestPasswordReset', username: 'naphatsorn' }).ok, 'บัญชีที่ถูกลบต้องรีเซ็ตรหัสไม่ได้');

    const reg = env.callPost({ action: 'register', payload: { username: 'newuser99', displayName: 'คุณใหม่ 99', password: '1234', confirmPassword: '1234' } });
    assert(reg.ok && reg.data.user.userId === 'USR-005', `รหัส USR ใหม่ต้องไม่ซ้ำกับ USR-004 ที่ถูกลบ (ได้ ${reg.data && reg.data.user && reg.data.user.userId})`);
    const apts = env.callPost({ action: 'list', force: true }).data.appointments;
    assertEq(apts.length, 1, 'รายการนัดหมายเดิมในระบบต้องยังคงอยู่ครบถ้วน');
  });

  test('D4. GAS v2.8.0 LINE Bind & Password Reset', 'ผูกบัญชี LINE 1-on-1, ส่ง OTP ทาง Push และ Reply DM ฟรี, Cooldown 60 วิ, ล็อกเมื่อผิด 5 ครั้ง และ Admin Fallback', () => {
    const env = createGasEnv();
    env.propStore.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    env.propStore.LINE_TARGET_ID = 'C_TEAM_GROUP';

    // 1) Unlinked user fallback -> must NOT expose OTP
    const unlRes = env.callPost({ action: 'requestPasswordReset', username: 'somchai', notifyAdmin: false });
    assert(unlRes.ok && unlRes.data.needsAdminReset === true && !unlRes.data.otp, 'ยังไม่ผูก LINE ต้องไม่ส่ง OTP หรือหลุดออกหน้าเว็บ');

    // Admin generates temporary OTP for unlinked user
    const admOtp = env.callPost({ action: 'adminGenerateResetOtp', actorUserId: 'USR-001', userId: 'USR-002' });
    assert(admOtp.ok && /^\d{6}$/.test(admOtp.data.otp), 'ADMIN ออก OTP 6 หลักชั่วคราวได้');
    assert(!env.callPost({ action: 'adminGenerateResetOtp', actorUserId: 'USR-002', userId: 'USR-003' }).ok, 'STAFF ห้ามออก OTP');

    // 2) Link LINE account via 1-on-1 DM (group chat must be rejected)
    const linkCode = env.callPost({ action: 'createLineLinkCode', actorUserId: 'USR-002' });
    assert(linkCode.ok && /^\d{6}$/.test(linkCode.data.code), 'สร้างรหัสผูกบัญชี LINE 6 หลักสำเร็จ');
    const sb = env.newCtx();
    const grpAttempt = sb.parseWebhookCmd_(linkCode.data.command, 'C_TEAM_GROUP', 'U_SOMCHAI');
    assert(JSON.stringify(grpAttempt).includes('ไม่อนุญาตในแชทกลุ่ม'), 'ห้ามผูกบัญชีในแชทกลุ่ม');
    const dmBind = sb.parseWebhookCmd_(linkCode.data.command, '', 'U_SOMCHAI');
    assert(JSON.stringify(dmBind).includes('ผูกบัญชี LINE สำเร็จ'), 'ผูกบัญชีในแชทส่วนตัวสำเร็จ');

    const pubUsers = env.callPost({ action: 'listUsers' }).data.users;
    const somchaiPub = pubUsers.find(u => u.username === 'somchai');
    assert(somchaiPub.hasLineLinked === true && !somchaiPub.lineUserId, 'listUsers ต้องส่งเฉพาะ hasLineLinked โดยไม่เปิดเผย lineUserId จริง');

    // 3) Request password reset -> Push Flex OTP to U_SOMCHAI + enforce 60s cooldown
    env.fetchCalls.length = 0;
    const pushReset = env.callPost({ action: 'requestPasswordReset', username: 'somchai' });
    assert(pushReset.ok && pushReset.data.sent === true && env.fetchCalls.length === 1, 'ต้องยิง Push OTP ไปยัง LINE ส่วนตัว');
    const pushPayload = env.fetchCalls[0].payload;
    assertEq(pushPayload.to, 'U_SOMCHAI', 'ต้องส่งเฉพาะ LINE userId ส่วนตัวของบัญชีนั้น');
    assert(!Logic.hasEmoji(JSON.stringify(pushPayload)), 'Flex OTP ต้องไร้ Emoji');
    const otpMatch = JSON.stringify(pushPayload).match(/\b(\d{6})\b/);
    assert(otpMatch, 'ต้องพบรหัส OTP 6 หลักใน Flex message');
    const sentOtp = otpMatch[1];

    // Cooldown guard
    const cdErr = env.callPost({ action: 'requestPasswordReset', username: 'somchai' });
    assert(!cdErr.ok && cdErr.error.includes('60 วินาที'), 'ต้องติด Cooldown 60 วินาที');

    // 5 wrong attempts lock out OTP
    const wrongOtp = sentOtp === '111111' ? '222222' : '111111';
    for (let i = 1; i <= 5; i++) {
      const bad = env.callPost({ action: 'confirmPasswordReset', username: 'somchai', otp: wrongOtp, newPassword: 'newpw', confirmPassword: 'newpw' });
      assert(!bad.ok, `กรอกผิดครั้งที่ ${i} ต้องไม่ผ่าน`);
    }
    assert(!env.callPost({ action: 'confirmPasswordReset', username: 'somchai', otp: sentOtp, newPassword: 'newpw', confirmPassword: 'newpw' }).ok, 'หลังผิดครบ 5 ครั้ง OTP เดิมต้องถูกยกเลิก');

    // 4) Free Reply DM "รีเซ็ตรหัส" (0 Push calls!) -> confirm reset -> login new pw -> cannot reuse OTP
    env.cacheStore.delete('PWD_CD_somchai');
    env.fetchCalls.length = 0;
    const grpReset = sb.parseWebhookCmd_('รีเซ็ตรหัส', 'C_TEAM_GROUP', 'U_SOMCHAI');
    assert(JSON.stringify(grpReset).includes('ไม่อนุญาตในแชทกลุ่ม'), 'ห้ามขอ OTP ในแชทกลุ่ม');
    const dmOtpFlex = sb.parseWebhookCmd_('รีเซ็ตรหัส', '', 'U_SOMCHAI');
    assertEq(env.fetchCalls.length, 0, 'คำสั่ง รีเซ็ตรหัส ในแชทส่วนตัวต้องใช้ Reply API โดยไม่เรียก Push');
    const dmOtp = JSON.stringify(dmOtpFlex).match(/\b(\d{6})\b/)[1];
    const okReset = env.callPost({ action: 'confirmPasswordReset', username: 'somchai', otp: dmOtp, newPassword: 'pass999', confirmPassword: 'pass999' });
    assert(okReset.ok, 'เปลี่ยนรหัสผ่านด้วย OTP จาก LINE DM สำเร็จ');
    assert(!env.callPost({ action: 'confirmPasswordReset', username: 'somchai', otp: dmOtp, newPassword: 'pass888', confirmPassword: 'pass888' }).ok, 'OTP ที่ใช้แล้วต้องใช้ซ้ำไม่ได้');
    assert(!env.callPost({ action: 'login', username: 'somchai', password: '1234' }).ok, 'รหัสผ่านเก่าต้องเข้าไม่ได้แล้ว');
    assert(env.callPost({ action: 'login', username: 'somchai', password: 'pass999' }).ok, 'รหัสผ่านใหม่ต้องเข้าสู่ระบบได้ทันที');

    // Emergency resetAdminPassword helper
    assert(sb.resetAdminPassword('adm2026').includes('เรียบร้อย') && env.callPost({ action: 'login', username: 'admin', password: 'adm2026' }).ok, 'resetAdminPassword ต้องรีเซ็ตรหัส admin ได้');
  });

  test('D5. Frontend Active Session Enforcement', 'applySyncBundle ต้องบังคับ Logout ทันทีเมื่อผู้ใช้ปัจจุบันถูกระงับหรือถูกลบ', () => {
    const h = createFrontendHarness(async () => {});
    h.api.state.currentUser = { userId: 'USR-003', username: 'wipada', displayName: 'คุณวิภาดา', role: 'STAFF' };
    h.lsMap.set('CAL_AUTH_USER_V2', JSON.stringify(h.api.state.currentUser));
    // Case 1: User suspended on server
    h.api.applySyncBundle({ appointments: [], users: [{ userId: 'USR-001', username: 'admin', role: 'ADMIN', isActive: true }, { userId: 'USR-003', username: 'wipada', role: 'STAFF', isActive: false, suspendedUntil: '2099-01-01T00:00:00+07:00' }], rev: 'r10' });
    assertEq(h.api.state.currentUser, null, 'เมื่อบัญชีถูกระงับระหว่างใช้งาน ต้องบังคับออกจากระบบทันที');
    assert(!h.lsMap.has('CAL_AUTH_USER_V2'), 'ต้องล้าง session ใน localStorage');

    // Case 2: User permanently deleted on server
    h.api.state.currentUser = { userId: 'USR-004', username: 'naphatsorn', displayName: 'คุณนภัสสร', role: 'STAFF' };
    h.lsMap.set('CAL_AUTH_USER_V2', JSON.stringify(h.api.state.currentUser));
    h.api.applySyncBundle({ appointments: [], users: [{ userId: 'USR-001', username: 'admin', role: 'ADMIN', isActive: true }], rev: 'r11' });
    assertEq(h.api.state.currentUser, null, 'เมื่อบัญชีถูกลบระหว่างใช้งาน ต้องบังคับออกจากระบบทันที');
  });

  Promise.all(asyncTests).then(() => {
    results.forEach(r => console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.suite} -> ${r.name}${r.err ? ' : ' + r.err : ''}`));
    console.log(`\nPerf & Sync Test Summary: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
  });
})();
