/**
 * app.js - UI Controller, State Management & User Attribution (v2.5.2)
 * Modern SaaS UI with Time-First Cards, Split-View Calendar, User Authentication & Audit Trail
 * Zero-Emoji Policy Compliant
 */
(function () {
  'use strict';

  const Logic = window.CalendarLogic, PatchNotes = window.PATCH_NOTES || [];
  const $ = id => document.getElementById(id), on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const openModal = id => { const el = $(id); if (el) el.classList.add('active'); };
  const closeModal = id => { const el = $(id); if (el) el.classList.remove('active'); };
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  const escapeHtml = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ESC[c]);

  const STORAGE = { APTS: 'CAL_DEMO_APTS_V2', LOGS: 'CAL_DEMO_LOGS_V2', CFG: 'CAL_CONN_CFG_V2', THEME: 'CAL_THEME_V2', AUTH_USER: 'CAL_AUTH_USER_V2', USERS: 'CAL_DEMO_USERS_V2' };
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwEq-EehM4BDKQLsh7dFQCJNeJNg2g_DtM1_INYgjblaKyhcdkNuAdiIEhkvSke--ro/exec';
  const DEFAULT_PASSCODE = 'CALL1234';
  const FIELD_LABELS = { appointmentDate: 'วันที่นัดหมาย', appointmentTime: 'เวลานัดหมาย', location: 'สถานที่', contactPerson: 'ผู้นัดพบ', status: 'สถานะ', DELETED: 'ลบนัดหมาย' };

  const ICO = {
    clock: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    user: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    pin: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    bell: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" style="stroke-width:2.5;"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    edit: '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
  };

  const state = {
    isLive: true, gasUrl: DEFAULT_GAS_URL, passcode: DEFAULT_PASSCODE, currentUser: null, users: [], theme: 'light',
    quickRange: 'ALL', filterUser: '', appointments: [], rescheduleLogs: [],
    meta: { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'TRUE' },
    calYear: Logic.getBangkokParts().year, calMonth: Logic.getBangkokParts().month, calSelectedDate: '',
    overviewYear: Logic.getBangkokParts().year, editingUserId: null
  };

  function showToast(msg, type = 'info') {
    const c = $('toastContainer'); if (!c) return;
    const it = document.createElement('div');
    it.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
    it.textContent = Logic.sanitizeNoEmoji(msg);
    c.appendChild(it);
    setTimeout(() => { it.style.opacity = '0'; it.style.transition = 'opacity 0.25s'; setTimeout(() => it.remove(), 260); }, 3200);
  }

  function applyTheme(t) {
    state.theme = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    if ($('iconThemeSun')) $('iconThemeSun').style.display = state.theme === 'dark' ? 'inline' : 'none';
    if ($('iconThemeMoon')) $('iconThemeMoon').style.display = state.theme === 'dark' ? 'none' : 'inline';
    try { localStorage.setItem(STORAGE.THEME, state.theme); } catch (_) {}
  }

  function switchTab(id) {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === id));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === id));
  }

  function loadSavedSession() {
    try { const su = localStorage.getItem(STORAGE.USERS); state.users = su ? JSON.parse(su) : [...Logic.DEFAULT_USERS]; } catch (_) { state.users = [...Logic.DEFAULT_USERS]; }
    state.currentUser = null;
    try { const uStr = localStorage.getItem(STORAGE.AUTH_USER); if (uStr) { const p = JSON.parse(uStr); if (p && p.username && p.displayName) state.currentUser = p; } } catch (_) {}
    updateUserSessionUI();
  }

  function switchAuthTab(mode) {
    const isReg = mode === 'register';
    if ($('tabBtnAuthLogin')) { $('tabBtnAuthLogin').classList.toggle('active', !isReg); $('tabBtnAuthLogin').setAttribute('aria-selected', isReg ? 'false' : 'true'); }
    if ($('tabBtnAuthRegister')) { $('tabBtnAuthRegister').classList.toggle('active', isReg); $('tabBtnAuthRegister').setAttribute('aria-selected', isReg ? 'true' : 'false'); }
    if ($('loginForm')) $('loginForm').style.display = isReg ? 'none' : 'flex';
    if ($('registerForm')) $('registerForm').style.display = isReg ? 'flex' : 'none';
    if ($('loginErrorMsg')) $('loginErrorMsg').style.display = 'none';
    if ($('registerErrorMsg')) $('registerErrorMsg').style.display = 'none';
  }

  function updateUserSessionUI() {
    const isAuth = Boolean(state.currentUser && state.currentUser.username);
    if ($('authGateScreen')) $('authGateScreen').style.display = isAuth ? 'none' : 'flex';
    if ($('appShell')) $('appShell').style.display = isAuth ? 'block' : 'none';
    const authBadge = $('authModeBadge');
    if (authBadge) { authBadge.className = state.isLive ? 'mode-badge live' : 'mode-badge demo'; authBadge.textContent = state.isLive ? 'Sheets' : 'Demo'; }
    const nameEl = $('currentUserName'), roleEl = $('currentUserRole');
    if (nameEl) nameEl.textContent = isAuth ? state.currentUser.displayName : 'ยังไม่ได้เข้าสู่ระบบ';
    if (roleEl) { const r = isAuth && state.currentUser.role === 'ADMIN' ? 'ADMIN' : 'STAFF'; roleEl.textContent = r; roleEl.className = `badge-role ${r.toLowerCase()}`; }
    const isAdmin = Boolean(isAuth && state.currentUser.role === 'ADMIN');
    if ($('userManagementSection')) $('userManagementSection').style.opacity = isAdmin ? '1' : '0.85';
    if ($('btnOpenAddUserModal')) $('btnOpenAddUserModal').style.display = isAdmin ? 'inline-flex' : 'none';
  }

  function handleLogout() {
    state.currentUser = null;
    try { localStorage.removeItem(STORAGE.AUTH_USER); } catch (_) {}
    ['appointmentModal', 'cancelModal', 'userModal', 'guideModal', 'patchNotesModal'].forEach(closeModal);
    if ($('loginUsername')) $('loginUsername').value = '';
    if ($('loginPassword')) $('loginPassword').value = '';
    switchAuthTab('login'); updateUserSessionUI(); showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  }

  const pendingIds = new Set();
  let bgTaskCount = 0;
  function setBgSync(active) {
    bgTaskCount = Math.max(0, bgTaskCount + (active ? 1 : -1));
    const btn = $('btnSyncNow'), lbl = $('syncBtnLabel');
    if (btn) btn.classList.toggle('is-syncing', bgTaskCount > 0);
    if (lbl) lbl.textContent = bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์';
  }

  function applySyncBundle(d) {
    if (!d) return;
    if (Array.isArray(d.appointments)) state.appointments = d.appointments;
    if (Array.isArray(d.rescheduleLogs)) state.rescheduleLogs = d.rescheduleLogs;
    if (Array.isArray(d.users) && d.users.length) state.users = d.users;
    else if (!state.users || !state.users.length) state.users = [...Logic.DEFAULT_USERS];
    if (d.meta) state.meta = { ...state.meta, ...d.meta };
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const un = ($('loginUsername').value || '').trim(), pw = $('loginPassword').value || '', errEl = $('loginErrorMsg'), submitBtn = $('btnSubmitLogin');
    try {
      if (errEl) errEl.style.display = 'none';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังตรวจสอบ...'; }
      let userObj = null, syncBundle = null;
      if (state.isLive && state.gasUrl) {
        try {
          const res = await callGasApi('login', { username: un, password: pw });
          userObj = res.user; if (Array.isArray(res.appointments)) syncBundle = res;
        } catch (apiErr) {
          if (String(apiErr.message || '').includes('ไม่รู้จัก action')) {
            const localRes = Logic.authenticateUser(state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, un, pw);
            if (!localRes.ok) throw new Error(localRes.error);
            userObj = localRes.user; showToast('เซิร์ฟเวอร์ GAS เป็นเวอร์ชันเดิม ระบบใช้บัญชีในเครื่องชั่วคราว', 'warn');
          } else throw apiErr;
        }
      } else {
        const res = Logic.authenticateUser(state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, un, pw);
        if (!res.ok) throw new Error(res.error);
        userObj = res.user;
      }
      state.currentUser = userObj; localStorage.setItem(STORAGE.AUTH_USER, JSON.stringify(userObj));
      updateUserSessionUI();
      if (state.isLive && state.gasUrl) { if (syncBundle) { applySyncBundle(syncBundle); renderAll(); } else await syncWithServer(true); }
      else { loadDemoData(); renderAll(); }
      showToast(`ยินดีต้อนรับ ${userObj.displayName} เข้าสู่ระบบ`, 'success');
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'เข้าสู่ระบบ'; }
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const username = ($('regUsername').value || '').trim().toLowerCase(), displayName = Logic.sanitizeNoEmoji($('regDisplayName').value || '');
    const password = $('regPassword').value || '', confirmPassword = $('regConfirmPassword').value || '', errEl = $('registerErrorMsg'), submitBtn = $('btnSubmitRegister');
    try {
      if (errEl) errEl.style.display = 'none';
      const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS;
      const localReg = Logic.registerUserAccount(uList, { username, displayName, password, confirmPassword });
      if (!localReg.ok) throw new Error(localReg.error);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังสร้างบัญชี...'; }
      let userObj = localReg.user, syncBundle = null;
      if (state.isLive && state.gasUrl) {
        try {
          const res = await callGasApi('register', { payload: { username, displayName, password, confirmPassword } });
          if (res && res.user) userObj = res.user;
          if (res && res.users) state.users = res.users;
          if (res && Array.isArray(res.appointments)) syncBundle = res;
        } catch (_) { state.users = [...uList, localReg.record]; try { localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users)); } catch (_) {} }
      } else { state.users = [...uList, localReg.record]; try { localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users)); } catch (_) {} }
      if ($('regUsername')) $('regUsername').value = '';
      if ($('regDisplayName')) $('regDisplayName').value = '';
      if ($('regPassword')) $('regPassword').value = '';
      if ($('regConfirmPassword')) $('regConfirmPassword').value = '';
      state.currentUser = { ...userObj, role: 'STAFF' };
      localStorage.setItem(STORAGE.AUTH_USER, JSON.stringify(state.currentUser));
      switchAuthTab('login'); updateUserSessionUI();
      if (state.isLive && state.gasUrl) { if (syncBundle) { applySyncBundle(syncBundle); renderAll(); } else await syncWithServer(true); }
      else { loadDemoData(); renderAll(); }
      showToast(`สมัครสมาชิกสำเร็จ ยินดีต้อนรับ ${state.currentUser.displayName} (STAFF)`, 'success');
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; } else showToast(err.message, 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'สมัครสมาชิกและเข้าใช้งานทันที'; }
    }
  }

  function initApp() {
    try { const s = localStorage.getItem(STORAGE.THEME); if (s) state.theme = s; } catch (_) {}
    applyTheme(state.theme);

    try {
      const c = JSON.parse(localStorage.getItem(STORAGE.CFG) || 'null');
      if (c && c.gasUrl && !c.gasUrl.includes('AKfycwEq') && !c.gasUrl.includes('AdilEhkvSke')) {
        state.gasUrl = (c.gasUrl || '').trim(); state.passcode = c.passcode || ''; state.isLive = Boolean(c.isLive && state.gasUrl);
      } else {
        state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true;
        localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }));
      }
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl;
      if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
    } catch (_) {}

    loadSavedSession();
    initMonthSelector();
    bindEvents();

    if (state.currentUser) {
      if (state.isLive && state.gasUrl) syncWithServer(true);
      else { loadDemoData(); renderAll(); }
    } else if (state.isLive && state.gasUrl) {
      callGasApi('listUsers', {}).then(d => {
        if (d && Array.isArray(d.users) && d.users.length) state.users = d.users;
      }).catch(() => {});
    } else {
      loadDemoData();
    }
    updateClock();
    setInterval(updateClock, 15000);
  }

  function loadDemoData() {
    state.isLive = false;
    try {
      const a = localStorage.getItem(STORAGE.APTS), l = localStorage.getItem(STORAGE.LOGS), u = localStorage.getItem(STORAGE.USERS);
      state.users = u ? JSON.parse(u) : [...Logic.DEFAULT_USERS];
      if (a) { state.appointments = JSON.parse(a); state.rescheduleLogs = l ? JSON.parse(l) : []; return; }
    } catch (_) {}

    state.users = [...Logic.DEFAULT_USERS];
    const now = Logic.getBangkokParts(), tmr = Logic.getBangkokParts(now.epochMs + 86400000), nYr = now.year + 1;
    const seeds = [
      { title: 'ประชุมตรวจรับงานและสรุปความต้องการ', appointmentDate: tmr.dateStr, appointmentTime: '10:00', location: 'ห้อง B ชั้น 4', contactPerson: 'คุณสมชาย', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณสมชาย' },
      { title: 'นัดหารือแนวทางเชื่อมต่อระบบ', appointmentDate: Logic.getBangkokParts(now.epochMs + 5 * 86400000).dateStr, appointmentTime: '14:30', location: 'ออนไลน์', contactPerson: 'คุณวิภาดา', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1, createdBy: 'คุณวิภาดา' },
      { title: 'ตรวจประเมินผลการดำเนินงานไตรมาส 1', appointmentDate: `${nYr}-03-15`, appointmentTime: '09:30', location: 'ศูนย์พระราม 9', contactPerson: 'คุณนภัสสร', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 2, remindHoursBefore: 1, createdBy: 'ผู้ดูแลระบบ' }
    ];
    const b = []; seeds.forEach(s => b.push(Logic.createAppointmentRecord(s, b, now.isoStr)));
    state.appointments = b; state.rescheduleLogs = []; saveDemoData();
  }

  function saveDemoData() {
    if (state.isLive) return;
    localStorage.setItem(STORAGE.APTS, JSON.stringify(state.appointments));
    localStorage.setItem(STORAGE.LOGS, JSON.stringify(state.rescheduleLogs));
    localStorage.setItem(STORAGE.USERS, JSON.stringify(state.users));
  }

  async function callGasApi(action, payload) {
    if (!state.gasUrl) throw new Error('ยังไม่ได้ระบุ Web App URL');
    const res = await fetch(state.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, passcode: state.passcode, currentUser: state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ', ...payload })
    });
    const r = await res.json();
    if (!r.ok) { const err = new Error(r.error || 'Server error'); err.code = r.code; throw err; }
    return r.data;
  }

  async function syncWithServer(silent = false) {
    if (!state.isLive || !state.gasUrl) { renderAll(); return; }
    const btn = $('btnSyncNow'), lbl = $('syncBtnLabel');
    try {
      if (btn) btn.classList.add('is-syncing'); if (lbl) lbl.textContent = 'กำลังซิงก์...';
      const d = await callGasApi('list', {});
      applySyncBundle(d);
      renderAll();
      if (!silent) showToast('ซิงก์ข้อมูลล่าสุดสำเร็จ', 'success');
    } catch (e) { showToast('ซิงก์ไม่สำเร็จ: ' + e.message, 'error'); }
    finally { if (btn) btn.classList.toggle('is-syncing', bgTaskCount > 0); if (lbl) lbl.textContent = bgTaskCount > 0 ? 'กำลังบันทึก...' : 'ซิงก์'; }
  }

  function renderAll() {
    renderHeader(); renderListTab(); renderCalendarTab(); renderYearTab(); renderSettingsTab(); updateUserSessionUI();
  }

  function updateClock() {
    const b = Logic.getBangkokParts();
    if ($('bangkokClockDisplay')) $('bangkokClockDisplay').textContent = `เวลา (BKK): ${Logic.formatThaiDateDisplay(b.dateStr, false)} ${b.timeStr} น.`;
  }

  function renderHeader() {
    const bd = $('connectionModeBadge'), ts = $('triggerStatusText');
    if (state.isLive) {
      bd.className = 'mode-badge live'; bd.textContent = 'Sheets';
      const lr = state.meta.LAST_TRIGGER_RUN_AT;
      ts.textContent = lr ? `Trigger: รันเมื่อ ${Math.max(0, Math.round((Logic.getBangkokParts().epochMs - Logic.getBangkokParts(lr).epochMs) / 60000))} นาทีที่แล้ว` : 'Trigger: พร้อมทำงาน';
    } else {
      bd.className = 'mode-badge demo'; bd.textContent = 'Demo'; ts.textContent = 'Trigger: โหมดจำลองในเครื่อง';
    }
    const lim = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0;
    const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
    $('quotaTextLabel').textContent = `โควตา LINE: ${used} / ${lim} (${pct}%)`;
    const f = $('quotaProgressFill'); f.style.width = `${pct}%`;
    f.className = 'quota-progress-fill' + (pct >= 90 ? ' danger' : pct >= 80 ? ' warn' : '');
  }

  const getStatusClass = s => {
    const st = Logic.normalizeStatus(s);
    return st === Logic.STATUS.COMPLETED ? 'status-completed' : (st === Logic.STATUS.CANCELLED ? 'status-cancelled' : 'status-confirmed');
  };

  function getRelDate(a, nowBkk, od) {
    if (od) return { text: 'เลยกำหนด', cls: 'rel-overdue' };
    if (!a.appointmentDate) return { text: 'ไม่ระบุวัน', cls: '' };
    const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate);
    return d === 0 ? { text: 'วันนี้', cls: 'rel-today' } : (d === 1 ? { text: 'พรุ่งนี้', cls: 'rel-today' } : { text: d > 0 ? `อีก ${d} วัน` : 'ผ่านมาแล้ว', cls: '' });
  }

  function renderCardHtml(a) {
    const nowBkk = Logic.getBangkokParts(), od = Logic.isOverdue(a, nowBkk.isoStr), st = Logic.normalizeStatus(a.status), cls = getStatusClass(st), rel = getRelDate(a, nowBkk, od);
    let dayNum = '-', monthYr = 'ไม่ระบุวัน';
    if (a.appointmentDate) {
      const [y, m, d] = a.appointmentDate.split('-').map(Number);
      if (y && m && d) { dayNum = String(d); monthYr = `${Logic.THAI_MONTHS_SHORT[m - 1]} ${y + 543}`; }
    }
    const badges = [];
    if (od) badges.push('<span class="badge-overdue">เลยกำหนดเวลา</span>');
    if (a.appointmentDate && a.notifiedDayForSlot === a.appointmentDate) badges.push('<span class="badge-info">แจ้งเตือนรายวันแล้ว</span>');
    if (a.appointmentDate && a.appointmentTime && a.notifiedHourForSlot === `${a.appointmentDate}T${a.appointmentTime}`) badges.push('<span class="badge-info">แจ้งเตือนรายชั่วโมงแล้ว</span>');
    if (+a.rescheduleCount > 0) badges.push(`<span class="badge-info">เลื่อนนัด ${+a.rescheduleCount} ครั้ง</span>`);
    const isConf = st === Logic.STATUS.CONFIRMED;

    const creatorName = escapeHtml(a.createdBy || a.updatedBy || '-');
    const attributionHtml = [`<span class="attribution-tag">${ICO.user}<span>ผู้สร้าง: <strong>${creatorName}</strong></span></span>`];
    if (st === Logic.STATUS.COMPLETED && a.statusChangedBy) {
      attributionHtml.push(`<span class="attribution-tag completed">${ICO.check}<span>เสร็จสิ้นโดย: <strong>${escapeHtml(a.statusChangedBy)}</strong></span></span>`);
    } else if (st === Logic.STATUS.CANCELLED && a.statusChangedBy) {
      attributionHtml.push(`<span class="attribution-tag cancelled"><span>ยกเลิกโดย: <strong>${escapeHtml(a.statusChangedBy)}</strong>${a.statusReason ? ` (${escapeHtml(a.statusReason)})` : ''}</span></span>`);
    } else if (a.updatedBy && a.updatedBy !== (a.createdBy || a.updatedBy)) {
      attributionHtml.push(`<span class="attribution-tag">${ICO.edit}<span>แก้ไขล่าสุดโดย: <strong>${escapeHtml(a.updatedBy)}</strong></span></span>`);
    }

    return `
      <article class="apt-card-slim ${cls}">
        <div class="apt-date-block">
          <span class="apt-rel-badge ${rel.cls}">${escapeHtml(rel.text)}</span>
          <div><div class="apt-day-num">${escapeHtml(dayNum)}</div><div class="apt-month-yr">${escapeHtml(monthYr)}</div></div>
          <div class="apt-time-pill">${ICO.clock}<span>${escapeHtml(a.appointmentTime || '-')} น.</span></div>
        </div>
        <div class="apt-main-col">
          <div class="apt-badges-row"><span class="apt-id-code">${escapeHtml(a.id)}</span><span class="status-badge ${cls}">${escapeHtml(st)}</span>${badges.join(' ')}</div>
          <h4 class="apt-slim-title">${escapeHtml(a.title)}</h4>
          <div class="apt-slim-meta">
            <span class="apt-meta-chip">${ICO.user}<span>ผู้นัดพบ: <strong>${escapeHtml(a.contactPerson || '-')}</strong></span></span>
            <span class="apt-meta-chip">${ICO.pin}<span>สถานที่: <strong>${escapeHtml(a.location || '-')}</strong></span></span>
            <span class="apt-meta-chip">${ICO.bell}<span>เตือน ${+a.remindDaysBefore}ว. / ${+a.remindHoursBefore}ชม.</span></span>
          </div>
          <div class="apt-attribution-row">${attributionHtml.join(' ')}</div>
          ${a.notes ? `<div class="apt-notes-bar">หมายเหตุ: ${escapeHtml(a.notes)}</div>` : ''}
        </div>
        <div class="apt-slim-actions">
          ${isConf ? `<button type="button" class="btn btn-success btn-sm btn-quick-complete" data-id="${escapeHtml(a.id)}">${ICO.check}<span>เสร็จสิ้น</span></button>` : ''}
          <button type="button" class="btn btn-soft btn-sm btn-edit-apt" data-id="${escapeHtml(a.id)}">${ICO.edit}<span>แก้ไข/เลื่อน</span></button>
          ${isConf ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-open-cancel-modal" data-id="${escapeHtml(a.id)}">ยกเลิก</button>` : `<button type="button" class="btn btn-outline btn-sm btn-quick-reopen" data-id="${escapeHtml(a.id)}">คืนสถานะนัด</button>`}
        </div>
      </article>`;
  }

  function renderListTab() {
    const nowBkk = Logic.getBangkokParts(), all = state.appointments.filter(a => a && !a.deletedAt);
    let sConf = 0, sComp = 0, sCanc = 0, sOd = 0;
    all.forEach(a => {
      const st = Logic.normalizeStatus(a.status);
      if (st === Logic.STATUS.CONFIRMED) sConf++; else if (st === Logic.STATUS.COMPLETED) sComp++; else if (st === Logic.STATUS.CANCELLED) sCanc++;
      if (Logic.isOverdue(a, nowBkk.isoStr)) sOd++;
    });
    $('statTotal').textContent = all.length; $('statConfirmed').textContent = sConf; $('statCompleted').textContent = sComp; $('statCancelled').textContent = sCanc; $('statOverdue').textContent = sOd;
    if ($('navBadgeActiveCount')) $('navBadgeActiveCount').textContent = sConf;

    const userSel = $('filterUser');
    if (userSel) {
      const curVal = userSel.value, creators = new Set();
      all.forEach(a => { const c = a.createdBy || a.updatedBy; if (c) creators.add(c); });
      (state.users || []).forEach(u => { if (u && u.displayName) creators.add(u.displayName); });
      let optHtml = '<option value="">สมาชิกทุกคน</option><option value="MY_APTS">เฉพาะงานของฉัน</option>';
      creators.forEach(name => { optHtml += `<option value="${escapeHtml(name)}">งานที่สร้างโดย: ${escapeHtml(name)}</option>`; });
      userSel.innerHTML = optHtml; userSel.value = curVal;
    }

    const kw = ($('filterSearch').value || '').trim().toLowerCase(), st = $('filterStatus').value, dt = $('filterDate').value, uFilter = userSel ? userSel.value : '';
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.toggle('active-stat', (p.getAttribute('data-filter-status') || '') === st));
    const tmrStr = Logic.getBangkokParts(nowBkk.epochMs + 86400000).dateStr, curMonthPfx = `${nowBkk.year}-${String(nowBkk.month).padStart(2, '0')}-`;
    const myName = state.currentUser ? state.currentUser.displayName : '';

    const filtered = all.filter(a => {
      const aSt = Logic.normalizeStatus(a.status);
      if (st === 'ACTIVE_ONLY' && aSt !== Logic.STATUS.CONFIRMED) return false;
      if (st === 'OVERDUE' && !Logic.isOverdue(a, nowBkk.isoStr)) return false;
      if (st && st !== 'ACTIVE_ONLY' && st !== 'OVERDUE' && aSt !== st) return false;
      if (dt && a.appointmentDate !== dt) return false;
      if (uFilter === 'MY_APTS' && (a.createdBy || a.updatedBy) !== myName) return false;
      if (uFilter && uFilter !== 'MY_APTS' && (a.createdBy || a.updatedBy) !== uFilter) return false;
      if (!dt && state.quickRange !== 'ALL') {
        if (state.quickRange === 'UPCOMING' && !(aSt === Logic.STATUS.CONFIRMED && a.appointmentDate >= nowBkk.dateStr)) return false;
        if (state.quickRange === 'TODAY' && a.appointmentDate !== nowBkk.dateStr) return false;
        if (state.quickRange === 'TOMORROW' && a.appointmentDate !== tmrStr) return false;
        if (state.quickRange === 'NEXT7') { const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate); if (d === null || d < 0 || d > 7) return false; }
        if (state.quickRange === 'MONTH' && (!a.appointmentDate || !a.appointmentDate.startsWith(curMonthPfx))) return false;
      }
      return !kw || `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${aSt} ${a.notes}`.toLowerCase().includes(kw);
    });
    filtered.sort((a, b) => (Logic.buildAppointmentSlot(a) || '9999').localeCompare(Logic.buildAppointmentSlot(b) || '9999'));
    if ($('listResultSummary')) $('listResultSummary').textContent = `แสดงรายการนัดหมาย ${filtered.length} รายการ (จากทั้งหมด ${all.length} รายการ)`;
    $('appointmentsListContainer').innerHTML = filtered.length ? filtered.map(renderCardHtml).join('') : '<div class="empty-state">ไม่พบรายการนัดหมายตามเงื่อนไขที่เลือก</div>';
  }

  function initMonthSelector() {
    const sel = $('calSelectMonth'); if (!sel) return;
    sel.innerHTML = Logic.THAI_MONTHS_FULL.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    sel.value = String(state.calMonth); $('calInputYear').value = String(state.calYear + 543); $('yearOverviewInput').value = String(state.overviewYear + 543);
  }

  function renderCalendarTab() {
    const y = state.calYear, m = state.calMonth, mData = Logic.queryByMonth(state.appointments, y, m, { nowIso: Logic.getBangkokParts().isoStr });
    $('calendarMonthTitle').textContent = `${mData.monthNameThai} พ.ศ. ${mData.buddhistYear}`;
    $('calSelectMonth').value = String(m); $('calInputYear').value = String(mData.buddhistYear);

    const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), maxDay = Logic.getDaysInMonth(y, m), todayStr = Logic.getBangkokParts().dateStr;
    const cells = Array.from({ length: startDow }, () => '<div class="cal-cell empty"></div>');
    for (let d = 1; d <= maxDay; d++) {
      const dtStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, itms = mData.items.filter(a => a.appointmentDate === dtStr);
      const pills = itms.slice(0, 3).map(a => `<div class="cal-apt-pill ${getStatusClass(a.status)}">${escapeHtml(a.appointmentTime || '')} ${escapeHtml(a.title)}</div>`).join('');
      const more = itms.length > 3 ? `<div style="font-size:10px;font-weight:600;color:var(--primary);">+ อีก ${itms.length - 3} งาน</div>` : '';
      cells.push(`<div class="cal-cell ${dtStr === todayStr ? 'today' : ''} ${dtStr === state.calSelectedDate ? 'selected' : ''}" data-date="${dtStr}"><div class="cal-cell-head"><span class="cal-date-num">${d}</span><button type="button" class="btn-cell-add" data-add-date="${dtStr}">+</button></div>${pills}${more}</div>`);
    }
    $('calendarGridContainer').innerHTML = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="cal-day-header">${d}</div>`).join('') + cells.join('');

    const showItems = state.calSelectedDate ? mData.items.filter(a => a.appointmentDate === state.calSelectedDate) : mData.items;
    if ($('agendaEyebrow')) $('agendaEyebrow').textContent = state.calSelectedDate ? 'วันที่เลือกในปฏิทิน' : `ภาพรวมประจำเดือน (${mData.stats.total} งาน)`;
    if ($('btnShowAllMonthApts')) $('btnShowAllMonthApts').style.display = state.calSelectedDate ? 'inline-flex' : 'none';
    $('monthlyListHeader').textContent = state.calSelectedDate ? `${Logic.formatThaiDateDisplay(state.calSelectedDate, false)} (${showItems.length} งาน)` : `นัดหมายเดือน${mData.monthNameThai} (${showItems.length} งาน)`;
    $('monthlyAppointmentsList').innerHTML = showItems.length ? showItems.map(renderCardHtml).join('') : '<div class="empty-state">ไม่มีรายการนัดหมายในวันที่เลือก กดปุ่ม "+ นัดวันนี้" ด้านบนเพื่อสร้างนัดใหม่</div>';
  }

  function renderYearTab() {
    const curY = Logic.getBangkokParts().year, multi = Logic.queryMultiYearOverview(state.appointments, Math.min(curY, state.overviewYear), Math.max(curY + 3, state.overviewYear + 1), { nowIso: Logic.getBangkokParts().isoStr });
    $('multiYearCardsContainer').innerHTML = multi.years.map(yr => `
      <div class="year-summary-card ${yr.ceYear === state.overviewYear ? 'active' : ''}" data-year="${yr.ceYear}">
        <div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:15px;">พ.ศ. ${yr.buddhistYear}</strong><span class="badge-info">ค.ศ. ${yr.ceYear}</span></div>
        <div style="font-size:12px;color:var(--text-secondary);margin:6px 0;">รวม <strong>${yr.stats.total}</strong> งาน | รอ <strong>${yr.stats.active}</strong> | เสร็จ <strong>${yr.stats.completed}</strong></div>
        <div class="month-mini-bar"><div style="width:${yr.stats.total ? yr.stats.completionRate : 0}%;background:#10b981;"></div></div>
      </div>`).join('');

    const selYr = Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: Logic.getBangkokParts().isoStr }), s = selYr.stats;
    $('selectedYearHeader').textContent = `สรุปสถิติตลอดทั้งปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`;
    const b = (t, v, sub, col) => `<div class="stat-box"${col ? ` style="border-left:4px solid ${col};"` : ''}><span class="stat-box-title">${t}</span><span class="stat-box-val">${v}</span><span class="stat-box-sub">${sub}</span></div>`;
    $('yearEndSummaryCards').innerHTML = b('งานนัดหมายทั้งหมด', s.total, 'รายการสะสมทั้งปี') + b('นัดหมายแล้ว (รอดำเนินการ)', s.active, 'รอถึงกำหนดนัดหมาย', 'var(--st-conf-border)') + b('สิ้นสุดการนัดหมาย', s.completed, `อัตราความสำเร็จ ${s.completionRate}%`, 'var(--st-comp-border)') + b('ยกเลิกการนัดหมาย', s.cancelled, `อัตราการยกเลิก ${s.cancellationRate}%`, 'var(--st-canc-border)') + b('การเลื่อนนัดสะสม', s.rescheduleTotal, 'ครั้งที่มีการเลื่อนวัน/เวลา');

    const uPerfGrid = $('userPerformanceGrid');
    if (uPerfGrid) {
      const uStats = Logic.calculateUserStats(selYr.items);
      uPerfGrid.innerHTML = !uStats.length ? '<div class="empty-state">ยังไม่มีข้อมูลสถิติผู้ใช้งานในปีนี้</div>' : uStats.map(u => `
        <div class="user-stat-card">
          <div class="user-stat-header"><span>${escapeHtml(u.user)}</span><span class="badge-info">สร้างนัด ${u.createdTotal} งาน</span></div>
          <div class="user-stat-counts">
            <span style="color:var(--st-comp-text);">กดเสร็จสิ้น: <strong>${u.completedTotal}</strong></span>
            <span style="color:var(--st-canc-text);">กดยกเลิก: <strong>${u.cancelledTotal}</strong></span>
            <span style="color:var(--st-conf-text);">รอดำเนินการ: <strong>${u.activeTotal}</strong></span>
          </div>
        </div>`).join('');
    }

    $('yearMonthsGrid').innerHTML = selYr.months.map(m => {
      const tot = m.stats.total || 0, pComp = tot ? Math.round((m.stats.completed / tot) * 100) : 0, pConf = tot ? Math.round((m.stats.active / tot) * 100) : 0, pCanc = tot ? Math.max(0, 100 - pComp - pConf) : 0;
      const itms = !m.items.length ? '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">ไม่มีรายการนัดหมาย</div>' : m.items.map(a => `
        <div class="btn-edit-apt" data-id="${escapeHtml(a.id)}" style="cursor:pointer;padding:6px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;border-left:3px solid var(--primary);font-size:11.5px;">
          <div style="font-weight:600;color:var(--text-main);">${a.appointmentDate.slice(8, 10)} ${m.monthShortThai} ${a.appointmentTime || ''} - ${escapeHtml(a.title)}</div>
          <div style="color:var(--text-secondary);font-size:11px;">${escapeHtml(a.contactPerson || '-')} | ผู้สร้าง: ${escapeHtml(a.createdBy || a.updatedBy || '-')}</div>
        </div>`).join('');
      return `<div class="month-box"><div class="month-box-header"><span>${m.monthNameThai}</span><div style="display:flex;align-items:center;gap:6px;"><span class="badge-info">รวม ${m.stats.total}</span><button type="button" class="btn btn-outline btn-sm btn-jump-cal-month" data-year="${selYr.ceYear}" data-month="${m.month}" style="padding:2px 7px;font-size:11px;">ดูปฏิทิน</button></div></div><div class="month-mini-bar"><div style="width:${pComp}%;background:#10b981;"></div><div style="width:${pConf}%;background:#6366f1;"></div><div style="width:${pCanc}%;background:#f43f5e;"></div></div><div style="display:flex;flex-direction:column;gap:5px;">${itms}</div></div>`;
    }).join('');
  }

  function renderSettingsTab() {
    $('cfgDigestHour').value = state.meta.DAILY_DIGEST_HOUR || '8';
    $('cfgEnableBotQuery').checked = String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE';
    $('cfgPrivacyMask').checked = String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
    if ($('cfgNotifyStatusChange')) $('cfgNotifyStatusChange').checked = String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE';

    const uTableBody = $('userTableBody');
    if (uTableBody) {
      const isAdmin = Boolean(state.currentUser && state.currentUser.role === 'ADMIN');
      const curUn = state.currentUser ? state.currentUser.username : '';
      const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS;
      uTableBody.innerHTML = uList.map(u => {
        const canToggle = isAdmin && u.username !== 'admin' && u.username !== curUn;
        return `
        <tr>
          <td><span class="apt-id-code">${escapeHtml(u.userId || '-')}</span></td>
          <td><strong>${escapeHtml(u.username)}</strong></td>
          <td>${escapeHtml(u.displayName || '-')}</td>
          <td><span class="badge-role ${(u.role || 'STAFF').toLowerCase()}">${escapeHtml(u.role || 'STAFF')}</span></td>
          <td><span class="status-badge ${u.isActive !== false ? 'status-completed' : 'status-cancelled'}">${u.isActive !== false ? 'ใช้งาน' : 'ระงับ'}</span></td>
          <td style="color:var(--text-muted);font-size:12px;">${escapeHtml(u.lastLoginAt ? Logic.formatThaiDateDisplay(u.lastLoginAt.slice(0, 10), false) + ' ' + u.lastLoginAt.slice(11, 16) : 'ยังไม่เคยเข้าใช้')}</td>
          <td>
            ${isAdmin ? `<button type="button" class="btn btn-soft btn-sm btn-edit-user" data-uid="${escapeHtml(u.userId)}">แก้ไข</button>` : '<span class="hint-text">เฉพาะ ADMIN</span>'}
            ${canToggle ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-toggle-user" data-uid="${escapeHtml(u.userId)}" data-active="${u.isActive !== false ? 'true' : 'false'}">${u.isActive !== false ? 'ระงับ' : 'เปิดใช้'}</button>` : ''}
          </td>
        </tr>`;
      }).join('');
    }

    const tb = $('rescheduleLogsTableBody');
    if (!state.rescheduleLogs.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:18px;">ยังไม่มีประวัติการเลื่อนนัดหรือแก้ไขข้อมูล</td></tr>'; return; }
    tb.innerHTML = state.rescheduleLogs.slice(0, 40).map(l => `
      <tr><td>${escapeHtml(l.changedAt)}</td><td><span class="apt-id-code">${escapeHtml(l.appointmentId)}</span></td><td>${escapeHtml(l.changedBy)}</td><td><span class="badge-info">${escapeHtml(FIELD_LABELS[l.fieldChanged] || l.fieldChanged)}</span></td><td style="color:var(--text-muted);">${escapeHtml(l.oldValue || '-')}</td><td><strong>${escapeHtml(l.newValue || '-')}</strong></td><td>${escapeHtml(l.reason || '-')}</td></tr>
    `).join('');
  }

  function renderPatchNotes() {
    const c = $('patchNotesContainer'); if (!c) return;
    c.innerHTML = PatchNotes.map(p => `
      <div class="patch-card"><div class="patch-card-head"><span>เวอร์ชัน ${escapeHtml(p.version)}</span><span class="hint-text">${escapeHtml(p.date)}</span></div><div class="patch-card-desc">${escapeHtml(p.title)}</div><ul>${(p.changes || []).map(ch => `<li>${escapeHtml(ch)}</li>`).join('')}</ul></div>
    `).join('');
  }

  function checkConflictOnForm() {
    const d = $('formDate').value, t = $('formTime').value, curId = $('formAptId').value, banner = $('conflictWarningBanner');
    if (!banner) return;
    const conflicts = Logic.findTimeConflicts(state.appointments, d, t, curId);
    if (conflicts.length > 0) {
      banner.textContent = `แจ้งเตือน: มีนัดหมายอื่นในวันและเวลานี้แล้ว (${conflicts.length} งาน: ${conflicts.map(c => c.title).join(', ')})`;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  function fillAptForm(f) {
    $('formAptId').value = f.id || ''; $('formExpectedUpdatedAt').value = f.updatedAt || '';
    $('formTitle').value = f.title || ''; $('formStatus').value = f.status || Logic.STATUS.CONFIRMED;
    $('formContactPerson').value = f.contactPerson || ''; $('formDate').value = f.date || '';
    $('formTime').value = f.time || '09:00'; $('formLocation').value = f.location || '';
    $('formRemindDays').value = String(f.remindDays != null ? f.remindDays : 1);
    $('formRemindHours').value = String(f.remindHours != null ? f.remindHours : 1);
    $('formNotes').value = f.notes || ''; $('formRescheduleReason').value = '';
    updateDateThaiPreview(); checkConflictOnForm(); openModal('appointmentModal');
  }

  function openCreateModal(prefillDate) {
    $('modalTitle').textContent = 'สร้างนัดหมายใหม่';
    if ($('formNotifyLine')) $('formNotifyLine').checked = true;
    if ($('formNotifyLineLabel')) $('formNotifyLineLabel').textContent = 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที';
    $('rescheduleReasonGroup').style.display = $('btnDeleteApt').style.display = 'none';
    if ($('formCreatedByPill')) {
      $('formCreatedByPill').textContent = `ผู้สร้างนัดหมาย: ${state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ'}`;
      $('formCreatedByPill').style.display = 'inline-block';
    }
    fillAptForm({ date: typeof prefillDate === 'string' && prefillDate ? prefillDate : Logic.getBangkokParts().dateStr });
  }

  function openEditModal(id) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    $('modalTitle').textContent = `แก้ไขนัดหมาย ${a.id}`;
    if ($('formNotifyLine')) $('formNotifyLine').checked = false;
    if ($('formNotifyLineLabel')) $('formNotifyLineLabel').textContent = 'ส่งแจ้งเตือนการแก้ไขนัดหมายเข้ากลุ่ม LINE ทันที';
    $('rescheduleReasonGroup').style.display = 'block'; $('btnDeleteApt').style.display = 'inline-flex';
    if ($('formCreatedByPill')) {
      $('formCreatedByPill').textContent = `ผู้สร้างนัดหมายเดิม: ${a.createdBy || a.updatedBy || '-'} | แก้ไขโดย: ${state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ'}`;
      $('formCreatedByPill').style.display = 'inline-block';
    }
    fillAptForm({ id: a.id, updatedAt: a.updatedAt, title: a.title, status: Logic.normalizeStatus(a.status), contactPerson: a.contactPerson, date: a.appointmentDate, time: a.appointmentTime, location: a.location, remindDays: a.remindDaysBefore, remindHours: a.remindHoursBefore, notes: a.notes });
  }

  function updateDateThaiPreview() {
    const v = $('formDate').value; $('formDateThaiPreview').textContent = v ? Logic.formatThaiDateDisplay(v, true) : 'ยังไม่ระบุวันที่';
  }

  // Optimistic Form Submit (Instant UI update + Background GAS reconciliation & Snapshot Rollback)
  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = $('formAptId').value.trim(), exp = $('formExpectedUpdatedAt').value.trim();
    if (id && pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return; }
    const curUserName = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ';
    const payload = {
      title: Logic.sanitizeNoEmoji($('formTitle').value), status: $('formStatus').value,
      contactPerson: Logic.sanitizeNoEmoji($('formContactPerson').value), appointmentDate: $('formDate').value,
      appointmentTime: $('formTime').value, location: Logic.sanitizeNoEmoji($('formLocation').value),
      remindDaysBefore: +$('formRemindDays').value, remindHoursBefore: +$('formRemindHours').value,
      notes: Logic.sanitizeNoEmoji($('formNotes').value), updatedBy: curUserName
    };
    const reason = Logic.sanitizeNoEmoji($('formRescheduleReason').value), notifyLine = $('formNotifyLine') ? Boolean($('formNotifyLine').checked) : !id;
    if (!id) payload.createdBy = curUserName;
    else { payload.statusChangedBy = curUserName; if (reason) payload.statusReason = reason; }

    const v = Logic.validateAppointmentInput(payload);
    if (!v.valid) { showToast(v.errors.join(' | '), 'error'); return; }

    const prevApts = state.appointments.map(a => ({ ...a })), prevLogs = [...state.rescheduleLogs];
    try {
      const now = Logic.getBangkokParts().isoStr;
      let savedApt = null;
      if (!id) {
        savedApt = Logic.createAppointmentRecord(payload, state.appointments, now);
        state.appointments.push(savedApt);
      } else {
        const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
        if (idx === -1) throw new Error('ไม่พบรายการนัดหมาย');
        const r = Logic.updateAppointmentRecord(state.appointments[idx], payload, { nowIso: now, expectedUpdatedAt: exp, reason });
        state.appointments[idx] = savedApt = r.record;
        if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
      }
      if (!state.isLive && notifyLine && savedApt && $('botSimOutput')) {
        $('botSimOutput').textContent = Logic.formatInstantAppointmentMessage(savedApt, Boolean(id), { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' });
      }
      if (!state.isLive) saveDemoData();
      closeModal('appointmentModal');
      renderAll();
      showToast(id ? 'บันทึกการแก้ไขนัดหมายเรียบร้อยแล้ว' : 'สร้างนัดหมายใหม่เรียบร้อยแล้ว', 'success');

      if (state.isLive) {
        const tempId = savedApt.id;
        pendingIds.add(tempId);
        setBgSync(true);
        const apiPromise = id
          ? callGasApi('update', { id, payload, expectedUpdatedAt: exp, reason, notifyLine })
          : callGasApi('create', { payload, notifyLine });
        apiPromise
          .then(res => {
            if (res && res.appointment) {
              const curIdx = state.appointments.findIndex(x => x.id === tempId);
              if (curIdx !== -1) state.appointments[curIdx] = res.appointment;
              else state.appointments.push(res.appointment);
            }
            if (res && res.meta) state.meta = { ...state.meta, ...res.meta };
            renderAll();
          })
          .catch(err => {
            state.appointments = prevApts;
            state.rescheduleLogs = prevLogs;
            renderAll();
            showToast('บันทึกไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error');
            if (err.code === 'CONCURRENCY_CONFLICT') syncWithServer(true);
          })
          .finally(() => {
            pendingIds.delete(tempId);
            setBgSync(false);
          });
      }
    } catch (err) {
      state.appointments = prevApts;
      state.rescheduleLogs = prevLogs;
      showToast(err.message, 'error');
    }
  }

  // Unified Status Mutation Handler (Optimistic UI + Background GAS reconciliation)
  async function mutateAptStatus(id, newStatus, reason, extra) {
    if (pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return false; }
    const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
    if (idx === -1) return false;
    const prevApt = { ...state.appointments[idx] }, prevLogs = [...state.rescheduleLogs];
    const curUser = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ';
    const notifyLine = (extra && extra.notifyLine !== undefined) ? extra.notifyLine : (String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE');
    const patch = {
      status: newStatus, updatedBy: curUser,
      statusChangedBy: newStatus === Logic.STATUS.CONFIRMED ? '' : curUser,
      statusReason: newStatus === Logic.STATUS.CONFIRMED ? '' : (extra && extra.statusReason ? Logic.sanitizeNoEmoji(extra.statusReason) : (reason || ''))
    };

    try {
      const r = Logic.updateAppointmentRecord(prevApt, patch, { nowIso: Logic.getBangkokParts().isoStr, expectedUpdatedAt: prevApt.updatedAt, reason: reason || newStatus });
      state.appointments[idx] = r.record;
      if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
      if (!state.isLive && notifyLine && $('botSimOutput')) {
        $('botSimOutput').textContent = Logic.formatInstantAppointmentMessage(r.record, true, { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' });
      }
      if (!state.isLive) saveDemoData();
      renderAll();

      if (state.isLive) {
        pendingIds.add(id);
        setBgSync(true);
        callGasApi('update', { id, payload: patch, expectedUpdatedAt: prevApt.updatedAt, notifyLine, reason: reason || newStatus })
          .then(res => {
            if (res && res.appointment) {
              const curIdx = state.appointments.findIndex(x => x.id === id);
              if (curIdx !== -1) state.appointments[curIdx] = res.appointment;
            }
            if (res && res.meta) state.meta = { ...state.meta, ...res.meta };
            renderAll();
          })
          .catch(err => {
            const curIdx = state.appointments.findIndex(x => x.id === id);
            if (curIdx !== -1) state.appointments[curIdx] = prevApt;
            state.rescheduleLogs = prevLogs;
            renderAll();
            showToast('เปลี่ยนสถานะไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error');
            if (err.code === 'CONCURRENCY_CONFLICT') syncWithServer(true);
          })
          .finally(() => {
            pendingIds.delete(id);
            setBgSync(false);
          });
      }
      return true;
    } catch (err) {
      state.appointments[idx] = prevApt;
      state.rescheduleLogs = prevLogs;
      showToast(err.message, 'error');
      return false;
    }
  }

  async function handleQuickComplete(id) {
    const ok = await mutateAptStatus(id, Logic.STATUS.COMPLETED, 'เสร็จสิ้นการนัดหมาย');
    if (ok) showToast(`บันทึก [${id}] สิ้นสุดการนัดหมายแล้ว`, 'success');
  }

  function openCancelModal(id) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    $('cancelAptId').value = a.id;
    $('cancelAptSummary').textContent = `[${a.id}] ${a.title} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`;
    $('cancelReasonInput').value = '';
    if ($('cancelNotifyLine')) $('cancelNotifyLine').checked = true;
    openModal('cancelModal');
  }

  async function handleCancelSubmit(e) {
    e.preventDefault();
    const id = $('cancelAptId').value.trim(), reason = Logic.sanitizeNoEmoji($('cancelReasonInput').value);
    const notifyLine = $('cancelNotifyLine') ? $('cancelNotifyLine').checked : true;
    const ok = await mutateAptStatus(id, Logic.STATUS.CANCELLED, reason || 'ยกเลิกการนัดหมาย', { statusReason: reason, notifyLine });
    if (ok) { closeModal('cancelModal'); showToast(`ยกเลิกนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn'); }
  }

  async function handleQuickReopen(id) {
    const ok = await mutateAptStatus(id, Logic.STATUS.CONFIRMED, 'คืนสถานะนัดหมาย', { notifyLine: true });
    if (ok) showToast(`คืนสถานะ [${id}] เป็น "นัดหมายแล้ว" เรียบร้อย`, 'success');
  }

  async function handleDelete() {
    const id = $('formAptId').value.trim(); if (!id || !confirm(`ยืนยันการลบนัดหมาย [${id}] หรือไม่?`)) return;
    if (pendingIds.has(id)) { showToast('รายการนี้กำลังซิงก์ข้อมูลอยู่ กรุณารอสักครู่', 'info'); return; }
    const user = state.currentUser ? state.currentUser.displayName : 'ผู้ใช้งานระบบ';
    const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
    if (idx === -1) return;

    const prevApts = state.appointments.map(a => ({ ...a })), prevLogs = [...state.rescheduleLogs];
    const removed = state.appointments[idx];
    state.appointments.splice(idx, 1);
    state.rescheduleLogs.unshift({
      logId: `LOG-${Date.now()}-DEL`, appointmentId: id, changedAt: Logic.getBangkokParts().isoStr,
      changedBy: user, fieldChanged: 'DELETED', oldValue: removed.title, newValue: 'ลบนัดหมาย', reason: 'ลบออกจากระบบ'
    });
    if (!state.isLive) saveDemoData();
    closeModal('appointmentModal');
    renderAll();
    showToast(`ลบนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn');

    if (state.isLive) {
      pendingIds.add(id);
      setBgSync(true);
      callGasApi('delete', { id, updatedBy: user })
        .catch(err => {
          state.appointments = prevApts;
          state.rescheduleLogs = prevLogs;
          renderAll();
          showToast('ลบนัดหมายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error');
        })
        .finally(() => {
          pendingIds.delete(id);
          setBgSync(false);
        });
    }
  }

  // User Management
  function openUserModal(userId) {
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') {
      showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return;
    }
    state.editingUserId = userId || null;
    $('userModalTitle').textContent = userId ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่';
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS;
    const u = userId ? uList.find(x => x.userId === userId) : null;
    $('formUsername').value = u ? u.username : ''; $('formUsername').disabled = Boolean(u);
    $('formDisplayName').value = u ? (u.displayName || u.username) : '';
    $('formUserPassword').value = ''; $('formUserRole').value = u ? (u.role || 'STAFF') : 'STAFF';
    $('formUserPasswordReqStar').style.display = u ? 'none' : 'inline';
    $('formUserPasswordHint').textContent = u ? 'เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน' : 'กำหนดรหัสผ่านสำหรับเข้าสู่ระบบ';
    openModal('userModal');
  }

  async function handleUserFormSubmit(e) {
    e.preventDefault();
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') {
      showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return;
    }
    const un = ($('formUsername').value || '').trim().toLowerCase(), disp = Logic.sanitizeNoEmoji($('formDisplayName').value);
    const pw = $('formUserPassword').value || '', role = $('formUserRole').value;
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS;
    const existingU = state.editingUserId ? uList.find(x => x.userId === state.editingUserId) : null;
    const payload = { userId: state.editingUserId || undefined, isNew: !state.editingUserId, username: un, displayName: disp, role, isActive: existingU ? existingU.isActive !== false : true };
    if (pw) payload.password = pw;

    try {
      const v = Logic.validateUserInput(payload, !state.editingUserId);
      if (!v.valid) throw new Error(v.errors.join(' | '));
      if (!state.editingUserId && uList.some(x => x.username.toLowerCase() === un)) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');

      const prevUsers = (state.users || []).map(u => ({ ...u }));
      const s = v.sanitized;
      if (state.editingUserId) {
        const idx = state.users.findIndex(x => x.userId === state.editingUserId);
        if (idx !== -1) { state.users[idx].displayName = s.displayName; state.users[idx].role = s.role; if (s.passwordHash) state.users[idx].passwordHash = s.passwordHash; }
      } else {
        const maxNum = (state.users || []).reduce((m, x) => {
          const n = x.userId && x.userId.startsWith('USR-') ? parseInt(x.userId.slice(4), 10) : 0;
          return !isNaN(n) && n > m ? n : m;
        }, 0);
        state.users.push({ userId: `USR-${String(maxNum + 1).padStart(3, '0')}`, username: s.username, displayName: s.displayName, role: s.role, passwordHash: s.passwordHash, isActive: true, createdAt: Logic.getBangkokParts().isoStr });
      }
      if (state.editingUserId && state.currentUser && state.currentUser.userId === state.editingUserId) {
        state.currentUser.displayName = disp; state.currentUser.role = role;
        try { localStorage.setItem(STORAGE.AUTH_USER, JSON.stringify(state.currentUser)); } catch (_) {}
        updateUserSessionUI();
      }
      if (!state.isLive) saveDemoData();
      closeModal('userModal');
      renderAll();
      showToast('บันทึกข้อมูลสมาชิกเรียบร้อยแล้ว', 'success');

      if (state.isLive) {
        setBgSync(true);
        callGasApi('saveUser', { userPayload: payload })
          .then(res => {
            if (res && res.user) {
              const idx = state.users.findIndex(x => x.userId === res.user.userId || x.username === res.user.username);
              if (idx !== -1) state.users[idx] = { ...state.users[idx], ...res.user };
              else state.users.push(res.user);
              renderAll();
            }
          })
          .catch(err => {
            state.users = prevUsers;
            renderAll();
            showToast('บันทึกสมาชิกไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error');
          })
          .finally(() => setBgSync(false));
      }
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function handleToggleUserStatus(userId, curActive) {
    if (!state.currentUser || state.currentUser.role !== 'ADMIN') {
      showToast('เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการสมาชิกได้', 'error'); return;
    }
    const uList = state.users && state.users.length ? state.users : Logic.DEFAULT_USERS, u = uList.find(x => x.userId === userId);
    if (u && (u.username === 'admin' || (state.currentUser && u.username === state.currentUser.username))) {
      showToast('ไม่สามารถระงับบัญชีผู้ดูแลระบบหลักหรือบัญชีที่กำลังใช้งานอยู่ได้', 'error'); return;
    }
    const targetStatus = !curActive;
    const idx = state.users.findIndex(x => x.userId === userId);
    if (idx === -1) return;
    state.users[idx].isActive = targetStatus;
    if (!state.isLive) saveDemoData();
    renderAll();
    showToast(`ปรับสถานะผู้ใช้งานเป็น ${targetStatus ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'} แล้ว`, 'info');

    if (state.isLive) {
      setBgSync(true);
      callGasApi('saveUser', { userPayload: { userId, username: u ? u.username : undefined, isActive: targetStatus } })
        .catch(err => {
          const curIdx = state.users.findIndex(x => x.userId === userId);
          if (curIdx !== -1) state.users[curIdx].isActive = curActive;
          renderAll();
          showToast('ปรับสถานะไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error');
        })
        .finally(() => setBgSync(false));
    }
  }

  function bindEvents() {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab'))));
    on('btnToggleTheme', 'click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    on('btnToggleThemeAuth', 'click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

    on('btnLogout', 'click', handleLogout);
    on('loginForm', 'submit', handleLoginSubmit);
    on('registerForm', 'submit', handleRegisterSubmit);
    on('tabBtnAuthLogin', 'click', () => switchAuthTab('login'));
    on('tabBtnAuthRegister', 'click', () => switchAuthTab('register'));
    on('btnSwitchToRegister', 'click', () => switchAuthTab('register'));
    on('btnSwitchToLogin', 'click', () => switchAuthTab('login'));

    on('btnOpenAddUserModal', 'click', () => openUserModal(null));
    on('btnCloseUserModalTop', 'click', () => closeModal('userModal'));
    on('btnCancelUserModal', 'click', () => closeModal('userModal'));
    on('userForm', 'submit', handleUserFormSubmit);

    on('btnCloseCancelModalTop', 'click', () => closeModal('cancelModal'));
    on('btnDismissCancelModal', 'click', () => closeModal('cancelModal'));
    on('cancelForm', 'submit', handleCancelSubmit);

    on('btnOpenCreateModal', 'click', () => openCreateModal());
    on('btnMobileFabCreate', 'click', () => openCreateModal());
    on('btnAddAptOnSelectedDate', 'click', () => openCreateModal(state.calSelectedDate || `${state.calYear}-${String(state.calMonth).padStart(2, '0')}-01`));
    on('btnShowAllMonthApts', 'click', () => { state.calSelectedDate = ''; renderCalendarTab(); });
    on('btnCloseModalTop', 'click', () => closeModal('appointmentModal'));
    on('btnCancelModal', 'click', () => closeModal('appointmentModal'));
    on('formDate', 'change', () => { updateDateThaiPreview(); checkConflictOnForm(); });
    on('formTime', 'change', checkConflictOnForm);
    on('appointmentForm', 'submit', handleFormSubmit);
    on('btnDeleteApt', 'click', handleDelete);
    on('btnSyncNow', 'click', () => syncWithServer(false));

    document.querySelectorAll('.time-chip').forEach(c => c.addEventListener('click', () => {
      if ($('formTime')) { $('formTime').value = c.getAttribute('data-time') || ''; checkConflictOnForm(); }
    }));
    document.querySelectorAll('.range-chip').forEach(c => c.addEventListener('click', () => {
      state.quickRange = c.getAttribute('data-range') || 'ALL';
      document.querySelectorAll('.range-chip').forEach(x => x.classList.toggle('active', x === c));
      if ($('filterDate')) $('filterDate').value = '';
      renderListTab();
    }));

    on('btnOpenPatchNotesModal', 'click', () => { renderPatchNotes(); openModal('patchNotesModal'); });
    on('btnClosePatchNotesModalTop', 'click', () => closeModal('patchNotesModal'));
    on('btnClosePatchNotesModal', 'click', () => closeModal('patchNotesModal'));
    on('btnOpenGuideModal', 'click', () => openModal('guideModal'));
    on('btnCloseGuideModalTop', 'click', () => closeModal('guideModal'));
    on('btnCloseGuideModal', 'click', () => closeModal('guideModal'));

    const setTeamConn = async () => {
      state.gasUrl = DEFAULT_GAS_URL; state.passcode = DEFAULT_PASSCODE; state.isLive = true;
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl; if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }));
      closeModal('guideModal'); await syncWithServer(false);
    };
    on('btnQuickConnectFromGuide', 'click', setTeamConn);
    on('btnResetDefaultConn', 'click', setTeamConn);

    on('filterSearch', 'input', renderListTab);
    on('filterStatus', 'change', renderListTab);
    on('filterUser', 'change', renderListTab);
    on('filterDate', 'change', () => {
      if ($('filterDate').value) { state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL')); }
      renderListTab();
    });
    on('btnClearFilters', 'click', () => {
      $('filterSearch').value = $('filterStatus').value = $('filterDate').value = '';
      if ($('filterUser')) $('filterUser').value = '';
      state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL'));
      renderListTab();
    });
    document.querySelectorAll('.stat-pill').forEach(p => p.addEventListener('click', () => { $('filterStatus').value = p.getAttribute('data-filter-status') || ''; renderListTab(); }));

    document.addEventListener('click', e => {
      const addCell = e.target.closest('.btn-cell-add');
      if (addCell) { e.stopPropagation(); const dt = addCell.getAttribute('data-add-date'); state.calSelectedDate = dt || ''; renderCalendarTab(); openCreateModal(dt); return; }
      const jumpM = e.target.closest('.btn-jump-cal-month');
      if (jumpM) { state.calYear = +jumpM.getAttribute('data-year'); state.calMonth = +jumpM.getAttribute('data-month'); state.calSelectedDate = ''; renderCalendarTab(); switchTab('tabMonth'); return; }
      const edit = e.target.closest('.btn-edit-apt'); if (edit) { openEditModal(edit.getAttribute('data-id')); return; }
      const comp = e.target.closest('.btn-quick-complete'); if (comp) { handleQuickComplete(comp.getAttribute('data-id')); return; }
      const canc = e.target.closest('.btn-open-cancel-modal'); if (canc) { openCancelModal(canc.getAttribute('data-id')); return; }
      const reopen = e.target.closest('.btn-quick-reopen'); if (reopen) { handleQuickReopen(reopen.getAttribute('data-id')); return; }
      const editU = e.target.closest('.btn-edit-user'); if (editU) { openUserModal(editU.getAttribute('data-uid')); return; }
      const toggleU = e.target.closest('.btn-toggle-user'); if (toggleU) { handleToggleUserStatus(toggleU.getAttribute('data-uid'), toggleU.getAttribute('data-active') === 'true'); return; }
      const cell = e.target.closest('.cal-cell:not(.empty)'); if (cell) { const d = cell.getAttribute('data-date'); state.calSelectedDate = state.calSelectedDate === d ? '' : d; renderCalendarTab(); return; }
      const yc = e.target.closest('.year-summary-card'); if (yc) { state.overviewYear = +yc.getAttribute('data-year'); $('yearOverviewInput').value = String(state.overviewYear + 543); renderYearTab(); return; }
      const qc = e.target.closest('.btn-quick-cmd'); if (qc) { $('botSimInput').value = qc.getAttribute('data-cmd'); runBotSim(); }
    });

    on('btnPrevMonth', 'click', () => { state.calSelectedDate = ''; if (--state.calMonth < 1) { state.calMonth = 12; state.calYear--; } renderCalendarTab(); });
    on('btnNextMonth', 'click', () => { state.calSelectedDate = ''; if (++state.calMonth > 12) { state.calMonth = 1; state.calYear++; } renderCalendarTab(); });
    on('btnCurrentMonth', 'click', () => { const now = Logic.getBangkokParts(); state.calYear = now.year; state.calMonth = now.month; state.calSelectedDate = now.dateStr; renderCalendarTab(); });
    on('btnJumpMonth', 'click', () => {
      const y = Logic.normalizeYearToCE($('calInputYear').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; }
      state.calMonth = +$('calSelectMonth').value; state.calYear = y; state.calSelectedDate = ''; renderCalendarTab();
    });
    on('btnJumpYearOverview', 'click', () => {
      const y = Logic.normalizeYearToCE($('yearOverviewInput').value); if (!y) { showToast('ระบุปีไม่ถูกต้อง', 'error'); return; }
      state.overviewYear = y; renderYearTab();
    });

    on('btnSaveConnection', 'click', async () => {
      const u = ($('cfgGasUrl').value || '').trim(), p = $('cfgPasscode').value || '';
      if (!u) { showToast('กรุณาระบุ Web App URL', 'error'); return; }
      state.gasUrl = u; state.passcode = p; state.isLive = true;
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: u, passcode: p, isLive: true }));
      await syncWithServer(false);
    });
    on('btnSwitchLocalDemo', 'click', () => {
      state.isLive = false; localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: false }));
      loadDemoData(); renderAll(); showToast('สลับเป็นโหมดจำลองข้อมูลในเครื่อง (Demo) แล้ว', 'warn');
    });
    on('btnSavePolicy', 'click', () => {
      const prevMeta = { ...state.meta }, m = { DAILY_DIGEST_HOUR: String(+$('cfgDigestHour').value || 8), ENABLE_LINE_BOT_QUERY: $('cfgEnableBotQuery').checked ? 'TRUE' : 'FALSE', PRIVACY_MASK_CONTACT: $('cfgPrivacyMask').checked ? 'TRUE' : 'FALSE', NOTIFY_ON_STATUS_CHANGE: $('cfgNotifyStatusChange') && $('cfgNotifyStatusChange').checked ? 'TRUE' : 'FALSE' };
      state.meta = { ...state.meta, ...m }; renderAll(); showToast(state.isLive ? 'บันทึกนโยบายเรียบร้อยแล้ว' : 'บันทึกนโยบายเรียบร้อยแล้ว (Demo)', 'success');
      if (state.isLive) { setBgSync(true); callGasApi('updateMeta', { meta: m }).catch(err => { state.meta = prevMeta; renderAll(); showToast('บันทึกนโยบายไม่สำเร็จ ระบบคืนค่าเดิมแล้ว: ' + err.message, 'error'); }).finally(() => setBgSync(false)); }
    });

    const handleTriggerSetup = async (mode, desc) => {
      if (!state.isLive) { showToast(`[Demo] จำลองการติดตั้ง ${desc} สำเร็จ`, 'info'); return; }
      try { const r = await callGasApi('setupTriggers', { mode }); showToast(r.message || `ตั้งค่า ${desc} เรียบร้อย`, 'success'); } catch (err) { showToast(err.message, 'error'); }
    };
    on('btnInstallAutoTrigger', 'click', () => handleTriggerSetup('auto', 'Trigger อัจฉริยะ'));
    on('btnInstallDailyTrigger', 'click', () => handleTriggerSetup('daily', 'Trigger สรุปเช้าวันละครั้ง'));
    on('btnInstall15MinTrigger', 'click', () => handleTriggerSetup('every15Min', 'Trigger ตรวจเช็คทุก 15 นาที'));
    on('btnRemoveTriggers', 'click', () => handleTriggerSetup('off', 'ปิด Trigger ทั้งหมด'));

    on('btnTestValidateLine', 'click', async () => {
      if (!state.isLive) { $('botSimOutput').textContent = '[Demo] ข้อความผ่านการตรวจสอบรูปแบบ Zero-Emoji พร้อมเชื่อม LINE'; showToast('ตรวจสอบรูปแบบสำเร็จ (Demo)', 'success'); return; }
      try { const r = await callGasApi('testNotification', { dryRun: true }); $('botSimOutput').textContent = `[Validate] ${r.ok ? 'สำเร็จ HTTP ' + r.httpStatus : 'ไม่สำเร็จ: ' + r.error}`; showToast(r.ok ? 'Validate ผ่านเรียบร้อย' : 'Validate ไม่ผ่าน', r.ok ? 'success' : 'error'); } catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
    });
    on('btnTestRealPush', 'click', async () => {
      if (!state.isLive || !confirm('การทดสอบจริงจะหักโควตา LINE ตามจำนวนสมาชิกกลุ่ม ยืนยันหรือไม่?')) return;
      try { const r = await callGasApi('testNotification', { dryRun: false }); $('botSimOutput').textContent = `[Push จริง] ${r.ok ? 'สำเร็จ' : r.error}`; await syncWithServer(true); showToast(r.ok ? 'ส่งข้อความทดสอบสำเร็จ' : 'ส่งไม่สำเร็จ', r.ok ? 'success' : 'error'); } catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
    });

    on('btnRunBotSim', 'click', runBotSim);
    on('botSimInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runBotSim(); } });
    on('btnPreviewNotificationPlan', 'click', () => {
      const bkk = Logic.getBangkokParts();
      const plan = Logic.buildNotificationPlan(state.appointments, `${bkk.dateStr}T08:15:00+07:00`, { dailyDigestHour: +state.meta.DAILY_DIGEST_HOUR || 8, quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0 });
      if ($('botSimUserEcho')) $('botSimUserEcho').textContent = '[ระบบจำลองรอบเตือนอัตโนมัติ 08:15 น.]';
      $('botSimOutput').textContent = plan.shouldPush ? plan.messageText : '[จำลองการแจ้งเตือน]\nไม่มีรายการที่ถึงเกณฑ์เตือนในรอบนี้';
    });
  }

  function runBotSim() {
    const txt = $('botSimInput').value;
    if ($('botSimUserEcho')) $('botSimUserEcho').textContent = txt || '...';
    const res = Logic.parseAndExecuteLineCommand(txt, state.appointments, Logic.getBangkokParts().isoStr, {
      enableLineBotQuery: String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE',
      privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE',
      quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300,
      quotaUsed: +state.meta.CACHED_QUOTA_USED || 0
    });
    $('botSimOutput').textContent = res === null ? '[บอทเงียบ]\nเนื่องจากข้อความไม่ได้ขึ้นต้นด้วยคำว่า "คิว"' : res;
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
