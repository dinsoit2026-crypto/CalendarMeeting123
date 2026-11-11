/**
 * Code.gs - Google Apps Script Backend for Calendar & LINE System (v2.4.0)
 * Timezone: Asia/Bangkok (UTC+07:00)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */

var API_VER = '2.4.0', SH_APTS = 'Appointments', SH_RE_LOGS = 'RescheduleLogs', SH_NOTIF_LOGS = 'NotificationLogs', SH_META = 'SystemMeta';
var APT_COLS = ['id', 'title', 'appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status', 'remindDaysBefore', 'remindHoursBefore', 'notifiedDayForSlot', 'notifiedHourForSlot', 'rescheduleCount', 'notes', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt'];
var RE_LOG_COLS = ['logId', 'appointmentId', 'changedAt', 'changedBy', 'fieldChanged', 'oldValue', 'newValue', 'reason'];
var NOTIF_LOG_COLS = ['logId', 'sentAt', 'triggerType', 'appointmentIds', 'targetId', 'httpStatus', 'retryKey', 'errorMessage'];
var META_COLS = ['key', 'value', 'updatedAt'];

var STATUS = { CONFIRMED: 'นัดหมายแล้ว', COMPLETED: 'สิ้นสุดการนัดหมาย', CANCELLED: 'ยกเลิกการนัดหมาย' };
var VALID_STATUSES = [STATUS.CONFIRMED, STATUS.COMPLETED, STATUS.CANCELLED];
var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

var EMOJI_EXT_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic}(?:\uFE0F|\u200D(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic})*)/gu;
var EMOJI_MOD_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;
function sanitizeNoEmoji(s) { return s == null ? '' : String(s).replace(EMOJI_EXT_RE, '').replace(EMOJI_MOD_RE, '').replace(/[ \t]{2,}/g, ' ').trim(); }

function normalizeStatus_(st) {
  var s = sanitizeNoEmoji(st || STATUS.CONFIRMED);
  if (s === 'กำลังนัดหมายวันเวลา' || s === 'พบหมายแล้ว' || s === STATUS.CONFIRMED) return STATUS.CONFIRMED;
  if (s === STATUS.COMPLETED || s === STATUS.CANCELLED) return s;
  return STATUS.CONFIRMED;
}

// --- Database Setup & Sheet Helpers ---
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [ [SH_APTS, APT_COLS], [SH_RE_LOGS, RE_LOG_COLS], [SH_NOTIF_LOGS, NOTIF_LOG_COLS], [SH_META, META_COLS] ].forEach(function (p) {
    ensureSheet_(ss, p[0], p[1]);
  });
  var defs = {
    LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', QUOTA_UPDATED_AT: '',
    DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7',
    ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'TRUE', WEB_APP_URL: ''
  };
  var cur = getMetaMap_(), now = getBkkNow_().isoStr, mSh = ss.getSheetByName(SH_META);
  Object.keys(defs).forEach(function (k) { if (cur[k] === undefined) mSh.appendRow([k, defs[k], now]); });
  formatPlainText_(mSh, META_COLS.length);
  return 'ตั้งค่าโครงสร้างชีต Plain Text สำเร็จ';
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  formatPlainText_(sh, cols.length);
  if (sh.getLastRow() === 0) { sh.appendRow(cols); sh.getRange(1, 1, 1, cols.length).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function formatPlainText_(sh, colCount) { sh.getRange(1, 1, Math.max(sh.getMaxRows(), 500), colCount).setNumberFormat('@'); }

// --- Trigger Management ---
function removeNotificationTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'runNotificationEngine') ScriptApp.deleteTrigger(t);
  });
  return 'ลบ Trigger แจ้งเตือนอัตโนมัติทั้งหมดเรียบร้อย';
}

function installTriggerAuto() {
  removeNotificationTriggers();
  // 1. สรุปคิวงานรอบเช้า (Daily Digest) เวลา 08:00 น.
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyDays(1).atHour(8).create();
  // 2. ตรวจสอบเตือนก่อนเวลานัด (Hourly Reminder) ทุก 1 ชั่วโมง
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyHours(1).create();
  return 'ติดตั้ง Trigger แจ้งเตือนอัตโนมัติ (รอบเช้า 08:00 น. และตรวจก่อนเวลานัดทุก 1 ชั่วโมง) เรียบร้อย';
}

function installTriggerEvery15Minutes() {
  removeNotificationTriggers();
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyMinutes(15).create();
  return 'ติดตั้ง Trigger ตรวจเช็คทุก 15 นาที เรียบร้อย';
}

function installTriggerDailyAt8AM() {
  removeNotificationTriggers();
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyDays(1).atHour(8).create();
  return 'ติดตั้ง Trigger แจ้งเตือนวันละ 1 ครั้ง (ช่วง 08:00 น.) เรียบร้อย';
}

