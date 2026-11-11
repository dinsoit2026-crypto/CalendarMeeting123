/**
 * app.js - UI Controller & State Management (v2.3.0 Optimized)
 * Modern SaaS UI with Time-First Cards, Split-View Calendar, Quick Filters, Dark Mode & Toasts
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

  const STORAGE = { APTS: 'CAL_DEMO_APTS_V2', LOGS: 'CAL_DEMO_LOGS_V2', CFG: 'CAL_CONN_CFG_V2', USER: 'CAL_USER_V2', THEME: 'CAL_THEME_V2' };
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwEq-EehM4BDKQLsh7dFQCJNeJNg2g_DtM1_INYgjblaKyhcdkNuAdiIEhkvSke--ro/exec';
  const DEFAULT_PASSCODE = 'CALL1234';
  const FIELD_LABELS = { appointmentDate: 'วันที่นัดหมาย', appointmentTime: 'เวลานัดหมาย', location: 'สถานที่', contactPerson: 'ผู้นัดพบ', status: 'สถานะ' };

  // Reusable SVG snippet dictionary
  const ICO = {
    clock: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    user: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    pin: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    bell: '<svg viewBox="0 0 24 24" width="14" height="14"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" style="stroke-width:2.5;"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    edit: '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
  };

  const state = {
    isLive: true, gasUrl: DEFAULT_GAS_URL, passcode: DEFAULT_PASSCODE, activeUser: 'ผู้ดูแลระบบ',
    theme: 'light', quickRange: 'ALL', appointments: [], rescheduleLogs: [],
    meta: { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'TRUE' },
    calYear: Logic.getBangkokParts().year, calMonth: Logic.getBangkokParts().month, calSelectedDate: '', overviewYear: Logic.getBangkokParts().year
  };

  // Toast System
  function showToast(msg, type = 'info') {
    const c = $('toastContainer'); if (!c) return;
    const it = document.createElement('div');
    it.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
    it.textContent = Logic.sanitizeNoEmoji(msg);
    c.appendChild(it);
    setTimeout(() => { it.style.opacity = '0'; it.style.transition = 'opacity 0.25s'; setTimeout(() => it.remove(), 260); }, 3200);
  }

  // Theme & Navigation
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

  // Init App
  function initApp() {
    try { const s = localStorage.getItem(STORAGE.THEME); if (s) state.theme = s; } catch (_) {}
    applyTheme(state.theme);
    try {
      const u = localStorage.getItem(STORAGE.USER); if (u) state.activeUser = Logic.sanitizeNoEmoji(u) || 'ผู้ดูแลระบบ';
      if ($('activeUserInput')) $('activeUserInput').value = state.activeUser;
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

    initMonthSelector();
    bindEvents();
    if (state.isLive && state.gasUrl) syncWithServer(true);
    else { loadDemoData(); renderAll(); }
    updateClock();
    setInterval(updateClock, 15000);
  }

  function loadDemoData() {
    state.isLive = false;
    try {
      const a = localStorage.getItem(STORAGE.APTS), l = localStorage.getItem(STORAGE.LOGS);
      if (a) { state.appointments = JSON.parse(a); state.rescheduleLogs = l ? JSON.parse(l) : []; return; }
    } catch (_) {}
    const now = Logic.getBangkokParts(), tmr = Logic.getBangkokParts(now.epochMs + 86400000), nYr = now.year + 1;
    const seeds = [
      { title: 'ประชุมตรวจรับงานและสรุปความต้องการ', appointmentDate: tmr.dateStr, appointmentTime: '10:00', location: 'ห้อง B ชั้น 4', contactPerson: 'คุณสมชาย', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1 },
      { title: 'นัดหารือแนวทางเชื่อมต่อระบบ', appointmentDate: Logic.getBangkokParts(now.epochMs + 5 * 86400000).dateStr, appointmentTime: '14:30', location: 'ออนไลน์', contactPerson: 'คุณวิภาดา', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 1, remindHoursBefore: 1 },
      { title: 'ตรวจประเมินผลการดำเนินงานไตรมาส 1', appointmentDate: `${nYr}-03-15`, appointmentTime: '09:30', location: 'ศูนย์พระราม 9', contactPerson: 'คุณนภัสสร', status: Logic.STATUS.CONFIRMED, remindDaysBefore: 2, remindHoursBefore: 1 }
    ];
    const b = []; seeds.forEach(s => b.push(Logic.createAppointmentRecord(s, b, now.isoStr)));
    state.appointments = b; state.rescheduleLogs = []; saveDemoData();
  }
  function saveDemoData() {
    if (state.isLive) return;
    localStorage.setItem(STORAGE.APTS, JSON.stringify(state.appointments));
    localStorage.setItem(STORAGE.LOGS, JSON.stringify(state.rescheduleLogs));
  }

  // API Call & Sync
  async function callGasApi(action, payload) {
    if (!state.gasUrl) throw new Error('ยังไม่ได้ระบุ Web App URL');
    const res = await fetch(state.gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, passcode: state.passcode, ...payload }) });
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
      state.appointments = d.appointments || []; state.rescheduleLogs = d.rescheduleLogs || [];
      if (d.meta) state.meta = { ...state.meta, ...d.meta };
      renderAll();
      if (!silent) showToast('ซิงก์ข้อมูลล่าสุดสำเร็จ', 'success');
    } catch (e) { showToast('ซิงก์ไม่สำเร็จ: ' + e.message, 'error'); }
    finally { if (btn) btn.classList.remove('is-syncing'); if (lbl) lbl.textContent = 'ซิงก์'; }
  }

  // Rendering
  function renderAll() { renderHeader(); renderListTab(); renderCalendarTab(); renderYearTab(); renderSettingsTab(); }
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
    return st === Logic.STATUS.COMPLETED ? 'status-completed' : st === Logic.STATUS.CANCELLED ? 'status-cancelled' : 'status-confirmed';
  };

  function getRelDate(a, nowBkk, od) {
    if (od) return { text: 'เลยกำหนด', cls: 'rel-overdue' };
    if (!a.appointmentDate) return { text: 'ไม่ระบุวัน', cls: '' };
    const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate);
    if (d === 0) return { text: 'วันนี้', cls: 'rel-today' };
    if (d === 1) return { text: 'พรุ่งนี้', cls: 'rel-today' };
    return { text: d > 0 ? `อีก ${d} วัน` : 'ผ่านมาแล้ว', cls: '' };
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
          ${a.notes ? `<div class="apt-notes-bar">หมายเหตุ: ${escapeHtml(a.notes)}</div>` : ''}
        </div>
        <div class="apt-slim-actions">
          ${isConf ? `<button type="button" class="btn btn-success btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="สิ้นสุดการนัดหมาย">${ICO.check}<span>เสร็จสิ้น</span></button>` : ''}
          <button type="button" class="btn btn-soft btn-sm btn-edit-apt" data-id="${escapeHtml(a.id)}">${ICO.edit}<span>แก้ไข/เลื่อน</span></button>
          ${isConf ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="ยกเลิกการนัดหมาย">ยกเลิก</button>` : `<button type="button" class="btn btn-outline btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="นัดหมายแล้ว">คืนสถานะนัด</button>`}
        </div>
      </article>
    `;
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

    const kw = ($('filterSearch').value || '').trim().toLowerCase(), st = $('filterStatus').value, dt = $('filterDate').value;
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.toggle('active-stat', (p.getAttribute('data-filter-status') || '') === st));
    const tmrStr = Logic.getBangkokParts(nowBkk.epochMs + 86400000).dateStr, curMonthPfx = `${nowBkk.year}-${String(nowBkk.month).padStart(2, '0')}-`;

    const filtered = all.filter(a => {
      const aSt = Logic.normalizeStatus(a.status);
      if (st === 'ACTIVE_ONLY' && aSt !== Logic.STATUS.CONFIRMED) return false;
      if (st === 'OVERDUE' && !Logic.isOverdue(a, nowBkk.isoStr)) return false;
      if (st && st !== 'ACTIVE_ONLY' && st !== 'OVERDUE' && aSt !== st) return false;
      if (dt && a.appointmentDate !== dt) return false;
      if (!dt && state.quickRange !== 'ALL') {
        if (state.quickRange === 'UPCOMING' && !(aSt === Logic.STATUS.CONFIRMED && a.appointmentDate >= nowBkk.dateStr)) return false;
        if (state.quickRange === 'TODAY' && a.appointmentDate !== nowBkk.dateStr) return false;
        if (state.quickRange === 'TOMORROW' && a.appointmentDate !== tmrStr) return false;
        if (state.quickRange === 'NEXT7') { const d = Logic.daysBetweenDates(nowBkk.dateStr, a.appointmentDate); if (d === null || d < 0 || d > 7) return false; }
        if (state.quickRange === 'MONTH' && (!a.appointmentDate || !a.appointmentDate.startsWith(curMonthPfx))) return false;
      }
      return !kw || `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${aSt} ${a.notes}`.toLowerCase().includes(kw);
    });
    filtered.sort((a, b) => (Logic.buildAppointmentSlot(a) || '9999').localeCompare(Logic.buildAppointmentSlot(b) || '9999'));
    if ($('listResultSummary')) $('listResultSummary').textContent = `แสดงรายการนัดหมาย ${filtered.length} รายการ (จากทั้งหมด ${all.length} รายการ)`;
    $('appointmentsListContainer').innerHTML = filtered.length ? filtered.map(renderCardHtml).join('') : '<div class="empty-state">ไม่พบรายการนัดหมายตามเงื่อนไขที่เลือก</div>';
  }

  // Calendar
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

  // Yearly
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
    $('yearEndSummaryCards').innerHTML = `
      <div class="stat-box"><span class="stat-box-title">งานนัดหมายทั้งหมด</span><span class="stat-box-val">${s.total}</span><span class="stat-box-sub">รายการสะสมทั้งปี</span></div>
      <div class="stat-box" style="border-left:4px solid var(--st-conf-border);"><span class="stat-box-title">นัดหมายแล้ว (รอดำเนินการ)</span><span class="stat-box-val">${s.active}</span><span class="stat-box-sub">รอถึงกำหนดนัดหมาย</span></div>
      <div class="stat-box" style="border-left:4px solid var(--st-comp-border);"><span class="stat-box-title">สิ้นสุดการนัดหมาย</span><span class="stat-box-val">${s.completed}</span><span class="stat-box-sub">อัตราความสำเร็จ ${s.completionRate}%</span></div>
      <div class="stat-box" style="border-left:4px solid var(--st-canc-border);"><span class="stat-box-title">ยกเลิกการนัดหมาย</span><span class="stat-box-val">${s.cancelled}</span><span class="stat-box-sub">อัตราการยกเลิก ${s.cancellationRate}%</span></div>
      <div class="stat-box"><span class="stat-box-title">การเลื่อนนัดสะสม</span><span class="stat-box-val">${s.rescheduleTotal}</span><span class="stat-box-sub">ครั้งที่มีการเลื่อนวัน/เวลา</span></div>`;

    $('yearMonthsGrid').innerHTML = selYr.months.map(m => {
      const tot = m.stats.total || 0, pComp = tot ? Math.round((m.stats.completed / tot) * 100) : 0, pConf = tot ? Math.round((m.stats.active / tot) * 100) : 0, pCanc = tot ? Math.max(0, 100 - pComp - pConf) : 0;
      const itms = !m.items.length ? '<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">ไม่มีรายการนัดหมาย</div>' : m.items.map(a => `
        <div class="btn-edit-apt" data-id="${escapeHtml(a.id)}" style="cursor:pointer;padding:6px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;border-left:3px solid var(--primary);font-size:11.5px;">
          <div style="font-weight:600;color:var(--text-main);">${a.appointmentDate.slice(8, 10)} ${m.monthShortThai} ${a.appointmentTime || ''} - ${escapeHtml(a.title)}</div>
          <div style="color:var(--text-secondary);font-size:11px;">${escapeHtml(a.contactPerson || '-')} | ${escapeHtml(Logic.normalizeStatus(a.status))}</div>
        </div>`).join('');
      return `<div class="month-box"><div class="month-box-header"><span>${m.monthNameThai}</span><div style="display:flex;align-items:center;gap:6px;"><span class="badge-info">รวม ${m.stats.total}</span><button type="button" class="btn btn-outline btn-sm btn-jump-cal-month" data-year="${selYr.ceYear}" data-month="${m.month}" style="padding:2px 7px;font-size:11px;">ดูปฏิทิน</button></div></div><div class="month-mini-bar"><div style="width:${pComp}%;background:#10b981;"></div><div style="width:${pConf}%;background:#6366f1;"></div><div style="width:${pCanc}%;background:#f43f5e;"></div></div><div style="display:flex;flex-direction:column;gap:5px;">${itms}</div></div>`;
    }).join('');
  }

  // Settings & Patch Notes
  function renderSettingsTab() {
    $('cfgDigestHour').value = state.meta.DAILY_DIGEST_HOUR || '8';
    $('cfgEnableBotQuery').checked = String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE';
    $('cfgPrivacyMask').checked = String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
    if ($('cfgNotifyStatusChange')) $('cfgNotifyStatusChange').checked = String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE';
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

  // Modal & Form Handlers
  function openCreateModal(prefillDate) {
    $('modalTitle').textContent = 'สร้างนัดหมายใหม่';
    $('formAptId').value = $('formExpectedUpdatedAt').value = $('formNotes').value = $('formRescheduleReason').value = $('formTitle').value = $('formContactPerson').value = $('formLocation').value = '';
    $('formStatus').value = Logic.STATUS.CONFIRMED;
    $('formDate').value = typeof prefillDate === 'string' && prefillDate ? prefillDate : Logic.getBangkokParts().dateStr;
    $('formTime').value = '09:00'; $('formRemindDays').value = $('formRemindHours').value = '1';
    if ($('formNotifyLine')) $('formNotifyLine').checked = true;
    if ($('formNotifyLineLabel')) $('formNotifyLineLabel').textContent = 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที';
    $('rescheduleReasonGroup').style.display = $('btnDeleteApt').style.display = 'none';
    updateDateThaiPreview(); openModal('appointmentModal');
  }
  function openEditModal(id) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    $('modalTitle').textContent = `แก้ไขนัดหมาย ${a.id}`;
    $('formAptId').value = a.id; $('formExpectedUpdatedAt').value = a.updatedAt || '';
    $('formTitle').value = a.title || ''; $('formStatus').value = Logic.normalizeStatus(a.status);
    $('formContactPerson').value = a.contactPerson || ''; $('formDate').value = a.appointmentDate || '';
    $('formTime').value = a.appointmentTime || ''; $('formLocation').value = a.location || '';
    $('formRemindDays').value = String(a.remindDaysBefore != null ? a.remindDaysBefore : 1);
    $('formRemindHours').value = String(a.remindHoursBefore != null ? a.remindHoursBefore : 1);
    $('formNotes').value = a.notes || ''; $('formRescheduleReason').value = '';
    if ($('formNotifyLine')) $('formNotifyLine').checked = false;
    if ($('formNotifyLineLabel')) $('formNotifyLineLabel').textContent = 'ส่งแจ้งเตือนการแก้ไขนัดหมายเข้ากลุ่ม LINE ทันที';
    $('rescheduleReasonGroup').style.display = 'block'; $('btnDeleteApt').style.display = 'inline-flex';
    updateDateThaiPreview(); openModal('appointmentModal');
  }
  function updateDateThaiPreview() {
    const v = $('formDate').value; $('formDateThaiPreview').textContent = v ? Logic.formatThaiDateDisplay(v, true) : 'ยังไม่ระบุวันที่';
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = $('formAptId').value.trim(), exp = $('formExpectedUpdatedAt').value.trim(), user = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
    const payload = {
      title: Logic.sanitizeNoEmoji($('formTitle').value), status: $('formStatus').value, contactPerson: Logic.sanitizeNoEmoji($('formContactPerson').value),
      appointmentDate: $('formDate').value, appointmentTime: $('formTime').value, location: Logic.sanitizeNoEmoji($('formLocation').value),
      remindDaysBefore: +$('formRemindDays').value, remindHoursBefore: +$('formRemindHours').value, notes: Logic.sanitizeNoEmoji($('formNotes').value), updatedBy: user
    };
    const v = Logic.validateAppointmentInput(payload);
    if (!v.valid) { showToast(v.errors.join(' | '), 'error'); return; }
    const reason = Logic.sanitizeNoEmoji($('formRescheduleReason').value), notifyLine = $('formNotifyLine') ? Boolean($('formNotifyLine').checked) : !id;

    try {
      $('btnSubmitModal').disabled = true; $('btnSubmitModal').textContent = 'กำลังบันทึก...';
      if (state.isLive) {
        if (!id) await callGasApi('create', { payload, notifyLine });
        else await callGasApi('update', { id, payload, reason, notifyLine });
        await syncWithServer(true);
      } else {
        const now = Logic.getBangkokParts().isoStr;
        let savedApt = null;
        if (!id) { savedApt = Logic.createAppointmentRecord(payload, state.appointments, now); state.appointments.push(savedApt); }
        else {
          const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt); if (idx === -1) throw new Error('ไม่พบรายการนัดหมาย');
          const r = Logic.updateAppointmentRecord(state.appointments[idx], payload, { nowIso: now, expectedUpdatedAt: exp, reason });
          state.appointments[idx] = savedApt = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
        }
        if (notifyLine && savedApt && $('botSimOutput')) {
          $('botSimOutput').textContent = Logic.formatInstantAppointmentMessage(savedApt, Boolean(id), { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' });
        }
        saveDemoData(); renderAll();
      }
      closeModal('appointmentModal');
      showToast(id ? 'บันทึกการแก้ไขนัดหมายเรียบร้อยแล้ว' : 'สร้างนัดหมายใหม่เรียบร้อยแล้ว', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { $('btnSubmitModal').disabled = false; $('btnSubmitModal').textContent = 'บันทึกนัดหมาย'; }
  }

  async function handleQuickStatus(id, newStatus) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    const user = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
    const notifyLine = String(state.meta.NOTIFY_ON_STATUS_CHANGE).toUpperCase() !== 'FALSE';
    try {
      if (state.isLive) {
        await callGasApi('update', { id, payload: { status: newStatus, updatedBy: user }, notifyLine: notifyLine, reason: `เปลี่ยนสถานะเป็น ${newStatus}` });
        await syncWithServer(true);
      } else {
        const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
        const r = Logic.updateAppointmentRecord(state.appointments[idx], { status: newStatus, updatedBy: user }, { nowIso: Logic.getBangkokParts().isoStr, expectedUpdatedAt: a.updatedAt, reason: `เปลี่ยนสถานะเป็น ${newStatus}` });
        state.appointments[idx] = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
        if (notifyLine && $('botSimOutput')) {
          $('botSimOutput').textContent = Logic.formatInstantAppointmentMessage(r.record, true, { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' });
        }
        saveDemoData(); renderAll();
      }
      showToast(`อัปเดตสถานะ [${id}] เป็น "${newStatus}" แล้ว${notifyLine ? ' (แจ้งเตือน LINE แล้ว)' : ''}`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function handleDelete() {
    const id = $('formAptId').value.trim(); if (!id || !confirm(`ยืนยันการลบนัดหมาย [${id}] หรือไม่?`)) return;
    const user = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
    try {
      if (state.isLive) { await callGasApi('delete', { id, updatedBy: user }); await syncWithServer(true); }
      else {
        const idx = state.appointments.findIndex(x => x.id === id && !x.deletedAt);
        if (idx !== -1) { state.appointments[idx].deletedAt = Logic.getBangkokParts().isoStr; saveDemoData(); renderAll(); }
      }
      closeModal('appointmentModal'); showToast(`ลบนัดหมาย [${id}] เรียบร้อยแล้ว`, 'warn');
    } catch (err) { showToast(err.message, 'error'); }
  }

  // Events Binding
  function bindEvents() {
    document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.getAttribute('data-tab'))));
    on('btnToggleTheme', 'click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));
    on('activeUserInput', 'change', () => {
      state.activeUser = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
      $('activeUserInput').value = state.activeUser; localStorage.setItem(STORAGE.USER, state.activeUser);
      showToast(`ตั้งชื่อผู้บันทึกเป็น "${state.activeUser}"`, 'info');
    });

    on('btnOpenCreateModal', 'click', () => openCreateModal());
    on('btnMobileFabCreate', 'click', () => openCreateModal());
    on('btnAddAptOnSelectedDate', 'click', () => openCreateModal(state.calSelectedDate || `${state.calYear}-${String(state.calMonth).padStart(2, '0')}-01`));
    on('btnShowAllMonthApts', 'click', () => { state.calSelectedDate = ''; renderCalendarTab(); });
    on('btnCloseModalTop', 'click', () => closeModal('appointmentModal'));
    on('btnCancelModal', 'click', () => closeModal('appointmentModal'));
    on('formDate', 'change', updateDateThaiPreview);
    on('appointmentForm', 'submit', handleFormSubmit);
    on('btnDeleteApt', 'click', handleDelete);
    on('btnSyncNow', 'click', () => syncWithServer(false));

    document.querySelectorAll('.time-chip').forEach(c => c.addEventListener('click', () => { if ($('formTime')) $('formTime').value = c.getAttribute('data-time') || ''; }));
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
    on('filterDate', 'change', () => {
      if ($('filterDate').value) { state.quickRange = 'ALL'; document.querySelectorAll('.range-chip').forEach(c => c.classList.toggle('active', c.getAttribute('data-range') === 'ALL')); }
      renderListTab();
    });
    on('btnClearFilters', 'click', () => {
      $('filterSearch').value = $('filterStatus').value = $('filterDate').value = '';
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
      const st = e.target.closest('.btn-quick-status'); if (st) { handleQuickStatus(st.getAttribute('data-id'), st.getAttribute('data-status')); return; }
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
    on('btnSavePolicy', 'click', async () => {
      const m = {
        DAILY_DIGEST_HOUR: String(+$('cfgDigestHour').value || 8),
        ENABLE_LINE_BOT_QUERY: $('cfgEnableBotQuery').checked ? 'TRUE' : 'FALSE',
        PRIVACY_MASK_CONTACT: $('cfgPrivacyMask').checked ? 'TRUE' : 'FALSE',
        NOTIFY_ON_STATUS_CHANGE: $('cfgNotifyStatusChange') && $('cfgNotifyStatusChange').checked ? 'TRUE' : 'FALSE'
      };
      state.meta = { ...state.meta, ...m };
      if (state.isLive) { try { await callGasApi('updateMeta', { meta: m }); showToast('บันทึกนโยบายเรียบร้อยแล้ว', 'success'); } catch (err) { showToast(err.message, 'error'); } }
      else showToast('บันทึกนโยบายเรียบร้อยแล้ว (Demo)', 'success');
      renderAll();
    });

    const handleTriggerSetup = async (mode, desc) => {
      if (!state.isLive) { showToast(`[Demo] จำลองการติดตั้ง ${desc} สำเร็จ`, 'info'); return; }
      try {
        const r = await callGasApi('setupTriggers', { mode });
        showToast(r.message || `ตั้งค่า ${desc} เรียบร้อย`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
    };
    on('btnInstallAutoTrigger', 'click', () => handleTriggerSetup('auto', 'Trigger อัจฉริยะ'));
    on('btnInstallDailyTrigger', 'click', () => handleTriggerSetup('daily', 'Trigger สรุปเช้าวันละครั้ง'));
    on('btnInstall15MinTrigger', 'click', () => handleTriggerSetup('every15Min', 'Trigger ตรวจเช็คทุก 15 นาที'));
    on('btnRemoveTriggers', 'click', () => handleTriggerSetup('off', 'ปิด Trigger ทั้งหมด'));
    on('btnTestValidateLine', 'click', async () => {
      if (!state.isLive) { $('botSimOutput').textContent = '[Demo] ข้อความผ่านการตรวจสอบรูปแบบ Zero-Emoji พร้อมเชื่อม LINE'; showToast('ตรวจสอบรูปแบบสำเร็จ (Demo)', 'success'); return; }
      try { const r = await callGasApi('testNotification', { dryRun: true }); $('botSimOutput').textContent = `[Validate] ${r.ok ? 'สำเร็จ HTTP ' + r.httpStatus : 'ไม่สำเร็จ: ' + r.error}`; showToast(r.ok ? 'Validate ผ่านเรียบร้อย' : 'Validate ไม่ผ่าน', r.ok ? 'success' : 'error'); }
      catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
    });
    on('btnTestRealPush', 'click', async () => {
      if (!state.isLive || !confirm('การทดสอบจริงจะหักโควตา LINE ตามจำนวนสมาชิกกลุ่ม ยืนยันหรือไม่?')) return;
      try { const r = await callGasApi('testNotification', { dryRun: false }); $('botSimOutput').textContent = `[Push จริง] ${r.ok ? 'สำเร็จ' : r.error}`; await syncWithServer(true); showToast(r.ok ? 'ส่งข้อความทดสอบสำเร็จ' : 'ส่งไม่สำเร็จ', r.ok ? 'success' : 'error'); }
      catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
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
      enableLineBotQuery: String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE', privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE',
      quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0
    });
    $('botSimOutput').textContent = res === null ? '[บอทเงียบ]\nเนื่องจากข้อความไม่ได้ขึ้นต้นด้วยคำว่า "คิว"' : res;
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
