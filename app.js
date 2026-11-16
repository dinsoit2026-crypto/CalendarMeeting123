/**
 * app.js - Web Frontend Controller, State Management & Low-Latency Engine (v2.6.4)
 * Zero-Emoji Policy | O(1) DOM Cache | Surgical Calendar Update | Duplicate/Copy/ICS & CSV/Print Report
 */
(function () { 'use strict'; const Logic = window.CalendarLogic, PatchNotes = window.PATCH_NOTES || []; const _el = {};
  const $ = id => _el[id] || (_el[id] = document.getElementById(id)); const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const txt = (el, v) => { if (el) el.textContent = v; }; const disp = (el, v) => { if (el) el.style.display = v; };
  const openModal = id => { const el = $(id); if (el) el.classList.add('active'); };
  const closeModal = id => { const el = $(id); if (el) el.classList.remove('active'); };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  const escapeHtml = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ESC[c]);
  const STORAGE = { APTS: 'CAL_DEMO_APTS_V2', LOGS: 'CAL_DEMO_LOGS_V2', CFG: 'CAL_CONN_CFG_V2', THEME: 'CAL_THEME_V2', AUTH_USER: 'CAL_AUTH_USER_V2', USERS: 'CAL_DEMO_USERS_V2', LIVE_CACHE: 'CAL_LIVE_CACHE_V2' };
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwEq-EehM4BDKQLsh7dFQCJNeJNg2g_DtM1_INYgjblaKyhcdkNuAdiIEhkvSke--ro/exec';
  const DEFAULT_PASSCODE = 'CALL1234';
  const FIELD_LABELS = { appointmentDate: 'วันที่นัดหมาย', appointmentTime: 'เวลานัดหมาย', location: 'สถานที่', contactPerson: 'ผู้นัดพบ', status: 'สถานะ', DELETED: 'ลบนัดหมาย' };
  const MODAL_IDS = ['appointmentModal', 'cancelModal', 'userModal', 'guideModal', 'patchNotesModal', 'mapPreviewModal', 'imagePreviewModal']; const ICO = {
    clock: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    user: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    pin: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    bell: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" style="stroke-width:2.5;"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    edit: '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    img: '<svg viewBox="0 0 24 24" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    copy: '<svg viewBox="0 0 24 24" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    cal: '<svg viewBox="0 0 24 24" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
  }; const state = { isLive: true, gasUrl: DEFAULT_GAS_URL, passcode: DEFAULT_PASSCODE, currentUser: null, users: [], theme: 'light',
    activeTab: 'tabMonth', quickRange: 'ALL', filterUser: '', calOnlyMyApts: false, appointments: [], rescheduleLogs: [],
    meta: { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'TRUE' },
    calYear: Logic.getBangkokParts().year, calMonth: Logic.getBangkokParts().month, calSelectedDate: '',
    overviewYear: Logic.getBangkokParts().year, editingUserId: null
  }; const isStaffOnlyCalendar = () => Boolean(state.currentUser && state.currentUser.role !== 'ADMIN');
  function showToast(msg, type = 'info') { const c = $('toastContainer'); if (!c) return; const it = document.createElement('div');
    it.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
    it.textContent = Logic.sanitizeNoEmoji(msg); c.appendChild(it);
    setTimeout(() => { it.style.opacity = '0'; it.style.transition = 'opacity 0.22s'; setTimeout(() => it.remove(), 240); }, 3000); }
  function applyTheme(t) { state.theme = t === 'dark' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', state.theme);
    disp($('iconThemeSun'), state.theme === 'dark' ? 'inline' : 'none'); disp($('iconThemeMoon'), state.theme === 'dark' ? 'none' : 'inline');
    try { localStorage.setItem(STORAGE.THEME, state.theme); } catch (_) { }
  }
  function applyTabClasses(id) {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === id));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id)); }
  function switchTab(id) { let target = id || 'tabMonth';
    if (isStaffOnlyCalendar() && target !== 'tabMonth') { target = 'tabMonth'; showToast('สมาชิกระดับ STAFF สามารถเข้าดูได้เฉพาะหน้าปฏิทินเดือน', 'warn'); }
    state.activeTab = target; applyTabClasses(target); renderActiveTab(); }
  // Live Startup Cache & Session Management
  function saveLiveCache() { if (!state.isLive || !state.currentUser || !state.currentUser.username) return;
    try { localStorage.setItem(STORAGE.LIVE_CACHE, JSON.stringify({ user: state.currentUser.username, appointments: state.appointments, rescheduleLogs: state.rescheduleLogs.slice(0, 60), users: state.users, meta: state.meta, ts: Date.now() })); } catch (_) { }
  }
  function loadLiveCache() { if (!state.isLive || !state.currentUser || !state.currentUser.username) return false; try {
      const d = JSON.parse(localStorage.getItem(STORAGE.LIVE_CACHE) || 'null');
      if (!d || d.user !== state.currentUser.username || !Array.isArray(d.appointments)) return false; state.appointments = d.appointments;
      if (Array.isArray(d.rescheduleLogs)) state.rescheduleLogs = d.rescheduleLogs; if (Array.isArray(d.users) && d.users.length) state.users = d.users;
      if (d.meta) state.meta = { ...state.meta, ...d.meta }; return true; } catch (_) { return false; }
  }
  function clearLiveCache() { try { localStorage.removeItem(STORAGE.LIVE_CACHE); } catch (_) { } }
  function loadSavedSession() {
    try { const su = localStorage.getItem(STORAGE.USERS); state.users = su ? JSON.parse(su) : [...Logic.DEFAULT_USERS]; } catch (_) { state.users = [...Logic.DEFAULT_USERS]; }
    state.currentUser = null;
    try { const u = JSON.parse(localStorage.getItem(STORAGE.AUTH_USER) || 'null'); if (u && u.username && u.displayName) state.currentUser = u; } catch (_) { }
    updateUserSessionUI(); }
  function switchAuthTab(mode) { const isReg = mode === 'register', lBtn = $('tabBtnAuthLogin'), rBtn = $('tabBtnAuthRegister');
    if (lBtn) { lBtn.classList.toggle('active', !isReg); lBtn.setAttribute('aria-selected', isReg ? 'false' : 'true'); }
    if (rBtn) { rBtn.classList.toggle('active', isReg); rBtn.setAttribute('aria-selected', isReg ? 'true' : 'false'); }
    disp($('loginForm'), isReg ? 'none' : 'flex'); disp($('registerForm'), isReg ? 'flex' : 'none');
    disp($('loginErrorMsg'), 'none'); disp($('registerErrorMsg'), 'none'); }
  function updateUserSessionUI() {
    const isAuth = Boolean(state.currentUser && state.currentUser.username), isAdmin = Boolean(isAuth && state.currentUser.role === 'ADMIN');
    disp($('authGateScreen'), isAuth ? 'none' : 'flex'); disp($('appShell'), isAuth ? 'block' : 'none'); const authBadge = $('authModeBadge');
    if (authBadge) { authBadge.className = state.isLive ? 'mode-badge live' : 'mode-badge demo'; authBadge.textContent = state.isLive ? 'Sheets' : 'Demo'; }
    txt($('currentUserName'), isAuth ? state.currentUser.displayName : 'ยังไม่ได้เข้าสู่ระบบ'); const roleEl = $('currentUserRole');
    if (roleEl) { const r = isAdmin ? 'ADMIN' : 'STAFF'; roleEl.textContent = r; roleEl.className = `badge-role ${r.toLowerCase()}`; }
    if ($('userManagementSection')) $('userManagementSection').style.opacity = isAdmin ? '1' : '0.85';
    disp($('btnOpenAddUserModal'), isAdmin ? 'inline-flex' : 'none');
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => { b.style.display = (!isAdmin && b.getAttribute('data-tab') !== 'tabMonth') ? 'none' : ''; });
    if (isAuth && !isAdmin && state.activeTab !== 'tabMonth') { state.activeTab = 'tabMonth'; applyTabClasses('tabMonth'); }
  }
  function handleLogout() { state.currentUser = null; state.activeTab = 'tabMonth'; state.calOnlyMyApts = false; applyTabClasses('tabMonth');
    try { localStorage.removeItem(STORAGE.AUTH_USER); } catch (_) { }
    clearLiveCache(); MODAL_IDS.forEach(closeModal); if ($('loginUsername')) $('loginUsername').value = '';
    if ($('loginPassword')) $('loginPassword').value = ''; switchAuthTab('login'); updateUserSessionUI(); showToast('ออกจากระบบเรียบร้อยแล้ว', 'info'); }
  // Optimistic UI Engine & Background Task Coordinator
  const pendingIds = new Set(); let bgTaskCount = 0;
  function setBgSync(active) { bgTaskCount = Math.max(0, bgTaskCount + (active ? 1 : -1));
    if ($('btnSyncNow')) $('btnSyncNow').classList.toggle('is-syncing', bgTaskCount > 0); txt($('syncBtnLabel'), bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์');
  }
  function runBgTask(trackId, apiPromiseFactory, onSuccess, onError) { if (trackId) pendingIds.add(trackId); setBgSync(true); apiPromiseFactory()
      .then(res => { if (onSuccess) onSuccess(res); saveLiveCache(); })
      .catch(err => { if (onError) onError(err); })
      .finally(() => {
        if (trackId) { pendingIds.delete(trackId); document.querySelectorAll(`.badge-syncing[data-sync-id="${trackId}"]`).forEach(el => el.remove()); }
        setBgSync(false); }); }
  const aptVisualSig = a => a ? `${a.id}|${a.title}|${Logic.normalizeStatus(a.status)}|${a.appointmentDate}|${a.appointmentTime}|${a.location}|${a.contactPerson}|${a.notes}|${a.remindDaysBefore}|${a.remindHoursBefore}|${a.rescheduleCount}|${a.notifiedDayForSlot}|${a.notifiedHourForSlot}|${a.createdBy}|${a.statusChangedBy}|${a.statusReason}|${a.updatedBy}|${a.mapUrl || ''}|${(a.imageUrl || '').length}` : '';
  function syncAptMutation(trackId, prevApts, prevLogs, optApt, apiFn, errPrefix) { if (!state.isLive) return; const optSig = aptVisualSig(optApt);
    runBgTask(trackId, apiFn, res => { let needRedraw = false; if (res && res.appointment) { const curIdx = state.appointments.findIndex(x => x.id === trackId);
        if (curIdx !== -1) state.appointments[curIdx] = res.appointment; else state.appointments.push(res.appointment);
        if (aptVisualSig(res.appointment) !== optSig) needRedraw = true; }
      if (res && res.meta) state.meta = { ...state.meta, ...res.meta }; if (needRedraw) renderActiveTab(); else renderHeader(); }, err => {
      state.appointments = prevApts; state.rescheduleLogs = prevLogs; renderActiveTab(); showToast(`${errPrefix} ระบบคืนค่าเดิมแล้ว: ${err.message}`, 'error');
      if (err.code === 'CONCURRENCY_CONFLICT') syncWithServer(true); }); }
  function applySyncBundle(d) { if (!d) return; if (Array.isArray(d.appointments)) state.appointments = d.appointments;
    if (Array.isArray(d.rescheduleLogs)) state.rescheduleLogs = d.rescheduleLogs; if (Array.isArray(d.users) && d.users.length) state.users = d.users;
    else if (!state.users || !state.users.length) state.users = [...Logic.DEFAULT_USERS]; if (d.meta) state.meta = { ...state.meta, ...d.meta };
    saveLiveCache(); }
  async function finishAuthSession(userObj, syncBundle, welcomeMsg) { state.currentUser = userObj; state.activeTab = 'tabMonth'; applyTabClasses('tabMonth');
    try { localStorage.setItem(STORAGE.AUTH_USER, JSON.stringify(userObj)); } catch (_) { }
    updateUserSessionUI(); if (state.isLive && state.gasUrl) { if (syncBundle) { applySyncBundle(syncBundle); renderAll(); }
      else { if (loadLiveCache()) renderAll(); await syncWithServer(true); }
    } else { loadDemoData(); renderAll(); }
    showToast(welcomeMsg, 'success'); }
  async function handleLoginSubmit(e) { e.preventDefault();
    const un = ($('loginUsername').value || '').trim(), pw = $('loginPassword').value || '', errEl = $('loginErrorMsg'), submitBtn = $('btnSubmitLogin'); try {
      disp(errEl, 'none'); if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังตรวจสอบ...'; }
      let userObj = null, syncBundle = null; if (state.isLive && state.gasUrl) { try { const res = await callGasApi('login', { username: un, password: pw });
          userObj = res.user; if (Array.isArray(res.appointments)) syncBundle = res; } catch (apiErr) {
          if (String(apiErr.message || '').includes('ไม่รู้จัก action')) {
            const localRes = Logic.authenticateUser(state.users.length ? state.users : Logic.DEFAULT_USERS, un, pw);
            if (!localRes.ok) throw new Error(localRes.error);
            userObj = localRes.user; showToast('เซิร์ฟเวอร์ GAS เป็นเวอร์ชันเดิม ระบบใช้บัญชีในเครื่องชั่วคราว', 'warn'); } else throw apiErr; }
      } else { const res = Logic.authenticateUser(state.users.length ? state.users : Logic.DEFAULT_USERS, un, pw); if (!res.ok) throw new Error(res.error);
        userObj = res.user; }
      await finishAuthSession(userObj, syncBundle, `ยินดีต้อนรับ ${userObj.displayName} เข้าสู่ระบบ`); } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'เข้าสู่ระบบ'; } }
  }
  async function handleRegisterSubmit(e) { e.preventDefault();
    const username = ($('regUsername').value || '').trim().toLowerCase(), displayName = Logic.sanitizeNoEmoji($('regDisplayName').value || '');
    const password = $('regPassword').value || '', confirmPassword = $('regConfirmPassword').value || '', errEl = $('registerErrorMsg'), submitBtn = $('btnSubmitRegister');
    try { disp(errEl, 'none'); const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS;
      const localReg = Logic.registerUserAccount(uList, { username, displayName, password, confirmPassword });
      if (!localReg.ok) throw new Error(localReg.error); if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังสร้างบัญชี...'; }
      let userObj = localReg.user, syncBundle = null; if (state.isLive && state.gasUrl) { try {
          const res = await callGasApi('register', { payload: { username, displayName, password, confirmPassword } }); if (res && res.user) userObj = res.user;
          if (res && res.users) state.users = res.users; if (res && Array.isArray(res.appointments)) syncBundle = res;
        } catch (_) { state.users = [...uList, localReg.record]; try { localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users)); } catch (_) { } }
      } else { state.users = [...uList, localReg.record]; try { localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users)); } catch (_) { } }
      ['regUsername', 'regDisplayName', 'regPassword', 'regConfirmPassword'].forEach(k => { if ($(k)) $(k).value = ''; }); switchAuthTab('login');
      await finishAuthSession({ ...userObj, role: 'STAFF' }, syncBundle, `สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${displayName || username} (STAFF)`); } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'สมัครสมาชิกและเข้าใช้งานทันที'; } }
  }
  function initApp() { try { const s = localStorage.getItem(STORAGE.THEME); if (s) state.theme = s; } catch (_) { }
    applyTheme(state.theme); try { const c = JSON.parse(localStorage.getItem(STORAGE.CFG) || 'null');
      if (c && c.gasUrl && !c.gasUrl.includes('AKfycwEq') && !c.gasUrl.includes('AdilEhkvSke')) {
        state.gasUrl = (c.gasUrl || '').trim(); state.passcode = c.passcode || ''; state.isLive = Boolean(c.isLive && state.gasUrl); } else {
        state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true;
        localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true })); }
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl; if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode; } catch (_) { }
    loadSavedSession(); initMonthSelector(); bindEvents(); if (state.currentUser) {
      if (state.isLive && state.gasUrl) { if (loadLiveCache()) renderAll(); syncWithServer(true); }
      else { loadDemoData(); renderAll(); }
    } else if (state.isLive && state.gasUrl) {
      callGasApi('listUsers', {}).then(d => { if (d && Array.isArray(d.users) && d.users.length) state.users = d.users; }).catch(() => { });
    } else loadDemoData(); updateClock(); setInterval(updateClock, 15000); }
  function loadDemoData() { state.isLive = false; try {
      const a = localStorage.getItem(STORAGE.APTS), l = localStorage.getItem(STORAGE.LOGS), u = localStorage.getItem(STORAGE.USERS);
      state.users = u ? JSON.parse(u) : [...Logic.DEFAULT_USERS];
      if (a) { state.appointments = JSON.parse(a); state.rescheduleLogs = l ? JSON.parse(l) : []; return; }
    } catch (_) { }
    state.users = [...Logic.DEFAULT_USERS]; const now = Logic.getBangkokParts(), tmr = Logic.getBangkokParts(now.epochMs + 86400000), nYr = now.year + 1;
    const seeds = [
      { title: 'ประชุมตรวจรับงานและสรุปความต้องการ', appointmentDate: tmr.dateStr, appointmentTime: '10:00', location: 'ห้อง B ชั้น 4', contactPerson: 'คุณสมชาย', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณสมชาย' },
      { title: 'นัดหารือแนวทางเชื่อมต่อระบบ', appointmentDate: Logic.getBangkokParts(now.epochMs + 5 * 86400000).dateStr, appointmentTime: '14:30', location: 'ออนไลน์', contactPerson: 'คุณวิภาดา', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณวิภาดา' },
      { title: 'ตรวจประเมินผลการดำเนินงานไตรมาส 1', appointmentDate: `${nYr}-03-15`, appointmentTime: '09:30', location: 'ศูนย์พระราม 9', contactPerson: 'คุณนภัสสร', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 2, remindHoursBefore: 1, createdBy: 'ผู้ดูแลระบบ' }
    ]; const b = []; seeds.forEach(s => b.push(Logic.createAppointmentRecord(s, b, now.isoStr)));
    state.appointments = b; state.rescheduleLogs = []; saveDemoData(); }
  function saveDemoData() { if (state.isLive) return; localStorage.setItem(STORAGE.APTS, JSON.stringify(state.appointments));
    localStorage.setItem(STORAGE.LOGS, JSON.stringify(state.rescheduleLogs)); localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users)); }
  // GAS API Gateway & Synchronization
  async function callGasApi(action, payload) { if (!state.gasUrl) throw new Error('ยังไม่ได้ระบุ Web App URL'); const res = await fetch(state.gasUrl, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, passcode: state.passcode, currentUser: state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ', ...payload })
    }); const r = await res.json(); if (!r.ok) { const err = new Error(r.error || 'Server error'); err.code = r.code; throw err; }
    return r.data; }
  async function syncWithServer(silent = false) { if (!state.isLive || !state.gasUrl) { renderAll(); return; }
    const btn = $('btnSyncNow'), lbl = $('syncBtnLabel'); try { if (btn) btn.classList.add('is-syncing'); txt(lbl, 'กำลังซิงก์...');
      applySyncBundle(await callGasApi('list', {})); renderAll(); if (!silent) showToast('ซิงก์ข้อมูลล่าสุดสำเร็จ', 'success');
    } catch (e) { showToast('ซิงก์ไม่สำเร็จ: ' + e.message, 'error'); }
    finally { if (btn) btn.classList.toggle('is-syncing', bgTaskCount > 0); txt(lbl, bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์'); }
  }
  // Lazy Active-Tab Rendering Pipeline
  function renderActiveTab() { if (isStaffOnlyCalendar() && state.activeTab !== 'tabMonth') { state.activeTab = 'tabMonth'; applyTabClasses('tabMonth'); }
    renderHeader(); updateUserSessionUI(); if (state.activeTab === 'tabMonth') renderCalendarTab(); else if (state.activeTab === 'tabYear') renderYearTab();
    else if (state.activeTab === 'tabSettings') renderSettingsTab(); else renderListTab(); }
  const renderAll = () => renderActiveTab();
  function updateClock() { const b = Logic.getBangkokParts();
    txt($('bangkokClockDisplay'), `เวลา (BKK): ${Logic.formatThaiDateDisplay(b.dateStr, false)} ${b.timeStr} น.`); }
  function renderHeader() { const bd = $('connectionModeBadge'), ts = $('triggerStatusText'); if (state.isLive) {
      if (bd) { bd.className = 'mode-badge live'; bd.textContent = 'Sheets'; }
      const lr = state.meta.LAST_TRIGGER_RUN_AT; if (ts) { ts.className = lr ? 'meta-status is-live' : 'meta-status'; if (lr) {
          const mins = Math.max(0, Math.round((Logic.getBangkokParts().epochMs - Logic.getBangkokParts(lr).epochMs) / 60000));
          ts.textContent = mins < 1 ? 'Trigger: เพิ่งทำงาน' : (mins < 60 ? `Trigger: ${mins} นาทีที่แล้ว` : `Trigger: ${Math.floor(mins / 60)} ชม. ที่แล้ว`);
        } else ts.textContent = 'Trigger: พร้อมทำงาน'; }
    } else { if (bd) { bd.className = 'mode-badge demo'; bd.textContent = 'Demo'; }
      if (ts) { ts.className = 'meta-status is-demo'; ts.textContent = 'Trigger: โหมดจำลอง'; }
    }
    const lim = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0, pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
    txt($('quotaTextLabel'), `โควตา LINE: ${used}/${lim} (${pct}%)`); const f = $('quotaProgressFill');
    if (f) { f.style.width = `${pct}%`; f.className = 'quota-progress-fill' + (pct >= 90 ? ' danger' : pct >= 80 ? ' warn' : ''); }
    let activeCnt = 0; for (const a of state.appointments) if (a && !a.deletedAt && Logic.normalizeStatus(a.status) === Logic.STATUS.CONFIRMED) activeCnt++;
    txt($('navBadgeActiveCount'), activeCnt); }
  const getStatusClass = s => { const st = Logic.normalizeStatus(s); return st === Logic.STATUS.COMPLETED ? 'status-completed' : (st === Logic.STATUS.CANCELLED ? 'status-cancelled' : 'status-confirmed'); };
  function getRelDate(a, nowBkk, od) { if (od) return { text: 'เลยกำหนด', cls: 'rel-overdue' }; if (!a.appointmentDate) return { text: 'ไม่ระบุวัน', cls: '' };
    const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate);
    return d === 0 ? { text: 'วันนี้', cls: 'rel-today' } : (d === 1 ? { text: 'พรุ่งนี้', cls: 'rel-today' } : { text: d > 0 ? `อีก ${d} วัน` : 'ผ่านมาแล้ว', cls: '' });
  }
  function renderCardHtml(a, cachedNowBkk) {
    const nowBkk = cachedNowBkk || Logic.getBangkokParts(), od = Logic.isOverdue(a, nowBkk.isoStr), st = Logic.normalizeStatus(a.status), cls = getStatusClass(st), rel = getRelDate(a, nowBkk, od);
    let dayNum = '-', monthYr = 'ไม่ระบุวัน';
    if (a.appointmentDate) { const [y, m, d] = a.appointmentDate.split('-').map(Number); if (y && m && d) { dayNum = String(d); monthYr = `${Logic.THAI_MONTHS_SHORT[m - 1]} ${y + 543}`; } }
    const badges = []; if (pendingIds.has(a.id)) badges.push(`<span class="badge-syncing" data-sync-id="${escapeHtml(a.id)}">กำลังซิงก์...</span>`);
    if (od) badges.push('<span class="badge-overdue">เลยกำหนดเวลา</span>');
    if (a.appointmentDate && a.notifiedDayForSlot === a.appointmentDate) badges.push('<span class="badge-info">แจ้งเตือนรายวันแล้ว</span>');
    if (a.appointmentDate && a.appointmentTime && a.notifiedHourForSlot === `${a.appointmentDate}T${a.appointmentTime}`) badges.push('<span class="badge-info">แจ้งเตือนรายชั่วโมงแล้ว</span>');
    if (+a.rescheduleCount > 0) badges.push(`<span class="badge-info">เลื่อนนัด ${+a.rescheduleCount} ครั้ง</span>`);
    const isConf = st === Logic.STATUS.CONFIRMED, creatorName = escapeHtml(a.createdBy || a.updatedBy || '-');
    const attrHtml = [`<span class="attribution-tag">${ICO.user}<span>ผู้สร้าง: <strong>${creatorName}</strong></span></span>`];
    if (st === Logic.STATUS.COMPLETED && a.statusChangedBy) attrHtml.push(`<span class="attribution-tag completed">${ICO.check}<span>เสร็จสิ้นโดย: <strong>${escapeHtml(a.statusChangedBy)}</strong></span></span>`);
    else if (st === Logic.STATUS.CANCELLED && a.statusChangedBy) attrHtml.push(`<span class="attribution-tag cancelled"><span>ยกเลิกโดย: <strong>${escapeHtml(a.statusChangedBy)}</strong>${a.statusReason ? ` (${escapeHtml(a.statusReason)})` : ''}</span></span>`);
    else if (a.updatedBy && a.updatedBy !== (a.createdBy || a.updatedBy)) attrHtml.push(`<span class="attribution-tag">${ICO.edit}<span>แก้ไขล่าสุดโดย: <strong>${escapeHtml(a.updatedBy)}</strong></span></span>`);
    const rD = +a.remindDaysBefore || 0, rH = +a.remindHoursBefore || 0, remTxt = (rD > 0 || rH > 0) ? `เตือน ${rD}ว. / ${rH}ชม.` : 'ปิดเตือนล่วงหน้า';
    return `<article class="apt-card-slim ${cls}${od ? ' is-overdue' : ''}">
      <div class="apt-date-block"><span class="apt-rel-badge ${rel.cls}">${escapeHtml(rel.text)}</span><div><div class="apt-day-num">${escapeHtml(dayNum)}</div><div class="apt-month-yr">${escapeHtml(monthYr)}</div></div><div class="apt-time-pill">${ICO.clock}<span>${escapeHtml(a.appointmentTime || '-')} น.</span></div></div>
      <div class="apt-main-col">
        <div class="apt-badges-row"><span class="status-badge ${cls}">${escapeHtml(st)}</span><span class="apt-id-code">${escapeHtml(a.id)}</span>${badges.join(' ')}</div>
        <h4 class="apt-slim-title">${escapeHtml(a.title)}</h4>
        <div class="apt-slim-meta">
          <span class="apt-meta-chip">${ICO.user}<span>ผู้นัดพบ: <strong>${escapeHtml(a.contactPerson || '-')}</strong></span></span>
          <span class="apt-meta-chip">${ICO.pin}<span>สถานที่: <strong>${escapeHtml(a.location || '-')}</strong></span></span>
          <span class="apt-meta-chip">${ICO.bell}<span>${remTxt}</span></span>
          ${a.mapUrl ? `<span class="apt-meta-chip map-chip">${ICO.pin}<span>มีแผนที่</span></span>` : ''}
          ${a.imageUrl ? `<span class="apt-meta-chip img-chip">${ICO.img}<span>มีรูปแนบ</span></span>` : ''}
        </div>
        <div class="apt-attribution-row">${attrHtml.join(' ')}</div>
        ${a.notes ? `<div class="apt-notes-bar">หมายเหตุ: ${escapeHtml(a.notes)}</div>` : ''}
      </div>
      <div class="apt-slim-actions">
        ${a.mapUrl ? `<button type="button" class="btn btn-outline btn-sm btn-view-map" data-id="${escapeHtml(a.id)}">${ICO.pin}<span>ดูแผนที่</span></button>` : ''}
        ${a.imageUrl ? `<button type="button" class="btn btn-outline btn-sm btn-view-image" data-id="${escapeHtml(a.id)}">${ICO.img}<span>ดูรูปภาพ</span></button>` : ''}
        <button type="button" class="btn btn-outline btn-xs btn-copy-apt" data-id="${escapeHtml(a.id)}" title="คัดลอกข้อความสรุปนัดหมาย">${ICO.copy}<span>คัดลอกข้อความ</span></button>
        <button type="button" class="btn btn-outline btn-xs btn-dup-apt" data-id="${escapeHtml(a.id)}" title="สร้างนัดหมายซ้ำจากรายการนี้"><span>คัดลอกนัด</span></button>
        <button type="button" class="btn btn-outline btn-xs btn-ics-apt" data-id="${escapeHtml(a.id)}" title="ดาวน์โหลดไฟล์ .ics เข้าปฏิทินมือถือ">${ICO.cal}<span>.ics</span></button>
        ${isConf ? `<button type="button" class="btn btn-success btn-sm btn-quick-complete" data-id="${escapeHtml(a.id)}">${ICO.check}<span>เสร็จสิ้น</span></button>` : ''}
        <button type="button" class="btn btn-soft btn-sm btn-edit-apt" data-id="${escapeHtml(a.id)}">${ICO.edit}<span>แก้ไข/เลื่อน</span></button>
        ${isConf ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-open-cancel-modal" data-id="${escapeHtml(a.id)}">ยกเลิก</button>` : `<button type="button" class="btn btn-outline btn-sm btn-quick-reopen" data-id="${escapeHtml(a.id)}">คืนสถานะนัด</button>`}
      </div>
    </article>`; }
  function renderListTab() { const nowBkk = Logic.getBangkokParts(), all = state.appointments.filter(a => a && !a.deletedAt);
    let sConf = 0, sComp = 0, sCanc = 0, sOd = 0; all.forEach(a => { const st = Logic.normalizeStatus(a.status);
      if (st === Logic.STATUS.CONFIRMED) sConf++; else if (st === Logic.STATUS.COMPLETED) sComp++; else if (st === Logic.STATUS.CANCELLED) sCanc++;
      if (Logic.isOverdue(a, nowBkk.isoStr)) sOd++; });
    txt($('statTotal'), all.length); txt($('statConfirmed'), sConf); txt($('statCompleted'), sComp); txt($('statCancelled'), sCanc); txt($('statOverdue'), sOd);
    txt($('navBadgeActiveCount'), sConf); const userSel = $('filterUser'); if (userSel) { const curVal = userSel.value, creators = new Set();
      all.forEach(a => { const c = a.createdBy || a.updatedBy; if (c) creators.add(c); });
      (state.users || []).forEach(u => { if (u && u.displayName) creators.add(u.displayName); });
      let optHtml = '<option value="">สมาชิกทุกคน</option><option value="MY_APTS">เฉพาะงานของฉัน</option>';
      creators.forEach(name => { optHtml += `<option value="${escapeHtml(name)}">งานที่สร้างโดย: ${escapeHtml(name)}</option>`; });
      userSel.innerHTML = optHtml; userSel.value = curVal; }
    const kw = ($('filterSearch').value || '').trim().toLowerCase(), st = $('filterStatus').value, dt = $('filterDate').value, uFilter = userSel ? userSel.value : '';
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.toggle('active-stat', (p.getAttribute('data-filter-status') || '') === st));
    const tmrStr = Logic.getBangkokParts(nowBkk.epochMs + 86400000).dateStr;
    const filtered = getFilteredListAppointments(nowBkk, all, { kw, st, dt, uFilter, tmrStr });
    txt($('listResultSummary'), `แสดงรายการนัดหมาย ${filtered.length} รายการ (จากทั้งหมด ${all.length} รายการ)`); const listEl = $('appointmentsListContainer');
    if (!filtered.length) { listEl.innerHTML = '<div class="empty-state">ไม่พบรายการนัดหมายตามเงื่อนไขที่เลือก</div>'; return; }
    const groups = { OVERDUE: { label: 'งานเลยกำหนดเวลา', cls: 'group-overdue', items: [] },
      TODAY: { label: `นัดหมายวันนี้ (${Logic.formatThaiDateDisplay(nowBkk.dateStr, false)})`, cls: 'group-today', items: [] },
      TOMORROW: { label: `นัดหมายพรุ่งนี้ (${Logic.formatThaiDateDisplay(tmrStr, false)})`, cls: 'group-tomorrow', items: [] },
      UPCOMING: { label: 'นัดหมายที่กำลังจะมาถึง', cls: 'group-upcoming', items: [] },
      HISTORY: { label: 'ดำเนินการแล้ว / ประวัติย้อนหลัง', cls: 'group-history', items: [] }
    }; filtered.forEach(a => { const aSt = Logic.normalizeStatus(a.status); if (Logic.isOverdue(a, nowBkk.isoStr)) groups.OVERDUE.items.push(a);
      else if (a.appointmentDate === nowBkk.dateStr) groups.TODAY.items.push(a); else if (a.appointmentDate === tmrStr) groups.TOMORROW.items.push(a);
      else if (aSt === Logic.STATUS.CONFIRMED && (!a.appointmentDate || a.appointmentDate > tmrStr)) groups.UPCOMING.items.push(a);
      else groups.HISTORY.items.push(a); });
    listEl.innerHTML = ['OVERDUE', 'TODAY', 'TOMORROW', 'UPCOMING', 'HISTORY'].map(k => groups[k]).filter(g => g.items.length > 0).map(g => `<div class="queue-group-section"><div class="queue-group-header ${g.cls}"><div class="queue-group-title-wrap"><span class="queue-group-dot"></span><span class="queue-group-title">${escapeHtml(g.label)}</span></div><span class="queue-group-count">${g.items.length} รายการ</span></div><div class="queue-group-items">${g.items.map(a => renderCardHtml(a, nowBkk)).join('')}</div></div>`).join('');
  }
  function getFilteredListAppointments(nowBkk, allList, pre) {
    const bkk = nowBkk || Logic.getBangkokParts(), all = allList || state.appointments.filter(a => a && !a.deletedAt);
    const kw = pre ? pre.kw : (($('filterSearch') ? $('filterSearch').value : '') || '').trim().toLowerCase();
    const st = pre ? pre.st : ($('filterStatus') ? $('filterStatus').value : ''); const dt = pre ? pre.dt : ($('filterDate') ? $('filterDate').value : '');
    const uFilter = pre ? pre.uFilter : ($('filterUser') ? $('filterUser').value : '');
    const tmrStr = pre ? pre.tmrStr : Logic.getBangkokParts(bkk.epochMs + 86400000).dateStr;
    const curMonthPfx = `${bkk.year}-${String(bkk.month).padStart(2, '0')}-`, myName = state.currentUser ? state.currentUser.displayName : '';
    return all.filter(a => { const aSt = Logic.normalizeStatus(a.status); if (st === 'ACTIVE_ONLY' && aSt !== Logic.STATUS.CONFIRMED) return false;
      if (st === 'OVERDUE' && !Logic.isOverdue(a, bkk.isoStr)) return false; if (st && st !== 'ACTIVE_ONLY' && st !== 'OVERDUE' && aSt !== st) return false;
      if (dt && a.appointmentDate !== dt) return false; if (uFilter === 'MY_APTS' && (a.createdBy || a.updatedBy) !== myName) return false;
      if (uFilter && uFilter !== 'MY_APTS' && (a.createdBy || a.updatedBy) !== uFilter) return false; if (!dt && state.quickRange !== 'ALL') {
        if (state.quickRange === 'UPCOMING' && !(aSt === Logic.STATUS.CONFIRMED && a.appointmentDate >= bkk.dateStr)) return false;
        if (state.quickRange === 'TODAY' && a.appointmentDate !== bkk.dateStr) return false;
        if (state.quickRange === 'TOMORROW' && a.appointmentDate !== tmrStr) return false;
        if (state.quickRange === 'NEXT7') { const d = Logic.daysBetweenDates(bkk.dateStr, a.appointmentDate); if (d === null || d < 0 || d > 7) return false; }
        if (state.quickRange === 'MONTH' && (!a.appointmentDate || !a.appointmentDate.startsWith(curMonthPfx))) return false; }
      return !kw || `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${aSt} ${a.notes}`.toLowerCase().includes(kw);
    }).sort((a, b) => (Logic.buildAppointmentSlot(a) || '9999').localeCompare(Logic.buildAppointmentSlot(b) || '9999')); }
  function csvEscapeCell(val) { let s = Logic.sanitizeNoEmoji(val == null ? '' : String(val)); if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function buildCsvContent(items) {
    const headers = ['รหัสนัดหมาย', 'วันที่นัด (พ.ศ.)', 'วันที่ (YYYY-MM-DD)', 'เวลา', 'หัวข้อนัดหมาย', 'ผู้นัดพบ', 'สถานที่', 'สถานะ', 'ผู้สร้างนัด', 'ผู้เปลี่ยนสถานะล่าสุด', 'สาเหตุ/การเลื่อนนัด', 'ลิงก์แผนที่', 'หมายเหตุ'];
    const rows = [headers.map(csvEscapeCell).join(',')]; (items || []).forEach(a => {
      const st = Logic.normalizeStatus(a.status), reasonTxt = a.statusReason || (+a.rescheduleCount > 0 ? `เลื่อนนัด ${+a.rescheduleCount} ครั้ง` : '');
      rows.push([a.id || '', Logic.formatThaiDateDisplay(a.appointmentDate, false), a.appointmentDate || '', (a.appointmentTime || '') + (a.appointmentTime ? ' น.' : ''), a.title || '', a.contactPerson || '', a.location || '', st, a.createdBy || a.updatedBy || '', a.statusChangedBy || '', reasonTxt, normalizeMapUrl(a.mapUrl || ''), a.notes || ''].map(csvEscapeCell).join(','));
    }); return '\uFEFF' + rows.join('\r\n'); }
  function triggerBlobDownload(content, mime, fname) { try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(new Blob([content], { type: mime })), link = document.createElement('a');
        link.href = url; link.setAttribute('download', fname); link.style.display = 'none';
        if (document.body && typeof document.body.appendChild === 'function') document.body.appendChild(link);
        link.click(); if (typeof link.remove === 'function') link.remove(); setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) { } }, 1500); }
    } catch (_) { }
  }
  function exportAppointmentsToCsv(ctx) {
    if (!ctx || !ctx.items || !ctx.items.length) { showToast('ไม่มีรายการนัดหมายสำหรับส่งออกในมุมมองนี้', 'warn'); return ''; }
    const csv = buildCsvContent(ctx.items);
    triggerBlobDownload(csv, 'text/csv;charset=utf-8;', `${ctx.filePrefix || 'appointments'}_${Logic.getBangkokParts().dateStr}.csv`);
    showToast(`ส่งออกไฟล์ CSV เรียบร้อยแล้ว (${ctx.items.length} รายการ)`, 'success'); return csv; }
  function exportAppointmentToIcs(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt);
    if (!a || !a.appointmentDate) { showToast('ไม่พบวันที่นัดหมายสำหรับสร้างไฟล์ปฏิทิน', 'warn'); return ''; }
    const startMs = Logic.bangkokSlotToEpochMs(a.appointmentDate, a.appointmentTime || '09:00') || Date.now(), endMs = startMs + 3600000;
    const fmtUtc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escIcs = s => Logic.sanitizeNoEmoji(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const desc = [`ผู้นัดพบ: ${a.contactPerson || '-'}`, `ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'}`, a.notes ? `หมายเหตุ: ${a.notes}` : '', a.mapUrl ? `แผนที่: ${normalizeMapUrl(a.mapUrl)}` : ''].filter(Boolean).join('\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CalendarSystem//TH', 'BEGIN:VEVENT', `UID:${a.id}@calendar.local`, `DTSTAMP:${fmtUtc(Date.now())}`, `DTSTART:${fmtUtc(startMs)}`, `DTEND:${fmtUtc(endMs)}`, `SUMMARY:${escIcs(a.title)}`, `LOCATION:${escIcs(a.location)}`, `DESCRIPTION:${escIcs(desc)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    triggerBlobDownload(ics, 'text/calendar;charset=utf-8;', `${a.id}.ics`); showToast(`ดาวน์โหลดไฟล์ปฏิทิน ${a.id}.ics แล้ว`, 'success'); return ics; }
  function copyAppointmentText(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return '';
    const out = Logic.formatInstantAppointmentMessage(a, false, { privacyMaskContact: false });
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') navigator.clipboard.writeText(out).catch(() => { });
    showToast('คัดลอกข้อความสรุปนัดหมายลงคลิปบอร์ดแล้ว', 'success'); return out; }
  function printAppointmentsReport(ctx) {
    if (!ctx || !ctx.items || !ctx.items.length) { showToast('ไม่มีรายการนัดหมายสำหรับพิมพ์รายงานในมุมมองนี้', 'warn'); return false; }
    const sheet = $('printReportSheet'); if (!sheet) return false; const nowBkk = Logic.getBangkokParts(), items = ctx.items;
    let cConf = 0, cComp = 0, cCanc = 0; items.forEach(a => { const st = Logic.normalizeStatus(a.status);
      if (st === Logic.STATUS.CONFIRMED) cConf++; else if (st === Logic.STATUS.COMPLETED) cComp++; else if (st === Logic.STATUS.CANCELLED) cCanc++; });
    const rowsHtml = items.map((a, idx) => { const st = Logic.normalizeStatus(a.status);
      const subNote = [a.notes ? `หมายเหตุ: ${a.notes}` : '', a.statusReason ? `สาเหตุ: ${a.statusReason}` : ''].filter(Boolean).join(' | ');
      const actor = st === Logic.STATUS.COMPLETED && a.statusChangedBy ? `เสร็จสิ้นโดย: ${a.statusChangedBy}` : (st === Logic.STATUS.CANCELLED && a.statusChangedBy ? `ยกเลิกโดย: ${a.statusChangedBy}` : `ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'}`);
      return `<tr><td style="text-align:center;width:34px;">${idx + 1}</td><td style="white-space:nowrap;font-weight:600;">${escapeHtml(a.id || '-')}</td><td style="white-space:nowrap;"><div><strong>${escapeHtml(Logic.formatThaiDateDisplay(a.appointmentDate, false))}</strong></div><div style="color:#475569;">เวลา ${escapeHtml(a.appointmentTime || '-')} น.</div></td><td><div style="font-weight:700;">${escapeHtml(a.title || '-')}</div>${subNote ? `<div style="font-size:10px;color:#475569;margin-top:2px;">${escapeHtml(subNote)}</div>` : ''}</td><td>${escapeHtml(a.contactPerson || '-')}</td><td>${escapeHtml(a.location || '-')}</td><td><div><span class="print-st-pill">${escapeHtml(st)}</span></div><div style="font-size:10px;color:#475569;margin-top:2px;">${escapeHtml(actor)}</div></td></tr>`;
    }).join(''); const printer = state.currentUser ? `${state.currentUser.displayName} (${state.currentUser.role || 'STAFF'})` : 'ผู้ใช้งานระบบ';
    sheet.innerHTML = `<div class="print-doc-header"><div><h1 class="print-doc-title">${escapeHtml(ctx.title || 'ใบสรุปตารางนัดหมาย')}</h1><p class="print-doc-sub">${escapeHtml(ctx.subtitle || 'ระบบบริหารตารางนัดหมายทีม')}</p></div><div class="print-doc-meta"><div>วันที่พิมพ์: ${escapeHtml(Logic.formatThaiDateDisplay(nowBkk.dateStr, false))} เวลา ${escapeHtml(nowBkk.timeStr)} น.</div><div>ผู้ออกรายงาน: ${escapeHtml(printer)}</div></div></div>
      <div class="print-kpi-row"><div class="print-kpi-box"><span class="print-kpi-label">รายการนัดหมายทั้งหมด</span><span class="print-kpi-val">${items.length} งาน</span></div><div class="print-kpi-box"><span class="print-kpi-label">นัดหมายแล้ว (รอดำเนินการ)</span><span class="print-kpi-val">${cConf} งาน</span></div><div class="print-kpi-box"><span class="print-kpi-label">สิ้นสุดการนัดหมาย</span><span class="print-kpi-val">${cComp} งาน</span></div><div class="print-kpi-box"><span class="print-kpi-label">ยกเลิกการนัดหมาย</span><span class="print-kpi-val">${cCanc} งาน</span></div></div>
      <table class="print-table"><thead><tr><th>#</th><th>รหัสนัด</th><th>วัน-เวลานัด</th><th>หัวข้อนัดหมาย / รายละเอียด</th><th>ผู้นัดพบ</th><th>สถานที่</th><th>สถานะ / ผู้รับผิดชอบ</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="print-footer-sign"><span>เอกสารออกโดยระบบนัดคิวทำงานอัตโนมัติ (v${escapeHtml(Logic.API_VERSION)})</span><span>จำนวนรวมทั้งสิ้น ${items.length} รายการ</span></div>`;
    if (typeof window.print === 'function') window.print(); return true; }
  function getCalFilteredMonthData(nowIso) {
    const mData = Logic.queryByMonth(state.appointments, state.calYear, state.calMonth, { nowIso: nowIso || Logic.getBangkokParts().isoStr });
    if (!state.calOnlyMyApts || !state.currentUser) return mData; const myName = state.currentUser.displayName;
    return { ...mData, items: mData.items.filter(a => (a.createdBy || a.updatedBy) === myName || a.statusChangedBy === myName) }; }
  function getMonthExportContext() { const mData = getCalFilteredMonthData();
    const items = state.calSelectedDate ? mData.items.filter(a => a.appointmentDate === state.calSelectedDate) : mData.items;
    const title = state.calSelectedDate ? `ใบสรุปตารางนัดหมายประจำวันที่ ${Logic.formatThaiDateDisplay(state.calSelectedDate, true)}` : `ใบสรุปตารางนัดหมายประจำเดือน ${mData.monthNameThai} พ.ศ. ${mData.buddhistYear}`;
    return { items, title, subtitle: `มุมมองปฏิทินเดือน (${items.length} รายการ)`, filePrefix: state.calSelectedDate ? `ตารางนัด_${state.calSelectedDate}` : `ตารางนัดเดือน_${mData.ceYear}_${String(state.calMonth).padStart(2, '0')}` };
  }
  function getListExportContext() {
    const items = getFilteredListAppointments(), rangeMap = { ALL: 'ทั้งหมด', UPCOMING: 'กำลังจะมาถึง', TODAY: 'วันนี้', TOMORROW: 'พรุ่งนี้', NEXT7: '7 วันข้างหน้า', MONTH: 'เดือนนี้' };
    return { items, title: 'ใบสรุปรายการคิวงานนัดหมาย', subtitle: `ช่วงเวลา: ${rangeMap[state.quickRange] || 'ทั้งหมด'} | จำนวนที่พบ ${items.length} รายการ`, filePrefix: 'รายการคิวงาน' };
  }
  function getYearExportContext() { const selYr = Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: Logic.getBangkokParts().isoStr });
    return { items: selYr.items, title: `รายงานสรุปตารางนัดหมายประจำปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`, subtitle: `อัตราความสำเร็จ ${selYr.stats.completionRate}% | เลื่อนนัดสะสม ${selYr.stats.rescheduleTotal} ครั้ง`, filePrefix: `สรุปนัดหมายรายปี_${selYr.buddhistYear}` };
  }
  function initMonthSelector() { const sel = $('calSelectMonth'); if (!sel) return;
    sel.innerHTML = Logic.THAI_MONTHS_FULL.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    sel.value = String(state.calMonth); $('calInputYear').value = String(state.calYear + 543); $('yearOverviewInput').value = String(state.overviewYear + 543);
  }
  let _lastCalMonthData = null;
  function renderMonthAgenda(mData, nowBkk) {
    const md = mData || _lastCalMonthData || getCalFilteredMonthData((nowBkk || Logic.getBangkokParts()).isoStr), bkk = nowBkk || Logic.getBangkokParts();
    const showItems = state.calSelectedDate ? md.items.filter(a => a.appointmentDate === state.calSelectedDate) : md.items;
    txt($('agendaEyebrow'), state.calSelectedDate ? 'วันที่เลือกในปฏิทิน' : `ภาพรวมประจำเดือน (${md.items.length} งาน)`);
    disp($('btnShowAllMonthApts'), state.calSelectedDate ? 'inline-flex' : 'none');
    txt($('monthlyListHeader'), state.calSelectedDate ? `${Logic.formatThaiDateDisplay(state.calSelectedDate, false)} (${showItems.length} งาน)` : `นัดหมายเดือน${md.monthNameThai} (${showItems.length} งาน)`);
    $('monthlyAppointmentsList').innerHTML = showItems.length ? showItems.map(a => renderCardHtml(a, bkk)).join('') : '<div class="empty-state">ไม่มีรายการนัดหมายในวันที่เลือก กดปุ่ม "+ นัดวันนี้" ด้านบนเพื่อสร้างนัดใหม่</div>';
  }
  function selectCalendarDate(dtStr) { state.calSelectedDate = state.calSelectedDate === dtStr ? '' : (dtStr || ''); const grid = $('calendarGridContainer');
    if (grid) grid.querySelectorAll('.cal-cell[data-date]').forEach(c => c.classList.toggle('selected', c.getAttribute('data-date') === state.calSelectedDate));
    renderMonthAgenda(); }
  function renderCalendarTab() {
    const nowBkk = Logic.getBangkokParts(), y = state.calYear, m = state.calMonth, mData = (_lastCalMonthData = getCalFilteredMonthData(nowBkk.isoStr));
    txt($('calendarMonthTitle'), `${mData.monthNameThai} พ.ศ. ${mData.buddhistYear}`);
    $('calSelectMonth').value = String(m); $('calInputYear').value = String(mData.buddhistYear); const myBtn = $('btnCalFilterMyApts');
    if (myBtn) { myBtn.textContent = state.calOnlyMyApts ? 'เฉพาะงานของฉัน' : 'งานทุกคนในทีม'; myBtn.className = `btn ${state.calOnlyMyApts ? 'btn-soft' : 'btn-outline'} btn-sm`; }
    const byDate = {}; mData.items.forEach(a => { (byDate[a.appointmentDate] || (byDate[a.appointmentDate] = [])).push(a); });
    const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), maxDay = Logic.getDaysInMonth(y, m), todayStr = nowBkk.dateStr;
    const cells = Array.from({ length: startDow }, () => '<div class="cal-cell empty"></div>'); for (let d = 1; d <= maxDay; d++) {
      const dtStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, itms = byDate[dtStr] || [];
      const pills = itms.slice(0, 3).map(a => `<div class="cal-apt-pill ${getStatusClass(a.status)}">${escapeHtml(a.appointmentTime || '')} ${escapeHtml(a.title)}</div>`).join('');
      const more = itms.length > 3 ? `<div style="font-size:10px;font-weight:600;color:var(--primary);">+ อีก ${itms.length - 3} งาน</div>` : '';
      cells.push(`<div class="cal-cell ${dtStr === todayStr ? 'today' : ''} ${dtStr === state.calSelectedDate ? 'selected' : ''}" data-date="${dtStr}"><div class="cal-cell-head"><span class="cal-date-num">${d}</span><button type="button" class="btn-cell-add" data-add-date="${dtStr}">+</button></div>${pills}${more}</div>`);
    }
    $('calendarGridContainer').innerHTML = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="cal-day-header">${d}</div>`).join('') + cells.join('');
    renderMonthAgenda(mData, nowBkk); }
  function renderYearTab() { const nowBkk = Logic.getBangkokParts(), curY = nowBkk.year;
    const multi = Logic.queryMultiYearOverview(state.appointments, Math.min(curY, state.overviewYear), Math.max(curY + 3, state.overviewYear + 1), { nowIso: nowBkk.isoStr });
    $('multiYearCardsContainer').innerHTML = multi.years.map(yr => `<div class="year-summary-card ${yr.ceYear === state.overviewYear ? 'active' : ''}" data-year="${yr.ceYear}"><div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:15px;">พ.ศ. ${yr.buddhistYear}</strong><span class="badge-info">ค.ศ. ${yr.ceYear}</span></div><div style="font-size:12px;color:var(--text-secondary);margin:6px 0;">รวม <strong>${yr.stats.total}</strong> งาน | รอ <strong>${yr.stats.active}</strong> | เสร็จ <strong>${yr.stats.completed}</strong></div><div class="month-mini-bar"><div style="width:${yr.stats.total ? yr.stats.completionRate : 0}%;background:#10b981;"></div></div></div>`).join('');
    const selYr = Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: nowBkk.isoStr }), s = selYr.stats;
    txt($('selectedYearHeader'), `สรุปสถิติตลอดทั้งปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`);
    const b = (t, v, sub, col) => `<div class="stat-box"${col ? ` style="border-left:4px solid ${col};"` : ''}><span class="stat-box-title">${t}</span><span class="stat-box-val">${v}</span><span class="stat-box-sub">${sub}</span></div>`;
    $('yearEndSummaryCards').innerHTML = b('งานนัดหมายทั้งหมด', s.total, 'รายการสะสมทั้งปี') + b('นัดหมายแล้ว (รอดำเนินการ)', s.active, 'รอถึงกำหนดนัดหมาย', 'var(--st-conf-border)') + b('สิ้นสุดการนัดหมาย', s.completed, `อัตราความสำเร็จ ${s.completionRate}%`, 'var(--st-comp-border)') + b('ยกเลิกการนัดหมาย', s.cancelled, `อัตราการยกเลิก ${s.cancellationRate}%`, 'var(--st-canc-border)') + b('การเลื่อนนัดสะสม', s.rescheduleTotal, 'ครั้งที่มีการเลื่อนวัน/เวลา');
    const uPerfGrid = $('userPerformanceGrid'); if (uPerfGrid) { const uStats = selYr.userStats || Logic.calculateUserStats(selYr.items);
      uPerfGrid.innerHTML = !uStats.length ? '<div class="empty-state">ยังไม่มีข้อมูลสถิติผู้ใช้งานในปีนี้</div>' : uStats.map(u => `<div class="user-stat-card"><div class="user-stat-header"><span>${escapeHtml(u.user)}</span><span class="badge-info">สร้างนัด ${u.createdTotal} งาน</span></div><div class="user-stat-counts"><span style="color:var(--st-comp-text);">กดเสร็จสิ้น: <strong>${u.completedTotal}</strong></span><span style="color:var(--st-canc-text);">กดยกเลิก: <strong>${u.cancelledTotal}</strong></span><span style="color:var(--st-conf-text);">รอดำเนินการ: <strong>${u.activeTotal}</strong></span></div></div>`).join('');
    }
    $('yearMonthsGrid').innerHTML = selYr.months.map(m => {
      const tot = m.stats.total || 0, pComp = tot ? Math.round((m.stats.completed / tot) * 100) : 0, pConf = tot ? Math.round((m.stats.active / tot) * 100) : 0, pCanc = tot ? Math.max(0, 100 - pComp - pConf) : 0;
      const itms = !m.items.length ? '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">ไม่มีรายการนัดหมาย</div>' : m.items.map(a => {
        const aSt = Logic.normalizeStatus(a.status), stCol = aSt === Logic.STATUS.COMPLETED ? 'var(--st-comp-border)' : (aSt === Logic.STATUS.CANCELLED ? 'var(--st-canc-border)' : 'var(--st-conf-border)');
        return `<div class="btn-edit-apt" data-id="${escapeHtml(a.id)}" style="cursor:pointer;padding:6px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;border-left:3px solid ${stCol};font-size:11.5px;"><div style="font-weight:600;color:var(--text-main);">${a.appointmentDate.slice(8, 10)} ${m.monthShortThai} ${a.appointmentTime || ''} - ${escapeHtml(a.title)}</div><div style="color:var(--text-secondary);font-size:11px;">${escapeHtml(a.contactPerson || '-')} | ผู้สร้าง: ${escapeHtml(a.createdBy || a.updatedBy || '-')}</div></div>`;
      }).join('');
      return `<div class="month-box"><div class="month-box-header"><span>${m.monthNameThai}</span><div style="display:flex;align-items:center;gap:6px;"><span class="badge-info">รวม ${m.stats.total}</span><button type="button" class="btn btn-outline btn-sm btn-jump-cal-month" data-year="${selYr.ceYear}" data-month="${m.month}" style="padding:2px 7px;font-size:11px;">ดูปฏิทิน</button></div></div><div class="month-mini-bar"><div style="width:${pComp}%;background:var(--st-comp-border);"></div><div style="width:${pConf}%;background:var(--st-conf-border);"></div><div style="width:${pCanc}%;background:var(--st-canc-border);"></div></div><div style="display:flex;flex-direction:column;gap:5px;">${itms}</div></div>`;
    }).join(''); }
  function renderSettingsTab() { $('cfgDigestHour').value = state.meta.DAILY_DIGEST_HOUR || '8';
    $('cfgEnableBotQuery').checked = String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE';
    $('cfgPrivacyMask').checked = String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
    if ($('cfgNotifyStatusChange')) $('cfgNotifyStatusChange').checked = String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE';
    const uTableBody = $('userTableBody'); if (uTableBody) {
      const isAdmin = Boolean(state.currentUser && state.currentUser.role === 'ADMIN'), curUn = state.currentUser ? state.currentUser.username : '';
      uTableBody.innerHTML = (state.users && state.users.length ? state.users : Logic.DEFAULT_USERS).map(u => {
        const canToggle = isAdmin && u.username !== 'admin' && u.username !== curUn;
        return `<tr><td><span class="apt-id-code">${escapeHtml(u.userId || '-')}</span></td><td><strong>${escapeHtml(u.username)}</strong></td><td>${escapeHtml(u.displayName || '-')}</td><td><span class="badge-role ${(u.role || 'STAFF').toLowerCase()}">${escapeHtml(u.role || 'STAFF')}</span></td><td><span class="status-badge ${u.isActive !== false ? 'status-completed' : 'status-cancelled'}">${u.isActive !== false ? 'ใช้งาน' : 'ระงับ'}</span></td><td style="color:var(--text-muted);font-size:12px;">${escapeHtml(u.lastLoginAt ? Logic.formatThaiDateDisplay(u.lastLoginAt.slice(0, 10), false) + ' ' + u.lastLoginAt.slice(11, 16) : 'ยังไม่เคยเข้าใช้')}</td><td>${isAdmin ? `<button type="button" class="btn btn-soft btn-sm btn-edit-user" data-uid="${escapeHtml(u.userId)}">แก้ไข</button>` : '<span class="hint-text">เฉพาะ ADMIN</span>'}${canToggle ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-toggle-user" data-uid="${escapeHtml(u.userId)}" data-active="${u.isActive !== false ? 'true' : 'false'}">${u.isActive !== false ? 'ระงับ' : 'เปิดใช้'}</button>` : ''}</td></tr>`;
      }).join(''); }
    const tb = $('rescheduleLogsTableBody');
    if (!state.rescheduleLogs.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:18px;">ยังไม่มีประวัติการเลื่อนนัดหรือแก้ไขข้อมูล</td></tr>'; return; }
    tb.innerHTML = state.rescheduleLogs.slice(0, 40).map(l => `<tr><td>${escapeHtml(l.changedAt)}</td><td><span class="apt-id-code">${escapeHtml(l.appointmentId)}</span></td><td>${escapeHtml(l.changedBy)}</td><td><span class="badge-info">${escapeHtml(FIELD_LABELS[l.fieldChanged] || l.fieldChanged)}</span></td><td style="color:var(--text-muted);">${escapeHtml(l.oldValue || '-')}</td><td><strong>${escapeHtml(l.newValue || '-')}</strong></td><td>${escapeHtml(l.reason || '-')}</td></tr>`).join('');
  }
  function renderPatchNotes() { const c = $('patchNotesContainer'); if (!c) return;
    c.innerHTML = PatchNotes.map(p => `<div class="patch-card"><div class="patch-card-head"><span>เวอร์ชัน ${escapeHtml(p.version)}</span><span class="hint-text">${escapeHtml(p.date)}</span></div><div class="patch-card-desc">${escapeHtml(p.title)}</div><ul>${(p.changes || []).map(ch => `<li>${escapeHtml(ch)}</li>`).join('')}</ul></div>`).join('');
  }
  // Map Pinning, Image Compression & Quick Reminder Helpers
  let pickerMap = null, pickerMarker = null, previewMap = null;
  function parseCoords(raw) { const s = String(raw || '').trim();
    const m = s.match(/(?:@|[?&](?:q|ll|destination)=|^\s*)(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/) || s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null; const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) ? { lat, lng } : null; }
  function normalizeMapUrl(raw) { const s = Logic.sanitizeNoEmoji(raw || '').trim(); if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    const ll = parseCoords(s);
    return ll ? `https://www.google.com/maps?q=${ll.lat},${ll.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`;
  }
  function updateMapPinUI() { disp($('btnClearMapPin'), ($('formMapUrl') ? $('formMapUrl').value : '').trim() ? 'inline-flex' : 'none'); }
  function setMapPinCoords(lat, lng, statusTxt) { const latF = Number(lat).toFixed(6), lngF = Number(lng).toFixed(6);
    if ($('formMapUrl')) $('formMapUrl').value = `https://www.google.com/maps?q=${latF},${lngF}`;
    txt($('mapPickerStatus'), statusTxt || `ปักหมุดแล้ว: ${latF}, ${lngF}`); updateMapPinUI();
    if (pickerMap && pickerMarker) { pickerMarker.setLatLng([+latF, +lngF]); pickerMap.setView([+latF, +lngF], Math.max(pickerMap.getZoom(), 15)); }
  }
  function openMapPickerPanel(optCoords) { const wrap = $('mapPickerWrap'); if (!wrap) return; wrap.style.display = 'flex';
    const c = optCoords || parseCoords($('formMapUrl') ? $('formMapUrl').value : '') || { lat: 13.7563, lng: 100.5018 }, box = $('leafletMapPicker');
    if (typeof window.L !== 'undefined' && box) { if (!pickerMap) { pickerMap = window.L.map(box).setView([c.lat, c.lng], 14);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM' }).addTo(pickerMap);
        pickerMarker = window.L.marker([c.lat, c.lng], { draggable: true }).addTo(pickerMap);
        pickerMap.on('click', ev => setMapPinCoords(ev.latlng.lat, ev.latlng.lng));
        pickerMarker.on('dragend', () => { const p = pickerMarker.getLatLng(); setMapPinCoords(p.lat, p.lng); }); } else setMapPinCoords(c.lat, c.lng);
      setTimeout(() => { if (pickerMap) pickerMap.invalidateSize(); }, 90);
    } else txt($('mapPickerStatus'), 'ไม่สามารถโหลดแผนที่แบบโต้ตอบได้ (สามารถวางลิงก์ Google Maps ในช่องด้านบนได้ทันที)'); }
  async function searchAndPinMap(query) { const q = Logic.sanitizeNoEmoji(query || '').trim();
    if (!q) { showToast('กรุณาระบุชื่อสถานที่เพื่อค้นหาบนแผนที่', 'warn'); return; }
    openMapPickerPanel(); txt($('mapPickerStatus'), `กำลังค้นหา "${q}"...`); try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`), d = await r.json();
      if (Array.isArray(d) && d[0]) { setMapPinCoords(d[0].lat, d[0].lon, `พบตำแหน่ง: ${d[0].display_name.slice(0, 70)}`); showToast('ปักหมุดตำแหน่งจากสถานที่สำเร็จ', 'success'); }
      else { txt($('mapPickerStatus'), 'ไม่พบพิกัดอัตโนมัติ ลองค้นหาด้วยชื่อย่าน/จังหวัด หรือคลิกปักหมุดบนแผนที่เอง'); showToast('ไม่พบพิกัดของสถานที่นี้ ลองคลิกบนแผนที่เพื่อปักหมุด', 'warn'); }
    } catch (_) { txt($('mapPickerStatus'), 'เชื่อมต่อค้นหาไม่สำเร็จ กรุณาคลิกปักหมุดบนแผนที่หรือวางลิงก์ Google Maps'); }
  }
  function openMapPreviewModal(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a || !a.mapUrl) return;
    txt($('mapPreviewTitle'), `แผนที่นัดหมาย: ${a.title}`); txt($('mapPreviewLocation'), `สถานที่: ${a.location || '-'}`);
    if ($('btnOpenExternalMap')) $('btnOpenExternalMap').href = normalizeMapUrl(a.mapUrl || a.location || '') || 'https://maps.google.com';
    const box = $('mapPreviewContainer'); if (previewMap) { try { previewMap.remove(); } catch (_) { } previewMap = null; }
    openModal('mapPreviewModal'); if (!box) return; box.innerHTML = ''; const ll = parseCoords(a.mapUrl); if (ll && typeof window.L !== 'undefined') {
      setTimeout(() => { try { previewMap = window.L.map(box).setView([ll.lat, ll.lng], 15);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM' }).addTo(previewMap);
          window.L.marker([ll.lat, ll.lng]).addTo(previewMap).bindPopup(escapeHtml(a.location || a.title || 'จุดนัดพบ')).openPopup();
          previewMap.invalidateSize(); } catch (_) { }
      }, 60);
    } else box.innerHTML = `<iframe class="map-embed-iframe" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(ll ? `${ll.lat},${ll.lng}` : (a.location || a.mapUrl))}&z=15&output=embed"></iframe>`;
  }
  function setFormImagePreview(val, infoText) { const v = Logic.sanitizeNoEmoji(val || '').trim(); if ($('formImageData')) $('formImageData').value = v;
    const nextUrlVal = v && !v.startsWith('data:') ? v : '';
    if ($('formImageUrlInput') && $('formImageUrlInput').value !== nextUrlVal) $('formImageUrlInput').value = nextUrlVal;
    if ($('formImagePreview')) $('formImagePreview').src = v || '';
    disp($('formImagePreviewWrap'), v ? 'flex' : 'none'); disp($('btnClearImage'), v ? 'inline-flex' : 'none');
    txt($('formImageSizeInfo'), infoText || (v ? (v.startsWith('data:') ? `ขนาดข้อมูล: ${Math.max(1, Math.round(v.length / 1024))} KB` : 'ลิงก์รูปภาพภายนอก') : ''));
  }
  function compressImageFile(file) { if (!file || !file.type || !file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error'); return; }
    const reader = new FileReader(); reader.onload = ev => { const img = new Image(); img.onload = () => { const tryEncode = (maxDim, q) => {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
          return { url: cv.toDataURL('image/jpeg', q), w, h }; }; let res = tryEncode(720, 0.72); if (res.url.length > 42000) res = tryEncode(560, 0.56);
        if (res.url.length > 45000) res = tryEncode(420, 0.45);
        if (res.url.length > 48000) { showToast('รูปภาพมีขนาดใหญ่เกินไปแม้หลังบีบอัด กรุณาใช้รูปที่เล็กลงหรือวางเป็นลิงก์รูปแทน', 'error'); return; }
        setFormImagePreview(res.url, `ย่อขนาดอัตโนมัติ ${res.w}x${res.h} (${Math.max(1, Math.round(res.url.length / 1024))} KB)`);
        showToast('แนบรูปภาพสำเร็จ', 'success'); }; img.src = ev.target.result; }; reader.readAsDataURL(file); }
  function openImagePreviewModal(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a || !a.imageUrl) return;
    txt($('imagePreviewTitle'), `รูปภาพแนบ: ${a.title}`); if ($('imagePreviewFull')) $('imagePreviewFull').src = a.imageUrl;
    if ($('btnOpenExternalImage')) $('btnOpenExternalImage').href = a.imageUrl; openModal('imagePreviewModal'); }
  function syncRemindChips() { ['formRemindDays', 'formRemindHours'].forEach(id => {
      const val = String(Math.max(0, parseInt($(id) ? $(id).value : '0', 10) || 0));
      document.querySelectorAll(`.remind-chip[data-remind-target="${id}"]`).forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === val)); });
  }
  function checkConflictOnForm() { const banner = $('conflictWarningBanner'); if (!banner) return;
    const conflicts = Logic.findTimeConflicts(state.appointments, $('formDate').value, $('formTime').value, $('formAptId').value);
    if (conflicts.length > 0) { banner.textContent = `แจ้งเตือน: มีนัดหมายอื่นในวันและเวลานี้แล้ว (${conflicts.length} งาน: ${conflicts.map(c => c.title).join(', ')})`; banner.style.display = 'block'; }
    else banner.style.display = 'none'; }
  function updateDateThaiPreview() { const v = $('formDate').value; txt($('formDateThaiPreview'), v ? Logic.formatThaiDateDisplay(v, true) : 'ยังไม่ระบุวันที่'); }
  function fillAptForm(f) { $('formAptId').value = f.id || ''; $('formExpectedUpdatedAt').value = f.updatedAt || '';
    $('formTitle').value = f.title || ''; $('formStatus').value = f.status || Logic.STATUS.CONFIRMED;
    $('formContactPerson').value = f.contactPerson || ''; $('formDate').value = f.date || '';
    $('formTime').value = f.time || '09:00'; $('formLocation').value = f.location || ''; if ($('formMapUrl')) $('formMapUrl').value = f.mapUrl || '';
    disp($('mapPickerWrap'), 'none'); if ($('formMapSearchInput')) $('formMapSearchInput').value = ''; updateMapPinUI();
    $('formRemindDays').value = String(f.remindDays != null && f.remindDays !== '' ? f.remindDays : 0);
    $('formRemindHours').value = String(f.remindHours != null && f.remindHours !== '' ? f.remindHours : 0); syncRemindChips();
    $('formNotes').value = f.notes || ''; $('formRescheduleReason').value = ''; if ($('formImageFile')) $('formImageFile').value = '';
    setFormImagePreview(f.imageUrl || ''); updateDateThaiPreview(); checkConflictOnForm(); openModal('appointmentModal'); }
  function setupAptModalHeader(titleTxt, notifyChecked, notifyLbl, showReason, creatorTxt) { txt($('modalTitle'), titleTxt);
    if ($('formNotifyLine')) $('formNotifyLine').checked = notifyChecked; txt($('formNotifyLineLabel'), notifyLbl);
    disp($('rescheduleReasonGroup'), showReason ? 'block' : 'none'); disp($('btnDeleteApt'), showReason ? 'inline-flex' : 'none');
    const pill = $('formCreatedByPill'); if (pill) { pill.textContent = creatorTxt; pill.style.display = 'inline-block'; }
  }
  function openCreateModal(prefillDate) {
    setupAptModalHeader('สร้างนัดหมายใหม่', true, 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที', false, `ผู้สร้างนัดหมาย: ${state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ'}`);
    fillAptForm({ date: typeof prefillDate === 'string' && prefillDate ? prefillDate : Logic.getBangkokParts().dateStr }); }
  function openDuplicateModal(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    setupAptModalHeader(`สร้างนัดหมายซ้ำ (คัดลอกจาก ${a.id})`, true, 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที', false, `ผู้สร้างนัดหมาย: ${state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ'}`);
    fillAptForm({ title: a.title, status: Logic.STATUS.CONFIRMED, contactPerson: a.contactPerson, date: state.calSelectedDate || a.appointmentDate || Logic.getBangkokParts().dateStr, time: a.appointmentTime || '09:00', location: a.location, mapUrl: a.mapUrl || '', imageUrl: a.imageUrl || '', remindDays: a.remindDaysBefore, remindHours: a.remindHoursBefore, notes: a.notes });
  }
  function openEditModal(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    setupAptModalHeader(`แก้ไขนัดหมาย ${a.id}`, false, 'ส่งแจ้งเตือนการแก้ไขนัดหมายเข้ากลุ่ม LINE ทันที', true, `ผู้สร้างนัดหมายเดิม: ${a.createdBy || a.updatedBy || '-'} | แก้ไขโดย: ${state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ'}`);
    fillAptForm({ id: a.id, updatedAt: a.updatedAt, title: a.title, status: Logic.normalizeStatus(a.status), contactPerson: a.contactPerson, date: a.appointmentDate, time: a.appointmentTime, location: a.location, mapUrl: a.mapUrl || '', imageUrl: a.imageUrl || '', remindDays: a.remindDaysBefore, remindHours: a.remindHoursBefore, notes: a.notes });
  }
  // Appointment Mutations & User Administration
  async function handleFormSubmit(e) { e.preventDefault(); const id = $('formAptId').value.trim(), exp = $('formExpectedUpdatedAt').value.trim();
    if (id && pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return; }
    const curUserName = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ';
    const rawImg = ($('formImageData') && $('formImageData').value) || ($('formImageUrlInput') && $('formImageUrlInput').value) || ''; const payload = {
      title: Logic.sanitizeNoEmoji($('formTitle').value), status: $('formStatus').value,
      contactPerson: Logic.sanitizeNoEmoji($('formContactPerson').value), appointmentDate: $('formDate').value,
      appointmentTime: $('formTime').value, location: Logic.sanitizeNoEmoji($('formLocation').value),
      mapUrl: $('formMapUrl') ? normalizeMapUrl($('formMapUrl').value) : '', imageUrl: Logic.sanitizeNoEmoji(rawImg),
      remindDaysBefore: +$('formRemindDays').value, remindHoursBefore: +$('formRemindHours').value,
      notes: Logic.sanitizeNoEmoji($('formNotes').value), updatedBy: curUserName
    }; const reason = Logic.sanitizeNoEmoji($('formRescheduleReason').value), notifyLine = $('formNotifyLine') ? Boolean($('formNotifyLine').checked) : !id;
    if (!id) payload.createdBy = curUserName; else { payload.statusChangedBy = curUserName; if (reason) payload.statusReason = reason; }
    const v = Logic.validateAppointmentInput(payload); if (!v.valid) { showToast(v.errors.join(' | '), 'error'); return; }
    const prevApts = state.appointments.map(a => ({ ...a })), prevLogs = [...state.rescheduleLogs]; try { const now = Logic.getBangkokParts().isoStr;
      let savedApt = null; if (!id) { savedApt = Logic.createAppointmentRecord(payload, state.appointments, now); state.appointments.push(savedApt); }
      else { const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) throw new Error('ไม่พบรายการนัดหมาย');
        const r = Logic.updateAppointmentRecord(state.appointments[idx], payload, { nowIso: now, expectedUpdatedAt: exp, reason });
        state.appointments[idx] = savedApt = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs]; }
      if (!state.isLive && notifyLine && savedApt) txt($('botSimOutput'), Logic.formatInstantAppointmentMessage(savedApt, Boolean(id), { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' }));
      if (!state.isLive) saveDemoData(); closeModal('appointmentModal'); if (state.isLive) pendingIds.add(savedApt.id); renderActiveTab();
      showToast(id ? 'บันทึกการแก้ไขนัดหมายเรียบร้อยแล้ว' : 'สร้างนัดหมายใหม่เรียบร้อยแล้ว', 'success');
      syncAptMutation(savedApt.id, prevApts, prevLogs, savedApt, () => id ? callGasApi('update', { id, payload, expectedUpdatedAt: exp, reason, notifyLine }) : callGasApi('create', { payload, notifyLine }), 'บันทึกไม่สำเร็จ');
    } catch (err) { state.appointments = prevApts; state.rescheduleLogs = prevLogs; showToast(err.message, 'error'); }
  }
  async function mutateAptStatus(id, newStatus, reason, extra) {
    if (pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return false; }
    const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) return false;
    const prevApts = state.appointments.map(a => ({ ...a })), prevApt = prevApts[idx], prevLogs = [...state.rescheduleLogs], curUser = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ';
    const notifyLine = (extra && extra.notifyLine !== undefined) ? extra.notifyLine : (String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE');
    const patch = { status: newStatus, updatedBy: curUser, statusChangedBy: newStatus === Logic.STATUS.CONFIRMED ? '' : curUser, statusReason: newStatus === Logic.STATUS.CONFIRMED ? '' : (extra && extra.statusReason ? Logic.sanitizeNoEmoji(extra.statusReason) : (reason || '')) };
    try {
      const r = Logic.updateAppointmentRecord(prevApt, patch, { nowIso: Logic.getBangkokParts().isoStr, expectedUpdatedAt: prevApt.updatedAt, reason: reason || newStatus });
      state.appointments[idx] = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
      if (!state.isLive && notifyLine) txt($('botSimOutput'), Logic.formatInstantAppointmentMessage(r.record, true, { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' }));
      if (!state.isLive) saveDemoData(); if (state.isLive) pendingIds.add(id); renderActiveTab();
      syncAptMutation(id, prevApts, prevLogs, r.record, () => callGasApi('update', { id, payload: patch, expectedUpdatedAt: prevApt.updatedAt, notifyLine, reason: reason || newStatus }), 'เปลี่ยนสถานะไม่สำเร็จ');
      return true; } catch (err) { state.appointments = prevApts; state.rescheduleLogs = prevLogs; showToast(err.message, 'error'); return false; }
  }
  async function handleQuickComplete(id) { if (await mutateAptStatus(id, Logic.STATUS.COMPLETED, 'เสร็จสิ้นการนัดหมาย')) showToast(`บันทึก [${id}] สิ้นสุดการนัดหมายแล้ว`, 'success'); }
  function openCancelModal(id) { const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    $('cancelAptId').value = a.id; txt($('cancelAptSummary'), `[${a.id}] ${a.title} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`);
    $('cancelReasonInput').value = ''; if ($('cancelNotifyLine')) $('cancelNotifyLine').checked = true; openModal('cancelModal'); }
  async function handleCancelSubmit(e) { e.preventDefault();
    const id = $('cancelAptId').value.trim(), reason = Logic.sanitizeNoEmoji($('cancelReasonInput').value), notifyLine = $('cancelNotifyLine') ? $('cancelNotifyLine').checked : true;
    if (await mutateAptStatus(id, Logic.STATUS.CANCELLED, reason || 'ยกเลิกการนัดหมาย', { statusReason: reason, notifyLine })) { closeModal('cancelModal'); showToast(`ยกเลิกนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn'); }
  }
  async function handleQuickReopen(id) { if (await mutateAptStatus(id, Logic.STATUS.CONFIRMED, 'คืนสถานะนัดหมาย', { notifyLine: true })) showToast(`คืนสถานะ [${id}] เป็น "นัดหมายแล้ว" เรียบร้อย`, 'success'); }
  async function handleDelete() { const id = $('formAptId').value.trim(); if (!id || !confirm(`ยืนยันการลบนัดหมาย [${id}] หรือไม่?`)) return;
    if (pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return; }
    const user = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ', idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
    if (idx === -1) return; const prevApts = state.appointments.map(a => ({ ...a })), prevLogs = [...state.rescheduleLogs], removed = state.appointments[idx];
    state.appointments.splice(idx, 1);
    state.rescheduleLogs.unshift({ logId: `LOG-${Date.now()}-DEL`, appointmentId: id, changedAt: Logic.getBangkokParts().isoStr, changedBy: user, fieldChanged: 'DELETED', oldValue: removed.title, newValue: 'ลบนัดหมาย', reason: 'ลบออกจากระบบ' });
    if (!state.isLive) saveDemoData(); closeModal('appointmentModal'); renderActiveTab(); showToast(`ลบนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn');
    if (state.isLive) runBgTask(id, () => callGasApi('delete', { id, updatedBy: user }), null, err => { state.appointments = prevApts; state.rescheduleLogs = prevLogs; renderActiveTab(); showToast('ลบนัดหมายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); });
  }
  function openUserModal(userId) {
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') { showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return; }
    state.editingUserId = userId || null; txt($('userModalTitle'), userId ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่');
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, u = userId ? uList.find(x => x.userId === userId) : null;
    $('formUsername').value = u ? u.username : ''; $('formUsername').disabled = Boolean(u);
    $('formDisplayName').value = u ? (u.displayName || u.username) : ''; $('formUserPassword').value = ''; $('formUserRole').value = u ? (u.role || 'STAFF') : 'STAFF';
    disp($('formUserPasswordReqStar'), u ? 'none' : 'inline');
    txt($('formUserPasswordHint'), u ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน' : 'กำหนดรหัสผ่านสำหรับเข้าสู่ระบบ'); openModal('userModal'); }
  async function handleUserFormSubmit(e) { e.preventDefault();
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') { showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return; }
    const un = ($('formUsername').value || '').trim().toLowerCase(), dispName = Logic.sanitizeNoEmoji($('formDisplayName').value), pw = $('formUserPassword').value || '', role = $('formUserRole').value;
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, existingU = state.editingUserId ? uList.find(x => x.userId === state.editingUserId) : null;
    const payload = { userId: state.editingUserId || undefined, isNew: !state.editingUserId, username: un, displayName: dispName, role, isActive: existingU ? existingU.isActive !== false : true };
    if (pw) payload.password = pw; try { const v = Logic.validateUserInput(payload, !state.editingUserId); if (!v.valid) throw new Error(v.errors.join(' | '));
      if (!state.editingUserId && uList.some(x => x.username.toLowerCase() === un)) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      const prevUsers = (state.users || []).map(u => ({ ...u })), s = v.sanitized; if (state.editingUserId) {
        const idx = state.users.findIndex(x => x.userId === state.editingUserId);
        if (idx !== -1) { state.users[idx].displayName = s.displayName; state.users[idx].role = s.role; if (s.passwordHash) state.users[idx].passwordHash = s.passwordHash; }
      } else {
        const maxNum = (state.users || []).reduce((m, x) => { const n = x.userId && x.userId.startsWith('USR-') ? parseInt(x.userId.slice(4), 10) : 0; return n > m ? n : m; }, 0);
        state.users.push({ userId: `USR-${String(maxNum + 1).padStart(3, '0')}`, username: s.username, displayName: s.displayName, role: s.role, passwordHash: s.passwordHash, isActive: true, createdAt: Logic.getBangkokParts().isoStr });
      }
      if (state.editingUserId && state.currentUser && state.currentUser.userId === state.editingUserId) {
        state.currentUser.displayName = dispName; state.currentUser.role = role;
        try { localStorage.setItem(STORAGE.AUTH_USER, JSON.stringify(state.currentUser)); } catch (_) { }
        updateUserSessionUI(); }
      if (!state.isLive) saveDemoData(); closeModal('userModal'); renderActiveTab(); showToast('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว', 'success');
      if (state.isLive) { runBgTask(null, () => callGasApi('saveUser', { userPayload: payload }), res => { if (res && res.user) {
            const idx = state.users.findIndex(x => x.userId === res.user.userId || x.username === res.user.username);
            if (idx !== -1) state.users[idx] = { ...state.users[idx], ...res.user }; else state.users.push(res.user); renderActiveTab(); }
        }, err => { state.users = prevUsers; renderActiveTab(); showToast('บันทึกสมาชิกไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); }); }
    } catch (err) { showToast(err.message, 'error'); }
  }
  async function handleToggleUserStatus(userId, curActive) {
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') { showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return; }
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, u = uList.find(x => x.userId === userId);
    if (u && (u.username === 'admin' || (state.currentUser && u.username === state.currentUser.username))) { showToast('ไม่สามารถระงับบัญชีผู้ดูแลระบบหลักหรือบัญชีที่กำลังใช้งานอยู่ได้', 'error'); return; }
    const targetStatus = !curActive, idx = state.users.findIndex(x => x.userId === userId); if (idx === -1) return; state.users[idx].isActive = targetStatus;
    if (!state.isLive) saveDemoData(); renderActiveTab(); showToast(`ปรับสถานะผู้ใช้งานเป็น ${targetStatus ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'} แล้ว`, 'info');
    if (state.isLive) runBgTask(null, () => callGasApi('saveUser', { userPayload: { userId, username: u ? u.username : undefined, isActive: targetStatus } }), null, err => { const curIdx = state.users.findIndex(x => x.userId === userId); if (curIdx !== -1) state.users[curIdx].isActive = curActive; renderActiveTab(); showToast('ปรับสถานะไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); });
  }
  // Event Bindings & Lifecycle
  function bindEvents() {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab'))));
    on('btnToggleTheme', 'click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    on('btnToggleThemeAuth', 'click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    on('btnLogout', 'click', handleLogout); on('loginForm', 'submit', handleLoginSubmit); on('registerForm', 'submit', handleRegisterSubmit);
    on('tabBtnAuthLogin', 'click', () => switchAuthTab('login')); on('tabBtnAuthRegister', 'click', () => switchAuthTab('register'));
    on('btnSwitchToRegister', 'click', () => switchAuthTab('register')); on('btnSwitchToLogin', 'click', () => switchAuthTab('login'));
    on('btnOpenAddUserModal', 'click', () => openUserModal(null)); on('btnCloseUserModalTop', 'click', () => closeModal('userModal'));
    on('btnCancelUserModal', 'click', () => closeModal('userModal')); on('userForm', 'submit', handleUserFormSubmit);
    on('btnCloseCancelModalTop', 'click', () => closeModal('cancelModal')); on('btnDismissCancelModal', 'click', () => closeModal('cancelModal'));
    on('cancelForm', 'submit', handleCancelSubmit);
    on('btnOpenCreateModal', 'click', () => openCreateModal()); on('btnMobileFabCreate', 'click', () => openCreateModal());
    on('btnAddAptOnSelectedDate', 'click', () => openCreateModal(state.calSelectedDate || `${state.calYear}-${String(state.calMonth).padStart(2, '0')}-01`));
    on('btnShowAllMonthApts', 'click', () => selectCalendarDate(''));
    on('btnCalFilterMyApts', 'click', () => { state.calOnlyMyApts = !state.calOnlyMyApts; renderCalendarTab(); });
    on('btnCloseModalTop', 'click', () => closeModal('appointmentModal')); on('btnCancelModal', 'click', () => closeModal('appointmentModal'));
    on('formDate', 'change', () => { updateDateThaiPreview(); checkConflictOnForm(); }); on('formTime', 'change', checkConflictOnForm);
    on('appointmentForm', 'submit', handleFormSubmit); on('btnDeleteApt', 'click', handleDelete); on('btnSyncNow', 'click', () => syncWithServer(false));
    document.querySelectorAll('.time-chip').forEach(c => c.addEventListener('click', () => { if ($('formTime')) { $('formTime').value = c.getAttribute('data-time') || ''; checkConflictOnForm(); } }));
    document.querySelectorAll('.range-chip').forEach(c => c.addEventListener('click', () => { state.quickRange = c.getAttribute('data-range') || 'ALL';
      document.querySelectorAll('.range-chip').forEach(x => x.classList.toggle('active', x === c)); if ($('filterDate')) $('filterDate').value = '';
      renderListTab(); })); on('btnOpenPatchNotesModal', 'click', () => { renderPatchNotes(); openModal('patchNotesModal'); });
    on('btnClosePatchNotesModalTop', 'click', () => closeModal('patchNotesModal')); on('btnClosePatchNotesModal', 'click', () => closeModal('patchNotesModal'));
    on('btnOpenGuideModal', 'click', () => openModal('guideModal')); on('btnCloseGuideModalTop', 'click', () => closeModal('guideModal')); on('btnCloseGuideModal', 'click', () => closeModal('guideModal'));
    on('btnCloseMapPreviewModalTop', 'click', () => closeModal('mapPreviewModal')); on('btnCloseMapPreviewModal', 'click', () => closeModal('mapPreviewModal'));
    on('btnCloseImagePreviewModalTop', 'click', () => closeModal('imagePreviewModal')); on('btnCloseImagePreviewModal', 'click', () => closeModal('imagePreviewModal'));
    on('formRemindDays', 'input', syncRemindChips); on('formRemindHours', 'input', syncRemindChips); on('formMapUrl', 'input', updateMapPinUI);
    on('btnToggleMapPicker', 'click', () => { const wrap = $('mapPickerWrap'); if (!wrap) return; if (wrap.style.display === 'none' || !wrap.style.display) openMapPickerPanel(); else wrap.style.display = 'none'; });
    on('btnSearchMapFromLoc', 'click', () => searchAndPinMap($('formLocation') ? $('formLocation').value : ''));
    on('btnExecMapSearch', 'click', () => searchAndPinMap($('formMapSearchInput') ? $('formMapSearchInput').value : ''));
    on('formMapSearchInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchAndPinMap($('formMapSearchInput').value); } });
    on('btnClearMapPin', 'click', () => { if ($('formMapUrl')) $('formMapUrl').value = ''; updateMapPinUI(); disp($('mapPickerWrap'), 'none'); });
    on('btnUseCurrentGps', 'click', () => { if (!navigator.geolocation) { showToast('อุปกรณ์ไม่รองรับการดึงพิกัด GPS', 'error'); return; }
      openMapPickerPanel(); txt($('mapPickerStatus'), 'กำลังดึงตำแหน่ง GPS ปัจจุบัน...');
      navigator.geolocation.getCurrentPosition(pos => { setMapPinCoords(pos.coords.latitude, pos.coords.longitude, 'ปักหมุดจากพิกัด GPS ปัจจุบันแล้ว'); showToast('ดึงพิกัด GPS สำเร็จ', 'success'); }, () => showToast('ไม่สามารถเข้าถึงตำแหน่ง GPS ได้ กรุณาอนุญาตสิทธิ์หรือคลิกบนแผนที่', 'warn'));
    }); on('btnTriggerImageUpload', 'click', () => { if ($('formImageFile')) $('formImageFile').click(); });
    on('formImageFile', 'change', e => { const f = e.target.files && e.target.files[0]; if (f) compressImageFile(f); });
    on('formImageUrlInput', 'input', () => { const u = Logic.sanitizeNoEmoji($('formImageUrlInput').value || '').trim(); setFormImagePreview(u, u ? 'ลิงก์รูปภาพภายนอก' : ''); if ($('formImageUrlInput') && u) $('formImageUrlInput').value = u; });
    on('btnClearImage', 'click', () => { if ($('formImageFile')) $('formImageFile').value = ''; setFormImagePreview(''); }); const setTeamConn = async () => {
      state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true;
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl; if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }));
      closeModal('guideModal'); await syncWithServer(false); };
    on('btnQuickConnectFromGuide', 'click', setTeamConn); on('btnResetDefaultConn', 'click', setTeamConn); let searchRaf = 0;
    on('filterSearch', 'input', () => { cancelAnimationFrame(searchRaf); searchRaf = requestAnimationFrame(renderListTab); });
    on('filterStatus', 'change', renderListTab); on('filterUser', 'change', renderListTab);
    on('filterDate', 'change', () => { if ($('filterDate').value) { state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL')); } renderListTab(); });
    on('btnClearFilters', 'click', () => { $('filterSearch').value = $('filterStatus').value = $('filterDate').value = '';
      if ($('filterUser')) $('filterUser').value = '';
      state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL'));
      renderListTab(); });
    document.querySelectorAll('.stat-pill').forEach(p => p.addEventListener('click', () => { $('filterStatus').value = p.getAttribute('data-filter-status') || ''; renderListTab(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') MODAL_IDS.forEach(closeModal);
      else if (e.altKey && (e.key === 'n' || e.key === 'N') && state.currentUser) { e.preventDefault(); openCreateModal(state.calSelectedDate); }
    }); document.addEventListener('click', e => { const t = e.target;
      if (t.classList && t.classList.contains('modal-backdrop')) { t.classList.remove('active'); return; }
      const addCell = t.closest('.btn-cell-add'); if (addCell) { e.stopPropagation(); const dt = addCell.getAttribute('data-add-date'); selectCalendarDate(dt || ''); openCreateModal(dt); return; }
      const jumpM = t.closest('.btn-jump-cal-month'); if (jumpM) { state.calYear = +jumpM.getAttribute('data-year'); state.calMonth = +jumpM.getAttribute('data-month'); state.calSelectedDate = ''; switchTab('tabMonth'); return; }
      const edit = t.closest('.btn-edit-apt'); if (edit) { openEditModal(edit.getAttribute('data-id')); return; }
      const dup = t.closest('.btn-dup-apt'); if (dup) { openDuplicateModal(dup.getAttribute('data-id')); return; }
      const cpy = t.closest('.btn-copy-apt'); if (cpy) { copyAppointmentText(cpy.getAttribute('data-id')); return; }
      const ics = t.closest('.btn-ics-apt'); if (ics) { exportAppointmentToIcs(ics.getAttribute('data-id')); return; }
      const vMap = t.closest('.btn-view-map'); if (vMap) { openMapPreviewModal(vMap.getAttribute('data-id')); return; }
      const vImg = t.closest('.btn-view-image'); if (vImg) { openImagePreviewModal(vImg.getAttribute('data-id')); return; }
      const rChip = t.closest('.remind-chip'); if (rChip) { const tid = rChip.getAttribute('data-remind-target'); if ($(tid)) { $(tid).value = rChip.getAttribute('data-val') || '0'; syncRemindChips(); } return; }
      const rStep = t.closest('.btn-remind-step'); if (rStep) {
        const tid = rStep.getAttribute('data-step-target'), stp = parseInt(rStep.getAttribute('data-step') || '0', 10);
        if ($(tid)) { const mx = parseInt($(tid).getAttribute('max') || '365', 10); $(tid).value = String(Math.max(0, Math.min(mx, (parseInt($(tid).value || '0', 10) || 0) + stp))); syncRemindChips(); }
        return; }
      const comp = t.closest('.btn-quick-complete'); if (comp) { handleQuickComplete(comp.getAttribute('data-id')); return; }
      const canc = t.closest('.btn-open-cancel-modal'); if (canc) { openCancelModal(canc.getAttribute('data-id')); return; }
      const reopen = t.closest('.btn-quick-reopen'); if (reopen) { handleQuickReopen(reopen.getAttribute('data-id')); return; }
      const editU = t.closest('.btn-edit-user'); if (editU) { openUserModal(editU.getAttribute('data-uid')); return; }
      const toggleU = t.closest('.btn-toggle-user'); if (toggleU) { handleToggleUserStatus(toggleU.getAttribute('data-uid'), toggleU.getAttribute('data-active') === 'true'); return; }
      const cell = t.closest('.cal-cell:not(.empty)'); if (cell) { selectCalendarDate(cell.getAttribute('data-date')); return; }
      const yc = t.closest('.year-summary-card'); if (yc) { state.overviewYear = +yc.getAttribute('data-year'); $('yearOverviewInput').value = String(state.overviewYear + 543); renderYearTab(); return; }
      const qc = t.closest('.btn-quick-cmd'); if (qc) { $('botSimInput').value = qc.getAttribute('data-cmd'); runBotSim(); }
    });
    on('btnPrevMonth', 'click', () => { state.calSelectedDate = ''; if (--state.calMonth < 1) { state.calMonth = 12; state.calYear--; } renderCalendarTab(); });
    on('btnNextMonth', 'click', () => { state.calSelectedDate = ''; if (++state.calMonth > 12) { state.calMonth = 1; state.calYear++; } renderCalendarTab(); });
    on('btnCurrentMonth', 'click', () => { const now = Logic.getBangkokParts(); state.calYear = now.year; state.calMonth = now.month; state.calSelectedDate = now.dateStr; renderCalendarTab(); });
    on('btnJumpMonth', 'click', () => { const y = Logic.normalizeYearToCE($('calInputYear').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; } state.calMonth = +$('calSelectMonth').value; state.calYear = y; state.calSelectedDate = ''; renderCalendarTab(); });
    on('btnJumpYearOverview', 'click', () => { const y = Logic.normalizeYearToCE($('yearOverviewInput').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; } state.overviewYear = y; renderYearTab(); });
    on('btnExportMonthCsv', 'click', () => exportAppointmentsToCsv(getMonthExportContext()));
    on('btnPrintMonth', 'click', () => printAppointmentsReport(getMonthExportContext()));
    on('btnExportListCsv', 'click', () => exportAppointmentsToCsv(getListExportContext()));
    on('btnPrintList', 'click', () => printAppointmentsReport(getListExportContext()));
    on('btnExportYearCsv', 'click', () => exportAppointmentsToCsv(getYearExportContext()));
    on('btnPrintYear', 'click', () => printAppointmentsReport(getYearExportContext())); on('btnSaveConnection', 'click', async () => {
      const u = ($('cfgGasUrl').value || '').trim(), p = $('cfgPasscode').value || ''; if (!u) { showToast('กรุณาระบุ Web App URL', 'error'); return; }
      state.gasUrl = u; state.passcode = p; state.isLive = true; clearLiveCache();
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: u, passcode: p, isLive: true })); await syncWithServer(false); });
    on('btnSwitchLocalDemo', 'click', () => { state.isLive = false; clearLiveCache();
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: false }));
      loadDemoData(); renderAll(); showToast('สลับเป็นโหมดจำลองข้อมูลในเครื่อง (Demo) แล้ว', 'warn'); }); on('btnSavePolicy', 'click', () => {
      const prevMeta = { ...state.meta }, m = { DAILY_DIGEST_HOUR: String(+$('cfgDigestHour').value || 8), ENABLE_LINE_BOT_QUERY: $('cfgEnableBotQuery').checked ? 'TRUE' : 'FALSE', PRIVACY_MASK_CONTACT: $('cfgPrivacyMask').checked ? 'TRUE' : 'FALSE', NOTIFY_ON_STATUS_CHANGE: $('cfgNotifyStatusChange') && $('cfgNotifyStatusChange').checked ? 'TRUE' : 'FALSE' };
      state.meta = { ...state.meta, ...m }; renderActiveTab(); showToast(state.isLive ? 'บันทึกนโยบายเรียบร้อยแล้ว' : 'บันทึกนโยบายเรียบร้อยแล้ว (Demo)', 'success');
      if (state.isLive) runBgTask(null, () => callGasApi('updateMeta', { meta: m }), null, err => { state.meta = prevMeta; renderActiveTab(); showToast('บันทึกนโยบายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); });
    }); const handleTriggerSetup = async (mode, desc) => { if (!state.isLive) { showToast(`[Demo] จำลองการติดตั้ง ${desc} สำเร็จ`, 'info'); return; }
      try { const r = await callGasApi('setupTriggers', { mode }); showToast(r.message || `ตั้งค่า ${desc} เรียบร้อย`, 'success'); } catch (err) { showToast(err.message, 'error'); }
    }; on('btnInstallAutoTrigger', 'click', () => handleTriggerSetup('auto', 'Trigger อัจฉริยะ'));
    on('btnInstallDailyTrigger', 'click', () => handleTriggerSetup('daily', 'Trigger สรุปเช้าวันละครั้ง'));
    on('btnInstall15MinTrigger', 'click', () => handleTriggerSetup('every15Min', 'Trigger ตรวจเช็คทุก 15 นาที'));
    on('btnRemoveTriggers', 'click', () => handleTriggerSetup('off', 'ปิด Trigger ทั้งหมด')); on('btnTestValidateLine', 'click', async () => {
      if (!state.isLive) { txt($('botSimOutput'), '[Demo] ข้อความผ่านการตรวจสอบรูปแบบ Zero-Emoji พร้อมเชื่อม LINE'); showToast('ตรวจสอบรูปแบบสำเร็จ (Demo)', 'success'); return; }
      try { const r = await callGasApi('testNotification', { dryRun: true }); txt($('botSimOutput'), `[Validate] ${r.ok ? 'สำเร็จ HTTP ' + r.httpStatus : 'ไม่สำเร็จ: ' + r.error}`); showToast(r.ok ? 'Validate ผ่านเรียบร้อย' : 'Validate ไม่ผ่าน', r.ok ? 'success' : 'error'); } catch (e) { txt($('botSimOutput'), '[Error] ' + e.message); }
    }); on('btnTestRealPush', 'click', async () => { if (!state.isLive || !confirm('การทดสอบจริงจะหักโควตา LINE ตามจำนวนสมาชิกกลุ่ม ยืนยันหรือไม่?')) return;
      try { const r = await callGasApi('testNotification', { dryRun: false }); txt($('botSimOutput'), `[Push จริง] ${r.ok ? 'สำเร็จ' : r.error}`); await syncWithServer(true); showToast(r.ok ? 'ส่งข้อความทดสอบสำเร็จ' : 'ส่งไม่สำเร็จ', r.ok ? 'success' : 'error'); } catch (e) { txt($('botSimOutput'), '[Error] ' + e.message); }
    }); on('btnRunBotSim', 'click', runBotSim); on('botSimInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runBotSim(); } });
    on('btnPreviewNotificationPlan', 'click', () => { const bkk = Logic.getBangkokParts();
      const plan = Logic.buildNotificationPlan(state.appointments, `${bkk.dateStr}T08:15:00+07:00`, { dailyDigestHour: +state.meta.DAILY_DIGEST_HOUR || 8, quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0 });
      txt($('botSimUserEcho'), '[ระบบจำลองรอบเตือนอัตโนมัติ 08:15 น.]');
      txt($('botSimOutput'), plan.shouldPush ? plan.messageText : '[จำลองการแจ้งเตือน]\nไม่มีรายการที่ถึงเกณฑ์เตือนในรอบนี้'); }); }
  function runBotSim() { const val = $('botSimInput').value; txt($('botSimUserEcho'), val || '...');
    const res = Logic.parseAndExecuteLineCommand(val, state.appointments, Logic.getBangkokParts().isoStr, {
      enableLineBotQuery: String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE',
      privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE',
      quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0
    }); txt($('botSimOutput'), res === null ? '[บอทเงียบ]\nเนื่องจากข้อความไม่ตรงกับคำสั่งบอท (ลองพิมพ์ "วันนี้", "ทั้งหมด" หรือ "ช่วยเหลือ")' : res); }
  window.addEventListener('DOMContentLoaded', initApp); })();