function setupNotificationTriggers_(mode) {
  if (mode === 'every15Min') return installTriggerEvery15Minutes();
  if (mode === 'daily') return installTriggerDailyAt8AM();
  if (mode === 'off') return removeNotificationTriggers();
  return installTriggerAuto();
}

function scheduleExactReminderForApt_(apt) {
  try {
    if (!apt || apt.status !== STATUS.CONFIRMED || !apt.appointmentDate || !apt.appointmentTime) return;
    var ep = bkkSlotToEpoch_(apt.appointmentDate, apt.appointmentTime);
    if (!ep) return;
    var rH = +apt.remindHoursBefore || 1;
    var remindMs = ep - (rH * 3600000);
    var nowMs = getBkkNow_().epochMs;
    // หากเวลาเตือนอยู่ในช่วง 3 นาที ถึง 48 ชั่วโมงข้างหน้า
    if (remindMs > nowMs + 180000 && remindMs <= nowMs + (48 * 3600000)) {
      var allTriggers = ScriptApp.getProjectTriggers();
      if (allTriggers.length < 18) {
        ScriptApp.newTrigger('runNotificationEngine').timeBased().at(new Date(remindMs)).create();
      }
    }
  } catch (_) {}
}

// --- HTTP Endpoints ---
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!verifyPasscode_(p.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' });
    if ((p.action || 'list') === 'list') return json_({ ok: true, data: { appointments: readAllApts_(), meta: getMetaMap_(), serverTime: getBkkNow_().isoStr } });
    return json_({ ok: false, error: 'ไม่รองรับ GET action' });
  } catch (err) { return json_({ ok: false, error: err.message || String(err) }); }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}', body = JSON.parse(raw), p = (e && e.parameter) || {};
    if (Array.isArray(body.events)) return handleLineWebhook_(body, p);
    if (!verifyPasscode_(body.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' });

    var a = body.action || '';
    if (a === 'list') return json_({ ok: true, data: { appointments: readAllApts_(), rescheduleLogs: readLogs_(SH_RE_LOGS, RE_LOG_COLS, 50), notificationLogs: readLogs_(SH_NOTIF_LOGS, NOTIF_LOG_COLS, 30), meta: getMetaMap_(), serverTime: getBkkNow_().isoStr } });
    if (a === 'create') return withLock_(function () {
      var apt = createApt_(body.payload || {});
      var lineNotification = body.notifyLine !== false ? sendInstantAptNotification_(apt, false) : null;
      scheduleExactReminderForApt_(apt);
      return json_({ ok: true, data: { appointment: apt, lineNotification: lineNotification, meta: getMetaMap_() } });
    });
    if (a === 'update') return withLock_(function () {
      var res = updateApt_(body.id, body.payload || {}, body.expectedUpdatedAt, body.reason);
      if (body.notifyLine === true && res && res.appointment) {
        res.lineNotification = sendInstantAptNotification_(res.appointment, true);
        res.meta = getMetaMap_();
      }
      if (res && res.appointment) scheduleExactReminderForApt_(res.appointment);
      return json_({ ok: true, data: res });
    });
    if (a === 'delete') return withLock_(function () { return json_({ ok: true, data: { appointment: deleteApt_(body.id, body.updatedBy) } }); });
    if (a === 'updateMeta') return withLock_(function () { return json_({ ok: true, data: { meta: updateMeta_(body.meta || {}) } }); });
    if (a === 'setupTriggers') return json_({ ok: true, data: { message: setupNotificationTriggers_(body.mode) } });
    if (a === 'refreshQuota') return json_({ ok: true, data: refreshLineQuotaCache_() });
    if (a === 'testNotification') return json_({ ok: true, data: testNotification_(body.dryRun !== false, body.sampleText) });
    if (a === 'runEngineNow') return json_({ ok: true, data: runNotificationEngine() });
    return json_({ ok: false, error: 'ไม่รู้จัก action: ' + a });
  } catch (err) { return json_({ ok: false, code: err.code || 'SERVER_ERROR', error: err.message || String(err) }); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify({ ok: Boolean(o.ok), version: API_VER, data: o.data || null, code: o.code || null, error: o.error || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  var l = LockService.getScriptLock(); l.waitLock(15000);
  try { return fn(); } finally { l.releaseLock(); }
}
function verifyPasscode_(p) {
  var exp = PropertiesService.getScriptProperties().getProperty('API_PASSCODE') || '';
  return !exp || String(p || '') === exp;
}

// --- Date & Time (BKK) ---
function pad2_(n) { return String(Math.floor(Math.abs(Number(n) || 0))).padStart(2, '0'); }
function getBkkNow_(opt) {
  var d = opt ? new Date(opt) : new Date(), ep = d.getTime(), b = new Date(ep + 7 * 3600 * 1000);
  var yr = b.getUTCFullYear(), mo = b.getUTCMonth() + 1, dy = b.getUTCDate(), hr = b.getUTCHours(), mi = b.getUTCMinutes(), sc = b.getUTCSeconds();
  var ds = yr + '-' + pad2_(mo) + '-' + pad2_(dy), ts = pad2_(hr) + ':' + pad2_(mi);
  return { epochMs: ep, year: yr, buddhistYear: yr + 543, month: mo, day: dy, hour: hr, minute: mi, dateStr: ds, timeStr: ts, isoStr: ds + 'T' + ts + ':' + pad2_(sc) + '+07:00' };
}
function bkkSlotToEpoch_(d, t) {
  if (!d) return null;
  var dp = String(d).split('-').map(Number), tp = String(t || '00:00').split(':').map(Number);
  return (dp.length !== 3 || tp.length < 2) ? null : Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0) - (7 * 3600 * 1000);
}
function diffDays_(s, e) {
  var sm = bkkSlotToEpoch_(s, '00:00'), em = bkkSlotToEpoch_(e, '00:00');
  return (sm === null || em === null) ? null : Math.round((em - sm) / 86400000);
}
function fmtThaiDate_(d) {
  var p = String(d || '').split('-').map(Number);
  return p.length !== 3 ? (d || 'ยังไม่กำหนดวัน') : (p[2] + ' ' + (TH_MONTHS_S[p[1] - 1] || '') + ' ' + (p[0] + 543));
}

// --- Data Operations ---
function readAllApts_(includeDeleted) {
  var sh = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SH_APTS, APT_COLS), lr = sh.getLastRow();
  if (lr <= 1) return [];
  return sh.getRange(2, 1, lr - 1, APT_COLS.length).getDisplayValues().reduce(function (arr, r) {
    var o = {}; APT_COLS.forEach(function (c, i) { o[c] = String(r[i] || '').trim(); });
    o.status = normalizeStatus_(o.status);
    o.remindDaysBefore = Number(o.remindDaysBefore || 1); o.remindHoursBefore = Number(o.remindHoursBefore || 1);
    o.rescheduleCount = Number(o.rescheduleCount || 0);
    if (o.id && (includeDeleted || !o.deletedAt)) arr.push(o);
    return arr;
  }, []);
}

function createApt_(inp) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ensureSheet_(ss, SH_APTS, APT_COLS);
  var now = getBkkNow_(), pfx = 'APT-' + now.dateStr.replace(/-/g, '') + '-';
  var max = readAllApts_(true).reduce(function (m, x) { return x.id && x.id.indexOf(pfx) === 0 ? Math.max(m, +x.id.slice(pfx.length) || 0) : m; }, 0);
  var rec = {
    id: pfx + String(max + 1).padStart(3, '0'), title: sanitizeNoEmoji(inp.title), appointmentDate: sanitizeNoEmoji(inp.appointmentDate),
    appointmentTime: sanitizeNoEmoji(inp.appointmentTime), location: sanitizeNoEmoji(inp.location), contactPerson: sanitizeNoEmoji(inp.contactPerson),
    status: normalizeStatus_(inp.status), remindDaysBefore: inp.remindDaysBefore != null ? +inp.remindDaysBefore : 1,
    remindHoursBefore: inp.remindHoursBefore != null ? +inp.remindHoursBefore : 1, notifiedDayForSlot: '', notifiedHourForSlot: '',
    rescheduleCount: 0, notes: sanitizeNoEmoji(inp.notes), updatedBy: sanitizeNoEmoji(inp.updatedBy || 'ผู้ใช้งานระบบ') || 'ผู้ใช้งานระบบ',
    createdAt: now.isoStr, updatedAt: now.isoStr, deletedAt: ''
  };
  validateApt_(rec);
  sh.appendRow(APT_COLS.map(function (c) { return String(rec[c]); }));
  sh.getRange(sh.getLastRow(), 1, 1, APT_COLS.length).setNumberFormat('@');
  return rec;
}

