/** app.js - Web Frontend Controller, State Management & Low-Latency Engine (v2.6.7) */
(function () { 'use strict'; const Logic = window.CalendarLogic, PatchNotes = window.PATCH_NOTES || [], _el = {};
  const $ = id => _el[id] || (_el[id] = document.getElementById(id)), on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const txt = (el, v) => { if (el) el.textContent = v; }, disp = (el, v) => { if (el) el.style.display = v; };
  const openModal = id => { const el = $(id); if (el) el.classList.add('active'); }, closeModal = id => { const el = $(id); if (el) el.classList.remove('active'); };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }, escapeHtml = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ESC[c]), eh = escapeHtml;
  const sn = Logic.sanitizeNoEmoji, ns = Logic.normalizeStatus, gb = Logic.getBangkokParts, ftd = Logic.formatThaiDateDisplay;
  const S_CF = Logic.STATUS.CONFIRMED, S_CP = Logic.STATUS.COMPLETED, S_CN = Logic.STATUS.CANCELLED, DEF_USERS = Logic.DEFAULT_USERS, S_SYS = 'ผู้ใช้งานระบบ';
  const M_SYNC = 'รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', M_ADMIN = 'เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้';
  const sGet = (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (_) { return fb; } };
  const sSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, sDel = k => { try { localStorage.removeItem(k); } catch (_) {} };
  const STORAGE = { APTS: 'CAL_DEMO_APTS_V2', LOGS: 'CAL_DEMO_LOGS_V2', CFG: 'CAL_CONN_CFG_V2', THEME: 'CAL_THEME_V2', AUTH_USER: 'CAL_AUTH_USER_V2', USERS: 'CAL_DEMO_USERS_V2', LIVE_CACHE: 'CAL_LIVE_CACHE_V2', WEB_NOTIF: 'CAL_WEB_NOTIF_CFG_V2', WEB_NOTIF_SENT: 'CAL_WEB_NOTIF_SENT_V2', WEB_NOTIF_FEED: 'CAL_WEB_NOTIF_FEED_V2' };
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwEq-EehM4BDKQLsh7dFQCJNeJNg2g_DtM1_INYgjblaKyhcdkNuAdiIEhkvSke--ro/exec', DEFAULT_PASSCODE = 'CALL1234';
  const FIELD_LABELS = { appointmentDate: 'วันที่นัดหมาย', appointmentTime: 'เวลานัดหมาย', location: 'สถานที่', contactPerson: 'ผู้นัดพบ', status: 'สถานะ', DELETED: 'ลบนัดหมาย' };
  const MODAL_IDS = ['appointmentModal', 'cancelModal', 'userModal', 'guideModal', 'patchNotesModal', 'mapPreviewModal', 'imagePreviewModal', 'webNotifModal'];
  const mkI = (s, b, ex = '') => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"${ex}>${b}</svg>`;
  const ICO = { clock: mkI(12, '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'), user: mkI(14, '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'), pin: mkI(14, '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'), bell: mkI(14, '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>'), check: mkI(13, '<polyline points="20 6 9 17 4 12"></polyline>', ' style="stroke-width:2.5;"'), edit: mkI(13, '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'), img: mkI(13, '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>'), copy: mkI(12, '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'), cal: mkI(12, '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>') };
  const state = { isLive: true, gasUrl: DEFAULT_GAS_URL, passcode: DEFAULT_PASSCODE, currentUser: null, users: [], theme: 'light', activeTab: 'tabMonth', quickRange: 'ALL', calOnlyMyApts: false, appointments: [], rescheduleLogs: [],
    meta: { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', DAILY_DIGEST_HOUR: '8', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'FALSE' },
    calYear: gb().year, calMonth: gb().month, calSelectedDate: '', overviewYear: gb().year, editingUserId: null,
    webNotif: { enabled: true, bgSync: true }, webNotifFeed: [], webNotifUnread: 0, swReg: null, deferredPwaPrompt: null, isStandalone: false, pendingNotifAptId: '' };
  const isStaffOnlyCalendar = () => Boolean(state.currentUser && state.currentUser.role !== 'ADMIN'), isAdminUser = () => Boolean(state.currentUser && state.currentUser.role === 'ADMIN');
  const curUserDisp = () => state.currentUser ? state.currentUser.displayName : S_SYS, metaTrue = k => String(state.meta[k]).toUpperCase() === 'TRUE', findApt = id => state.appointments.find(x => x.id === id && !x.deletedAt), bkkOf = b => (b && b.epochMs) ? b : gb();
  function showToast(msg, type = 'info') { const c = $('toastContainer'); if (!c) return; const it = document.createElement('div');
    it.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
    it.textContent = sn(msg); c.appendChild(it); setTimeout(() => { it.style.opacity = '0'; it.style.transition = 'opacity 0.22s'; setTimeout(() => it.remove(), 240); }, 3000); }
  function applyTheme(t) { state.theme = t === 'dark' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', state.theme);
    disp($('iconThemeSun'), state.theme === 'dark' ? 'inline' : 'none'); disp($('iconThemeMoon'), state.theme === 'dark' ? 'none' : 'inline');
    try { localStorage.setItem(STORAGE.THEME, state.theme); } catch (_) {} }
  function applyTabClasses(id) { document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === id));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id)); }
  function switchTab(id) { let target = id || 'tabMonth';
    if (isStaffOnlyCalendar() && target !== 'tabMonth') { target = 'tabMonth'; showToast('สมาชิกระดับ STAFF สามารถเข้าดูได้เฉพาะหน้าปฏิทินเดือน', 'warn'); }
    state.activeTab = target; applyTabClasses(target); renderActiveTab(); }
  function saveLiveCache() { if (state.isLive && state.currentUser && state.currentUser.username) sSet(STORAGE.LIVE_CACHE, { user: state.currentUser.username, appointments: state.appointments, rescheduleLogs: state.rescheduleLogs.slice(0, 60), users: state.users, meta: state.meta, ts: Date.now() }); }
  function loadLiveCache() { if (!state.isLive || !state.currentUser || !state.currentUser.username) return false;
    const d = sGet(STORAGE.LIVE_CACHE); if (!d || d.user !== state.currentUser.username || !Array.isArray(d.appointments)) return false;
    state.appointments = d.appointments; if (Array.isArray(d.rescheduleLogs)) state.rescheduleLogs = d.rescheduleLogs; if (Array.isArray(d.users) && d.users.length) state.users = d.users; if (d.meta) state.meta = { ...state.meta, ...d.meta }; return true; }
  function clearLiveCache() { sDel(STORAGE.LIVE_CACHE); }
  function loadSavedSession() { const su = sGet(STORAGE.USERS); state.users = Array.isArray(su) ? su : [...DEF_USERS]; const u = sGet(STORAGE.AUTH_USER); state.currentUser = (u && u.username && u.displayName) ? u : null; updateUserSessionUI(); }
  function switchAuthTab(mode) { const isReg = mode === 'register', lBtn = $('tabBtnAuthLogin'), rBtn = $('tabBtnAuthRegister');
    if (lBtn) { lBtn.classList.toggle('active', !isReg); lBtn.setAttribute('aria-selected', isReg ? 'false' : 'true'); }
    if (rBtn) { rBtn.classList.toggle('active', isReg); rBtn.setAttribute('aria-selected', isReg ? 'true' : 'false'); }
    disp($('loginForm'), isReg ? 'none' : 'flex'); disp($('registerForm'), isReg ? 'flex' : 'none'); disp($('loginErrorMsg'), 'none'); disp($('registerErrorMsg'), 'none'); }
  function updateUserSessionUI() { const isAuth = Boolean(state.currentUser && state.currentUser.username), isAdmin = isAuth && isAdminUser(), authBadge = $('authModeBadge'), roleEl = $('currentUserRole');
    disp($('authGateScreen'), isAuth ? 'none' : 'flex'); disp($('appShell'), isAuth ? 'block' : 'none');
    if (authBadge) { authBadge.className = state.isLive ? 'mode-badge live' : 'mode-badge demo'; authBadge.textContent = state.isLive ? 'Sheets' : 'Demo'; }
    txt($('currentUserName'), isAuth ? state.currentUser.displayName : 'ยังไม่ได้เข้าสู่ระบบ');
    if (roleEl) { const r = isAdmin ? 'ADMIN' : 'STAFF'; roleEl.textContent = r; roleEl.className = `badge-role ${r.toLowerCase()}`; }
    if ($('userManagementSection')) $('userManagementSection').style.opacity = isAdmin ? '1' : '0.85'; disp($('btnOpenAddUserModal'), isAdmin ? 'inline-flex' : 'none');
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => { b.style.display = (!isAdmin && b.getAttribute('data-tab') !== 'tabMonth') ? 'none' : ''; });
    if (isAuth && !isAdmin && state.activeTab !== 'tabMonth') { state.activeTab = 'tabMonth'; applyTabClasses('tabMonth'); } }
  function handleLogout() { state.currentUser = null; state.activeTab = 'tabMonth'; state.calOnlyMyApts = false; applyTabClasses('tabMonth');
    sDel(STORAGE.AUTH_USER); clearLiveCache(); MODAL_IDS.forEach(closeModal); if ($('loginUsername')) $('loginUsername').value = ''; if ($('loginPassword')) $('loginPassword').value = '';
    switchAuthTab('login'); updateUserSessionUI(); showToast('ออกจากระบบเรียบร้อยแล้ว', 'info'); }
  const pendingIds = new Set(); let bgTaskCount = 0, _lastCalMonthData = null;
  function setBgSync(active) { bgTaskCount = Math.max(0, bgTaskCount + (active ? 1 : -1));
    if ($('btnSyncNow')) $('btnSyncNow').classList.toggle('is-syncing', bgTaskCount > 0); txt($('syncBtnLabel'), bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์'); }
  function runBgTask(trackId, apiPromiseFactory, onSuccess, onError) { if (trackId) pendingIds.add(trackId); setBgSync(true); apiPromiseFactory()
      .then(res => { if (onSuccess) onSuccess(res); saveLiveCache(); }).catch(err => { if (onError) onError(err); })
      .finally(() => { if (trackId) { pendingIds.delete(trackId); document.querySelectorAll(`.badge-syncing[data-sync-id="${trackId}"]`).forEach(el => el.remove()); } setBgSync(false); }); }
  const aptVisualSig = a => a ? `${a.id}|${a.title}|${ns(a.status)}|${a.appointmentDate}|${a.appointmentTime}|${a.location}|${a.contactPerson}|${a.notes}|${a.remindDaysBefore}|${a.remindHoursBefore}|${a.rescheduleCount}|${a.notifiedDayForSlot}|${a.notifiedHourForSlot}|${a.createdBy}|${a.statusChangedBy}|${a.statusReason}|${a.updatedBy}|${a.mapUrl || ''}|${(a.imageUrl || '').length}` : '';
  function syncAptMutation(trackId, prevApts, prevLogs, optApt, apiFn, errPrefix) { if (!state.isLive) return; const optSig = aptVisualSig(optApt);
    runBgTask(trackId, apiFn, res => { let needRedraw = false; if (res && res.appointment) { const curIdx = state.appointments.findIndex(x => x.id === trackId);
        if (curIdx !== -1) state.appointments[curIdx] = res.appointment; else state.appointments.push(res.appointment); if (aptVisualSig(res.appointment) !== optSig) needRedraw = true; }
      if (res && res.meta) state.meta = { ...state.meta, ...res.meta }; if (needRedraw) renderActiveTab(); else renderHeader(); }, err => {
      state.appointments = prevApts; state.rescheduleLogs = prevLogs; renderActiveTab(); showToast(`${errPrefix} ระบบคืนค่าเดิมแล้ว: ${err.message}`, 'error');
      if (err.code === 'CONCURRENCY_CONFLICT') syncWithServer(true); }); }
  function applySyncBundle(d) { if (!d) return; if (Array.isArray(d.appointments)) state.appointments = d.appointments; if (Array.isArray(d.rescheduleLogs)) state.rescheduleLogs = d.rescheduleLogs;
    if (Array.isArray(d.users) && d.users.length) state.users = d.users; else if (!state.users || !state.users.length) state.users = [...DEF_USERS]; if (d.meta) state.meta = { ...state.meta, ...d.meta }; saveLiveCache(); }
  async function finishAuthSession(userObj, syncBundle, welcomeMsg) { state.currentUser = userObj; state.activeTab = 'tabMonth'; applyTabClasses('tabMonth');
    sSet(STORAGE.AUTH_USER, userObj); updateUserSessionUI();
    if (state.isLive && state.gasUrl) { if (syncBundle) { applySyncBundle(syncBundle); renderAll(); } else { if (loadLiveCache()) renderAll(); await syncWithServer(true); } } else { loadDemoData(); renderAll(); }
    evaluateAndFireWebNotifications(null, false); if (state.pendingNotifAptId) { const pid = state.pendingNotifAptId; state.pendingNotifAptId = ''; focusAppointmentFromNotif(pid); } showToast(welcomeMsg, 'success'); }
  async function handleLoginSubmit(e) { e.preventDefault();
    const un = ($('loginUsername').value || '').trim(), pw = $('loginPassword').value || '', errEl = $('loginErrorMsg'), submitBtn = $('btnSubmitLogin'); try {
      disp(errEl, 'none'); if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังตรวจสอบ...'; }
      let userObj = null, syncBundle = null; if (state.isLive && state.gasUrl) { try { const res = await callGasApi('login', { username: un, password: pw });
          userObj = res.user; if (Array.isArray(res.appointments)) syncBundle = res; } catch (apiErr) {
          if (String(apiErr.message || '').includes('ไม่รู้จัก action')) { const localRes = Logic.authenticateUser(state.users.length ? state.users : DEF_USERS, un, pw); if (!localRes.ok) throw new Error(localRes.error);
            userObj = localRes.user; showToast('เซิร์ฟเวอร์ GAS เป็นเวอร์ชันเดิม ระบบใช้บัญชีในเครื่องชั่วคราว', 'warn'); } else throw apiErr; }
      } else { const res = Logic.authenticateUser(state.users.length ? state.users : DEF_USERS, un, pw); if (!res.ok) throw new Error(res.error); userObj = res.user; }
      await finishAuthSession(userObj, syncBundle, `ยินดีต้อนรับ ${userObj.displayName} เข้าสู่ระบบ`); } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'เข้าสู่ระบบ'; } } }
  async function handleRegisterSubmit(e) { e.preventDefault();
    const username = ($('regUsername').value || '').trim().toLowerCase(), displayName = sn($('regDisplayName').value), password = $('regPassword').value || '', confirmPassword = $('regConfirmPassword').value || '', errEl = $('registerErrorMsg'), submitBtn = $('btnSubmitRegister');
    try { disp(errEl, 'none'); const uList = state.users && state.users.length ? state.users : DEF_USERS;
      const localReg = Logic.registerUserAccount(uList, { username, displayName, password, confirmPassword }); if (!localReg.ok) throw new Error(localReg.error);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังสร้างบัญชี...'; } let userObj = localReg.user, syncBundle = null;
      if (state.isLive && state.gasUrl) { try { const res = await callGasApi('register', { payload: { username, displayName, password, confirmPassword } });
          if (res && res.user) userObj = res.user; if (res && res.users) state.users = res.users; if (res && Array.isArray(res.appointments)) syncBundle = res;
        } catch (_) { state.users = [...uList, localReg.record]; sSet(STORAGE.USERS, state.users); }
      } else { state.users = [...uList, localReg.record]; sSet(STORAGE.USERS, state.users); }
      ['regUsername', 'regDisplayName', 'regPassword', 'regConfirmPassword'].forEach(k => { if ($(k)) $(k).value = ''; }); switchAuthTab('login');
      await finishAuthSession({ ...userObj, role: 'STAFF' }, syncBundle, `สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${displayName || username} (STAFF)`); } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'สมัครสมาชิกและเข้าใช้งานทันที'; } } }
  function initApp() { try { const s = localStorage.getItem(STORAGE.THEME); if (s) state.theme = s; } catch (_) {}
    applyTheme(state.theme); const c = sGet(STORAGE.CFG);
    if (c && c.gasUrl) { state.gasUrl = c.gasUrl.trim(); state.passcode = c.passcode || ''; state.isLive = Boolean(c.isLive && state.gasUrl); }
    else { state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true; sSet(STORAGE.CFG, { gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }); }
    if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl; if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode; loadSavedSession(); initMonthSelector(); bindEvents(); initPwaAndWebPush();
    if (state.currentUser) { if (state.isLive && state.gasUrl) { if (loadLiveCache()) renderAll(); syncWithServer(true); } else { loadDemoData(); renderAll(); }
      evaluateAndFireWebNotifications(null, false); if (state.pendingNotifAptId) { const pid = state.pendingNotifAptId; state.pendingNotifAptId = ''; focusAppointmentFromNotif(pid); }
    } else if (!state.isLive) loadDemoData();
    updateClock(); setInterval(updateClock, 15000); setInterval(() => evaluateAndFireWebNotifications(null, false), 60000);
    setInterval(() => { if (state.currentUser && state.isLive && state.gasUrl && state.webNotif.bgSync && document.visibilityState !== 'hidden') syncWithServer(true, true); }, 60000); }
  function loadDemoData() { state.isLive = false;
    const a = sGet(STORAGE.APTS), l = sGet(STORAGE.LOGS), u = sGet(STORAGE.USERS); state.users = Array.isArray(u) ? u : [...DEF_USERS];
    if (Array.isArray(a)) { state.appointments = a; state.rescheduleLogs = Array.isArray(l) ? l : []; return; }
    state.users = [...DEF_USERS]; const now = gb(), tmr = gb(now.epochMs + 86400000), nYr = now.year + 1;
    const seeds = [{ title: 'ประชุมตรวจรับงานและสรุปความต้องการ', appointmentDate: tmr.dateStr, appointmentTime: '10:00', location: 'ห้อง B ชั้น 4', contactPerson: 'คุณสมชาย', status: S_CF, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณสมชาย' },
      { title: 'นัดหารือแนวทางเชื่อมต่อระบบ', appointmentDate: gb(now.epochMs + 5 * 86400000).dateStr, appointmentTime: '14:30', location: 'ออนไลน์', contactPerson: 'คุณวิภาดา', status: S_CF, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณวิภาดา' },
      { title: 'ตรวจประเมินผลการดำเนินงานไตรมาส 1', appointmentDate: `${nYr}-03-15`, appointmentTime: '09:30', location: 'ศูนย์พระราม 9', contactPerson: 'คุณนภัสสร', status: S_CF, remindDaysBefore: 2, remindHoursBefore: 1, createdBy: 'ผู้ดูแลระบบ' }];
    const b = []; seeds.forEach(s => b.push(Logic.createAppointmentRecord(s, b, now.isoStr))); state.appointments = b; state.rescheduleLogs = []; saveDemoData(); }
  function saveDemoData() { if (!state.isLive) { sSet(STORAGE.APTS, state.appointments); sSet(STORAGE.LOGS, state.rescheduleLogs); sSet(STORAGE.USERS, state.users); } }
  async function callGasApi(action, payload) { if (!state.gasUrl) throw new Error('ยังไม่ได้ระบุ Web App URL'); const res = await fetch(state.gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, passcode: state.passcode, currentUser: curUserDisp(), ...payload }) });
    const r = await res.json(); if (!r.ok) { const err = new Error(r.error || 'Server error'); err.code = r.code; throw err; } return r.data; }
  async function syncWithServer(silent = false, isBgDiff = false) { if (!state.isLive || !state.gasUrl) { renderAll(); return; }
    const btn = $('btnSyncNow'), lbl = $('syncBtnLabel'), prevApts = state.appointments.length ? state.appointments.slice() : null;
    try { if (btn) btn.classList.add('is-syncing'); txt(lbl, 'กำลังซิงก์...'); applySyncBundle(await callGasApi('list', {})); renderAll(); evaluateAndFireWebNotifications(prevApts, Boolean(prevApts));
      if (!silent) showToast('ซิงก์ข้อมูลล่าสุดสำเร็จ', 'success');
    } catch (e) { if (!isBgDiff) showToast('ซิงก์ไม่สำเร็จ: ' + e.message, 'error'); }
    finally { if (btn) btn.classList.toggle('is-syncing', bgTaskCount > 0); txt(lbl, bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์'); } }
  function renderActiveTab() { if (isStaffOnlyCalendar() && state.activeTab !== 'tabMonth') { state.activeTab = 'tabMonth'; applyTabClasses('tabMonth'); }
    _lastCalMonthData = null; const nowBkk = gb(); renderHeader(nowBkk); updateUserSessionUI();
    if (state.activeTab === 'tabMonth') renderCalendarTab(nowBkk); else if (state.activeTab === 'tabYear') renderYearTab(nowBkk);
    else if (state.activeTab === 'tabSettings') renderSettingsTab(); else renderListTab(nowBkk); }
  const renderAll = () => renderActiveTab();
  function updateClock() { const b = gb(); txt($('bangkokClockDisplay'), `เวลา (BKK): ${ftd(b.dateStr, false)} ${b.timeStr} น.`); }
  function renderHeader(cachedNowBkk) { const bd = $('connectionModeBadge'), ts = $('triggerStatusText'), nowBkk = bkkOf(cachedNowBkk);
    if (state.isLive) { if (bd) { bd.className = 'mode-badge live'; bd.textContent = 'Sheets'; } const lr = state.meta.LAST_TRIGGER_RUN_AT;
      if (ts) { ts.className = lr ? 'meta-status is-live' : 'meta-status'; if (lr) { const mins = Math.max(0, Math.round((nowBkk.epochMs - gb(lr).epochMs) / 60000));
          ts.textContent = mins < 1 ? 'Trigger: เพิ่งทำงาน' : (mins < 60 ? `Trigger: ${mins} นาทีที่แล้ว` : `Trigger: ${Math.floor(mins / 60)} ชม. ที่แล้ว`); } else ts.textContent = 'Trigger: พร้อมทำงาน'; }
    } else { if (bd) { bd.className = 'mode-badge demo'; bd.textContent = 'Demo'; } if (ts) { ts.className = 'meta-status is-demo'; ts.textContent = 'Trigger: โหมดจำลอง'; } }
    const lim = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0, pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0, f = $('quotaProgressFill');
    txt($('quotaTextLabel'), `โควตา LINE: ${used}/${lim} (${pct}%)`); if (f) { f.style.width = `${pct}%`; f.className = 'quota-progress-fill' + (pct >= 90 ? ' danger' : pct >= 80 ? ' warn' : ''); }
    let activeCnt = 0; for (const a of state.appointments) if (a && !a.deletedAt && ns(a.status) === S_CF) activeCnt++; txt($('navBadgeActiveCount'), activeCnt); }
  const getStatusClass = s => { const st = ns(s); return st === S_CP ? 'status-completed' : (st === S_CN ? 'status-cancelled' : 'status-confirmed'); };
  function getRelDate(a, nowBkk, od) { if (od) return { text: 'เลยกำหนด', cls: 'rel-overdue' }; if (!a.appointmentDate) return { text: 'ไม่ระบุวัน', cls: '' };
    const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate); return d === 0 ? { text: 'วันนี้', cls: 'rel-today' } : (d === 1 ? { text: 'พรุ่งนี้', cls: 'rel-today' } : { text: d > 0 ? `อีก ${d} วัน` : 'ผ่านมาแล้ว', cls: '' }); }
  function renderCardHtml(a, cachedNowBkk, preOd) {
    const nowBkk = bkkOf(cachedNowBkk), od = preOd !== undefined ? preOd : Logic.isOverdue(a, nowBkk.isoStr), st = ns(a.status), cls = getStatusClass(st), rel = getRelDate(a, nowBkk, od), aid = eh(a.id);
    let dayNum = '-', monthYr = 'ไม่ระบุวัน'; if (a.appointmentDate) { const [y, m, d] = a.appointmentDate.split('-').map(Number); if (y && m && d) { dayNum = String(d); monthYr = `${Logic.THAI_MONTHS_SHORT[m - 1]} ${y + 543}`; } }
    const badges = []; if (pendingIds.has(a.id)) badges.push(`<span class="badge-syncing" data-sync-id="${aid}">กำลังซิงก์...</span>`);
    if (od) badges.push('<span class="badge-overdue">เลยกำหนดเวลา</span>'); if (a.appointmentDate && a.notifiedDayForSlot === a.appointmentDate) badges.push('<span class="badge-info">แจ้งเตือนรายวันแล้ว</span>');
    if (a.appointmentDate && a.appointmentTime && a.notifiedHourForSlot === `${a.appointmentDate}T${a.appointmentTime}`) badges.push('<span class="badge-info">แจ้งเตือนรายชั่วโมงแล้ว</span>');
    if (+a.rescheduleCount > 0) badges.push(`<span class="badge-info">เลื่อนนัด ${+a.rescheduleCount} ครั้ง</span>`);
    const isConf = st === S_CF, creatorName = eh(a.createdBy || a.updatedBy || '-'), attrHtml = [`<span class="attribution-tag">${ICO.user}<span>ผู้สร้าง: <strong>${creatorName}</strong></span></span>`];
    if (st === S_CP && a.statusChangedBy) attrHtml.push(`<span class="attribution-tag completed">${ICO.check}<span>เสร็จสิ้นโดย: <strong>${eh(a.statusChangedBy)}</strong></span></span>`);
    else if (st === S_CN && a.statusChangedBy) attrHtml.push(`<span class="attribution-tag cancelled"><span>ยกเลิกโดย: <strong>${eh(a.statusChangedBy)}</strong>${a.statusReason ? ` (${eh(a.statusReason)})` : ''}</span></span>`);
    else if (a.updatedBy && a.updatedBy !== (a.createdBy || a.updatedBy)) attrHtml.push(`<span class="attribution-tag">${ICO.edit}<span>แก้ไขล่าสุดโดย: <strong>${eh(a.updatedBy)}</strong></span></span>`);
    const rD = +a.remindDaysBefore || 0, rH = +a.remindHoursBefore || 0, remTxt = (rD > 0 || rH > 0) ? `เตือน ${rD}ว. / ${rH}ชม.` : 'ปิดเตือนล่วงหน้า';
    const chip = (ic, h, ex = '') => `<span class="apt-meta-chip${ex}">${ICO[ic]}<span>${h}</span></span>`;
    const btn = (c, ic, l, tt = '') => `<button type="button" class="btn ${c}" data-id="${aid}"${tt ? ` title="${tt}"` : ''}>${ic ? ICO[ic] : ''}<span>${l}</span></button>`;
    return `<article class="apt-card-slim ${cls}${od ? ' is-overdue' : ''}"><div class="apt-date-block"><span class="apt-rel-badge ${rel.cls}">${eh(rel.text)}</span><div><div class="apt-day-num">${eh(dayNum)}</div><div class="apt-month-yr">${eh(monthYr)}</div></div><div class="apt-time-pill">${ICO.clock}<span>${eh(a.appointmentTime || '-')} น.</span></div></div><div class="apt-main-col"><div class="apt-badges-row"><span class="status-badge ${cls}">${eh(st)}</span><span class="apt-id-code">${aid}</span>${badges.join(' ')}</div><h4 class="apt-slim-title">${eh(a.title)}</h4><div class="apt-slim-meta">${chip('user', `ผู้นัดพบ: <strong>${eh(a.contactPerson || '-')}</strong>`)}${chip('pin', `สถานที่: <strong>${eh(a.location || '-')}</strong>`)}${chip('bell', remTxt)}${a.mapUrl ? chip('pin', 'มีแผนที่', ' map-chip') : ''}${a.imageUrl ? chip('img', 'มีรูปแนบ', ' img-chip') : ''}</div><div class="apt-attribution-row">${attrHtml.join(' ')}</div>${a.notes ? `<div class="apt-notes-bar">หมายเหตุ: ${eh(a.notes)}</div>` : ''}</div><div class="apt-slim-actions">${a.mapUrl ? btn('btn-outline btn-sm btn-view-map', 'pin', 'ดูแผนที่') : ''}${a.imageUrl ? btn('btn-outline btn-sm btn-view-image', 'img', 'ดูรูปภาพ') : ''}${btn('btn-outline btn-xs btn-copy-apt', 'copy', 'คัดลอกข้อความ', 'คัดลอกข้อความสรุปนัดหมาย')}${btn('btn-outline btn-xs btn-dup-apt', '', 'คัดลอกนัด', 'สร้างนัดหมายซ้ำจากรายการนี้')}${btn('btn-outline btn-xs btn-ics-apt', 'cal', '.ics', 'ดาวน์โหลดไฟล์ .ics เข้าปฏิทินมือถือ')}${isConf ? btn('btn-success btn-sm btn-quick-complete', 'check', 'เสร็จสิ้น') : ''}${btn('btn-soft btn-sm btn-edit-apt', 'edit', 'แก้ไข/เลื่อน')}${isConf ? btn('btn-danger-ghost btn-sm btn-open-cancel-modal', '', 'ยกเลิก') : btn('btn-outline btn-sm btn-quick-reopen', '', 'คืนสถานะนัด')}</div></article>`; }
  let _lastUserOptHtml = '';
  function renderListTab(cachedNowBkk) { const nowBkk = bkkOf(cachedNowBkk), all = [], creators = new Set(), odSet = new Set(); let sConf = 0, sComp = 0, sCanc = 0, sOd = 0;
    for (let i = 0; i < state.appointments.length; i++) { const a = state.appointments[i]; if (!a || a.deletedAt) continue; all.push(a);
      const c = a.createdBy || a.updatedBy; if (c) creators.add(c); const st = ns(a.status);
      if (st === S_CF) { sConf++; if (Logic.isOverdue(a, nowBkk.isoStr)) { sOd++; odSet.add(a); } } else if (st === S_CP) sComp++; else sCanc++; }
    txt($('statTotal'), all.length); txt($('statConfirmed'), sConf); txt($('statCompleted'), sComp); txt($('statCancelled'), sCanc); txt($('statOverdue'), sOd);
    const userSel = $('filterUser'); if (userSel) { const curVal = userSel.value; (state.users || []).forEach(u => { if (u && u.displayName) creators.add(u.displayName); });
      let optHtml = '<option value="">สมาชิกทุกคน</option><option value="MY_APTS">เฉพาะงานของฉัน</option>'; creators.forEach(name => { optHtml += `<option value="${eh(name)}">งานที่สร้างโดย: ${eh(name)}</option>`; });
      if (optHtml !== _lastUserOptHtml) { _lastUserOptHtml = optHtml; userSel.innerHTML = optHtml; userSel.value = curVal; } }
    const kw = ($('filterSearch').value || '').trim().toLowerCase(), st = $('filterStatus').value, dt = $('filterDate').value, uFilter = userSel ? userSel.value : '';
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.toggle('active-stat', (p.getAttribute('data-filter-status') || '') === st));
    const tmrStr = gb(nowBkk.epochMs + 86400000).dateStr, filtered = getFilteredListAppointments(nowBkk, all, { kw, st, dt, uFilter, tmrStr, odSet }), listEl = $('appointmentsListContainer');
    txt($('listResultSummary'), `แสดงรายการนัดหมาย ${filtered.length} รายการ (จากทั้งหมด ${all.length} รายการ)`);
    if (!filtered.length) { listEl.innerHTML = '<div class="empty-state">ไม่พบรายการนัดหมายตามเงื่อนไขที่เลือก</div>'; return; }
    const groups = { OVERDUE: { label: 'งานเลยกำหนดเวลา', cls: 'group-overdue', items: [] }, TODAY: { label: `นัดหมายวันนี้ (${ftd(nowBkk.dateStr, false)})`, cls: 'group-today', items: [] }, TOMORROW: { label: `นัดหมายพรุ่งนี้ (${ftd(tmrStr, false)})`, cls: 'group-tomorrow', items: [] }, UPCOMING: { label: 'นัดหมายที่กำลังจะมาถึง', cls: 'group-upcoming', items: [] }, HISTORY: { label: 'ดำเนินการแล้ว / ประวัติย้อนหลัง', cls: 'group-history', items: [] } };
    filtered.forEach(a => { const aSt = ns(a.status); if (odSet.has(a)) groups.OVERDUE.items.push(a); else if (a.appointmentDate === nowBkk.dateStr) groups.TODAY.items.push(a); else if (a.appointmentDate === tmrStr) groups.TOMORROW.items.push(a); else if (aSt === S_CF && (!a.appointmentDate || a.appointmentDate > tmrStr)) groups.UPCOMING.items.push(a); else groups.HISTORY.items.push(a); });
    listEl.innerHTML = ['OVERDUE', 'TODAY', 'TOMORROW', 'UPCOMING', 'HISTORY'].map(k => groups[k]).filter(g => g.items.length > 0).map(g => `<div class="queue-group-section"><div class="queue-group-header ${g.cls}"><div class="queue-group-title-wrap"><span class="queue-group-dot"></span><span class="queue-group-title">${eh(g.label)}</span></div><span class="queue-group-count">${g.items.length} รายการ</span></div><div class="queue-group-items">${g.items.map(a => renderCardHtml(a, nowBkk, odSet.has(a))).join('')}</div></div>`).join(''); }
  function getFilteredListAppointments(nowBkk, allList, pre) {
    const bkk = bkkOf(nowBkk), all = allList || state.appointments.filter(a => a && !a.deletedAt), kw = pre ? pre.kw : (($('filterSearch') ? $('filterSearch').value : '') || '').trim().toLowerCase();
    const st = pre ? pre.st : ($('filterStatus') ? $('filterStatus').value : ''), dt = pre ? pre.dt : ($('filterDate') ? $('filterDate').value : ''), uFilter = pre ? pre.uFilter : ($('filterUser') ? $('filterUser').value : '');
    const tmrStr = pre ? pre.tmrStr : gb(bkk.epochMs + 86400000).dateStr, curMonthPfx = `${bkk.year}-${String(bkk.month).padStart(2, '0')}-`, myName = state.currentUser ? state.currentUser.displayName : '';
    const next7Str = state.quickRange === 'NEXT7' ? gb(bkk.epochMs + 7 * 86400000).dateStr : '', isOd = a => pre && pre.odSet ? pre.odSet.has(a) : Logic.isOverdue(a, bkk.isoStr);
    return all.filter(a => { const aSt = ns(a.status); if (st === 'ACTIVE_ONLY' && aSt !== S_CF) return false;
      if (st === 'OVERDUE' && !isOd(a)) return false; if (st && st !== 'ACTIVE_ONLY' && st !== 'OVERDUE' && aSt !== st) return false;
      if (dt && a.appointmentDate !== dt) return false; if (uFilter === 'MY_APTS' && (a.createdBy || a.updatedBy) !== myName) return false; if (uFilter && uFilter !== 'MY_APTS' && (a.createdBy || a.updatedBy) !== uFilter) return false;
      if (!dt && state.quickRange !== 'ALL') { if (state.quickRange === 'UPCOMING' && !(aSt === S_CF && a.appointmentDate >= bkk.dateStr)) return false; if (state.quickRange === 'TODAY' && a.appointmentDate !== bkk.dateStr) return false; if (state.quickRange === 'TOMORROW' && a.appointmentDate !== tmrStr) return false;
        if (state.quickRange === 'NEXT7') { if (!a.appointmentDate) return false; if (/^\d{4}-\d{2}-\d{2}$/.test(a.appointmentDate)) { if (a.appointmentDate < bkk.dateStr || a.appointmentDate > next7Str) return false; } else { const d = Logic.daysBetweenDates(bkk.dateStr, a.appointmentDate); if (d === null || d < 0 || d > 7) return false; } }
        if (state.quickRange === 'MONTH' && (!a.appointmentDate || !a.appointmentDate.startsWith(curMonthPfx))) return false; }
      return !kw || `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${aSt} ${a.notes}`.toLowerCase().includes(kw);
    }).sort((a, b) => { if (a.appointmentDate && b.appointmentDate && a.appointmentTime && b.appointmentTime) return a.appointmentDate < b.appointmentDate ? -1 : (a.appointmentDate > b.appointmentDate ? 1 : (a.appointmentTime < b.appointmentTime ? -1 : (a.appointmentTime > b.appointmentTime ? 1 : 0)));
      const sa = Logic.buildAppointmentSlot(a) || '9999', sb = Logic.buildAppointmentSlot(b) || '9999'; return sa < sb ? -1 : (sa > sb ? 1 : 0); }); }
  function csvEscapeCell(val) { let s = sn(val == null ? '' : String(val)); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function buildCsvContent(items) {
    const headers = ['รหัสนัดหมาย', 'วันที่นัด (พ.ศ.)', 'วันที่ (YYYY-MM-DD)', 'เวลา', 'หัวข้อนัดหมาย', 'ผู้นัดพบ', 'สถานที่', 'สถานะ', 'ผู้สร้างนัด', 'ผู้เปลี่ยนสถานะล่าสุด', 'สาเหตุ/การเลื่อนนัด', 'ลิงก์แผนที่', 'หมายเหตุ'], rows = [headers.map(csvEscapeCell).join(',')];
    (items || []).forEach(a => { const st = ns(a.status), reasonTxt = a.statusReason || (+a.rescheduleCount > 0 ? `เลื่อนนัด ${+a.rescheduleCount} ครั้ง` : '');
      rows.push([a.id || '', ftd(a.appointmentDate, false), a.appointmentDate || '', (a.appointmentTime || '') + (a.appointmentTime ? ' น.' : ''), a.title || '', a.contactPerson || '', a.location || '', st, a.createdBy || a.updatedBy || '', a.statusChangedBy || '', reasonTxt, normalizeMapUrl(a.mapUrl || ''), a.notes || ''].map(csvEscapeCell).join(','));
    }); return '\uFEFF' + rows.join('\r\n'); }
  function triggerBlobDownload(content, mime, fname) { try { if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(new Blob([content], { type: mime })), link = document.createElement('a'); link.href = url; link.setAttribute('download', fname); link.style.display = 'none';
      if (document.body && typeof document.body.appendChild === 'function') document.body.appendChild(link); link.click(); if (typeof link.remove === 'function') link.remove(); setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 1500); } } catch (_) {} }
  function exportAppointmentsToCsv(ctx) { if (!ctx || !ctx.items || !ctx.items.length) { showToast('ไม่มีรายการนัดหมายสำหรับส่งออกในมุมมองนี้', 'warn'); return ''; }
    const csv = buildCsvContent(ctx.items); triggerBlobDownload(csv, 'text/csv;charset=utf-8;', `${ctx.filePrefix || 'appointments'}_${gb().dateStr}.csv`);
    showToast(`ส่งออกไฟล์ CSV เรียบร้อยแล้ว (${ctx.items.length} รายการ)`, 'success'); return csv; }
  function exportAppointmentToIcs(id) { const a = findApt(id); if (!a || !a.appointmentDate) { showToast('ไม่พบวันที่นัดหมายสำหรับสร้างไฟล์ปฏิทิน', 'warn'); return ''; }
    const startMs = Logic.bangkokSlotToEpochMs(a.appointmentDate, a.appointmentTime || '09:00') || Date.now(), endMs = startMs + 3600000, fmtUtc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const escIcs = s => sn(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const desc = [`ผู้นัดพบ: ${a.contactPerson || '-'}`, `ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'}`, a.notes ? `หมายเหตุ: ${a.notes}` : '', a.mapUrl ? `แผนที่: ${normalizeMapUrl(a.mapUrl)}` : ''].filter(Boolean).join('\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CalendarSystem//TH', 'BEGIN:VEVENT', `UID:${a.id}@calendar.local`, `DTSTAMP:${fmtUtc(Date.now())}`, `DTSTART:${fmtUtc(startMs)}`, `DTEND:${fmtUtc(endMs)}`, `SUMMARY:${escIcs(a.title)}`, `LOCATION:${escIcs(a.location)}`, `DESCRIPTION:${escIcs(desc)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    triggerBlobDownload(ics, 'text/calendar;charset=utf-8;', `${a.id}.ics`); showToast(`ดาวน์โหลดไฟล์ปฏิทิน ${a.id}.ics แล้ว`, 'success'); return ics; }
  function copyAppointmentText(id) { const a = findApt(id); if (!a) return '';
    const out = Logic.formatInstantAppointmentMessage(a, false, { privacyMaskContact: false }); if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') navigator.clipboard.writeText(out).catch(() => {});
    showToast('คัดลอกข้อความสรุปนัดหมายลงคลิปบอร์ดแล้ว', 'success'); return out; }
  function printAppointmentsReport(ctx) { if (!ctx || !ctx.items || !ctx.items.length) { showToast('ไม่มีรายการนัดหมายสำหรับพิมพ์รายงานในมุมมองนี้', 'warn'); return false; }
    const sheet = $('printReportSheet'); if (!sheet) return false; const nowBkk = gb(), items = ctx.items; let cConf = 0, cComp = 0, cCanc = 0;
    items.forEach(a => { const st = ns(a.status); if (st === S_CF) cConf++; else if (st === S_CP) cComp++; else cCanc++; });
    const rowsHtml = items.map((a, idx) => { const st = ns(a.status), subNote = [a.notes ? `หมายเหตุ: ${a.notes}` : '', a.statusReason ? `สาเหตุ: ${a.statusReason}` : ''].filter(Boolean).join(' | ');
      const actor = st === S_CP && a.statusChangedBy ? `เสร็จสิ้นโดย: ${a.statusChangedBy}` : (st === S_CN && a.statusChangedBy ? `ยกเลิกโดย: ${a.statusChangedBy}` : `ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'}`);
      return `<tr><td style="text-align:center;width:34px;">${idx + 1}</td><td style="white-space:nowrap;font-weight:600;">${eh(a.id || '-')}</td><td style="white-space:nowrap;"><div><strong>${eh(ftd(a.appointmentDate, false))}</strong></div><div style="color:#475569;">เวลา ${eh(a.appointmentTime || '-')} น.</div></td><td><div style="font-weight:700;">${eh(a.title || '-')}</div>${subNote ? `<div style="font-size:10px;color:#475569;margin-top:2px;">${eh(subNote)}</div>` : ''}</td><td>${eh(a.contactPerson || '-')}</td><td>${eh(a.location || '-')}</td><td><div><span class="print-st-pill">${eh(st)}</span></div><div style="font-size:10px;color:#475569;margin-top:2px;">${eh(actor)}</div></td></tr>`;
    }).join(''); const printer = state.currentUser ? `${state.currentUser.displayName} (${state.currentUser.role || 'STAFF'})` : S_SYS, kpi = (l, v) => `<div class="print-kpi-box"><span class="print-kpi-label">${l}</span><span class="print-kpi-val">${v} งาน</span></div>`;
    sheet.innerHTML = `<div class="print-doc-header"><div><h1 class="print-doc-title">${eh(ctx.title || 'ใบสรุปตารางนัดหมาย')}</h1><p class="print-doc-sub">${eh(ctx.subtitle || 'ระบบบริหารตารางนัดหมายทีม')}</p></div><div class="print-doc-meta"><div>วันที่พิมพ์: ${eh(ftd(nowBkk.dateStr, false))} เวลา ${eh(nowBkk.timeStr)} น.</div><div>ผู้ออกรายงาน: ${eh(printer)}</div></div></div><div class="print-kpi-row">${kpi('รายการนัดหมายทั้งหมด', items.length)}${kpi('เริ่มนัด (รอดำเนินการ)', cConf)}${kpi('สิ้นสุดการนัดหมาย', cComp)}${kpi('ยกเลิกการนัดหมาย', cCanc)}</div><table class="print-table"><thead><tr><th>#</th><th>รหัสนัด</th><th>วัน-เวลานัด</th><th>หัวข้อนัดหมาย / รายละเอียด</th><th>ผู้นัดพบ</th><th>สถานที่</th><th>สถานะ / ผู้รับผิดชอบ</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="print-footer-sign"><span>เอกสารออกโดยระบบนัดคิวทำงานอัตโนมัติ (v${eh(Logic.API_VERSION)})</span><span>จำนวนรวมทั้งสิ้น ${items.length} รายการ</span></div>`;
    if (typeof window.print === 'function') window.print(); return true; }
  function getCalFilteredMonthData(nowIso) { const mData = Logic.queryByMonth(state.appointments, state.calYear, state.calMonth, { nowIso: nowIso || gb().isoStr });
    if (!state.calOnlyMyApts || !state.currentUser) return mData; const myName = state.currentUser.displayName;
    return { ...mData, items: mData.items.filter(a => (a.createdBy || a.updatedBy) === myName || a.statusChangedBy === myName) }; }
  function getMonthExportContext() { const mData = getCalFilteredMonthData(), items = state.calSelectedDate ? mData.items.filter(a => a.appointmentDate === state.calSelectedDate) : mData.items;
    return { items, title: state.calSelectedDate ? `ใบสรุปตารางนัดหมายประจำวันที่ ${ftd(state.calSelectedDate, true)}` : `ใบสรุปตารางนัดหมายประจำเดือน ${mData.monthNameThai} พ.ศ. ${mData.buddhistYear}`, subtitle: `มุมมองปฏิทินเดือน (${items.length} รายการ)`, filePrefix: state.calSelectedDate ? `ตารางนัด_${state.calSelectedDate}` : `ตารางนัดเดือน_${mData.ceYear}_${String(state.calMonth).padStart(2, '0')}` }; }
  function getListExportContext() { const items = getFilteredListAppointments(), rangeMap = { ALL: 'ทั้งหมด', UPCOMING: 'กำลังจะมาถึง', TODAY: 'วันนี้', TOMORROW: 'พรุ่งนี้', NEXT7: '7 วันข้างหน้า', MONTH: 'เดือนนี้' };
    return { items, title: 'ใบสรุปรายการคิวงานนัดหมาย', subtitle: `ช่วงเวลา: ${rangeMap[state.quickRange] || 'ทั้งหมด'} | จำนวนที่พบ ${items.length} รายการ`, filePrefix: 'รายการคิวงาน' }; }
  function getYearExportContext() { const selYr = Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: gb().isoStr });
    return { items: selYr.items, title: `รายงานสรุปตารางนัดหมายประจำปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`, subtitle: `อัตราความสำเร็จ ${selYr.stats.completionRate}% | เลื่อนนัดสะสม ${selYr.stats.rescheduleTotal} ครั้ง`, filePrefix: `สรุปนัดหมายรายปี_${selYr.buddhistYear}` }; }
  function initMonthSelector() { const sel = $('calSelectMonth'); if (!sel) return; sel.innerHTML = Logic.THAI_MONTHS_FULL.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    sel.value = String(state.calMonth); $('calInputYear').value = String(state.calYear + 543); $('yearOverviewInput').value = String(state.overviewYear + 543); }
  function renderMonthAgenda(mData, nowBkk) { const bkk = bkkOf(nowBkk), md = mData || _lastCalMonthData || getCalFilteredMonthData(bkk.isoStr), showItems = state.calSelectedDate ? md.items.filter(a => a.appointmentDate === state.calSelectedDate) : md.items;
    txt($('agendaEyebrow'), state.calSelectedDate ? 'วันที่เลือกในปฏิทิน' : `ภาพรวมประจำเดือน (${md.items.length} งาน)`); disp($('btnShowAllMonthApts'), state.calSelectedDate ? 'inline-flex' : 'none');
    txt($('monthlyListHeader'), state.calSelectedDate ? `${ftd(state.calSelectedDate, false)} (${showItems.length} งาน)` : `นัดหมายเดือน${md.monthNameThai} (${showItems.length} งาน)`);
    $('monthlyAppointmentsList').innerHTML = showItems.length ? showItems.map(a => renderCardHtml(a, bkk)).join('') : '<div class="empty-state">ไม่มีรายการนัดหมายในวันที่เลือก กดปุ่ม "+ นัดวันนี้" ด้านบนเพื่อสร้างนัดใหม่</div>'; }
  function selectCalendarDate(dtStr) { state.calSelectedDate = state.calSelectedDate === dtStr ? '' : (dtStr || ''); const grid = $('calendarGridContainer');
    if (grid) grid.querySelectorAll('.cal-cell[data-date]').forEach(c => c.classList.toggle('selected', c.getAttribute('data-date') === state.calSelectedDate)); renderMonthAgenda(); }
  function renderCalendarTab(cachedNowBkk) { const nowBkk = bkkOf(cachedNowBkk), y = state.calYear, m = state.calMonth, mData = (_lastCalMonthData = getCalFilteredMonthData(nowBkk.isoStr)), myBtn = $('btnCalFilterMyApts');
    txt($('calendarMonthTitle'), `${mData.monthNameThai} พ.ศ. ${mData.buddhistYear}`); $('calSelectMonth').value = String(m); $('calInputYear').value = String(mData.buddhistYear);
    if (myBtn) { myBtn.textContent = state.calOnlyMyApts ? 'เฉพาะงานของฉัน' : 'งานทุกคนในทีม'; myBtn.className = `btn ${state.calOnlyMyApts ? 'btn-soft' : 'btn-outline'} btn-sm`; }
    const byDate = {}; mData.items.forEach(a => { (byDate[a.appointmentDate] || (byDate[a.appointmentDate] = [])).push(a); });
    const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), maxDay = Logic.getDaysInMonth(y, m), todayStr = nowBkk.dateStr, cells = Array.from({ length: startDow }, () => '<div class="cal-cell empty"></div>');
    for (let d = 1; d <= maxDay; d++) { const dtStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, itms = byDate[dtStr] || [];
      const pills = itms.slice(0, 3).map(a => `<div class="cal-apt-pill ${getStatusClass(a.status)}">${eh(a.appointmentTime || '')} ${eh(a.title)}</div>`).join('');
      const more = itms.length > 3 ? `<div style="font-size:10px;font-weight:600;color:var(--primary);">+ อีก ${itms.length - 3} งาน</div>` : '';
      cells.push(`<div class="cal-cell ${dtStr === todayStr ? 'today' : ''} ${dtStr === state.calSelectedDate ? 'selected' : ''}" data-date="${dtStr}"><div class="cal-cell-head"><span class="cal-date-num">${d}</span><button type="button" class="btn-cell-add" data-add-date="${dtStr}">+</button></div>${pills}${more}</div>`); }
    $('calendarGridContainer').innerHTML = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="cal-day-header">${d}</div>`).join('') + cells.join(''); renderMonthAgenda(mData, nowBkk); }
  function renderYearTab(cachedNowBkk) { const nowBkk = bkkOf(cachedNowBkk), curY = nowBkk.year;
    const multi = Logic.queryMultiYearOverview(state.appointments, Math.min(curY, state.overviewYear), Math.max(curY + 3, state.overviewYear + 1), { nowIso: nowBkk.isoStr });
    $('multiYearCardsContainer').innerHTML = multi.years.map(yr => `<div class="year-summary-card ${yr.ceYear === state.overviewYear ? 'active' : ''}" data-year="${yr.ceYear}"><div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:15px;">พ.ศ. ${yr.buddhistYear}</strong><span class="badge-info">ค.ศ. ${yr.ceYear}</span></div><div style="font-size:12px;color:var(--text-secondary);margin:6px 0;">รวม <strong>${yr.stats.total}</strong> งาน | รอ <strong>${yr.stats.active}</strong> | เสร็จ <strong>${yr.stats.completed}</strong></div><div class="month-mini-bar"><div style="width:${yr.stats.total ? yr.stats.completionRate : 0}%;background:#10b981;"></div></div></div>`).join('');
    const selYr = multi.years.find(y => y.ceYear === state.overviewYear) || Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: nowBkk.isoStr }), s = selYr.stats, uPerfGrid = $('userPerformanceGrid');
    txt($('selectedYearHeader'), `สรุปสถิติตลอดทั้งปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`);
    const b = (t, v, sub, col) => `<div class="stat-box"${col ? ` style="border-left:4px solid ${col};"` : ''}><span class="stat-box-title">${t}</span><span class="stat-box-val">${v}</span><span class="stat-box-sub">${sub}</span></div>`;
    $('yearEndSummaryCards').innerHTML = b('งานนัดหมายทั้งหมด', s.total, 'รายการสะสมทั้งปี') + b('เริ่มนัด (รอดำเนินการ)', s.active, 'รอถึงกำหนดนัดหมาย', 'var(--st-conf-border)') + b('สิ้นสุดการนัดหมาย', s.completed, `อัตราความสำเร็จ ${s.completionRate}%`, 'var(--st-comp-border)') + b('ยกเลิกการนัดหมาย', s.cancelled, `อัตราการยกเลิก ${s.cancellationRate}%`, 'var(--st-canc-border)') + b('การเลื่อนนัดสะสม', s.rescheduleTotal, 'ครั้งที่มีการเลื่อนวัน/เวลา');
    if (uPerfGrid) { const uStats = selYr.userStats || Logic.calculateUserStats(selYr.items);
      uPerfGrid.innerHTML = !uStats.length ? '<div class="empty-state">ยังไม่มีข้อมูลสถิติผู้ใช้งานในปีนี้</div>' : uStats.map(u => `<div class="user-stat-card"><div class="user-stat-header"><span>${eh(u.user)}</span><span class="badge-info">สร้างนัด ${u.createdTotal} งาน</span></div><div class="user-stat-counts"><span style="color:var(--st-comp-text);">กดเสร็จสิ้น: <strong>${u.completedTotal}</strong></span><span style="color:var(--st-canc-text);">กดยกเลิก: <strong>${u.cancelledTotal}</strong></span><span style="color:var(--st-conf-text);">รอดำเนินการ: <strong>${u.activeTotal}</strong></span></div></div>`).join(''); }
    $('yearMonthsGrid').innerHTML = selYr.months.map(m => { const tot = m.stats.total || 0, pComp = tot ? Math.round((m.stats.completed / tot) * 100) : 0, pConf = tot ? Math.round((m.stats.active / tot) * 100) : 0, pCanc = tot ? Math.max(0, 100 - pComp - pConf) : 0;
      const itms = !m.items.length ? '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">ไม่มีรายการนัดหมาย</div>' : m.items.map(a => { const aSt = ns(a.status), stCol = aSt === S_CP ? 'var(--st-comp-border)' : (aSt === S_CN ? 'var(--st-canc-border)' : 'var(--st-conf-border)');
        return `<div class="btn-edit-apt" data-id="${eh(a.id)}" style="cursor:pointer;padding:6px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;border-left:3px solid ${stCol};font-size:11.5px;"><div style="font-weight:600;color:var(--text-main);">${a.appointmentDate.slice(8, 10)} ${m.monthShortThai} ${a.appointmentTime || ''} - ${eh(a.title)}</div><div style="color:var(--text-secondary);font-size:11px;">${eh(a.contactPerson || '-')} | ผู้สร้าง: ${eh(a.createdBy || a.updatedBy || '-')}</div></div>`; }).join('');
      return `<div class="month-box"><div class="month-box-header"><span>${m.monthNameThai}</span><div style="display:flex;align-items:center;gap:6px;"><span class="badge-info">รวม ${m.stats.total}</span><button type="button" class="btn btn-outline btn-sm btn-jump-cal-month" data-year="${selYr.ceYear}" data-month="${m.month}" style="padding:2px 7px;font-size:11px;">ดูปฏิทิน</button></div></div><div class="month-mini-bar"><div style="width:${pComp}%;background:var(--st-comp-border);"></div><div style="width:${pConf}%;background:var(--st-conf-border);"></div><div style="width:${pCanc}%;background:var(--st-canc-border);"></div></div><div style="display:flex;flex-direction:column;gap:5px;">${itms}</div></div>`; }).join(''); }
  function renderSettingsTab() { $('cfgDigestHour').value = state.meta.DAILY_DIGEST_HOUR || '8';
    $('cfgEnableBotQuery').checked = String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE'; $('cfgPrivacyMask').checked = metaTrue('PRIVACY_MASK_CONTACT');
    if ($('cfgNotifyStatusChange')) $('cfgNotifyStatusChange').checked = metaTrue('NOTIFY_ON_STATUS_CHANGE'); updatePwaAndNotifyUI();
    const uTableBody = $('userTableBody'); if (uTableBody) { const isAdmin = isAdminUser(), curUn = state.currentUser ? state.currentUser.username : '';
      uTableBody.innerHTML = (state.users && state.users.length ? state.users : DEF_USERS).map(u => { const canToggle = isAdmin && u.username !== 'admin' && u.username !== curUn;
        return `<tr><td><span class="apt-id-code">${eh(u.userId || '-')}</span></td><td><strong>${eh(u.username)}</strong></td><td>${eh(u.displayName || '-')}</td><td><span class="badge-role ${(u.role || 'STAFF').toLowerCase()}">${eh(u.role || 'STAFF')}</span></td><td><span class="status-badge ${u.isActive !== false ? 'status-completed' : 'status-cancelled'}">${u.isActive !== false ? 'ใช้งาน' : 'ระงับ'}</span></td><td style="color:var(--text-muted);font-size:12px;">${eh(u.lastLoginAt ? ftd(u.lastLoginAt.slice(0, 10), false) + ' ' + u.lastLoginAt.slice(11, 16) : 'ยังไม่เคยเข้าใช้')}</td><td>${isAdmin ? `<button type="button" class="btn btn-soft btn-sm btn-edit-user" data-uid="${eh(u.userId)}">แก้ไข</button>` : '<span class="hint-text">เฉพาะ ADMIN</span>'}${canToggle ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-toggle-user" data-uid="${eh(u.userId)}" data-active="${u.isActive !== false ? 'true' : 'false'}">${u.isActive !== false ? 'ระงับ' : 'เปิดใช้'}</button>` : ''}</td></tr>`; }).join(''); }
    const tb = $('rescheduleLogsTableBody');
    if (!state.rescheduleLogs.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:18px;">ยังไม่มีประวัติการเลื่อนนัดหรือแก้ไขข้อมูล</td></tr>'; return; }
    tb.innerHTML = state.rescheduleLogs.slice(0, 40).map(l => `<tr><td>${eh(l.changedAt)}</td><td><span class="apt-id-code">${eh(l.appointmentId)}</span></td><td>${eh(l.changedBy)}</td><td><span class="badge-info">${eh(FIELD_LABELS[l.fieldChanged] || l.fieldChanged)}</span></td><td style="color:var(--text-muted);">${eh(l.oldValue || '-')}</td><td><strong>${eh(l.newValue || '-')}</strong></td><td>${eh(l.reason || '-')}</td></tr>`).join(''); }
  function renderPatchNotes() { const c = $('patchNotesContainer'); if (!c) return;
    c.innerHTML = PatchNotes.map(p => `<div class="patch-card"><div class="patch-card-head"><span>เวอร์ชัน ${eh(p.version)}</span><span class="hint-text">${eh(p.date)}</span></div><div class="patch-card-desc">${eh(p.title)}</div><ul>${(p.changes || []).map(ch => `<li>${eh(ch)}</li>`).join('')}</ul></div>`).join(''); }
  let pickerMap = null, pickerMarker = null, previewMap = null;
  function parseCoords(raw) { const s = String(raw || '').trim(), m = s.match(/(?:@|[?&](?:q|ll|destination)=|^\s*)(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/) || s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null; const lat = parseFloat(m[1]), lng = parseFloat(m[2]); return (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) ? { lat, lng } : null; }
  function normalizeMapUrl(raw) { const s = sn(raw); if (!s) return ''; if (/^https?:\/\//i.test(s)) return s; const ll = parseCoords(s); return ll ? `https://www.google.com/maps?q=${ll.lat},${ll.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s)}`; }
  function updateMapPinUI() { disp($('btnClearMapPin'), ($('formMapUrl') ? $('formMapUrl').value : '').trim() ? 'inline-flex' : 'none'); }
  function setMapPinCoords(lat, lng, statusTxt) { const latF = Number(lat).toFixed(6), lngF = Number(lng).toFixed(6);
    if ($('formMapUrl')) $('formMapUrl').value = `https://www.google.com/maps?q=${latF},${lngF}`; txt($('mapPickerStatus'), statusTxt || `ปักหมุดแล้ว: ${latF}, ${lngF}`); updateMapPinUI();
    if (pickerMap && pickerMarker) { pickerMarker.setLatLng([+latF, +lngF]); pickerMap.setView([+latF, +lngF], Math.max(pickerMap.getZoom(), 15)); } }
  function openMapPickerPanel(optCoords) { const wrap = $('mapPickerWrap'); if (!wrap) return; wrap.style.display = 'flex';
    const c = optCoords || parseCoords($('formMapUrl') ? $('formMapUrl').value : '') || { lat: 13.7563, lng: 100.5018 }, box = $('leafletMapPicker');
    if (typeof window.L !== 'undefined' && box) { if (!pickerMap) { pickerMap = window.L.map(box).setView([c.lat, c.lng], 14);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM' }).addTo(pickerMap); pickerMarker = window.L.marker([c.lat, c.lng], { draggable: true }).addTo(pickerMap);
        pickerMap.on('click', ev => setMapPinCoords(ev.latlng.lat, ev.latlng.lng)); pickerMarker.on('dragend', () => { const p = pickerMarker.getLatLng(); setMapPinCoords(p.lat, p.lng); }); } else setMapPinCoords(c.lat, c.lng);
      setTimeout(() => { if (pickerMap) pickerMap.invalidateSize(); }, 90);
    } else txt($('mapPickerStatus'), 'ไม่สามารถโหลดแผนที่แบบโต้ตอบได้ (สามารถวางลิงก์ Google Maps ในช่องด้านบนได้ทันที)'); }
  async function searchAndPinMap(query) { const q = sn(query); if (!q) { showToast('กรุณาระบุชื่อสถานที่เพื่อค้นหาบนแผนที่', 'warn'); return; }
    openMapPickerPanel(); txt($('mapPickerStatus'), `กำลังค้นหา "${q}"...`); try {
      const d = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)).json();
      if (Array.isArray(d) && d[0]) { setMapPinCoords(d[0].lat, d[0].lon, `พบตำแหน่ง: ${d[0].display_name.slice(0, 70)}`); showToast('ปักหมุดตำแหน่งจากสถานที่สำเร็จ', 'success'); }
      else { txt($('mapPickerStatus'), 'ไม่พบพิกัดอัตโนมัติ ลองค้นหาด้วยชื่อย่าน/จังหวัด หรือคลิกปักหมุดบนแผนที่เอง'); showToast('ไม่พบพิกัดของสถานที่นี้ ลองคลิกบนแผนที่เพื่อปักหมุด', 'warn'); }
    } catch (_) { txt($('mapPickerStatus'), 'เชื่อมต่อค้นหาไม่สำเร็จ กรุณาคลิกปักหมุดบนแผนที่หรือวางลิงก์ Google Maps'); } }
  function openMapPreviewModal(id) { const a = findApt(id); if (!a || !a.mapUrl) return;
    txt($('mapPreviewTitle'), `แผนที่นัดหมาย: ${a.title}`); txt($('mapPreviewLocation'), `สถานที่: ${a.location || '-'}`);
    if ($('btnOpenExternalMap')) $('btnOpenExternalMap').href = normalizeMapUrl(a.mapUrl || a.location) || 'https://maps.google.com';
    const box = $('mapPreviewContainer'); if (previewMap) { try { previewMap.remove(); } catch (_) {} previewMap = null; }
    openModal('mapPreviewModal'); if (!box) return; box.innerHTML = ''; const ll = parseCoords(a.mapUrl); if (ll && typeof window.L !== 'undefined') {
      setTimeout(() => { try { previewMap = window.L.map(box).setView([ll.lat, ll.lng], 15);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OSM' }).addTo(previewMap);
          window.L.marker([ll.lat, ll.lng]).addTo(previewMap).bindPopup(eh(a.location || a.title || 'จุดนัดพบ')).openPopup(); previewMap.invalidateSize(); } catch (_) {} }, 60);
    } else box.innerHTML = `<iframe class="map-embed-iframe" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(ll ? `${ll.lat},${ll.lng}` : (a.location || a.mapUrl))}&z=15&output=embed"></iframe>`; }
  function setFormImagePreview(val, infoText) { const v = sn(val); if ($('formImageData')) $('formImageData').value = v;
    const nextUrlVal = v && !v.startsWith('data:') ? v : ''; if ($('formImageUrlInput') && $('formImageUrlInput').value !== nextUrlVal) $('formImageUrlInput').value = nextUrlVal;
    if ($('formImagePreview')) $('formImagePreview').src = v || ''; disp($('formImagePreviewWrap'), v ? 'flex' : 'none'); disp($('btnClearImage'), v ? 'inline-flex' : 'none');
    txt($('formImageSizeInfo'), infoText || (v ? (v.startsWith('data:') ? `ขนาดข้อมูล: ${Math.max(1, Math.round(v.length / 1024))} KB` : 'ลิงก์รูปภาพภายนอก') : '')); }
  function compressImageFile(file) { if (!file || !file.type || !file.type.startsWith('image/')) { showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error'); return; }
    const reader = new FileReader(); reader.onload = ev => { const img = new Image(); img.onload = () => { const tryEncode = (maxDim, q) => {
          let w = img.width, h = img.height; if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); return { url: cv.toDataURL('image/jpeg', q), w, h }; };
        let res = tryEncode(720, 0.72); if (res.url.length > 42000) res = tryEncode(560, 0.56); if (res.url.length > 45000) res = tryEncode(420, 0.45);
        if (res.url.length > 48000) { showToast('รูปภาพมีขนาดใหญ่เกินไปแม้หลังบีบอัด กรุณาใช้รูปที่เล็กลงหรือวางเป็นลิงก์รูปแทน', 'error'); return; }
        setFormImagePreview(res.url, `ย่อขนาดอัตโนมัติ ${res.w}x${res.h} (${Math.max(1, Math.round(res.url.length / 1024))} KB)`); showToast('แนบรูปภาพสำเร็จ', 'success'); };
      img.src = ev.target.result; }; reader.readAsDataURL(file); }
  function openImagePreviewModal(id) { const a = findApt(id); if (!a || !a.imageUrl) return;
    txt($('imagePreviewTitle'), `รูปภาพแนบ: ${a.title}`); if ($('imagePreviewFull')) $('imagePreviewFull').src = a.imageUrl; if ($('btnOpenExternalImage')) $('btnOpenExternalImage').href = a.imageUrl; openModal('imagePreviewModal'); }
  function syncRemindChips() { ['formRemindDays', 'formRemindHours'].forEach(id => { const val = String(Math.max(0, parseInt($(id) ? $(id).value : '0', 10) || 0));
      document.querySelectorAll(`.remind-chip[data-remind-target="${id}"]`).forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === val)); }); }
  function checkConflictOnForm() { const banner = $('conflictWarningBanner'); if (!banner) return;
    const conflicts = Logic.findTimeConflicts(state.appointments, $('formDate').value, $('formTime').value, $('formAptId').value);
    if (conflicts.length > 0) { banner.textContent = `แจ้งเตือน: มีนัดหมายอื่นในวันและเวลานี้แล้ว (${conflicts.length} งาน: ${conflicts.map(c => c.title).join(', ')})`; banner.style.display = 'block'; } else banner.style.display = 'none'; }
  function updateDateThaiPreview() { const v = $('formDate').value; txt($('formDateThaiPreview'), v ? ftd(v, true) : 'ยังไม่ระบุวันที่'); }
  function fillAptForm(f) { $('formAptId').value = f.id || ''; $('formExpectedUpdatedAt').value = f.updatedAt || ''; $('formTitle').value = f.title || ''; $('formStatus').value = f.status || S_CF;
    $('formContactPerson').value = f.contactPerson || ''; $('formDate').value = f.date || ''; $('formTime').value = f.time || '09:00'; $('formLocation').value = f.location || '';
    if ($('formMapUrl')) $('formMapUrl').value = f.mapUrl || ''; disp($('mapPickerWrap'), 'none'); if ($('formMapSearchInput')) $('formMapSearchInput').value = ''; updateMapPinUI();
    $('formRemindDays').value = String(f.remindDays != null && f.remindDays !== '' ? f.remindDays : 0); $('formRemindHours').value = String(f.remindHours != null && f.remindHours !== '' ? f.remindHours : 0); syncRemindChips();
    $('formNotes').value = f.notes || ''; $('formRescheduleReason').value = ''; if ($('formImageFile')) $('formImageFile').value = ''; setFormImagePreview(f.imageUrl || ''); updateDateThaiPreview(); checkConflictOnForm(); openModal('appointmentModal'); }
  function setupAptModalHeader(titleTxt, notifyChecked, notifyLbl, showReason, creatorTxt) { txt($('modalTitle'), titleTxt);
    if ($('formNotifyLine')) $('formNotifyLine').checked = notifyChecked; txt($('formNotifyLineLabel'), notifyLbl); disp($('rescheduleReasonGroup'), showReason ? 'block' : 'none'); disp($('btnDeleteApt'), showReason ? 'inline-flex' : 'none');
    const pill = $('formCreatedByPill'); if (pill) { pill.textContent = creatorTxt; pill.style.display = 'inline-block'; } }
  function openCreateModal(prefillDate) { setupAptModalHeader('สร้างนัดหมายใหม่', true, 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที', false, `ผู้สร้างนัดหมาย: ${curUserDisp()}`);
    fillAptForm({ date: typeof prefillDate === 'string' && prefillDate ? prefillDate : gb().dateStr }); }
  function openDuplicateModal(id) { const a = findApt(id); if (!a) return;
    setupAptModalHeader(`สร้างนัดหมายซ้ำ (คัดลอกจาก ${a.id})`, true, 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที', false, `ผู้สร้างนัดหมาย: ${curUserDisp()}`);
    fillAptForm({ title: a.title, status: S_CF, contactPerson: a.contactPerson, date: state.calSelectedDate || a.appointmentDate || gb().dateStr, time: a.appointmentTime || '09:00', location: a.location, mapUrl: a.mapUrl || '', imageUrl: a.imageUrl || '', remindDays: a.remindDaysBefore, remindHours: a.remindHoursBefore, notes: a.notes }); }
  function openEditModal(id) { const a = findApt(id); if (!a) return;
    setupAptModalHeader(`แก้ไขนัดหมาย ${a.id}`, false, 'ส่งแจ้งเตือนการแก้ไขนัดหมายเข้ากลุ่ม LINE ทันที', true, `ผู้สร้างนัดหมายเดิม: ${a.createdBy || a.updatedBy || '-'} | แก้ไขโดย: ${curUserDisp()}`);
    fillAptForm({ id: a.id, updatedAt: a.updatedAt, title: a.title, status: ns(a.status), contactPerson: a.contactPerson, date: a.appointmentDate, time: a.appointmentTime, location: a.location, mapUrl: a.mapUrl || '', imageUrl: a.imageUrl || '', remindDays: a.remindDaysBefore, remindHours: a.remindHoursBefore, notes: a.notes }); }
  async function handleFormSubmit(e) { e.preventDefault(); const id = $('formAptId').value.trim(), exp = $('formExpectedUpdatedAt').value.trim();
    if (id && pendingIds.has(id)) { showToast(M_SYNC, 'info'); return; }
    const curUserName = curUserDisp(), rawImg = ($('formImageData') && $('formImageData').value) || ($('formImageUrlInput') && $('formImageUrlInput').value) || '';
    const payload = { title: sn($('formTitle').value), status: $('formStatus').value, contactPerson: sn($('formContactPerson').value), appointmentDate: $('formDate').value, appointmentTime: $('formTime').value, location: sn($('formLocation').value), mapUrl: $('formMapUrl') ? normalizeMapUrl($('formMapUrl').value) : '', imageUrl: sn(rawImg), remindDaysBefore: +$('formRemindDays').value, remindHoursBefore: +$('formRemindHours').value, notes: sn($('formNotes').value), updatedBy: curUserName };
    const reason = sn($('formRescheduleReason').value), notifyLine = Boolean($('formNotifyLine') && $('formNotifyLine').checked);
    if (!id) payload.createdBy = curUserName; else { payload.statusChangedBy = curUserName; if (reason) payload.statusReason = reason; }
    const v = Logic.validateAppointmentInput(payload); if (!v.valid) { showToast(v.errors.join(' | '), 'error'); return; }
    const prevApts = [...state.appointments], prevLogs = [...state.rescheduleLogs]; try { const now = gb().isoStr; let savedApt = null, wpType = 'CREATE';
      if (!id) { savedApt = Logic.createAppointmentRecord(payload, state.appointments, now); state.appointments.push(savedApt); }
      else { const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) throw new Error('ไม่พบรายการนัดหมาย');
        const r = Logic.updateAppointmentRecord(state.appointments[idx], payload, { nowIso: now, expectedUpdatedAt: exp, reason, suppressSlotReset: Boolean(id && !notifyLine) });
        state.appointments[idx] = savedApt = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
        wpType = r.reopened ? 'REOPEN' : (r.statusChanged && savedApt.status === S_CP ? 'COMPLETED' : (r.statusChanged && savedApt.status === S_CN ? 'CANCELLED' : 'UPDATE')); }
      if (!state.isLive && notifyLine && savedApt) txt($('botSimOutput'), Logic.formatInstantAppointmentMessage(savedApt, Boolean(id), { privacyMaskContact: metaTrue('PRIVACY_MASK_CONTACT') }));
      if (!state.isLive) saveDemoData(); closeModal('appointmentModal'); if (state.isLive) pendingIds.add(savedApt.id); renderActiveTab(); notifyWebPushForApt(savedApt, wpType);
      showToast(id ? 'บันทึกการแก้ไขนัดหมายเรียบร้อยแล้ว' : 'สร้างนัดหมายใหม่เรียบร้อยแล้ว', 'success');
      syncAptMutation(savedApt.id, prevApts, prevLogs, savedApt, () => id ? callGasApi('update', { id, payload, expectedUpdatedAt: exp, reason, notifyLine }) : callGasApi('create', { payload, notifyLine }), 'บันทึกไม่สำเร็จ');
    } catch (err) { state.appointments = prevApts; state.rescheduleLogs = prevLogs; showToast(err.message, 'error'); } }
  async function mutateAptStatus(id, newStatus, reason, extra) {
    if (pendingIds.has(id)) { showToast(M_SYNC, 'info'); return false; }
    const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) return false;
    const prevApts = [...state.appointments], prevApt = prevApts[idx], prevLogs = [...state.rescheduleLogs], curUser = curUserDisp(), notifyLine = (extra && extra.notifyLine !== undefined) ? Boolean(extra.notifyLine) : metaTrue('NOTIFY_ON_STATUS_CHANGE');
    const patch = { status: newStatus, updatedBy: curUser, statusChangedBy: newStatus === S_CF ? '' : curUser, statusReason: newStatus === S_CF ? '' : (extra && extra.statusReason ? sn(extra.statusReason) : (reason || '')) };
    try { const r = Logic.updateAppointmentRecord(prevApt, patch, { nowIso: gb().isoStr, expectedUpdatedAt: prevApt.updatedAt, reason: reason || newStatus, suppressSlotReset: !notifyLine });
      state.appointments[idx] = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
      if (!state.isLive && notifyLine) txt($('botSimOutput'), Logic.formatInstantAppointmentMessage(r.record, true, { privacyMaskContact: metaTrue('PRIVACY_MASK_CONTACT') }));
      if (!state.isLive) saveDemoData(); if (state.isLive) pendingIds.add(id); renderActiveTab();
      notifyWebPushForApt(r.record, newStatus === S_CP ? 'COMPLETED' : (newStatus === S_CN ? 'CANCELLED' : 'REOPEN'));
      syncAptMutation(id, prevApts, prevLogs, r.record, () => callGasApi('update', { id, payload: patch, expectedUpdatedAt: prevApt.updatedAt, notifyLine, reason: reason || newStatus }), 'เปลี่ยนสถานะไม่สำเร็จ');
      return true; } catch (err) { state.appointments = prevApts; state.rescheduleLogs = prevLogs; showToast(err.message, 'error'); return false; } }
  async function handleQuickComplete(id) { if (await mutateAptStatus(id, S_CP, 'เสร็จสิ้นการนัดหมาย')) showToast(`บันทึก [${id}] สิ้นสุดการนัดหมายแล้ว`, 'success'); }
  function openCancelModal(id) { const a = findApt(id); if (!a) return;
    $('cancelAptId').value = a.id; txt($('cancelAptSummary'), `[${a.id}] ${a.title} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`);
    $('cancelReasonInput').value = ''; if ($('cancelNotifyLine')) $('cancelNotifyLine').checked = metaTrue('NOTIFY_ON_STATUS_CHANGE'); openModal('cancelModal'); }
  async function handleCancelSubmit(e) { e.preventDefault(); const id = $('cancelAptId').value.trim(), reason = sn($('cancelReasonInput').value), notifyLine = Boolean($('cancelNotifyLine') && $('cancelNotifyLine').checked);
    if (await mutateAptStatus(id, S_CN, reason || 'ยกเลิกการนัดหมาย', { statusReason: reason, notifyLine })) { closeModal('cancelModal'); showToast(`ยกเลิกนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn'); } }
  async function handleQuickReopen(id) { if (await mutateAptStatus(id, S_CF, 'คืนสถานะนัดหมาย')) showToast(`คืนสถานะ [${id}] เป็น "เริ่มนัด" เรียบร้อย`, 'success'); }
  async function handleDelete() { const id = $('formAptId').value.trim(); if (!id || !confirm(`ยืนยันการลบนัดหมาย [${id}] หรือไม่?`)) return;
    if (pendingIds.has(id)) { showToast(M_SYNC, 'info'); return; }
    const user = curUserDisp(), idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) return;
    const prevApts = [...state.appointments], prevLogs = [...state.rescheduleLogs], removed = state.appointments[idx];
    state.appointments.splice(idx, 1); state.rescheduleLogs.unshift({ logId: `LOG-${Date.now()}-DEL`, appointmentId: id, changedAt: gb().isoStr, changedBy: user, fieldChanged: 'DELETED', oldValue: removed.title, newValue: 'ลบนัดหมาย', reason: 'ลบออกจากระบบ' });
    if (!state.isLive) saveDemoData(); closeModal('appointmentModal'); renderActiveTab(); notifyWebPushForApt(removed, 'DELETE'); showToast(`ลบนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn');
    if (state.isLive) runBgTask(id, () => callGasApi('delete', { id, updatedBy: user }), null, err => { state.appointments = prevApts; state.rescheduleLogs = prevLogs; renderActiveTab(); showToast('ลบนัดหมายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); }); }
  function openUserModal(userId) { if (!isAdminUser()) { showToast(M_ADMIN, 'error'); return; }
    state.editingUserId = userId || null; txt($('userModalTitle'), userId ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่');
    const uList = state.users && state.users.length ? state.users : DEF_USERS, u = userId ? uList.find(x => x.userId === userId) : null;
    $('formUsername').value = u ? u.username : ''; $('formUsername').disabled = Boolean(u); $('formDisplayName').value = u ? (u.displayName || u.username) : ''; $('formUserPassword').value = ''; $('formUserRole').value = u ? (u.role || 'STAFF') : 'STAFF';
    disp($('formUserPasswordReqStar'), u ? 'none' : 'inline'); txt($('formUserPasswordHint'), u ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน' : 'กำหนดรหัสผ่านสำหรับเข้าสู่ระบบ'); openModal('userModal'); }
  async function handleUserFormSubmit(e) { e.preventDefault(); if (!isAdminUser()) { showToast(M_ADMIN, 'error'); return; }
    const un = ($('formUsername').value || '').trim().toLowerCase(), dispName = sn($('formDisplayName').value), pw = $('formUserPassword').value || '', role = $('formUserRole').value;
    const uList = state.users && state.users.length ? state.users : DEF_USERS, existingU = state.editingUserId ? uList.find(x => x.userId === state.editingUserId) : null;
    const payload = { userId: state.editingUserId || undefined, isNew: !state.editingUserId, username: un, displayName: dispName, role, isActive: existingU ? existingU.isActive !== false : true }; if (pw) payload.password = pw;
    try { const v = Logic.validateUserInput(payload, !state.editingUserId); if (!v.valid) throw new Error(v.errors.join(' | '));
      if (!state.editingUserId && uList.some(x => x.username.toLowerCase() === un)) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      const prevUsers = (state.users || []).map(u => ({ ...u })), s = v.sanitized;
      if (state.editingUserId) { const idx = state.users.findIndex(x => x.userId === state.editingUserId); if (idx !== -1) { state.users[idx].displayName = s.displayName; state.users[idx].role = s.role; if (s.passwordHash) state.users[idx].passwordHash = s.passwordHash; } }
      else { const maxNum = (state.users || []).reduce((m, x) => Math.max(m, x.userId && x.userId.startsWith('USR-') ? (+x.userId.slice(4) || 0) : 0), 0);
        state.users.push({ userId: `USR-${String(maxNum + 1).padStart(3, '0')}`, username: s.username, displayName: s.displayName, role: s.role, passwordHash: s.passwordHash, isActive: true, createdAt: gb().isoStr }); }
      if (state.editingUserId && state.currentUser.userId === state.editingUserId) { state.currentUser.displayName = dispName; state.currentUser.role = role; sSet(STORAGE.AUTH_USER, state.currentUser); updateUserSessionUI(); }
      if (!state.isLive) saveDemoData(); closeModal('userModal'); renderActiveTab(); showToast('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว', 'success');
      if (state.isLive) runBgTask(null, () => callGasApi('saveUser', { userPayload: payload }), res => { if (res && res.user) {
          const idx = state.users.findIndex(x => x.userId === res.user.userId || x.username === res.user.username); if (idx !== -1) state.users[idx] = { ...state.users[idx], ...res.user }; else state.users.push(res.user); renderActiveTab(); }
      }, err => { state.users = prevUsers; renderActiveTab(); showToast('บันทึกสมาชิกไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); });
    } catch (err) { showToast(err.message, 'error'); } }
  async function handleToggleUserStatus(userId, curActive) { if (!isAdminUser()) { showToast(M_ADMIN, 'error'); return; }
    const uList = state.users && state.users.length ? state.users : DEF_USERS, u = uList.find(x => x.userId === userId);
    if (u && (u.username === 'admin' || u.username === state.currentUser.username)) { showToast('ไม่สามารถระงับบัญชีผู้ดูแลระบบหลักหรือบัญชีที่กำลังใช้งานอยู่ได้', 'error'); return; }
    const targetStatus = !curActive, idx = state.users.findIndex(x => x.userId === userId); if (idx === -1) return; state.users[idx].isActive = targetStatus;
    if (!state.isLive) saveDemoData(); renderActiveTab(); showToast(`ปรับสถานะผู้ใช้งานเป็น ${targetStatus ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'} แล้ว`, 'info');
    if (state.isLive) runBgTask(null, () => callGasApi('saveUser', { userPayload: { userId, username: u ? u.username : undefined, isActive: targetStatus } }), null, err => { const curIdx = state.users.findIndex(x => x.userId === userId); if (curIdx !== -1) state.users[curIdx].isActive = curActive; renderActiveTab(); showToast('ปรับสถานะไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); }); }
  function bindEvents() {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab'))));
    const toggleTheme = () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'), onAll = (ids, fn) => ids.forEach(i => on(i, 'click', fn));
    onAll(['btnToggleTheme', 'btnToggleThemeAuth'], toggleTheme); on('btnLogout', 'click', handleLogout); on('loginForm', 'submit', handleLoginSubmit); on('registerForm', 'submit', handleRegisterSubmit);
    [['tabBtnAuthLogin', 'login'], ['tabBtnAuthRegister', 'register'], ['btnSwitchToRegister', 'register'], ['btnSwitchToLogin', 'login']].forEach(([i, m]) => on(i, 'click', () => switchAuthTab(m)));
    on('btnOpenAddUserModal', 'click', () => openUserModal(null)); on('userForm', 'submit', handleUserFormSubmit); on('cancelForm', 'submit', handleCancelSubmit);
    [['btnCloseUserModalTop', 'userModal'], ['btnCancelUserModal', 'userModal'], ['btnCloseCancelModalTop', 'cancelModal'], ['btnDismissCancelModal', 'cancelModal'], ['btnCloseModalTop', 'appointmentModal'], ['btnCancelModal', 'appointmentModal'], ['btnClosePatchNotesModalTop', 'patchNotesModal'], ['btnClosePatchNotesModal', 'patchNotesModal'], ['btnCloseGuideModalTop', 'guideModal'], ['btnCloseGuideModal', 'guideModal'], ['btnCloseMapPreviewModalTop', 'mapPreviewModal'], ['btnCloseMapPreviewModal', 'mapPreviewModal'], ['btnCloseImagePreviewModalTop', 'imagePreviewModal'], ['btnCloseImagePreviewModal', 'imagePreviewModal'], ['btnCloseWebNotifModalTop', 'webNotifModal'], ['btnCloseWebNotifModal', 'webNotifModal']].forEach(([b, m]) => on(b, 'click', () => closeModal(m)));
    onAll(['btnOpenCreateModal', 'btnMobileFabCreate'], () => openCreateModal()); on('btnAddAptOnSelectedDate', 'click', () => openCreateModal(state.calSelectedDate || `${state.calYear}-${String(state.calMonth).padStart(2, '0')}-01`));
    on('btnShowAllMonthApts', 'click', () => selectCalendarDate('')); on('btnCalFilterMyApts', 'click', () => { state.calOnlyMyApts = !state.calOnlyMyApts; renderCalendarTab(); });
    on('formDate', 'change', () => { updateDateThaiPreview(); checkConflictOnForm(); }); on('formTime', 'change', checkConflictOnForm); on('appointmentForm', 'submit', handleFormSubmit); on('btnDeleteApt', 'click', handleDelete); on('btnSyncNow', 'click', () => syncWithServer(false));
    document.querySelectorAll('.time-chip').forEach(c => c.addEventListener('click', () => { if ($('formTime')) { $('formTime').value = c.getAttribute('data-time') || ''; checkConflictOnForm(); } }));
    document.querySelectorAll('.range-chip').forEach(c => c.addEventListener('click', () => { state.quickRange = c.getAttribute('data-range') || 'ALL'; document.querySelectorAll('.range-chip').forEach(x => x.classList.toggle('active', x === c)); if ($('filterDate')) $('filterDate').value = ''; renderListTab(); }));
    on('btnOpenPatchNotesModal', 'click', () => { renderPatchNotes(); openModal('patchNotesModal'); }); on('btnOpenGuideModal', 'click', () => openModal('guideModal'));
    on('formRemindDays', 'input', syncRemindChips); on('formRemindHours', 'input', syncRemindChips); on('formMapUrl', 'input', updateMapPinUI);
    on('btnToggleMapPicker', 'click', () => { const wrap = $('mapPickerWrap'); if (wrap) { if (wrap.style.display === 'none' || !wrap.style.display) openMapPickerPanel(); else wrap.style.display = 'none'; } });
    on('btnSearchMapFromLoc', 'click', () => searchAndPinMap($('formLocation') ? $('formLocation').value : '')); on('btnExecMapSearch', 'click', () => searchAndPinMap($('formMapSearchInput') ? $('formMapSearchInput').value : ''));
    on('formMapSearchInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchAndPinMap($('formMapSearchInput').value); } });
    on('btnClearMapPin', 'click', () => { if ($('formMapUrl')) $('formMapUrl').value = ''; updateMapPinUI(); disp($('mapPickerWrap'), 'none'); });
    on('btnUseCurrentGps', 'click', () => { if (!navigator.geolocation) { showToast('อุปกรณ์ไม่รองรับการดึงพิกัด GPS', 'error'); return; } openMapPickerPanel(); txt($('mapPickerStatus'), 'กำลังดึงตำแหน่ง GPS ปัจจุบัน...');
      navigator.geolocation.getCurrentPosition(pos => { setMapPinCoords(pos.coords.latitude, pos.coords.longitude, 'ปักหมุดจากพิกัด GPS ปัจจุบันแล้ว'); showToast('ดึงพิกัด GPS สำเร็จ', 'success'); }, () => showToast('ไม่สามารถเข้าถึงตำแหน่ง GPS ได้ กรุณาอนุญาตสิทธิ์หรือคลิกบนแผนที่', 'warn')); });
    on('btnTriggerImageUpload', 'click', () => { if ($('formImageFile')) $('formImageFile').click(); }); on('formImageFile', 'change', e => { const f = e.target.files && e.target.files[0]; if (f) compressImageFile(f); });
    on('formImageUrlInput', 'input', () => { const u = sn($('formImageUrlInput').value); setFormImagePreview(u, u ? 'ลิงก์รูปภาพภายนอก' : ''); if ($('formImageUrlInput') && u) $('formImageUrlInput').value = u; });
    on('btnClearImage', 'click', () => { if ($('formImageFile')) $('formImageFile').value = ''; setFormImagePreview(''); });
    const setTeamConn = async () => { state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true; if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl; if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
      sSet(STORAGE.CFG, { gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }); closeModal('guideModal'); await syncWithServer(false); };
    onAll(['btnQuickConnectFromGuide', 'btnResetDefaultConn'], setTeamConn); let searchRaf = 0;
    on('filterSearch', 'input', () => { cancelAnimationFrame(searchRaf); searchRaf = requestAnimationFrame(renderListTab); }); on('filterStatus', 'change', renderListTab); on('filterUser', 'change', renderListTab);
    on('filterDate', 'change', () => { if ($('filterDate').value) { state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL')); } renderListTab(); });
    on('btnClearFilters', 'click', () => { $('filterSearch').value = $('filterStatus').value = $('filterDate').value = ''; if ($('filterUser')) $('filterUser').value = ''; state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL')); renderListTab(); });
    document.querySelectorAll('.stat-pill').forEach(p => p.addEventListener('click', () => { $('filterStatus').value = p.getAttribute('data-filter-status') || ''; renderListTab(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') MODAL_IDS.forEach(closeModal); else if (e.altKey && (e.key === 'n' || e.key === 'N') && state.currentUser) { e.preventDefault(); openCreateModal(state.calSelectedDate); } });
    const idClickMap = [['.btn-edit-apt', openEditModal], ['.btn-dup-apt', openDuplicateModal], ['.btn-copy-apt', copyAppointmentText], ['.btn-ics-apt', exportAppointmentToIcs], ['.btn-view-map', openMapPreviewModal], ['.btn-view-image', openImagePreviewModal], ['.btn-quick-complete', handleQuickComplete], ['.btn-open-cancel-modal', openCancelModal], ['.btn-quick-reopen', handleQuickReopen]];
    document.addEventListener('click', e => { const t = e.target; if (t.classList && t.classList.contains('modal-backdrop')) { t.classList.remove('active'); return; }
      const addCell = t.closest('.btn-cell-add'); if (addCell) { e.stopPropagation(); const dt = addCell.getAttribute('data-add-date'); selectCalendarDate(dt || ''); openCreateModal(dt); return; }
      const jumpM = t.closest('.btn-jump-cal-month'); if (jumpM) { state.calYear = +jumpM.getAttribute('data-year'); state.calMonth = +jumpM.getAttribute('data-month'); state.calSelectedDate = ''; switchTab('tabMonth'); return; }
      for (let i = 0; i < idClickMap.length; i++) { const hit = t.closest(idClickMap[i][0]); if (hit) { idClickMap[i][1](hit.getAttribute('data-id')); return; } }
      const rChip = t.closest('.remind-chip'); if (rChip) { const tid = rChip.getAttribute('data-remind-target'); if ($(tid)) { $(tid).value = rChip.getAttribute('data-val') || '0'; syncRemindChips(); } return; }
      const rStep = t.closest('.btn-remind-step'); if (rStep) { const tid = rStep.getAttribute('data-step-target'), stp = parseInt(rStep.getAttribute('data-step') || '0', 10); if ($(tid)) { const mx = parseInt($(tid).getAttribute('max') || '365', 10); $(tid).value = String(Math.max(0, Math.min(mx, (parseInt($(tid).value || '0', 10) || 0) + stp))); syncRemindChips(); } return; }
      const editU = t.closest('.btn-edit-user'); if (editU) { openUserModal(editU.getAttribute('data-uid')); return; }
      const toggleU = t.closest('.btn-toggle-user'); if (toggleU) { handleToggleUserStatus(toggleU.getAttribute('data-uid'), toggleU.getAttribute('data-active') === 'true'); return; }
      const cell = t.closest('.cal-cell:not(.empty)'); if (cell) { selectCalendarDate(cell.getAttribute('data-date')); return; }
      const yc = t.closest('.year-summary-card'); if (yc) { state.overviewYear = +yc.getAttribute('data-year'); $('yearOverviewInput').value = String(state.overviewYear + 543); renderYearTab(); return; }
      const qc = t.closest('.btn-quick-cmd'); if (qc) { $('botSimInput').value = qc.getAttribute('data-cmd'); runBotSim(); } });
    on('btnPrevMonth', 'click', () => { state.calSelectedDate = ''; if (--state.calMonth < 1) { state.calMonth = 12; state.calYear--; } renderCalendarTab(); });
    on('btnNextMonth', 'click', () => { state.calSelectedDate = ''; if (++state.calMonth > 12) { state.calMonth = 1; state.calYear++; } renderCalendarTab(); });
    on('btnCurrentMonth', 'click', () => { const now = gb(); state.calYear = now.year; state.calMonth = now.month; state.calSelectedDate = now.dateStr; renderCalendarTab(); });
    on('btnJumpMonth', 'click', () => { const y = Logic.normalizeYearToCE($('calInputYear').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; } state.calMonth = +$('calSelectMonth').value; state.calYear = y; state.calSelectedDate = ''; renderCalendarTab(); });
    on('btnJumpYearOverview', 'click', () => { const y = Logic.normalizeYearToCE($('yearOverviewInput').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; } state.overviewYear = y; renderYearTab(); });
    [['btnExportMonthCsv', getMonthExportContext, exportAppointmentsToCsv], ['btnPrintMonth', getMonthExportContext, printAppointmentsReport], ['btnExportListCsv', getListExportContext, exportAppointmentsToCsv], ['btnPrintList', getListExportContext, printAppointmentsReport], ['btnExportYearCsv', getYearExportContext, exportAppointmentsToCsv], ['btnPrintYear', getYearExportContext, printAppointmentsReport]].forEach(([id, ctxFn, actFn]) => on(id, 'click', () => actFn(ctxFn())));
    on('btnSaveConnection', 'click', async () => { const u = ($('cfgGasUrl').value || '').trim(), p = $('cfgPasscode').value || ''; if (!u) { showToast('กรุณาระบุ Web App URL', 'error'); return; }
      state.gasUrl = u; state.passcode = p; state.isLive = true; clearLiveCache(); sSet(STORAGE.CFG, { gasUrl: u, passcode: p, isLive: true }); await syncWithServer(false); });
    on('btnSwitchLocalDemo', 'click', () => { state.isLive = false; clearLiveCache(); sSet(STORAGE.CFG, { gasUrl: state.gasUrl, passcode: state.passcode, isLive: false }); loadDemoData(); renderAll(); showToast('สลับเป็นโหมดจำลองข้อมูลในเครื่อง (Demo) แล้ว', 'warn'); });
    on('btnSavePolicy', 'click', () => { const prevMeta = { ...state.meta }, m = { DAILY_DIGEST_HOUR: String(+$('cfgDigestHour').value || 8), ENABLE_LINE_BOT_QUERY: $('cfgEnableBotQuery').checked ? 'TRUE' : 'FALSE', PRIVACY_MASK_CONTACT: $('cfgPrivacyMask').checked ? 'TRUE' : 'FALSE', NOTIFY_ON_STATUS_CHANGE: $('cfgNotifyStatusChange') && $('cfgNotifyStatusChange').checked ? 'TRUE' : 'FALSE' };
      state.meta = { ...state.meta, ...m }; renderActiveTab(); showToast(state.isLive ? 'บันทึกนโยบายเรียบร้อยแล้ว' : 'บันทึกนโยบายเรียบร้อยแล้ว (Demo)', 'success');
      if (state.isLive) runBgTask(null, () => callGasApi('updateMeta', { meta: m }), null, err => { state.meta = prevMeta; renderActiveTab(); showToast('บันทึกนโยบายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); }); });
    const handleTriggerSetup = async (mode, desc) => { if (!state.isLive) { showToast(`[Demo] จำลองการติดตั้ง ${desc} สำเร็จ`, 'info'); return; }
      try { const r = await callGasApi('setupTriggers', { mode }); showToast(r.message || `ตั้งค่า ${desc} เรียบร้อย`, 'success'); } catch (err) { showToast(err.message, 'error'); } };
    [['btnInstallAutoTrigger', 'auto', 'Trigger อัจฉริยะ'], ['btnInstallDailyTrigger', 'daily', 'Trigger สรุปเช้าวันละครั้ง'], ['btnInstall15MinTrigger', 'every15Min', 'Trigger ตรวจเช็คทุก 15 นาที'], ['btnRemoveTriggers', 'off', 'ปิด Trigger ทั้งหมด']].forEach(([id, m, d]) => on(id, 'click', () => handleTriggerSetup(m, d)));
    on('btnTestValidateLine', 'click', async () => { if (!state.isLive) { txt($('botSimOutput'), '[Demo] ข้อความผ่านการตรวจสอบรูปแบบ Zero-Emoji พร้อมเชื่อม LINE'); showToast('ตรวจสอบรูปแบบสำเร็จ (Demo)', 'success'); return; }
      try { const r = await callGasApi('testNotification', { dryRun: true }); txt($('botSimOutput'), `[Validate] ${r.ok ? 'สำเร็จ HTTP ' + r.httpStatus : 'ไม่สำเร็จ: ' + r.error}`); showToast(r.ok ? 'Validate ผ่านเรียบร้อย' : 'Validate ไม่ผ่าน', r.ok ? 'success' : 'error'); } catch (e) { txt($('botSimOutput'), '[Error] ' + e.message); } });
    on('btnTestRealPush', 'click', async () => { if (!state.isLive || !confirm('การทดสอบจริงจะหักโควตา LINE ตามจำนวนสมาชิกกลุ่ม ยืนยันหรือไม่?')) return;
      try { const r = await callGasApi('testNotification', { dryRun: false }); txt($('botSimOutput'), `[Push จริง] ${r.ok ? 'สำเร็จ' : r.error}`); await syncWithServer(true); showToast(r.ok ? 'ส่งข้อความทดสอบสำเร็จ' : 'ส่งไม่สำเร็จ', r.ok ? 'success' : 'error'); } catch (e) { txt($('botSimOutput'), '[Error] ' + e.message); } });
    on('btnRunBotSim', 'click', runBotSim); on('botSimInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runBotSim(); } });
    on('btnPreviewNotificationPlan', 'click', () => { const bkk = gb(), plan = Logic.buildNotificationPlan(state.appointments, `${bkk.dateStr}T08:15:00+07:00`, { dailyDigestHour: +state.meta.DAILY_DIGEST_HOUR || 8, quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0 });
      txt($('botSimUserEcho'), '[ระบบจำลองรอบเตือนอัตโนมัติ 08:15 น.]'); txt($('botSimOutput'), plan.shouldPush ? plan.messageText : '[จำลองการแจ้งเตือน]\nไม่มีรายการที่ถึงเกณฑ์เตือนในรอบนี้'); });
    on('btnHeaderWebNotify', 'click', openWebNotifModal); on('btnClearWebNotifFeed', 'click', () => { state.webNotifFeed = []; state.webNotifUnread = 0; saveWebNotifFeed(); updatePwaAndNotifyUI(); renderWebNotifFeed(); });
    onAll(['btnInstallPwa', 'btnInstallPwaSettings'], handleInstallPwaClick); onAll(['btnRequestWebNotify', 'btnModalReqWebNotify'], requestWebNotifyPermission); onAll(['btnTestWebNotify', 'btnModalTestWebNotify'], handleTestWebNotify);
    const onWebNotifToggle = e => { state.webNotif.enabled = Boolean(e.target.checked); saveWebNotifCfg(); updatePwaAndNotifyUI(); };
    on('chkModalWebNotify', 'change', onWebNotifToggle); on('cfgWebNotifyEnable', 'change', onWebNotifToggle);
    on('cfgWebNotifyBgSync', 'change', () => { state.webNotif.bgSync = Boolean($('cfgWebNotifyBgSync').checked); saveWebNotifCfg(); updatePwaAndNotifyUI(); }); }
  const localMutAt = {};
  function loadWebNotifCfg() { try { const c = JSON.parse(localStorage.getItem(STORAGE.WEB_NOTIF) || 'null'), f = JSON.parse(localStorage.getItem(STORAGE.WEB_NOTIF_FEED) || '[]');
      if (c && typeof c === 'object') state.webNotif = { enabled: c.enabled !== false, bgSync: c.bgSync !== false }; if (Array.isArray(f)) state.webNotifFeed = f.slice(0, 40); } catch (_) {} }
  function saveWebNotifCfg() { try { localStorage.setItem(STORAGE.WEB_NOTIF, JSON.stringify(state.webNotif)); } catch (_) {} }
  function saveWebNotifFeed() { try { localStorage.setItem(STORAGE.WEB_NOTIF_FEED, JSON.stringify(state.webNotifFeed.slice(0, 40))); } catch (_) {} }
  function getWebNotifSentList() { try { const arr = JSON.parse(localStorage.getItem(STORAGE.WEB_NOTIF_SENT) || '[]'); return Array.isArray(arr) ? arr : []; } catch (_) { return []; } }
  function markWebNotifSent(key) { try { const arr = getWebNotifSentList(); if (!arr.includes(key)) { arr.push(key); if (arr.length > 150) arr.splice(0, arr.length - 150); localStorage.setItem(STORAGE.WEB_NOTIF_SENT, JSON.stringify(arr)); } } catch (_) {} }
  function updatePwaAndNotifyUI() { state.isStandalone = Boolean((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true));
    const hasNotif = typeof Notification !== 'undefined', perm = hasNotif ? Notification.permission : 'unsupported', hBtn = $('btnHeaderWebNotify'), badge = $('webNotifBadgeCount');
    if (hBtn) { hBtn.classList.toggle('is-granted', perm === 'granted' && state.webNotif.enabled); hBtn.classList.toggle('is-denied', perm === 'denied'); }
    txt($('headerWebNotifyLabel'), perm === 'granted' ? (state.webNotif.enabled ? 'แจ้งเตือน: เปิด' : 'แจ้งเตือน: พัก') : (perm === 'denied' ? 'แจ้งเตือน: บล็อก' : 'แจ้งเตือนเว็บ'));
    if (badge) { txt(badge, state.webNotifUnread); disp(badge, state.webNotifUnread > 0 ? 'inline-block' : 'none'); }
    const permText = !hasNotif ? 'แจ้งเตือนในแอป (อุปกรณ์ไม่รองรับ OS Push)' : (perm === 'granted' ? (state.webNotif.enabled ? 'อนุญาต OS Push แล้ว (เปิดใช้งาน)' : 'อนุญาตแล้ว (พักชั่วคราว)') : (perm === 'denied' ? 'OS Push ถูกบล็อก (ยังแจ้งเตือนในแอปปกติ)' : 'ยังไม่ได้เปิด OS Push (แจ้งเตือนในแอปเปิดอยู่)'));
    txt($('webNotifyStatusBadge'), permText); txt($('modalWebNotifyPermBadge'), permText);
    txt($('pwaInstallStatusBadge'), state.isStandalone ? 'ติดตั้งเป็นแอปแล้ว (Standalone)' : (state.deferredPwaPrompt ? 'พร้อมติดตั้งลงเครื่อง' : 'ใช้งานผ่านเบราว์เซอร์'));
    disp($('btnInstallPwa'), state.isStandalone ? 'none' : 'inline-flex'); txt($('installPwaBtnLabel'), state.deferredPwaPrompt ? 'ติดตั้งแอปทันที' : 'ติดตั้งแอป');
    if ($('btnInstallPwaSettings')) { $('btnInstallPwaSettings').disabled = state.isStandalone; $('btnInstallPwaSettings').textContent = state.isStandalone ? 'ติดตั้งเป็นแอปแล้ว' : 'ติดตั้งเว็บแอปลงเครื่อง (PWA)'; }
    if ($('cfgWebNotifyEnable')) $('cfgWebNotifyEnable').checked = state.webNotif.enabled; if ($('chkModalWebNotify')) $('chkModalWebNotify').checked = state.webNotif.enabled; if ($('cfgWebNotifyBgSync')) $('cfgWebNotifyBgSync').checked = state.webNotif.bgSync; }
  function renderWebNotifFeed() { const box = $('webNotifFeedList'); if (!box) return;
    if (!state.webNotifFeed.length) { box.innerHTML = '<div class="empty-state">ยังไม่มีประวัติการแจ้งเตือนบนอุปกรณ์นี้</div>'; return; }
    box.innerHTML = state.webNotifFeed.map(it => `<div class="notif-feed-item" data-apt-id="${escapeHtml(it.aptId || '')}"><div class="notif-feed-head"><span>${escapeHtml(it.title)}</span><span class="notif-feed-time">${escapeHtml(it.time)}</span></div><div class="notif-feed-body">${escapeHtml(it.body)}</div></div>`).join(''); }
  function openWebNotifModal() { state.webNotifUnread = 0; updatePwaAndNotifyUI(); renderWebNotifFeed(); openModal('webNotifModal'); }
  function showWebPushBanner(title, body, aptId, variant) { const c = $('webPushBannerContainer'); if (!c) return; while (c.children.length >= 3) c.firstElementChild.remove();
    const card = document.createElement('div'), bkk = Logic.getBangkokParts(); card.className = `web-push-card${variant ? ' ' + variant : ''}`;
    card.innerHTML = `<div class="web-push-icon">${ICO.bell}</div><div class="web-push-content"><div class="web-push-head"><span class="web-push-title">${escapeHtml(title)}</span><span class="web-push-time">${escapeHtml(bkk.timeStr)} น.</span></div><div class="web-push-body">${escapeHtml(body)}</div></div><button type="button" class="web-push-close" aria-label="ปิด">&times;</button>`;
    card.addEventListener('click', ev => { if (ev.target.closest('.web-push-close')) { card.remove(); return; } if (aptId) focusAppointmentFromNotif(aptId); card.remove(); });
    c.appendChild(card); setTimeout(() => { card.style.opacity = '0'; card.style.transition = 'opacity 0.25s'; setTimeout(() => card.remove(), 260); }, 6500); }
  async function sendWebPushNotification(title, body, tag, aptId, opts) {
    const cleanTitle = Logic.sanitizeNoEmoji(title || 'แจ้งเตือนนัดคิวทำงาน'), cleanBody = Logic.sanitizeNoEmoji(body || ''), bkk = Logic.getBangkokParts(), timeLbl = `${Logic.formatThaiDateDisplay(bkk.dateStr, false)} ${bkk.timeStr} น.`;
    state.webNotifFeed.unshift({ title: cleanTitle, body: cleanBody, time: timeLbl, aptId: aptId || '' }); if (state.webNotifFeed.length > 40) state.webNotifFeed.length = 40; saveWebNotifFeed();
    const mEl = $('webNotifModal'); if (!mEl || !mEl.classList.contains('active')) state.webNotifUnread++; else renderWebNotifFeed(); updatePwaAndNotifyUI(); showWebPushBanner(cleanTitle, cleanBody, aptId || '', opts && opts.variant);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return true;
    const swOpts = { body: cleanBody, icon: './icon.svg', badge: './icon.svg', vibrate: [180, 80, 180], tag: tag || ('cal-' + Date.now()), renotify: true, data: { url: './index.html', aptId: aptId || '' } };
    let reg = (state.swReg && state.swReg.active) ? state.swReg : null, nativeSent = false;
    if (!reg && navigator.serviceWorker && navigator.serviceWorker.controller) { try { reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 600))]); } catch (_) {} }
    if (reg && typeof reg.showNotification === 'function') { try { await reg.showNotification(cleanTitle, swOpts); nativeSent = true; } catch (_) {} }
    if (!nativeSent) { try { const n = new Notification(cleanTitle, { body: cleanBody, icon: './icon.svg', tag: swOpts.tag }); n.onclick = () => { try { window.focus(); } catch (_) {} if (aptId) focusAppointmentFromNotif(aptId); n.close(); }; nativeSent = true; } catch (_) {} }
    if (!nativeSent && reg && reg.active && typeof reg.active.postMessage === 'function') { try { reg.active.postMessage({ type: 'SHOW_NOTIFICATION', title: cleanTitle, options: swOpts }); } catch (_) {} }
    return true; }
  function notifyWebPushForApt(apt, actionType) { if (!apt || !state.webNotif.enabled) return; if (apt.id) localMutAt[apt.id] = Date.now();
    const hdrMap = { CREATE: ['[แจ้งเตือนนัดหมายใหม่]', ''], COMPLETED: ['[แจ้งเตือนสิ้นสุดการนัดหมาย]', 'is-ok'], CANCELLED: ['[แจ้งเตือนยกเลิกการนัดหมาย]', 'is-err'], REOPEN: ['[แจ้งเตือนการคืนสถานะนัดหมาย]', ''], DELETE: ['[แจ้งเตือนลบนัดหมาย]', 'is-warn'], UPDATE: ['[แจ้งเตือนการอัปเดตนัดหมาย]', ''] };
    const [hdr, variant] = hdrMap[actionType] || hdrMap.UPDATE, lim = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0, qFull = lim > 0 && used >= lim;
    const lines = [`วันนัด: ${Logic.formatThaiDateDisplay(apt.appointmentDate, false)} เวลา ${apt.appointmentTime || '-'} น.`, `สถานที่: ${apt.location || '-'} | ผู้นัด: ${apt.contactPerson || '-'}`];
    if (actionType === 'CANCELLED' && apt.statusReason) lines.push(`สาเหตุ: ${apt.statusReason}`); if (qFull) lines.push('(แจ้งเตือนผ่านแอป - โควตา LINE เต็ม)');
    return sendWebPushNotification(`${hdr} ${apt.title || apt.id || ''}`, lines.join('\n'), `apt-${actionType}-${apt.id || 'x'}-${Date.now()}`, actionType === 'DELETE' ? '' : apt.id, { variant }).catch(() => false); }
  async function requestWebNotifyPermission() {
    if (typeof Notification === 'undefined') { showToast('เบราว์เซอร์นี้ไม่รองรับ OS Push (ระบบยังคงแจ้งเตือนในแอปให้ปกติ)', 'warn'); updatePwaAndNotifyUI(); return false; }
    if (Notification.permission === 'denied') { showToast('สิทธิ์ OS Push ถูกบล็อก กรุณากดอนุญาตที่ไอคอนตั้งค่าข้างแถบ URL (ในแอปยังแจ้งเตือนปกติ)', 'warn'); updatePwaAndNotifyUI(); return false; }
    try { const res = await Notification.requestPermission();
      if (res === 'granted') { state.webNotif.enabled = true; saveWebNotifCfg(); updatePwaAndNotifyUI(); showToast('เปิดรับการแจ้งเตือนผ่านเว็บเรียบร้อยแล้ว', 'success');
        await sendWebPushNotification('ระบบนัดคิวทำงานพร้อมแจ้งเตือน', 'คุณจะได้รับการแจ้งเตือนนัดหมายและอัปเดตบนอุปกรณ์นี้', 'cal-perm-' + Date.now(), '', { variant: 'is-ok' }); return true;
      } updatePwaAndNotifyUI(); showToast('ยังไม่ได้รับสิทธิ์ OS Push (ระบบยังคงแจ้งเตือนในแอปให้ปกติ)', 'warn'); return false;
    } catch (e) { showToast('ขออนุญาตแจ้งเตือนไม่สำเร็จ: ' + e.message, 'error'); return false; } }
  async function handleTestWebNotify() { if (typeof Notification !== 'undefined' && Notification.permission === 'default') await requestWebNotifyPermission();
    const permGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    await sendWebPushNotification('ทดสอบแจ้งเตือน: ระบบนัดคิวทำงาน', permGranted ? 'การแจ้งเตือน OS Push และ In-App ทำงานปกติ (ไม่เสียโควตา LINE)' : 'การแจ้งเตือน In-App ทำงานปกติ (กด "ขออนุญาต" เพื่อรับแจ้งเตือนระดับอุปกรณ์)', 'cal-test-' + Date.now(), '', { variant: 'is-ok' });
    showToast('ส่งแจ้งเตือนทดสอบเรียบร้อยแล้ว', 'success'); }
  async function handleInstallPwaClick() { if (state.isStandalone) { showToast('เว็บแอปถูกติดตั้งและกำลังเปิดใช้งานแบบแอปแล้ว', 'info'); return; }
    if (state.deferredPwaPrompt) { try { state.deferredPwaPrompt.prompt(); const ch = await state.deferredPwaPrompt.userChoice; state.deferredPwaPrompt = null; updatePwaAndNotifyUI();
        if (ch && ch.outcome === 'accepted') showToast('ติดตั้งเว็บแอปลงเครื่องเรียบร้อยแล้ว', 'success'); } catch (_) {} return; }
    showToast(/iphone|ipad|ipod/i.test(navigator.userAgent || '') ? 'สำหรับ iOS: แตะปุ่ม แชร์ (Share) ของ Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"' : 'หากเปิดผ่าน HTTPS บน Chrome/Edge กดไอคอนติดตั้งที่แถบ URL หรือเมนูเบราว์เซอร์ "ติดตั้งแอป"', 'info'); }
  function focusAppointmentFromNotif(aptId) { const a = state.appointments.find(x => x.id === aptId && !x.deletedAt); if (!a) return;
    if (a.appointmentDate) { const p = a.appointmentDate.split('-').map(Number); if (p[0] && p[1]) { state.calYear = p[0]; state.calMonth = p[1]; state.calSelectedDate = a.appointmentDate; } }
    switchTab('tabMonth'); showToast(`เปิดรายการนัดหมาย [${a.id}] ${a.title}`, 'info'); }
  function evaluateAndFireWebNotifications(prevApts, isSyncDiff) { if (!state.currentUser || !state.webNotif.enabled) return;
    const nowBkk = Logic.getBangkokParts(), sentSet = new Set(getWebNotifSentList()), lim = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0, qFull = lim > 0 && used >= lim, cfg = { dailyDigestHour: +state.meta.DAILY_DIGEST_HOUR || 8, quietHoursStart: 22, quietHoursEnd: 7, requireDigestWindow: false };
    state.appointments.forEach(a => { const ev = Logic.evaluateAppointmentNotification(a, nowBkk.isoStr, cfg);
      if (ev.shouldNotifyHour) { const key = `HOUR:${a.id}:${ev.targetHourSlot}`; if (!sentSet.has(key)) { markWebNotifSent(key); sentSet.add(key); sendWebPushNotification(`[เตือนก่อนเวลานัด] ${a.title}`, `${Logic.formatThaiDateDisplay(a.appointmentDate, false)} เวลา ${a.appointmentTime} น. | ${a.location}${qFull ? '\n(โควตา LINE เต็ม - แจ้งเตือนผ่านแอป)' : ''}`, key, a.id, { variant: 'is-warn' }); } }
      else if (ev.shouldNotifyDay) { const key = `DAY:${a.id}:${ev.targetDaySlot}`; if (!sentSet.has(key)) { markWebNotifSent(key); sentSet.add(key); sendWebPushNotification(`[แจ้งเตือนนัดหมาย] ${a.title}`, `${Logic.formatThaiDateDisplay(a.appointmentDate, false)} เวลา ${a.appointmentTime} น. | ${a.location}${qFull ? '\n(โควตา LINE เต็ม - แจ้งเตือนผ่านแอป)' : ''}`, key, a.id); } } });
    if (isSyncDiff && Array.isArray(prevApts) && prevApts.length) { const prevMap = new Map(prevApts.map(x => [x.id, x])), nowMs = Date.now();
      state.appointments.forEach(a => { if (!a || a.deletedAt || pendingIds.has(a.id) || nowMs - (localMutAt[a.id] || 0) < 15000) return; const p = prevMap.get(a.id);
        if (!p) { const key = `NEW:${a.id}:${a.updatedAt || a.createdAt}`; if (!sentSet.has(key)) { markWebNotifSent(key); notifyWebPushForApt(a, 'CREATE'); } }
        else if (p.updatedAt !== a.updatedAt) { const key = `UPD:${a.id}:${a.updatedAt}`, st = Logic.normalizeStatus(a.status); if (!sentSet.has(key)) { markWebNotifSent(key); notifyWebPushForApt(a, st === Logic.STATUS.COMPLETED ? 'COMPLETED' : (st === Logic.STATUS.CANCELLED ? 'CANCELLED' : 'UPDATE')); } } }); } }
  function initPwaAndWebPush() { loadWebNotifCfg(); const hm = (window.location.hash || '').match(/apt=([^&]+)/); if (hm) state.pendingNotifAptId = decodeURIComponent(hm[1]);
    on('webNotifFeedList', 'click', ev => { const item = ev.target.closest('.notif-feed-item'); if (!item) return; const aid = item.getAttribute('data-apt-id'); closeModal('webNotifModal'); if (aid) focusAppointmentFromNotif(aid); });
    if ('serviceWorker' in navigator && /^https?:$/i.test(window.location.protocol)) {
      navigator.serviceWorker.register('./sw.js').then(reg => { state.swReg = reg; if (reg.active) updatePwaAndNotifyUI(); }).catch(() => {});
      navigator.serviceWorker.ready.then(reg => { state.swReg = reg; updatePwaAndNotifyUI(); }).catch(() => {});
      navigator.serviceWorker.addEventListener('message', ev => { if (ev.data && ev.data.type === 'NOTIFICATION_CLICK' && ev.data.aptId) focusAppointmentFromNotif(ev.data.aptId); }); }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredPwaPrompt = e; updatePwaAndNotifyUI(); });
    window.addEventListener('appinstalled', () => { state.deferredPwaPrompt = null; state.isStandalone = true; updatePwaAndNotifyUI(); showToast('ติดตั้งเว็บแอปลงเครื่องเรียบร้อยแล้ว', 'success'); });
    updatePwaAndNotifyUI(); }
  function runBotSim() { const val = $('botSimInput').value; txt($('botSimUserEcho'), val || '...');
    const res = Logic.parseAndExecuteLineCommand(val, state.appointments, gb().isoStr, { enableLineBotQuery: String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE', privacyMaskContact: metaTrue('PRIVACY_MASK_CONTACT'), quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0, defaultCreator: curUserDisp(),
      onCreate: rec => { const prevApts = [...state.appointments], prevLogs = [...state.rescheduleLogs]; state.appointments.push(rec); if (state.isLive) pendingIds.add(rec.id); else saveDemoData();
        renderActiveTab(); notifyWebPushForApt(rec, 'CREATE'); showToast('สร้างนัดหมายใหม่ผ่านคำสั่งบอทแล้ว', 'success');
        if (state.isLive) syncAptMutation(rec.id, prevApts, prevLogs, rec, () => callGasApi('create', { payload: rec, notifyLine: false }), 'บันทึกนัดจากบอทไม่สำเร็จ'); } });
    txt($('botSimOutput'), res === null ? '[บอทเงียบ]\nเนื่องจากข้อความไม่ตรงกับคำสั่งบอท (ลองพิมพ์ "วันนี้", "ทั้งหมด" หรือ "ช่วยเหลือ")' : res); }
  window.addEventListener('DOMContentLoaded', initApp); })();
