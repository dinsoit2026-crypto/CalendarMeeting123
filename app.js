/**
 * app.js - UI Controller & State Management (v2.2.0)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */
(function () {
  'use strict';

  const Logic = window.CalendarLogic, PatchNotes = window.PATCH_NOTES || [];
  const $ = id => document.getElementById(id), on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const openModal = id => $(id).classList.add('active'), closeModal = id => $(id).classList.remove('active');
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }, escapeHtml = s => s == null ? '' : String(s).replace(/[&<>"']/g, c => ESC[c]);

  const STORAGE = { APTS: 'CAL_DEMO_APTS_V2', LOGS: 'CAL_DEMO_LOGS_V2', CFG: 'CAL_CONN_CFG_V2', USER: 'CAL_USER_V2' };
  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwEq-EehM4BDKQLsh7dFQCJNeJNg2g_DtM1_INYgjblaKyhcdkNuAdiIEhkvSke--ro/exec';
  const DEFAULT_PASSCODE = 'CALL1234';

  const state = {
    isLive: true, gasUrl: DEFAULT_GAS_URL, passcode: DEFAULT_PASSCODE, activeUser: 'ผู้ดูแลระบบ',
    appointments: [], rescheduleLogs: [],
    meta: { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE' },
    calYear: Logic.getBangkokParts().year, calMonth: Logic.getBangkokParts().month, calSelectedDate: '',
    overviewYear: Logic.getBangkokParts().year
  };

  // --- Init & Storage ---
  function initApp() {
    try {
      const u = localStorage.getItem(STORAGE.USER); if (u) state.activeUser = Logic.sanitizeNoEmoji(u) || 'ผู้ดูแลระบบ';
      if ($('activeUserInput')) $('activeUserInput').value = state.activeUser;
      const c = JSON.parse(localStorage.getItem(STORAGE.CFG) || 'null');
      if (c && c.gasUrl && !c.gasUrl.includes('AKfycwEq') && !c.gasUrl.includes('AdilEhkvSke')) {
        state.gasUrl = (c.gasUrl || '').trim();
        state.passcode = c.passcode || '';
        state.isLive = Boolean(c.isLive && state.gasUrl);
      } else {
        state.gasUrl = DEFAULT_GAS_URL;
        state.passcode = DEFAULT_PASSCODE;
        state.isLive = true;
        localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }));
      }
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl;
      if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
    } catch (_) {}

    initMonthSelector();
    bindEvents();
    if (state.isLive && state.gasUrl) syncWithServer();
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
    const built = [];
    seeds.forEach(s => built.push(Logic.createAppointmentRecord(s, built, now.isoStr)));
    state.appointments = built; state.rescheduleLogs = [];
    saveDemoData();
  }

  function saveDemoData() {
    if (state.isLive) return;
    localStorage.setItem(STORAGE.APTS, JSON.stringify(state.appointments));
    localStorage.setItem(STORAGE.LOGS, JSON.stringify(state.rescheduleLogs));
  }

  // --- API Client ---
  async function callGasApi(action, payload) {
    if (!state.gasUrl) throw new Error('ยังไม่ได้ระบุ Web App URL');
    const res = await fetch(state.gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, passcode: state.passcode, ...payload }) });
    const r = await res.json();
    if (!r.ok) { const err = new Error(r.error || 'Server error'); err.code = r.code; throw err; }
    return r.data;
  }

  async function syncWithServer() {
    if (!state.isLive || !state.gasUrl) { renderAll(); return; }
    try {
      $('btnSyncNow').textContent = '...';
      const d = await callGasApi('list', {});
      state.appointments = d.appointments || []; state.rescheduleLogs = d.rescheduleLogs || [];
      if (d.meta) state.meta = { ...state.meta, ...d.meta };
      renderAll();
    } catch (e) { alert('ซิงก์ข้อมูลไม่สำเร็จ: ' + e.message); }
    finally { $('btnSyncNow').textContent = 'ซิงก์'; }
  }

  // --- Render ---
  function renderAll() {
    renderHeader(); renderListTab(); renderCalendarTab(); renderYearTab(); renderSettingsTab();
  }

  function updateClock() {
    const b = Logic.getBangkokParts();
    if ($('bangkokClockDisplay')) $('bangkokClockDisplay').textContent = `เวลา (BKK): ${Logic.formatThaiDateDisplay(b.dateStr, false)} ${b.timeStr} น.`;
  }

  function renderHeader() {
    const bd = $('connectionModeBadge'), ts = $('triggerStatusText');
    if (state.isLive) {
      bd.className = 'mode-badge live'; bd.textContent = '[Sheets]';
      const lr = state.meta.LAST_TRIGGER_RUN_AT;
      ts.textContent = lr ? `Trigger: รันเมื่อ ${Math.round((Logic.getBangkokParts().epochMs - Logic.getBangkokParts(lr).epochMs) / 60000)} นาทีที่แล้ว` : 'Trigger: ยังไม่เริ่มรัน';
    } else {
      bd.className = 'mode-badge demo'; bd.textContent = '[Demo]';
      ts.textContent = 'Trigger: โหมดจำลองในเครื่อง';
    }
    const limit = +state.meta.CACHED_QUOTA_LIMIT || 300, used = +state.meta.CACHED_QUOTA_USED || 0;
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    $('quotaTextLabel').textContent = `โควตา LINE: ${used} / ${limit} (${pct}%)`;
    const f = $('quotaProgressFill'); f.style.width = `${pct}%`;
    f.className = 'quota-progress-fill' + (pct >= 90 ? ' danger' : pct >= 80 ? ' warn' : '');
  }

  const getStatusClass = s => {
    const st = Logic.normalizeStatus(s);
    return st === Logic.STATUS.COMPLETED ? 'status-completed' : (st === Logic.STATUS.CANCELLED ? 'status-cancelled' : 'status-confirmed');
  };

  function renderCardHtml(a) {
    const now = Logic.getBangkokParts().isoStr, od = Logic.isOverdue(a, now), st = Logic.normalizeStatus(a.status), cls = getStatusClass(st);
    const daySent = a.appointmentDate && a.notifiedDayForSlot === a.appointmentDate;
    const hrSent = a.appointmentDate && a.appointmentTime && a.notifiedHourForSlot === `${a.appointmentDate}T${a.appointmentTime}`;
    const badges = [];
    if (od) badges.push('<span class="badge-overdue">[เลยกำหนด]</span>');
    if (daySent) badges.push('<span class="badge-info">[เตือนวันแล้ว]</span>');
    if (hrSent) badges.push('<span class="badge-info">[เตือน ชม.แล้ว]</span>');
    if (+a.rescheduleCount > 0) badges.push(`<span class="badge-info">[เลื่อน ${+a.rescheduleCount} ครั้ง]</span>`);

    const isConfirmed = st === Logic.STATUS.CONFIRMED;

    return `
      <article class="apt-card-slim ${cls}">
        <div class="apt-slim-top">
          <div class="apt-slim-title-wrap">
            <span class="apt-id-code">${escapeHtml(a.id)}</span>
            <span class="status-badge ${cls}">[${escapeHtml(st)}]</span>
            ${badges.join(' ')}
            <strong class="apt-slim-title">${escapeHtml(a.title)}</strong>
          </div>
          <div class="apt-slim-actions">
            <button type="button" class="btn btn-primary btn-sm btn-edit-apt" data-id="${escapeHtml(a.id)}">แก้ไข/เลื่อน</button>
            ${isConfirmed ? `
              <button type="button" class="btn btn-success btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="สิ้นสุดการนัดหมาย">สิ้นสุด</button>
              <button type="button" class="btn btn-danger btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="ยกเลิกการนัดหมาย">ยกเลิก</button>
            ` : `
              <button type="button" class="btn btn-outline btn-sm btn-quick-status" data-id="${escapeHtml(a.id)}" data-status="นัดหมายแล้ว">คืนสถานะนัด</button>
            `}
          </div>
        </div>
        <div class="apt-slim-meta">
          <span><strong>วัน-เวลา:</strong> ${escapeHtml(Logic.formatThaiDateDisplay(a.appointmentDate, false))} ${escapeHtml(a.appointmentTime || '')} น.</span>
          <span class="apt-meta-sep">|</span>
          <span><strong>ผู้นัดพบ:</strong> ${escapeHtml(a.contactPerson || '-')}</span>
          <span class="apt-meta-sep">|</span>
          <span><strong>สถานที่:</strong> ${escapeHtml(a.location || '-')}</span>
          <span class="apt-meta-sep">|</span>
          <span><strong>เตือน:</strong> ${+a.remindDaysBefore}ว. / ${+a.remindHoursBefore}ชม.</span>
          ${a.notes ? `<span class="apt-meta-sep">|</span><span>หมายเหตุ: ${escapeHtml(a.notes)}</span>` : ''}
        </div>
      </article>
    `;
  }

  function renderListTab() {
    const now = Logic.getBangkokParts().isoStr, all = state.appointments.filter(a => a && !a.deletedAt);
    let sConf = 0, sComp = 0, sCanc = 0, sOd = 0;
    all.forEach(a => {
      const st = Logic.normalizeStatus(a.status);
      if (st === Logic.STATUS.CONFIRMED) sConf++;
      else if (st === Logic.STATUS.COMPLETED) sComp++;
      else if (st === Logic.STATUS.CANCELLED) sCanc++;
      if (Logic.isOverdue(a, now)) sOd++;
    });
    $('statTotal').textContent = all.length;
    $('statConfirmed').textContent = sConf;
    $('statCompleted').textContent = sComp;
    $('statCancelled').textContent = sCanc;
    $('statOverdue').textContent = sOd;

    const kw = ($('filterSearch').value || '').trim().toLowerCase(), st = $('filterStatus').value, dt = $('filterDate').value;
    const filtered = all.filter(a => {
      const aSt = Logic.normalizeStatus(a.status);
      if (st === 'ACTIVE_ONLY' && aSt !== Logic.STATUS.CONFIRMED) return false;
      if (st === 'OVERDUE' && !Logic.isOverdue(a, now)) return false;
      if (st && st !== 'ACTIVE_ONLY' && st !== 'OVERDUE' && aSt !== st) return false;
      if (dt && a.appointmentDate !== dt) return false;
      if (kw && !`${a.id} ${a.title} ${a.location} ${a.contactPerson} ${aSt} ${a.notes}`.toLowerCase().includes(kw)) return false;
      return true;
    });
    filtered.sort((a, b) => (Logic.buildAppointmentSlot(a) || '9999').localeCompare(Logic.buildAppointmentSlot(b) || '9999'));
    $('appointmentsListContainer').innerHTML = filtered.length ? filtered.map(renderCardHtml).join('') : '<div class="empty-state">ไม่มีรายการนัดหมาย</div>';
  }

  // --- Calendar Tab ---
  function initMonthSelector() {
    const sel = $('calSelectMonth'); if (!sel) return;
    sel.innerHTML = Logic.THAI_MONTHS_FULL.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    sel.value = String(state.calMonth);
    $('calInputYear').value = String(state.calYear + 543);
    $('yearOverviewInput').value = String(state.overviewYear + 543);
  }

  function renderCalendarTab() {
    const y = state.calYear, m = state.calMonth, mData = Logic.queryByMonth(state.appointments, y, m, { nowIso: Logic.getBangkokParts().isoStr });
    $('calendarMonthTitle').textContent = `${mData.monthNameThai} ${mData.buddhistYear}`;
    $('calSelectMonth').value = String(m); $('calInputYear').value = String(mData.buddhistYear);

    const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), maxDay = Logic.getDaysInMonth(y, m), todayStr = Logic.getBangkokParts().dateStr;
    const cells = Array.from({ length: startDow }, () => '<div class="cal-cell empty"></div>');
    for (let d = 1; d <= maxDay; d++) {
      const dtStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const itms = mData.items.filter(a => a.appointmentDate === dtStr);
      const isTd = dtStr === todayStr, isSel = dtStr === state.calSelectedDate;
      const pills = itms.slice(0, 3).map(a => `<div class="cal-apt-pill ${getStatusClass(a.status)}">${escapeHtml(a.appointmentTime || '')} ${escapeHtml(a.title)}</div>`).join('');
      const more = itms.length > 3 ? `<div style="font-size: 8.5px; color: var(--text-muted);">+${itms.length - 3}</div>` : '';
      cells.push(`<div class="cal-cell ${isTd ? 'today' : ''} ${isSel ? 'selected' : ''}" data-date="${dtStr}"><div class="cal-date-num">${d}</div>${pills}${more}</div>`);
    }
    const dows = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => `<div class="cal-day-header">${d}</div>`).join('');
    $('calendarGridContainer').innerHTML = dows + cells.join('');

    const showItems = state.calSelectedDate ? mData.items.filter(a => a.appointmentDate === state.calSelectedDate) : mData.items;
    $('monthlyListHeader').textContent = state.calSelectedDate ? `นัดหมายวันที่ ${Logic.formatThaiDateDisplay(state.calSelectedDate, false)} (${showItems.length} รายการ)` : `นัดหมายเดือน${mData.monthNameThai} (${showItems.length} รายการ)`;
    $('monthlyAppointmentsList').innerHTML = showItems.length ? showItems.map(renderCardHtml).join('') : '<div class="empty-state">ไม่มีนัดหมาย</div>';
  }

  // --- Year-End Statistics & Year Tab ---
  function renderYearTab() {
    const curY = Logic.getBangkokParts().year, sY = Math.min(curY, state.overviewYear), eY = Math.max(curY + 3, state.overviewYear + 1);
    const multi = Logic.queryMultiYearOverview(state.appointments, sY, eY, { nowIso: Logic.getBangkokParts().isoStr });

    $('multiYearCardsContainer').innerHTML = multi.years.map(yr => `
      <div class="year-summary-card ${yr.ceYear === state.overviewYear ? 'active' : ''}" data-year="${yr.ceYear}">
        <div style="font-weight: 700; font-size: 14px;">พ.ศ. ${yr.buddhistYear} (${yr.ceYear})</div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">รวม ${yr.stats.total} งาน | รอ ${yr.stats.active} งาน</div>
      </div>
    `).join('');

    const selYr = Logic.queryByYear(state.appointments, state.overviewYear, { nowIso: Logic.getBangkokParts().isoStr });
    const s = selYr.stats;
    $('selectedYearHeader').textContent = `สรุปสถิติตลอดทั้งปี พ.ศ. ${selYr.buddhistYear} (ค.ศ. ${selYr.ceYear})`;

    $('yearEndSummaryCards').innerHTML = `
      <div class="stat-box">
        <span class="stat-box-title">งานนัดทั้งหมด</span>
        <span class="stat-box-val">${s.total}</span>
        <span class="stat-box-sub">รายการสะสมทั้งปี</span>
      </div>
      <div class="stat-box" style="border-left: 3px solid var(--st-conf-border);">
        <span class="stat-box-title">นัดหมายแล้ว (รอดำเนินการ)</span>
        <span class="stat-box-val">${s.active}</span>
        <span class="stat-box-sub">รอถึงกำหนดนัด</span>
      </div>
      <div class="stat-box" style="border-left: 3px solid var(--st-comp-border);">
        <span class="stat-box-title">สิ้นสุดการนัดหมาย</span>
        <span class="stat-box-val">${s.completed}</span>
        <span class="stat-box-sub">สำเร็จ ${s.completionRate}%</span>
      </div>
      <div class="stat-box" style="border-left: 3px solid var(--st-canc-border);">
        <span class="stat-box-title">ยกเลิกการนัดหมาย</span>
        <span class="stat-box-val">${s.cancelled}</span>
        <span class="stat-box-sub">ยกเลิก ${s.cancellationRate}%</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-title">การเลื่อนนัดสะสม</span>
        <span class="stat-box-val">${s.rescheduleTotal}</span>
        <span class="stat-box-sub">ครั้งที่มีการเลื่อน</span>
      </div>
    `;

    $('yearMonthsGrid').innerHTML = selYr.months.map(m => {
      const itms = !m.items.length ? '<div style="font-size: 11px; color: var(--text-muted);">- ไม่มีงาน -</div>' : m.items.map(a => `
        <div style="padding: 3px 6px; background: var(--bg-muted); border-radius: 3px; border-left: 2px solid var(--primary); font-size: 11px;">
          <div style="font-weight: 600;">[${a.appointmentDate.slice(8, 10)} ${m.monthShortThai} ${a.appointmentTime || ''}] ${escapeHtml(a.title)}</div>
          <div style="color: var(--text-muted); font-size: 10.5px;">${escapeHtml(a.contactPerson || '-')} | [${escapeHtml(Logic.normalizeStatus(a.status))}]</div>
        </div>
      `).join('');
      return `
        <div class="month-box">
          <div class="month-box-header">
            <span>${m.monthNameThai}</span>
            <span class="badge-info">รวม ${m.stats.total} (เสร็จ ${m.stats.completed} / ยกเลิก ${m.stats.cancelled})</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;">${itms}</div>
        </div>
      `;
    }).join('');
  }

  // --- Settings & Patch Notes ---
  function renderSettingsTab() {
    $('cfgDigestHour').value = state.meta.DAILY_DIGEST_HOUR || '8';
    $('cfgEnableBotQuery').checked = String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE';
    $('cfgPrivacyMask').checked = String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';

    const tb = $('rescheduleLogsTableBody');
    if (!state.rescheduleLogs.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">ไม่มีประวัติ</td></tr>'; return; }
    tb.innerHTML = state.rescheduleLogs.slice(0, 40).map(l => `
      <tr><td>${escapeHtml(l.changedAt)}</td><td><code>${escapeHtml(l.appointmentId)}</code></td><td>${escapeHtml(l.changedBy)}</td><td>${escapeHtml(l.fieldChanged)}</td><td>${escapeHtml(l.oldValue || '-')}</td><td><strong>${escapeHtml(l.newValue || '-')}</strong></td><td>${escapeHtml(l.reason || '-')}</td></tr>
    `).join('');
  }

  function renderPatchNotes() {
    const c = $('patchNotesContainer');
    if (!c) return;
    c.innerHTML = PatchNotes.map(p => `
      <div class="patch-card">
        <div class="patch-card-head"><span>เวอร์ชัน ${escapeHtml(p.version)}</span><span class="hint-text">${escapeHtml(p.date)}</span></div>
        <div class="patch-card-desc">${escapeHtml(p.title)}</div>
        <ul>${(p.changes || []).map(ch => `<li>${escapeHtml(ch)}</li>`).join('')}</ul>
      </div>
    `).join('');
  }

  // --- Modals & CRUD ---
  function openCreateModal() {
    $('modalTitle').textContent = 'นัดหมายใหม่';
    $('formAptId').value = $('formExpectedUpdatedAt').value = $('formNotes').value = $('formRescheduleReason').value = '';
    $('formTitle').value = ''; $('formStatus').value = Logic.STATUS.CONFIRMED; $('formContactPerson').value = $('formLocation').value = '';
    $('formDate').value = Logic.getBangkokParts().dateStr; $('formTime').value = '09:00'; $('formRemindDays').value = $('formRemindHours').value = '1';
    if ($('formNotifyLine')) $('formNotifyLine').checked = true;
    if ($('formNotifyLineLabel')) $('formNotifyLineLabel').textContent = 'ส่งแจ้งเตือนนัดหมายใหม่เข้ากลุ่ม LINE ทันที';
    $('rescheduleReasonGroup').style.display = $('btnDeleteApt').style.display = 'none';
    updateDateThaiPreview(); openModal('appointmentModal');
  }

  function openEditModal(id) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    $('modalTitle').textContent = `แก้ไขนัดหมาย [${a.id}]`;
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
    const v = $('formDate').value; $('formDateThaiPreview').textContent = v ? Logic.formatThaiDateDisplay(v, true) : 'ยังไม่ระบุวัน';
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
    if (!v.valid) { alert(v.errors.join('\n')); return; }
    const reason = Logic.sanitizeNoEmoji($('formRescheduleReason').value);
    const notifyLine = $('formNotifyLine') ? Boolean($('formNotifyLine').checked) : !id;

    try {
      $('btnSubmitModal').disabled = true;
      $('btnSubmitModal').textContent = 'กำลังบันทึก...';
      if (state.isLive) {
        if (!id) await callGasApi('create', { payload, notifyLine });
        else await callGasApi('update', { id, payload, expectedUpdatedAt: exp, reason, notifyLine });
        await syncWithServer();
      } else {
        const now = Logic.getBangkokParts().isoStr;
        let savedApt = null;
        if (!id) {
          savedApt = Logic.createAppointmentRecord(payload, state.appointments, now);
          state.appointments.push(savedApt);
        } else {
          const idx = state.appointments.findIndex(x => x.id === id); if (idx === -1) throw new Error('ไม่พบรายการ');
          const r = Logic.updateAppointmentRecord(state.appointments[idx], payload, { nowIso: now, expectedUpdatedAt: exp, reason });
          state.appointments[idx] = savedApt = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
        }
        if (notifyLine && savedApt && $('botSimOutput')) {
          $('botSimOutput').textContent = Logic.formatInstantAppointmentMessage(savedApt, Boolean(id), { privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE' });
        }
        saveDemoData(); renderAll();
      }
      closeModal('appointmentModal');
    } catch (err) { alert(err.message); }
    finally {
      $('btnSubmitModal').disabled = false;
      $('btnSubmitModal').textContent = 'บันทึกนัดหมาย';
    }
  }

  async function handleQuickStatus(id, newStatus) {
    const a = state.appointments.find(x => x.id === id && !x.deletedAt); if (!a) return;
    const user = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';

    try {
      if (state.isLive) {
        await callGasApi('update', { id, payload: { status: newStatus, updatedBy: user }, expectedUpdatedAt: a.updatedAt, reason: `เปลี่ยนสถานะเป็น ${newStatus}` });
        await syncWithServer();
      } else {
        const idx = state.appointments.findIndex(x => x.id === id);
        const r = Logic.updateAppointmentRecord(state.appointments[idx], { status: newStatus, updatedBy: user }, { nowIso: Logic.getBangkokParts().isoStr, expectedUpdatedAt: a.updatedAt, reason: `เปลี่ยนสถานะเป็น ${newStatus}` });
        state.appointments[idx] = r.record; if (r.logs.length) state.rescheduleLogs = [...r.logs, ...state.rescheduleLogs];
        saveDemoData(); renderAll();
      }
    } catch (err) { alert(err.message); }
  }

  async function handleDelete() {
    const id = $('formAptId').value.trim(); if (!id || !confirm(`ยืนยันการลบนัดหมาย [${id}] หรือไม่?`)) return;
    const user = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
    try {
      if (state.isLive) { await callGasApi('delete', { id, updatedBy: user }); await syncWithServer(); }
      else {
        const idx = state.appointments.findIndex(x => x.id === id);
        if (idx !== -1) { state.appointments[idx].deletedAt = Logic.getBangkokParts().isoStr; saveDemoData(); renderAll(); }
      }
      closeModal('appointmentModal');
    } catch (err) { alert(err.message); }
  }

  // --- Events ---
  function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active'); const t = $(btn.getAttribute('data-tab')); if (t) t.classList.add('active');
      });
    });

    on('activeUserInput', 'change', () => {
      state.activeUser = Logic.sanitizeNoEmoji($('activeUserInput').value) || 'ผู้ดูแลระบบ';
      $('activeUserInput').value = state.activeUser; localStorage.setItem(STORAGE.USER, state.activeUser);
    });

    on('btnOpenCreateModal', 'click', openCreateModal);
    on('btnCloseModalTop', 'click', () => closeModal('appointmentModal'));
    on('btnCancelModal', 'click', () => closeModal('appointmentModal'));
    on('formDate', 'change', updateDateThaiPreview);
    on('appointmentForm', 'submit', handleFormSubmit);
    on('btnDeleteApt', 'click', handleDelete);
    on('btnSyncNow', 'click', syncWithServer);

    // Patch Notes Modal
    on('btnOpenPatchNotesModal', 'click', () => { renderPatchNotes(); openModal('patchNotesModal'); });
    on('btnClosePatchNotesModalTop', 'click', () => closeModal('patchNotesModal'));
    on('btnClosePatchNotesModal', 'click', () => closeModal('patchNotesModal'));

    // User Guide Modal
    on('btnOpenGuideModal', 'click', () => openModal('guideModal'));
    on('btnCloseGuideModalTop', 'click', () => closeModal('guideModal'));
    on('btnCloseGuideModal', 'click', () => closeModal('guideModal'));

    const applyTeamDefaultConnection = async () => {
      state.gasUrl = DEFAULT_GAS_URL;
      state.passcode = DEFAULT_PASSCODE;
      state.isLive = true;
      if ($('cfgGasUrl')) $('cfgGasUrl').value = state.gasUrl;
      if ($('cfgPasscode')) $('cfgPasscode').value = state.passcode;
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: true }));
      closeModal('guideModal');
      await syncWithServer();
    };
    on('btnQuickConnectFromGuide', 'click', applyTeamDefaultConnection);
    on('btnResetDefaultConn', 'click', applyTeamDefaultConnection);

    // Filters
    on('filterSearch', 'input', renderListTab);
    on('filterStatus', 'change', renderListTab);
    on('filterDate', 'change', renderListTab);
    on('btnClearFilters', 'click', () => { $('filterSearch').value = $('filterStatus').value = $('filterDate').value = ''; renderListTab(); });

    document.querySelectorAll('.stat-pill').forEach(pill => {
      pill.addEventListener('click', () => { $('filterStatus').value = pill.getAttribute('data-filter-status') || ''; renderListTab(); });
    });

    document.addEventListener('click', e => {
      const edit = e.target.closest('.btn-edit-apt'); if (edit) { openEditModal(edit.getAttribute('data-id')); return; }
      const st = e.target.closest('.btn-quick-status'); if (st) { handleQuickStatus(st.getAttribute('data-id'), st.getAttribute('data-status')); return; }
      const cell = e.target.closest('.cal-cell:not(.empty)');
      if (cell) { const d = cell.getAttribute('data-date'); state.calSelectedDate = state.calSelectedDate === d ? '' : d; renderCalendarTab(); return; }
      const yc = e.target.closest('.year-summary-card');
      if (yc) { state.overviewYear = +yc.getAttribute('data-year'); $('yearOverviewInput').value = String(state.overviewYear + 543); renderYearTab(); return; }
      const qc = e.target.closest('.btn-quick-cmd');
      if (qc) { $('botSimInput').value = qc.getAttribute('data-cmd'); runBotSim(); }
    });

    // Calendar & Year nav
    on('btnPrevMonth', 'click', () => { state.calSelectedDate = ''; if (--state.calMonth < 1) { state.calMonth = 12; state.calYear--; } renderCalendarTab(); });
    on('btnNextMonth', 'click', () => { state.calSelectedDate = ''; if (++state.calMonth > 12) { state.calMonth = 1; state.calYear++; } renderCalendarTab(); });
    on('btnCurrentMonth', 'click', () => { const now = Logic.getBangkokParts(); state.calYear = now.year; state.calMonth = now.month; state.calSelectedDate = ''; renderCalendarTab(); });
    on('btnJumpMonth', 'click', () => {
      const y = Logic.normalizeYearToCE($('calInputYear').value);
      if (!y) { alert('ระบุปีไม่ถูกต้อง'); return; }
      state.calMonth = +$('calSelectMonth').value; state.calYear = y; state.calSelectedDate = ''; renderCalendarTab();
    });
    on('btnJumpYearOverview', 'click', () => {
      const y = Logic.normalizeYearToCE($('yearOverviewInput').value);
      if (!y) { alert('ระบุปีไม่ถูกต้อง'); return; }
      state.overviewYear = y; renderYearTab();
    });

    // Settings
    on('btnSaveConnection', 'click', async () => {
      const u = ($('cfgGasUrl').value || '').trim(), p = $('cfgPasscode').value || '';
      if (!u) { alert('กรุณาระบุ URL'); return; }
      state.gasUrl = u; state.passcode = p; state.isLive = true;
      localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: u, passcode: p, isLive: true }));
      await syncWithServer();
    });
    on('btnSwitchLocalDemo', 'click', () => {
      state.isLive = false; localStorage.setItem(STORAGE.CFG, JSON.stringify({ gasUrl: state.gasUrl, passcode: state.passcode, isLive: false }));
      loadDemoData(); renderAll();
    });
    on('btnSavePolicy', 'click', async () => {
      const m = { DAILY_DIGEST_HOUR: String(+$('cfgDigestHour').value || 8), ENABLE_LINE_BOT_QUERY: $('cfgEnableBotQuery').checked ? 'TRUE' : 'FALSE', PRIVACY_MASK_CONTACT: $('cfgPrivacyMask').checked ? 'TRUE' : 'FALSE' };
      state.meta = { ...state.meta, ...m };
      if (state.isLive) { try { await callGasApi('updateMeta', { meta: m }); alert('บันทึกเรียบร้อย'); } catch (err) { alert(err.message); } }
      else alert('บันทึกเรียบร้อย (Demo)');
      renderAll();
    });
    on('btnTestValidateLine', 'click', async () => {
      if (!state.isLive) { $('botSimOutput').textContent = '[Demo] ข้อความผ่านการตรวจสอบรูปแบบ Zero-Emoji พร้อมเชื่อม LINE'; return; }
      try { const r = await callGasApi('testNotification', { dryRun: true }); $('botSimOutput').textContent = `[Validate] ${r.ok ? 'สำเร็จ HTTP ' + r.httpStatus : 'ไม่สำเร็จ: ' + r.error}`; }
      catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
    });
    on('btnTestRealPush', 'click', async () => {
      if (!state.isLive || !confirm('การทดสอบจริงจะหักโควตา LINE ตามจำนวนสมาชิกกลุ่ม ยืนยันหรือไม่?')) return;
      try { const r = await callGasApi('testNotification', { dryRun: false }); $('botSimOutput').textContent = `[Push จริง] ${r.ok ? 'สำเร็จ' : r.error}`; await syncWithServer(); }
      catch (e) { $('botSimOutput').textContent = '[Error] ' + e.message; }
    });
    on('btnRunBotSim', 'click', runBotSim);
    on('btnPreviewNotificationPlan', 'click', () => {
      const bkk = Logic.getBangkokParts(), plan = Logic.buildNotificationPlan(state.appointments, `${bkk.dateStr}T08:15:00+07:00`, { dailyDigestHour: +state.meta.DAILY_DIGEST_HOUR || 8, quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0 });
      $('botSimOutput').textContent = plan.shouldPush ? plan.messageText : '[จำลองการแจ้งเตือน]\nไม่มีรายการที่ถึงเกณฑ์เตือนในรอบนี้';
    });
  }

  function runBotSim() {
    const txt = $('botSimInput').value, res = Logic.parseAndExecuteLineCommand(txt, state.appointments, Logic.getBangkokParts().isoStr, {
      enableLineBotQuery: String(state.meta.ENABLE_LINE_BOT_QUERY).toUpperCase() !== 'FALSE', privacyMaskContact: String(state.meta.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE',
      quotaLimit: +state.meta.CACHED_QUOTA_LIMIT || 300, quotaUsed: +state.meta.CACHED_QUOTA_USED || 0
    });
    $('botSimOutput').textContent = res === null ? '[บอทเงียบ]\nเนื่องจากไม่ได้ขึ้นต้นด้วย "คิว"' : res;
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