function updateApt_(id, patch, expUpdated, reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ensureSheet_(ss, SH_APTS, APT_COLS), lr = sh.getLastRow();
  if (lr <= 1) throw new Error('ไม่พบนัดหมาย');
  var vals = sh.getRange(2, 1, lr - 1, APT_COLS.length).getDisplayValues(), targetRow = -1, cur = null;
  var delIdx = APT_COLS.indexOf('deletedAt');
  for (var r = vals.length - 1; r >= 0; r--) {
    if (String(vals[r][0]).trim() === String(id).trim() && !String(vals[r][delIdx] || '').trim()) {
      targetRow = r + 2; cur = {}; APT_COLS.forEach(function (c, i) { cur[c] = String(vals[r][i] || '').trim(); });
      break;
    }
  }
  if (!cur) throw new Error('ไม่พบรหัส: ' + id);
  var now = getBkkNow_(), up = {};
  APT_COLS.forEach(function (c) { up[c] = patch[c] !== undefined ? sanitizeNoEmoji(patch[c]) : cur[c]; });
  up.id = cur.id; up.status = normalizeStatus_(up.status); up.createdAt = cur.createdAt; up.updatedAt = now.isoStr;

  var dChg = cur.appointmentDate !== up.appointmentDate, tChg = cur.appointmentTime !== up.appointmentTime;
  var rDChg = String(cur.remindDaysBefore) !== String(up.remindDaysBefore), rHChg = String(cur.remindHoursBefore) !== String(up.remindHoursBefore);
  var reop = (cur.status === STATUS.COMPLETED || cur.status === STATUS.CANCELLED) && up.status === STATUS.CONFIRMED;
  if (dChg || reop || rDChg) { up.notifiedDayForSlot = ''; }
  if (dChg || tChg || reop || rHChg) { up.notifiedHourForSlot = ''; }
  if ((cur.appointmentDate || cur.appointmentTime) && (dChg || tChg)) up.rescheduleCount = String((+cur.rescheduleCount || 0) + 1);

  validateApt_(up);
  var lSh = ensureSheet_(ss, SH_RE_LOGS, RE_LOG_COLS), logs = [];
  ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status'].forEach(function (f, idx) {
    if (String(cur[f] || '') !== String(up[f] || '')) {
      var le = { logId: 'LOG-' + now.epochMs + '-' + (idx + 1), appointmentId: cur.id, changedAt: now.isoStr, changedBy: up.updatedBy, fieldChanged: f, oldValue: cur[f] || '', newValue: up[f] || '', reason: sanitizeNoEmoji(reason || '') };
      logs.push(le); lSh.appendRow(RE_LOG_COLS.map(function (c) { return le[c]; }));
    }
  });
  sh.getRange(targetRow, 1, 1, APT_COLS.length).setNumberFormat('@').setValues([APT_COLS.map(function (c) { return String(up[c]); })]);
  return { appointment: up, logs: logs };
}

function deleteApt_(id, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ensureSheet_(ss, SH_APTS, APT_COLS), lr = sh.getLastRow();
  if (lr <= 1) throw new Error('ไม่พบนัดหมาย');
  var vals = sh.getRange(2, 1, lr - 1, APT_COLS.length).getDisplayValues(), delIdx = APT_COLS.indexOf('deletedAt'), removed = null;
  for (var r = vals.length - 1; r >= 0; r--) {
    var rowId = String(vals[r][0]).trim(), isDel = Boolean(String(vals[r][delIdx] || '').trim());
    if (rowId === String(id).trim() || isDel) {
      if (rowId === String(id).trim() && !removed) {
        removed = {}; APT_COLS.forEach(function (c, i) { removed[c] = String(vals[r][i] || '').trim(); });
      }
      sh.deleteRow(r + 2);
    }
  }
  return removed || { id: id };
}

function validateApt_(r) {
  if (!r.title) throw new Error('กรุณาระบุหัวข้องาน');
  if (!r.appointmentDate || !r.appointmentTime || !r.location || !r.contactPerson) {
    throw new Error('กรุณาระบุวันที่, เวลา, สถานที่ และผู้นัดพบให้ครบถ้วน');
  }
}

function getMetaMap_() {
  var sh = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SH_META, META_COLS), lr = sh.getLastRow();
  if (lr <= 1) return {};
  return sh.getRange(2, 1, lr - 1, 3).getDisplayValues().reduce(function (m, r) { if (r[0]) m[String(r[0]).trim()] = String(r[1] || '').trim(); return m; }, {});
}
function updateMeta_(obj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ensureSheet_(ss, SH_META, META_COLS), lr = sh.getLastRow(), now = getBkkNow_().isoStr;
  var vals = lr > 1 ? sh.getRange(2, 1, lr - 1, 3).getDisplayValues() : [];
  Object.keys(obj || {}).forEach(function (k) {
    var v = sanitizeNoEmoji(obj[k]), found = -1;
    for (var i = 0; i < vals.length; i++) { if (String(vals[i][0]).trim() === k) { found = i + 2; break; } }
    if (found !== -1) sh.getRange(found, 2, 1, 2).setNumberFormat('@').setValues([[v, now]]);
    else sh.appendRow([k, v, now]);
  });
  return getMetaMap_();
}
function readLogs_(name, cols, lim) {
  var sh = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), name, cols), lr = sh.getLastRow();
  if (lr <= 1) return [];
  var st = Math.max(2, lr - (lim || 30) + 1);
  return sh.getRange(st, 1, lr - st + 1, cols.length).getDisplayValues().reverse().map(function (row) {
    var o = {}; cols.forEach(function (c, i) { o[c] = row[i]; }); return o;
  });
}

// --- Notification Engine ---
function runNotificationEngine() {
  return withLock_(function () {
    var now = getBkkNow_(); updateMeta_({ LAST_TRIGGER_RUN_AT: now.isoStr });
    var m = getMetaMap_(), qs = +m.QUIET_HOURS_START || 22, qe = +m.QUIET_HOURS_END || 7, dh = +m.DAILY_DIGEST_HOUR || 8;
    var quiet = qs > qe ? (now.hour >= qs || now.hour < qe) : (now.hour >= qs && now.hour < qe);
    if (quiet) return { sent: false, reason: 'QUIET_HOURS' };

    var apts = readAllApts_(), hourly = [], digest = [], slotUp = [];
    apts.forEach(function (a) {
      if (a.status !== STATUS.CONFIRMED || !a.appointmentDate || !a.appointmentTime) return;
      var ep = bkkSlotToEpoch_(a.appointmentDate, a.appointmentTime);
      if (ep === null || now.epochMs >= ep) return;

      var slot = a.appointmentDate + 'T' + a.appointmentTime, diffH = (ep - now.epochMs) / 3600000;
      var rH = +a.remindHoursBefore || 0, rD = +a.remindDaysBefore || 0;

      if (rH > 0 && a.notifiedHourForSlot !== slot && diffH > 0 && diffH <= rH) {
        hourly.push(a); slotUp.push({ id: a.id, dSlot: a.appointmentDate, hSlot: slot }); return;
      }
      var diffD = diffDays_(now.dateStr, a.appointmentDate);
      if (rD > 0 && a.notifiedDayForSlot !== a.appointmentDate && diffD !== null && diffD >= 0 && diffD <= rD && now.hour >= dh) {
        digest.push(a); slotUp.push({ id: a.id, dSlot: a.appointmentDate, hSlot: a.notifiedHourForSlot || '' });
      }
    });

    if (!hourly.length && !digest.length) return { sent: false, reason: 'NONE_DUE' };
    var qInfo = refreshLineQuotaCache_(), mask = String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE', parts = [];

    if (hourly.length) parts.push('[แจ้งเตือนก่อนเวลานัด] (' + hourly.length + ' รายการ)\n' + hourly.map(function (a, i) { return fmtAptLine_(a, i + 1, mask); }).join('\n'));
    if (digest.length) parts.push('[สรุปคิวงานล่วงหน้าประจำวัน ' + fmtThaiDate_(now.dateStr) + '] (' + digest.length + ' รายการ)\n' + digest.map(function (a, i) { return fmtAptLine_(a, i + 1, mask); }).join('\n'));
    if (qInfo.limit > 0 && qInfo.used / qInfo.limit >= 0.8) parts.push('[เตือนโควตา] ใช้ไปแล้ว ' + qInfo.used + '/' + qInfo.limit);
    if (m.WEB_APP_URL) parts.push('ดูตารางงาน: ' + m.WEB_APP_URL);

    var msg = sanitizeNoEmoji(parts.join('\n\n'));
    if (msg.length > 4500) msg = msg.slice(0, 4420) + '\n...(ดูเพิ่มเติมบนหน้าเว็บแอป)';

    var target = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
    var pushRes = pushLine_(target, msg, Utilities.getUuid(), false, hourly.length ? 'HOURLY' : 'DAILY', slotUp.map(function (u) { return u.id; }).join(','));
    if (pushRes.ok) { applySlotUpdates_(slotUp); refreshLineQuotaCache_(); }
    return { sent: pushRes.ok, httpStatus: pushRes.httpStatus, count: slotUp.length };
  });
}

function applySlotUpdates_(ups) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ensureSheet_(ss, SH_APTS, APT_COLS), lr = sh.getLastRow();
  if (lr <= 1) return;
  var vals = sh.getRange(2, 1, lr - 1, APT_COLS.length).getDisplayValues();
  var dCol = APT_COLS.indexOf('notifiedDayForSlot') + 1, hCol = APT_COLS.indexOf('notifiedHourForSlot') + 1, delIdx = APT_COLS.indexOf('deletedAt');
  ups.forEach(function (u) {
    for (var r = vals.length - 1; r >= 0; r--) {
      if (String(vals[r][0]).trim() === u.id && !String(vals[r][delIdx] || '').trim()) {
        sh.getRange(r + 2, dCol).setValue(u.dSlot); sh.getRange(r + 2, hCol).setValue(u.hSlot); break;
      }
    }
  });
}

function fmtAptLine_(a, idx, mask) {
  var c = sanitizeNoEmoji(a.contactPerson || '-'); if (mask && c.length > 2) c = c.slice(0, 2) + '***';
  return idx + '. [' + a.id + '] ' + sanitizeNoEmoji(a.title) + '\n   วันนัด: ' + fmtThaiDate_(a.appointmentDate) + ' เวลา ' + (a.appointmentTime || '-') + ' น.\n   สถานที่: ' + sanitizeNoEmoji(a.location || '-') + ' | ผู้นัด: ' + c + ' | [' + sanitizeNoEmoji(a.status) + ']';
}

// --- LINE API ---
function pushLine_(target, text, retryKey, isDry, type, aptIds) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '', now = getBkkNow_().isoStr;
  if (!token) return { ok: false, error: 'ไม่มี Token' };
  var url = isDry ? 'https://api.line.me/v2/bot/message/validate/push' : 'https://api.line.me/v2/bot/message/push';
  var payload = isDry ? { messages: [{ type: 'text', text: sanitizeNoEmoji(text) }] } : { to: target, messages: [{ type: 'text', text: sanitizeNoEmoji(text) }] };
  var hdrs = { 'Authorization': 'Bearer ' + token }; if (!isDry && retryKey) hdrs['X-Line-Retry-Key'] = retryKey;

  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: hdrs, payload: JSON.stringify(payload), muteHttpExceptions: true });
  var code = res.getResponseCode(), ok = code >= 200 && code < 300;
  ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SH_NOTIF_LOGS, NOTIF_LOG_COLS).appendRow(['NLOG-' + Date.now(), now, type || 'PUSH', aptIds || '-', target || '-', String(code), retryKey || '-', ok ? '' : res.getContentText()]);
  return { ok: ok, httpStatus: code, error: ok ? null : res.getContentText() };
}

function testNotification_(isDry, custom) {
  var t = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
  return pushLine_(t, custom || '[ทดสอบระบบแจ้งเตือน]\nตรวจสอบรูปแบบสำเร็จ (Zero-Emoji)', Utilities.getUuid(), isDry, isDry ? 'DRY_RUN' : 'MANUAL_TEST', 'TEST');
}

function sendInstantAptNotification_(apt, isUpdate) {
  var target = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
  if (!target || !apt) return { sent: false, reason: 'NO_TARGET' };
  var m = getMetaMap_(), mask = String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
  var c = sanitizeNoEmoji(apt.contactPerson || '-'); if (mask && c.length > 2) c = c.slice(0, 2) + '***';
  
  var hdr = isUpdate ? '[แจ้งเตือนการอัปเดตนัดหมาย]' : '[แจ้งเตือนนัดหมายใหม่]';
  var notifType = isUpdate ? 'INSTANT_UPDATE' : 'INSTANT_CREATE';
  var st = normalizeStatus_(apt.status);
  if (st === STATUS.COMPLETED) {
    hdr = '[แจ้งเตือนสิ้นสุดการนัดหมาย]';
    notifType = 'INSTANT_COMPLETED';
  } else if (st === STATUS.CANCELLED) {
    hdr = '[แจ้งเตือนยกเลิกการนัดหมาย]';
    notifType = 'INSTANT_CANCELLED';
  } else if (isUpdate && apt.reopened) {
    hdr = '[แจ้งเตือนการคืนสถานะนัดหมาย]';
    notifType = 'INSTANT_REOPEN';
  }

  var lines = [
    hdr,
    'รหัส: ' + sanitizeNoEmoji(apt.id || '-'),
    'หัวข้อ: ' + sanitizeNoEmoji(apt.title || '-'),
    'วันนัด: ' + fmtThaiDate_(apt.appointmentDate) + ' เวลา ' + sanitizeNoEmoji(apt.appointmentTime || '-') + ' น.',
    'สถานที่: ' + sanitizeNoEmoji(apt.location || '-'),
    'ผู้นัดพบ: ' + c,
    'สถานะ: [' + sanitizeNoEmoji(apt.status) + ']'
  ];
  if (apt.notes) lines.push('หมายเหตุ: ' + sanitizeNoEmoji(apt.notes));
  if (apt.updatedBy) lines.push('ผู้บันทึก: ' + sanitizeNoEmoji(apt.updatedBy));
  var msg = sanitizeNoEmoji(lines.join('\n'));
  var pushRes = pushLine_(target, msg, Utilities.getUuid(), false, notifType, apt.id);
  if (pushRes.ok) refreshLineQuotaCache_();
  return { sent: pushRes.ok, httpStatus: pushRes.httpStatus, error: pushRes.error };
}

function refreshLineQuotaCache_() {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '', m = getMetaMap_();
  var lim = +m.CACHED_QUOTA_LIMIT || 300, used = +m.CACHED_QUOTA_USED || 0;
  if (!token) return { limit: lim, used: used };
  try {
    var hdrs = { 'Authorization': 'Bearer ' + token };
    var qR = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota', { method: 'get', headers: hdrs, muteHttpExceptions: true });
    var cR = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota/consumption', { method: 'get', headers: hdrs, muteHttpExceptions: true });
    if (qR.getResponseCode() === 200) lim = +JSON.parse(qR.getContentText()).value || lim;
    if (cR.getResponseCode() === 200) used = +JSON.parse(cR.getContentText()).totalUsage || used;
    updateMeta_({ CACHED_QUOTA_LIMIT: String(lim), CACHED_QUOTA_USED: String(used), QUOTA_UPDATED_AT: getBkkNow_().isoStr });
    return { limit: lim, used: used };
  } catch (e) { return { limit: lim, used: used, error: e.message }; }
}

// --- LINE Webhook ---
function handleLineWebhook_(body, qParams) {
  var props = PropertiesService.getScriptProperties(), expKey = props.getProperty('WEBHOOK_SECRET_KEY') || '';
  if (expKey && String(qParams.webhookKey || '') !== expKey) return json_({ ok: false, error: 'INVALID_KEY' });
  var cache = CacheService.getScriptCache();
  var grps = (props.getProperty('ALLOWED_GROUP_IDS') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var usrs = (props.getProperty('ALLOWED_USER_IDS') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  (body.events || []).forEach(function (ev) {
    if (ev.webhookEventId && cache.get('WH_' + ev.webhookEventId)) return;
    if (ev.webhookEventId) cache.put('WH_' + ev.webhookEventId, '1', 600);
    var src = ev.source || {}, gid = src.groupId || src.roomId || '', uid = src.userId || '';

    if (ev.type === 'join') {
      ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SH_NOTIF_LOGS, NOTIF_LOG_COLS).appendRow(['NLOG-' + Date.now(), getBkkNow_().isoStr, 'JOIN', '-', gid || uid, '200', '-', 'พบ ID สำหรับตั้งค่า: ' + (gid || uid)]);
      return;
    }
    if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
    if (grps.length && grps.indexOf(gid) === -1 && (!usrs.length || usrs.indexOf(uid) === -1)) return;

    var reply = parseWebhookCmd_(ev.message.text);
    if (reply && ev.replyToken) {
      UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'post', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') },
        payload: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text: sanitizeNoEmoji(reply) }] }), muteHttpExceptions: true
      });
    }
  });
  return json_({ ok: true });
}

function parseWebhookCmd_(raw) {
  var txt = sanitizeNoEmoji(raw || '').trim();
  if (!/^คิว(?:\s+|ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ|$)/.test(txt)) return null;
  var m = getMetaMap_(); if (String(m.ENABLE_LINE_BOT_QUERY).toUpperCase() === 'FALSE') return '[ระบบปิดค้นหาผ่านแชทชั่วคราว] กรุณาดูบนเว็บแอป';
  var arg = txt.replace(/^คิว\s*/, '').trim(), now = getBkkNow_(), list = readAllApts_(), mask = String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
  var fmt = function (hdr, itms) {
    var o = hdr + '\n' + itms.map(function (a, i) { return fmtAptLine_(a, i + 1, mask); }).join('\n\n');
    return o.length > 4500 ? o.slice(0, 4420) + '\n...(ดูเพิ่มเติมบนเว็บแอป)' : o;
  };

  if (!arg || arg === 'ช่วยเหลือ' || arg.toLowerCase() === 'help') {
    return '[คำสั่งตรวจสอบตารางงาน]\n- คิวทั้งหมด (หรือ คิว ทั้งหมด) : นัดที่กำลังจะมาถึงทั้งหมด\n- คิว วันนี้ : นัดวันนี้\n- คิว พรุ่งนี้ : นัดพรุ่งนี้\n- คิว สัปดาห์นี้ : นัดใน 7 วัน\n- คิว ค้างอยู่ : นัดเลยกำหนด\n- คิว เดือนนี้ : สรุปงานเดือนปัจจุบัน\n- คิว ปีนี้ / คิว ปี YYYY : สรุปสถิติประจำปี\n- คิว ค้นหา <คำค้น> : ค้นหางาน\n- คิว โควตา : เช็คโควตารายเดือน';
  }
  if (arg === 'โควตา') return '[โควตา LINE เดือนนี้] ใช้ไปแล้ว ' + (m.CACHED_QUOTA_USED || '0') + ' / ' + (m.CACHED_QUOTA_LIMIT || '300') + ' ข้อความ';
  if (arg === 'ทั้งหมด' || arg === 'นัดทั้งหมด' || arg === 'งานทั้งหมด') {
    var up = list.filter(function (a) { return a.status === STATUS.CONFIRMED && a.appointmentDate && a.appointmentDate >= now.dateStr; });
    return up.length ? fmt('[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด] (' + up.length + ' รายการ)', up) : '[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด]\nไม่มีรายการนัดหมายที่กำลังจะมาถึง';
  }
  if (arg === 'วันนี้') {
    var td = list.filter(function (a) { return a.appointmentDate === now.dateStr && a.status !== STATUS.CANCELLED; });
    return td.length ? fmt('[คิวงานวันนี้ ' + fmtThaiDate_(now.dateStr) + '] (' + td.length + ' รายการ)', td) : '[คิวงานวันนี้ ' + fmtThaiDate_(now.dateStr) + ']\nไม่มีนัดหมาย';
  }
  if (arg === 'พรุ่งนี้') {
    var tm = getBkkNow_(now.epochMs + 86400000).dateStr, tmi = list.filter(function (a) { return a.appointmentDate === tm && a.status !== STATUS.CANCELLED; });
    return tmi.length ? fmt('[คิวงานพรุ่งนี้ ' + fmtThaiDate_(tm) + '] (' + tmi.length + ' รายการ)', tmi) : '[คิวงานพรุ่งนี้ ' + fmtThaiDate_(tm) + ']\nไม่มีนัดหมาย';
  }
  if (arg === 'สัปดาห์นี้') {
    var wk = list.filter(function (a) {
      if (!a.appointmentDate || a.status === STATUS.CANCELLED) return false;
      var d = diffDays_(now.dateStr, a.appointmentDate);
      return d !== null && d >= 0 && d <= 7;
    });
    return wk.length ? fmt('[คิวงานใน 7 วันข้างหน้า] (' + wk.length + ' รายการ)', wk) : '[คิวงานใน 7 วันข้างหน้า]\nไม่มีนัดหมาย';
  }
  if (arg === 'ค้างอยู่') {
    var ov = list.filter(function (a) {
      if (a.status !== STATUS.CONFIRMED || !a.appointmentDate) return false;
      var ep = bkkSlotToEpoch_(a.appointmentDate, a.appointmentTime || '23:59');
      return ep !== null && now.epochMs > ep;
    });
    return ov.length ? fmt('[คิวงานเลยกำหนดเวลา] (' + ov.length + ' รายการ)', ov) : '[คิวงานเลยกำหนด]\nไม่มีรายการค้าง';
  }
  if (arg === 'เดือนนี้') {
    var pfx = now.year + '-' + pad2_(now.month) + '-', mi = list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(pfx) === 0; });
    return mi.length ? fmt('[งานเดือน' + TH_MONTHS[now.month - 1] + ' ' + (now.year + 543) + '] (' + mi.length + ' รายการ)', mi) : 'ไม่มีนัดหมายเดือนนี้';
  }
  if (arg === 'ปีนี้' || arg === 'ปีหน้า') {
    var ty = arg === 'ปีนี้' ? now.year : now.year + 1, yi = list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(ty + '-') === 0; });
    var comp = yi.filter(function(a){ return a.status === STATUS.COMPLETED; }).length;
    var canc = yi.filter(function(a){ return a.status === STATUS.CANCELLED; }).length;
    var act = yi.filter(function(a){ return a.status === STATUS.CONFIRMED; }).length;
    var rate = yi.length > 0 ? Math.round((comp / yi.length) * 100) : 0;
    var hdr = '[สรุปสถิติประจำปี พ.ศ. ' + (ty + 543) + ']\nรวมทั้งหมด: ' + yi.length + ' งาน | นัดหมายแล้ว: ' + act + ' | สิ้นสุด: ' + comp + ' (' + rate + '%) | ยกเลิก: ' + canc;
    if (!yi.length) return hdr + '\nยังไม่มีนัดหมายในปีนี้';
    return hdr + '\n' + yi.slice(0, 8).map(function (a, i) { return (i + 1) + '. [' + a.appointmentDate + '] ' + a.title + ' (' + a.status + ')'; }).join('\n');
  }
  var sm = arg.match(/^ค้นหา\s+(.+)$/);
  if (sm) {
    var kw = sm[1].trim().toLowerCase(), found = list.filter(function (a) { return (a.id + ' ' + a.title + ' ' + a.location + ' ' + a.contactPerson).toLowerCase().indexOf(kw) !== -1; });
    return found.length ? fmt('[ผลการค้นหา "' + sm[1].trim() + '"] (' + found.length + ' รายการ)', found.slice(0, 15)) : 'ไม่พบงานที่ตรงกัน';
  }
  return '[ไม่พบคำสั่ง] พิมพ์ "คิว ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด';
}