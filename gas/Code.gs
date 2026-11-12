/**
 * Code.gs - Google Apps Script Backend for Calendar & LINE System (v2.5.0)
 * Timezone: Asia/Bangkok (UTC+07:00)
 * Features: User Authentication, User Attribution, Reschedule Audit, LINE Bot & Trigger Automation
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */

var API_VER = '2.5.0';
var SH_USERS = 'Users', SH_APTS = 'Appointments', SH_RE_LOGS = 'RescheduleLogs', SH_NOTIF_LOGS = 'NotificationLogs', SH_META = 'SystemMeta';
var USER_COLS = ['userId', 'username', 'passwordHash', 'displayName', 'role', 'isActive', 'createdAt', 'lastLoginAt'];
var APT_COLS = ['id', 'title', 'appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status', 'remindDaysBefore', 'remindHoursBefore', 'notifiedDayForSlot', 'notifiedHourForSlot', 'rescheduleCount', 'notes', 'createdBy', 'statusChangedBy', 'statusChangedAt', 'statusReason', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt'];
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
  return (s === 'กำลังนัดหมายวันเวลา' || s === 'พบหมายแล้ว' || s === STATUS.CONFIRMED) ? STATUS.CONFIRMED : (s === STATUS.COMPLETED || s === STATUS.CANCELLED ? s : STATUS.CONFIRMED);
}

function hashPassword_(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str || ''), Utilities.Charset.UTF_8), out = '';
  for (var i = 0; i < raw.length; i++) {
    var val = (raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16);
    out += (val.length === 1 ? '0' : '') + val;
  }
  return out;
}

// Request-level cache to eliminate repetitive SpreadsheetApp calls
var _ss = null, _shMap = {}, _metaCache = null;
function getSs_() { return _ss || (_ss = SpreadsheetApp.getActiveSpreadsheet()); }

function formatPlainText_(sh, colCount) {
  var c = Math.max(colCount || 1, 1), r = Math.max(sh.getMaxRows(), 500);
  sh.getRange(1, 1, r, c).setNumberFormat('@');
}

function appendPlainRow_(sh, rowVals, knownLastRow) {
  var nextRow = (knownLastRow != null ? knownLastRow : sh.getLastRow()) + 1;
  sh.getRange(nextRow, 1, 1, rowVals.length).setNumberFormat('@').setValues([rowVals]);
}

function ensureSheet_(ss, name, cols, isSetup) {
  if (_shMap[name]) return _shMap[name];
  var s = ss || getSs_(), sh = s.getSheetByName(name) || s.insertSheet(name);
  if (sh.getLastRow() === 0 && cols) {
    sh.appendRow(cols);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    formatPlainText_(sh, cols.length);
  } else if (isSetup && cols) {
    var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0];
    cols.forEach(function (c) {
      if (headers.indexOf(c) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
    });
    formatPlainText_(sh, Math.max(sh.getLastColumn(), cols.length));
  }

  if (name === SH_USERS && sh.getLastRow() <= 1) {
    var nowIso = getBkkNow_().isoStr;
    [
      ['USR-001', 'admin', hashPassword_('admin'), 'ผู้ดูแลระบบ', 'ADMIN', 'TRUE', nowIso, nowIso],
      ['USR-002', 'somchai', hashPassword_('1234'), 'คุณสมชาย', 'STAFF', 'TRUE', nowIso, ''],
      ['USR-003', 'wipada', hashPassword_('1234'), 'คุณวิภาดา', 'STAFF', 'TRUE', nowIso, ''],
      ['USR-004', 'naphatsorn', hashPassword_('1234'), 'คุณนภัสสร', 'STAFF', 'TRUE', nowIso, '']
    ].forEach(function (r) { sh.appendRow(r); });
    formatPlainText_(sh, USER_COLS.length);
  }
  _shMap[name] = sh;
  return sh;
}

function getSheetData_(name, cols) {
  var sh = ensureSheet_(getSs_(), name, cols), lr = sh.getLastRow();
  if (lr <= 1) return { sh: sh, headers: cols || [], rows: [] };
  var all = sh.getRange(1, 1, lr, sh.getLastColumn()).getDisplayValues();
  return { sh: sh, headers: all[0], rows: all.slice(1) };
}

function setupDatabase() {
  var ss = getSs_();
  [[SH_USERS, USER_COLS], [SH_APTS, APT_COLS], [SH_RE_LOGS, RE_LOG_COLS], [SH_NOTIF_LOGS, NOTIF_LOG_COLS], [SH_META, META_COLS]].forEach(function (p) {
    ensureSheet_(ss, p[0], p[1], true);
  });
  var defs = {
    LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', QUOTA_UPDATED_AT: '',
    DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7',
    ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'TRUE', WEB_APP_URL: ''
  };
  var cur = getMetaMap_(), now = getBkkNow_().isoStr, mSh = ensureSheet_(ss, SH_META, META_COLS, true);
  Object.keys(defs).forEach(function (k) { if (cur[k] === undefined) { mSh.appendRow([k, defs[k], now]); cur[k] = defs[k]; } });
  formatPlainText_(mSh, META_COLS.length);
  return 'ตั้งค่าโครงสร้างชีต Plain Text และบัญชีเริ่มต้นสำเร็จ';
}

// Trigger Management
function removeNotificationTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runNotificationEngine') ScriptApp.deleteTrigger(t);
  });
  try { PropertiesService.getScriptProperties().deleteProperty('ONEOFF_TRIGGERS_JSON'); } catch (_) {}
  return 'ลบ Trigger แจ้งเตือนอัตโนมัติทั้งหมดเรียบร้อย';
}

function getTrigMs_(entry) { return entry && typeof entry === 'object' ? (+entry.ms || 0) : (+entry || 0); }
function getTrigId_(entry) { return entry && typeof entry === 'object' ? String(entry.id || '') : ''; }

function cleanExpiredTriggers_(existingTriggers) {
  try {
    var props = PropertiesService.getScriptProperties(), map = JSON.parse(props.getProperty('ONEOFF_TRIGGERS_JSON') || '{}');
    var nowMs = Date.now(), changed = false, all = existingTriggers || ScriptApp.getProjectTriggers();
    all.forEach(function (t) {
      var uid = t.getUniqueId(), ms = getTrigMs_(map[uid]);
      if (ms && ms <= nowMs) { ScriptApp.deleteTrigger(t); delete map[uid]; changed = true; }
    });
    if (changed) props.setProperty('ONEOFF_TRIGGERS_JSON', JSON.stringify(map));
  } catch (_) {}
}

function installTriggerAuto() {
  removeNotificationTriggers();
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyDays(1).atHour(8).create();
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
    if (!apt || !apt.id) return;
    var props = PropertiesService.getScriptProperties(), map = JSON.parse(props.getProperty('ONEOFF_TRIGGERS_JSON') || '{}');
    var aptUids = Object.keys(map).filter(function (u) { return getTrigId_(map[u]) === apt.id; });
    var ep = (apt.status === STATUS.CONFIRMED && apt.appointmentDate && apt.appointmentTime) ? bkkSlotToEpoch_(apt.appointmentDate, apt.appointmentTime) : null;
    var rH = +apt.remindHoursBefore || 1, remindMs = ep ? ep - (rH * 3600000) : 0, nowMs = getBkkNow_().epochMs;
    var shouldCreate = Boolean(ep && remindMs > nowMs + 180000 && remindMs <= nowMs + (48 * 3600000));

    if (!shouldCreate && !aptUids.length) return;
    if (shouldCreate && aptUids.length === 1 && Math.abs(getTrigMs_(map[aptUids[0]]) - remindMs) < 60000) return;

    var allTriggers = ScriptApp.getProjectTriggers(), changed = false, activeCount = allTriggers.length, slotCovered = false;
    allTriggers.forEach(function (t) {
      var uid = t.getUniqueId(), ms = getTrigMs_(map[uid]), tAptId = getTrigId_(map[uid]);
      if ((ms && ms <= nowMs) || (tAptId && tAptId === apt.id)) {
        ScriptApp.deleteTrigger(t); delete map[uid]; activeCount--; changed = true;
      } else if (shouldCreate && ms && Math.abs(ms - remindMs) < 60000) {
        slotCovered = true;
      }
    });

    if (shouldCreate && !slotCovered) {
      if (activeCount >= 16) {
        for (var i = 0; i < allTriggers.length; i++) {
          var tUid = allTriggers[i].getUniqueId();
          if (map[tUid]) { ScriptApp.deleteTrigger(allTriggers[i]); delete map[tUid]; changed = true; break; }
        }
      }
      var newTrig = ScriptApp.newTrigger('runNotificationEngine').timeBased().at(new Date(remindMs)).create();
      map[newTrig.getUniqueId()] = { ms: remindMs, id: apt.id };
      changed = true;
    }
    if (changed) props.setProperty('ONEOFF_TRIGGERS_JSON', JSON.stringify(map));
  } catch (_) {}
}

function buildSyncBundle_(optUsers) {
  return {
    appointments: readAllApts_(),
    users: optUsers || readPublicUsers_(),
    rescheduleLogs: readLogs_(SH_RE_LOGS, RE_LOG_COLS, 50),
    notificationLogs: readLogs_(SH_NOTIF_LOGS, NOTIF_LOG_COLS, 30),
    meta: getMetaMap_(),
    serverTime: getBkkNow_().isoStr
  };
}

// HTTP Endpoints
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!verifyPasscode_(p.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' });
    if ((p.action || 'list') === 'list') {
      return json_({ ok: true, data: { appointments: readAllApts_(), users: readPublicUsers_(), meta: getMetaMap_(), serverTime: getBkkNow_().isoStr } });
    }
    return json_({ ok: false, error: 'ไม่รองรับ GET action' });
  } catch (err) { return json_({ ok: false, error: err.message || String(err) }); }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}', body = JSON.parse(raw), p = (e && e.parameter) || {};
    if (Array.isArray(body.events)) return handleLineWebhook_(body, p);
    if (!verifyPasscode_(body.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' });

    var a = body.action || '';
    if (a === 'login') return json_({ ok: true, data: handleUserLogin_(body.username, body.password) });
    if (a === 'register') return withLock_(function () { return json_({ ok: true, data: handleUserRegister_(body.payload || body.userPayload || {}) }); });
    if (a === 'listUsers') return json_({ ok: true, data: { users: readPublicUsers_() } });
    if (a === 'saveUser') return withLock_(function () { return json_({ ok: true, data: { user: saveUser_(body.userPayload) } }); });
    if (a === 'deleteUser') return withLock_(function () { return json_({ ok: true, data: { result: deleteUser_(body.userId) } }); });
    if (a === 'list') return json_({ ok: true, data: buildSyncBundle_() });
    if (a === 'create') return withLock_(function () {
      var apt = createApt_(body.payload || {});
      var lineNotification = body.notifyLine !== false ? sendInstantAptNotification_(apt, false) : null;
      scheduleExactReminderForApt_(apt);
      return json_({ ok: true, data: { appointment: apt, lineNotification: lineNotification, meta: getMetaMap_() } });
    });
    if (a === 'update') return withLock_(function () {
      var res = updateApt_(body.id, body.payload || {}, body.expectedUpdatedAt, body.reason, body.currentUser);
      if (body.notifyLine === true && res && res.appointment) {
        res.lineNotification = sendInstantAptNotification_(res.appointment, true);
        res.meta = getMetaMap_();
      }
      if (res && res.appointment && res.needsTriggerSync) scheduleExactReminderForApt_(res.appointment);
      return json_({ ok: true, data: res });
    });
    if (a === 'delete') return withLock_(function () {
      return json_({ ok: true, data: { appointment: deleteApt_(body.id, body.updatedBy) } });
    });
    if (a === 'updateMeta') return withLock_(function () { return json_({ ok: true, data: { meta: updateMeta_(body.meta || {}) } }); });
    if (a === 'setupTriggers') return json_({ ok: true, data: { message: setupNotificationTriggers_(body.mode) } });
    if (a === 'refreshQuota') return json_({ ok: true, data: refreshLineQuotaCache_() });
    if (a === 'testNotification') return json_({ ok: true, data: testNotification_(body.dryRun !== false, body.sampleText) });
    if (a === 'runEngineNow') return json_({ ok: true, data: runNotificationEngine() });
    return json_({ ok: false, error: 'ไม่รู้จัก action: ' + a });
  } catch (err) { return json_({ ok: false, code: err.code || 'SERVER_ERROR', error: err.message || String(err) }); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify({ ok: Boolean(o.ok), version: API_VER, data: o.data || null, code: o.code || null, error: o.error || null })).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  var l = LockService.getScriptLock(); l.waitLock(15000);
  try { return fn(); } finally { l.releaseLock(); }
}

function verifyPasscode_(p) {
  var exp = PropertiesService.getScriptProperties().getProperty('API_PASSCODE') || '';
  return !exp || String(p || '') === exp;
}

// Date & Time Helpers (BKK)
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

// User Operations
function readAllUsersInternal_() {
  var d = getSheetData_(SH_USERS, USER_COLS);
  return d.rows.reduce(function (arr, r, idx) {
    var o = { _rowIndex: idx + 2, _headers: d.headers, _sh: d.sh };
    d.headers.forEach(function (h, i) { o[h] = String(r[i] || '').trim(); });
    if (o.userId && o.username) arr.push(o);
    return arr;
  }, []);
}

function toPublicUser_(u) {
  return {
    userId: u.userId, username: u.username, displayName: sanitizeNoEmoji(u.displayName || u.username),
    role: u.role === 'ADMIN' ? 'ADMIN' : 'STAFF', isActive: String(u.isActive).toUpperCase() !== 'FALSE',
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt
  };
}

function readPublicUsers_() {
  return readAllUsersInternal_().map(toPublicUser_);
}

function handleUserLogin_(username, password) {
  var un = sanitizeNoEmoji(username || '').toLowerCase(), pw = String(password || '');
  if (!un || !pw) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  var users = readAllUsersInternal_(), targetUser = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].username.toLowerCase() === un) { targetUser = users[i]; break; }
  }
  if (!targetUser) throw new Error('ไม่พบบัญชีผู้ใช้งานนี้');
  if (String(targetUser.isActive).toUpperCase() === 'FALSE') throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  if (targetUser.passwordHash !== hashPassword_(pw)) throw new Error('รหัสผ่านไม่ถูกต้อง');

  var nowIso = getBkkNow_().isoStr, colIdx = (targetUser._headers || USER_COLS).indexOf('lastLoginAt') + 1;
  if (colIdx > 0 && targetUser._rowIndex > 1 && targetUser._sh) targetUser._sh.getRange(targetUser._rowIndex, colIdx).setValue(nowIso);
  targetUser.lastLoginAt = nowIso;

  var bundle = buildSyncBundle_(users.map(toPublicUser_));
  bundle.user = { userId: targetUser.userId, username: targetUser.username, displayName: sanitizeNoEmoji(targetUser.displayName || targetUser.username), role: targetUser.role === 'ADMIN' ? 'ADMIN' : 'STAFF' };
  return bundle;
}

function handleUserRegister_(payload) {
  var p = payload || {}, un = sanitizeNoEmoji(p.username || '').toLowerCase(), disp = sanitizeNoEmoji(p.displayName || ''), pw = String(p.password || '');
  var confirmPw = p.confirmPassword !== undefined ? String(p.confirmPassword || '') : pw;
  if (!un || un.length < 3 || un.length > 30 || !/^[a-z0-9_.-]+$/.test(un)) throw new Error('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 3-30 ตัวอักษร');
  if (!disp) throw new Error('กรุณาระบุชื่อ-นามสกุล หรือชื่อเรียกที่ใช้แสดงในระบบ');
  if (!pw || pw.length < 4) throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
  if (pw !== confirmPw) throw new Error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');

  var d = getSheetData_(SH_USERS, USER_COLS), rows = d.rows, headers = d.headers;
  var idIdx = headers.indexOf('userId'), unIdx = headers.indexOf('username'), dispIdx = headers.indexOf('displayName'), maxIdNum = 0;
  for (var i = 0; i < rows.length; i++) {
    var rId = String(rows[i][idIdx] || '').trim(), rUn = String(rows[i][unIdx] || '').trim().toLowerCase(), rDisp = String(rows[i][dispIdx] || '').trim().toLowerCase();
    if (rId.indexOf('USR-') === 0) {
      var num = parseInt(rId.slice(4), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
    if (rUn === un) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
    if (rDisp && rDisp === disp.toLowerCase()) throw new Error('ชื่อที่ใช้แสดงผลนี้มีอยู่ในระบบแล้ว กรุณาระบุชื่อหรือแผนกเพิ่มเติม');
  }

  var nowIso = getBkkNow_().isoStr, newId = 'USR-' + String(maxIdNum + 1).padStart(3, '0');
  var newRow = headers.map(function (h) {
    if (h === 'userId') return newId;
    if (h === 'username') return un;
    if (h === 'passwordHash') return hashPassword_(pw);
    if (h === 'displayName') return disp;
    if (h === 'role') return 'STAFF';
    if (h === 'isActive') return 'TRUE';
    if (h === 'createdAt' || h === 'lastLoginAt') return nowIso;
    return '';
  });
  appendPlainRow_(d.sh, newRow, rows.length + 1);
  var bundle = buildSyncBundle_(readPublicUsers_());
  bundle.user = { userId: newId, username: un, displayName: disp, role: 'STAFF' };
  return bundle;
}

function saveUser_(payload) {
  var p = payload || {}, uid = sanitizeNoEmoji(p.userId || '').trim(), un = sanitizeNoEmoji(p.username || '').toLowerCase();
  var d = getSheetData_(SH_USERS, USER_COLS), rows = d.rows, headers = d.headers;
  var idIdx = headers.indexOf('userId'), unIdx = headers.indexOf('username'), dispIdx = headers.indexOf('displayName'), roleIdx = headers.indexOf('role'), actIdx = headers.indexOf('isActive');
  var foundIdx = -1, foundByUsernameIdx = -1, maxIdNum = 0;

  for (var i = 0; i < rows.length; i++) {
    var rId = String(rows[i][idIdx] || '').trim(), rUn = String(rows[i][unIdx] || '').trim().toLowerCase();
    if (rId.indexOf('USR-') === 0) {
      var num = parseInt(rId.slice(4), 10);
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
    if (uid && rId === uid) foundIdx = i;
    if (un && rUn === un) foundByUsernameIdx = i;
  }

  if (p.isNew && foundByUsernameIdx !== -1) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
  if (foundIdx === -1 && !p.isNew && foundByUsernameIdx !== -1) foundIdx = foundByUsernameIdx;

  var nowIso = getBkkNow_().isoStr;
  if (foundIdx !== -1) {
    var foundRow = foundIdx + 2, curRow = rows[foundIdx];
    var curUserId = String(curRow[idIdx] || '').trim(), curUn = String(curRow[unIdx] || '').trim().toLowerCase();
    var nextDisp = p.displayName !== undefined ? sanitizeNoEmoji(p.displayName) : String(curRow[dispIdx] || curUn).trim();
    if (!nextDisp) throw new Error('กรุณาระบุชื่อที่แสดงผล');
    var nextRole = p.role !== undefined ? (String(p.role).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF') : (String(curRow[roleIdx] || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF');
    var nextActive = p.isActive !== undefined ? (p.isActive !== false && String(p.isActive).toUpperCase() !== 'FALSE' ? 'TRUE' : 'FALSE') : (String(curRow[actIdx]).toUpperCase() !== 'FALSE' ? 'TRUE' : 'FALSE');
    if (curUn === 'admin' && nextActive === 'FALSE') throw new Error('ไม่สามารถระงับบัญชีผู้ดูแลระบบหลัก (admin) ได้');

    var updatedRow = headers.map(function (h, colI) {
      if (h === 'displayName') return nextDisp;
      if (h === 'role') return nextRole;
      if (h === 'isActive') return nextActive;
      if (h === 'passwordHash' && p.password) {
        if (String(p.password).length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
        return hashPassword_(p.password);
      }
      return curRow[colI];
    });
    d.sh.getRange(foundRow, 1, 1, headers.length).setNumberFormat('@').setValues([updatedRow]);
    return { userId: curUserId, username: curUn, displayName: nextDisp, role: nextRole, isActive: nextActive === 'TRUE' };
  } else {
    if (!un || un.length < 3) throw new Error('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
    var disp = sanitizeNoEmoji(p.displayName || un);
    if (!disp) throw new Error('กรุณาระบุชื่อที่แสดงผล');
    if (!p.password || String(p.password).length < 4) throw new Error('กรุณาระบุรหัสผ่านอย่างน้อย 4 ตัวอักษรสำหรับผู้ใช้ใหม่');
    var role = (p.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';
    var isActive = p.isActive !== false && String(p.isActive).toUpperCase() !== 'FALSE' ? 'TRUE' : 'FALSE';
    var newId = 'USR-' + String(maxIdNum + 1).padStart(3, '0');
    var newRow = headers.map(function (h) {
      if (h === 'userId') return newId;
      if (h === 'username') return un;
      if (h === 'passwordHash') return hashPassword_(p.password);
      if (h === 'displayName') return disp;
      if (h === 'role') return role;
      if (h === 'isActive') return isActive;
      if (h === 'createdAt') return nowIso;
      return '';
    });
    appendPlainRow_(d.sh, newRow, rows.length + 1);
    return { userId: newId, username: un, displayName: disp, role: role, isActive: isActive === 'TRUE' };
  }
}

function deleteUser_(userId) {
  var d = getSheetData_(SH_USERS, USER_COLS), uIdx = d.headers.indexOf('userId'), actIdx = d.headers.indexOf('isActive');
  for (var i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][uIdx]).trim() === String(userId).trim()) {
      d.sh.getRange(i + 2, actIdx + 1).setValue('FALSE');
      return { success: true, userId: userId };
    }
  }
  throw new Error('ไม่พบรหัสผู้ใช้: ' + userId);
}

// Data Operations (Appointments & Attribution)
function readAllApts_(includeDeleted) {
  var d = getSheetData_(SH_APTS, APT_COLS);
  if (!d.rows.length) return [];
  var delIdx = d.headers.indexOf('deletedAt');
  return d.rows.reduce(function (arr, r) {
    var o = {};
    d.headers.forEach(function (c, i) { o[c] = String(r[i] || '').trim(); });
    o.status = normalizeStatus_(o.status);
    o.remindDaysBefore = Number(o.remindDaysBefore || 1);
    o.remindHoursBefore = Number(o.remindHoursBefore || 1);
    o.rescheduleCount = Number(o.rescheduleCount || 0);
    o.createdBy = sanitizeNoEmoji(o.createdBy || o.updatedBy || 'ผู้ใช้งานระบบ');
    o.statusChangedBy = sanitizeNoEmoji(o.statusChangedBy || '');
    o.statusChangedAt = sanitizeNoEmoji(o.statusChangedAt || '');
    o.statusReason = sanitizeNoEmoji(o.statusReason || '');
    var isDel = delIdx !== -1 && Boolean(String(r[delIdx] || '').trim());
    if (o.id && (includeDeleted || !isDel)) arr.push(o);
    return arr;
  }, []);
}

function createApt_(inp) {
  var d = getSheetData_(SH_APTS, APT_COLS), now = getBkkNow_(), pfx = 'APT-' + now.dateStr.replace(/-/g, '') + '-';
  var idIdx = Math.max(0, d.headers.indexOf('id'));
  var max = d.rows.reduce(function (m, r) {
    var rid = String(r[idIdx] || '').trim();
    return rid.indexOf(pfx) === 0 ? Math.max(m, +rid.slice(pfx.length) || 0) : m;
  }, 0);
  var creator = sanitizeNoEmoji(inp.createdBy || inp.updatedBy || 'ผู้ใช้งานระบบ') || 'ผู้ใช้งานระบบ';
  var st = normalizeStatus_(inp.status);
  var rec = {
    id: pfx + String(max + 1).padStart(3, '0'),
    title: sanitizeNoEmoji(inp.title), appointmentDate: sanitizeNoEmoji(inp.appointmentDate), appointmentTime: sanitizeNoEmoji(inp.appointmentTime),
    location: sanitizeNoEmoji(inp.location), contactPerson: sanitizeNoEmoji(inp.contactPerson), status: st,
    remindDaysBefore: inp.remindDaysBefore != null ? +inp.remindDaysBefore : 1, remindHoursBefore: inp.remindHoursBefore != null ? +inp.remindHoursBefore : 1,
    notifiedDayForSlot: '', notifiedHourForSlot: '', rescheduleCount: 0, notes: sanitizeNoEmoji(inp.notes), createdBy: creator,
    statusChangedBy: st !== STATUS.CONFIRMED ? (sanitizeNoEmoji(inp.statusChangedBy) || creator) : '', statusChangedAt: st !== STATUS.CONFIRMED ? now.isoStr : '',
    statusReason: sanitizeNoEmoji(inp.statusReason || ''), updatedBy: creator, createdAt: now.isoStr, updatedAt: now.isoStr, deletedAt: ''
  };
  validateApt_(rec);
  var rowVals = d.headers.map(function (c) { return rec[c] !== undefined ? String(rec[c]) : ''; });
  appendPlainRow_(d.sh, rowVals, d.rows.length + 1);
  return rec;
}

function updateApt_(id, patch, expUpdated, reason, currentUser) {
  var d = getSheetData_(SH_APTS, APT_COLS), rows = d.rows, headers = d.headers;
  var delIdx = headers.indexOf('deletedAt'), targetRow = -1, cur = null;
  for (var r = rows.length - 1; r >= 0; r--) {
    var isDel = delIdx !== -1 && Boolean(String(rows[r][delIdx] || '').trim());
    if (String(rows[r][0]).trim() === String(id).trim() && !isDel) {
      targetRow = r + 2; cur = {}; headers.forEach(function (c, i) { cur[c] = String(rows[r][i] || '').trim(); });
      break;
    }
  }
  if (!cur) throw new Error('ไม่พบรหัส: ' + id);
  if (expUpdated && cur.updatedAt && String(expUpdated).trim() !== String(cur.updatedAt).trim()) {
    var err = new Error('ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรชก่อนทำรายการ'); err.code = 'CONCURRENCY_CONFLICT'; throw err;
  }

  var now = getBkkNow_(), up = {};
  headers.forEach(function (c) { up[c] = patch[c] !== undefined ? sanitizeNoEmoji(patch[c]) : cur[c]; });
  up.id = cur.id; up.status = normalizeStatus_(up.status); up.createdAt = cur.createdAt; up.updatedAt = now.isoStr;
  up.createdBy = cur.createdBy || cur.updatedBy || 'ผู้ใช้งานระบบ';
  var actingUser = sanitizeNoEmoji(currentUser || patch.updatedBy || up.createdBy);
  up.updatedBy = actingUser;

  var statusChanged = normalizeStatus_(cur.status) !== normalizeStatus_(up.status);
  if (statusChanged) {
    if (up.status === STATUS.CONFIRMED) { up.statusChangedBy = up.statusChangedAt = up.statusReason = ''; }
    else {
      up.statusChangedBy = sanitizeNoEmoji(patch.statusChangedBy || actingUser);
      up.statusChangedAt = now.isoStr;
      up.statusReason = sanitizeNoEmoji(patch.statusReason || reason || '');
    }
  } else {
    up.statusChangedBy = cur.statusChangedBy || '';
    up.statusChangedAt = cur.statusChangedAt || '';
    up.statusReason = patch.statusReason !== undefined ? sanitizeNoEmoji(patch.statusReason) : (cur.statusReason || '');
  }

  var dChg = cur.appointmentDate !== up.appointmentDate, tChg = cur.appointmentTime !== up.appointmentTime;
  var rDChg = String(cur.remindDaysBefore) !== String(up.remindDaysBefore), rHChg = String(cur.remindHoursBefore) !== String(up.remindHoursBefore);
  var reop = (cur.status === STATUS.COMPLETED || cur.status === STATUS.CANCELLED) && up.status === STATUS.CONFIRMED;
  if (dChg || reop || rDChg) up.notifiedDayForSlot = '';
  if (dChg || tChg || reop || rHChg) up.notifiedHourForSlot = '';
  if ((cur.appointmentDate || cur.appointmentTime) && (dChg || tChg)) up.rescheduleCount = String((+cur.rescheduleCount || 0) + 1);

  validateApt_(up);
  var logs = [];
  ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status'].forEach(function (f, idx) {
    if (String(cur[f] || '') !== String(up[f] || '')) {
      logs.push({ logId: 'LOG-' + now.epochMs + '-' + (idx + 1), appointmentId: cur.id, changedAt: now.isoStr, changedBy: up.updatedBy, fieldChanged: f, oldValue: cur[f] || '', newValue: up[f] || '', reason: sanitizeNoEmoji(reason || up.statusReason || '') });
    }
  });

  if (logs.length) {
    var lSh = ensureSheet_(getSs_(), SH_RE_LOGS, RE_LOG_COLS);
    var logRows = logs.map(function (le) { return RE_LOG_COLS.map(function (c) { return le[c]; }); });
    lSh.getRange(lSh.getLastRow() + 1, 1, logRows.length, RE_LOG_COLS.length).setNumberFormat('@').setValues(logRows);
  }

  var updatedVals = headers.map(function (c) { return String(up[c] !== undefined ? up[c] : ''); });
  d.sh.getRange(targetRow, 1, 1, headers.length).setNumberFormat('@').setValues([updatedVals]);
  return { appointment: up, logs: logs, needsTriggerSync: Boolean(dChg || tChg || rHChg || statusChanged) };
}

function deleteApt_(id, user) {
  var d = getSheetData_(SH_APTS, APT_COLS), rows = d.rows, headers = d.headers;
  var delIdx = headers.indexOf('deletedAt'), removed = null, now = getBkkNow_();
  for (var r = rows.length - 1; r >= 0; r--) {
    var rowId = String(rows[r][0]).trim(), isDel = delIdx !== -1 && Boolean(String(rows[r][delIdx] || '').trim());
    if (rowId === String(id).trim() || isDel) {
      if (rowId === String(id).trim() && !removed) {
        removed = {}; headers.forEach(function (c, i) { removed[c] = String(rows[r][i] || '').trim(); });
        var lSh = ensureSheet_(getSs_(), SH_RE_LOGS, RE_LOG_COLS);
        var le = { logId: 'LOG-' + now.epochMs + '-DEL', appointmentId: id, changedAt: now.isoStr, changedBy: sanitizeNoEmoji(user || 'ผู้ใช้งานระบบ'), fieldChanged: 'DELETED', oldValue: removed.title || '-', newValue: 'ลบนัดหมาย', reason: 'ลบออกจากระบบ' };
        appendPlainRow_(lSh, RE_LOG_COLS.map(function (c) { return le[c]; }));
      }
      d.sh.deleteRow(r + 2);
    }
  }
  return removed || { id: id };
}

function validateApt_(r) {
  if (!r.title) throw new Error('กรุณาระบุหัวข้องาน');
  if (!r.appointmentDate || !r.appointmentTime || !r.location || !r.contactPerson) throw new Error('กรุณาระบุวันที่, เวลา, สถานที่ และผู้นัดพบให้ครบถ้วน');
}

function getMetaMap_() {
  if (_metaCache) return _metaCache;
  var d = getSheetData_(SH_META, META_COLS);
  _metaCache = d.rows.reduce(function (m, r) { if (r[0]) m[String(r[0]).trim()] = String(r[1] || '').trim(); return m; }, {});
  return _metaCache;
}

function updateMeta_(obj) {
  var d = getSheetData_(SH_META, META_COLS), now = getBkkNow_().isoStr, m = getMetaMap_(), keyMap = {};
  for (var i = 0; i < d.rows.length; i++) {
    var k = String(d.rows[i][0]).trim();
    if (k) keyMap[k] = i + 2;
  }
  var nextRow = d.rows.length + 1;
  Object.keys(obj || {}).forEach(function (k) {
    var v = sanitizeNoEmoji(obj[k]);
    m[k] = v;
    if (keyMap[k]) d.sh.getRange(keyMap[k], 2, 1, 2).setNumberFormat('@').setValues([[v, now]]);
    else { appendPlainRow_(d.sh, [k, v, now], nextRow); keyMap[k] = ++nextRow; }
  });
  return m;
}

function readLogs_(name, cols, lim) {
  var d = getSheetData_(name, cols);
  if (!d.rows.length) return [];
  var slice = d.rows.slice(Math.max(0, d.rows.length - (lim || 30))).reverse();
  return slice.map(function (row) {
    var o = {}; d.headers.forEach(function (c, i) { o[c] = row[i]; }); return o;
  });
}

// Notification Engine
function runNotificationEngine() {
  return withLock_(function () {
    cleanExpiredTriggers_();
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
  var d = getSheetData_(SH_APTS, APT_COLS);
  if (!d.rows.length) return;
  var dCol = d.headers.indexOf('notifiedDayForSlot') + 1, hCol = d.headers.indexOf('notifiedHourForSlot') + 1, delIdx = d.headers.indexOf('deletedAt');
  ups.forEach(function (u) {
    for (var r = d.rows.length - 1; r >= 0; r--) {
      var isDel = delIdx !== -1 && Boolean(String(d.rows[r][delIdx] || '').trim());
      if (String(d.rows[r][0]).trim() === u.id && !isDel) {
        if (dCol > 0) d.sh.getRange(r + 2, dCol).setValue(u.dSlot);
        if (hCol > 0) d.sh.getRange(r + 2, hCol).setValue(u.hSlot);
        break;
      }
    }
  });
}

function fmtAptLine_(a, idx, mask) {
  var c = sanitizeNoEmoji(a.contactPerson || '-'); if (mask && c.length > 2) c = c.slice(0, 2) + '***';
  var creator = sanitizeNoEmoji(a.createdBy || a.updatedBy || '-');
  var lines = [
    idx + '. [' + a.id + '] ' + sanitizeNoEmoji(a.title),
    '   วันนัด: ' + fmtThaiDate_(a.appointmentDate) + ' เวลา ' + (a.appointmentTime || '-') + ' น.',
    '   สถานที่: ' + sanitizeNoEmoji(a.location || '-') + ' | ผู้นัด: ' + c + ' | [' + sanitizeNoEmoji(a.status) + ']',
    '   ผู้สร้าง: ' + creator
  ];
  if (a.statusChangedBy && normalizeStatus_(a.status) !== STATUS.CONFIRMED) lines.push('   ผู้ดำเนินการ: ' + sanitizeNoEmoji(a.statusChangedBy));
  return lines.join('\n');
}

// LINE API & Webhook
function pushLine_(target, msg, retryKey, isDry, type, aptIds) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '', now = getBkkNow_().isoStr;
  if (!token) return { ok: false, error: 'ไม่มี Token' };
  var url = isDry ? 'https://api.line.me/v2/bot/message/validate/push' : 'https://api.line.me/v2/bot/message/push';
  var msgObj = (typeof msg === 'object' && msg !== null) ? msg : { type: 'text', text: sanitizeNoEmoji(msg) };
  var payload = isDry ? { messages: [msgObj] } : { to: target, messages: [msgObj] };
  var hdrs = { 'Authorization': 'Bearer ' + token }; if (!isDry && retryKey) hdrs['X-Line-Retry-Key'] = retryKey;

  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: hdrs, payload: JSON.stringify(payload), muteHttpExceptions: true });
  var code = res.getResponseCode(), ok = code >= 200 && code < 300;
  appendPlainRow_(ensureSheet_(getSs_(), SH_NOTIF_LOGS, NOTIF_LOG_COLS), ['NLOG-' + Date.now(), now, type || 'PUSH', aptIds || '-', target || '-', String(code), retryKey || '-', ok ? '' : res.getContentText()]);
  return { ok: ok, httpStatus: code, error: ok ? null : res.getContentText() };
}

function sendLineReply_(replyToken, msg, props) {
  var token = (props || PropertiesService.getScriptProperties()).getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
  if (!token || !replyToken) return;
  var msgObj = (typeof msg === 'object' && msg !== null) ? msg : { type: 'text', text: sanitizeNoEmoji(msg) };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json', headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [msgObj] }), muteHttpExceptions: true
  });
}

function getLineUserName_(gid, uid, token) {
  if (!token || !uid) return 'สมาชิก LINE';
  try {
    var url = gid ? ('https://api.line.me/v2/bot/group/' + gid + '/member/' + uid) : ('https://api.line.me/v2/bot/profile/' + uid);
    var res = UrlFetchApp.fetch(url, { headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText());
      if (data && data.displayName) return sanitizeNoEmoji(data.displayName);
    }
  } catch (_) {}
  return 'สมาชิก LINE';
}

function parseQueryString_(qs) {
  var obj = {}, pairs = String(qs || '').split('&');
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i].split('=');
    if (p.length === 2) obj[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
  }
  return obj;
}

function buildAptFlexMsg_(apt, isUpdate, maskContact, webAppUrl) {
  var c = sanitizeNoEmoji(apt.contactPerson || '-');
  if (maskContact && c.length > 2) c = c.slice(0, 2) + '***';
  var creator = sanitizeNoEmoji(apt.createdBy || apt.updatedBy || 'ผู้ใช้งานระบบ');
  var st = normalizeStatus_(apt.status);

  var hdrText = isUpdate ? '[แจ้งเตือนการอัปเดตนัดหมาย]' : '[แจ้งเตือนนัดหมายใหม่]';
  var stColor = '#4f46e5';
  if (st === STATUS.COMPLETED) { hdrText = '[แจ้งเตือนสิ้นสุดการนัดหมาย]'; stColor = '#10b981'; }
  else if (st === STATUS.CANCELLED) { hdrText = '[แจ้งเตือนยกเลิกการนัดหมาย]'; stColor = '#ef4444'; }
  else if (isUpdate && apt.reopened) { hdrText = '[แจ้งเตือนการคืนสถานะนัดหมาย]'; stColor = '#4f46e5'; }

  var infoRows = [
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'วันนัด', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: fmtThaiDate_(apt.appointmentDate), size: 'sm', flex: 5, weight: 'bold', color: '#1e293b' }
    ]},
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'เวลา', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: (apt.appointmentTime || '-') + ' น.', size: 'sm', flex: 5, weight: 'bold', color: '#1e293b' }
    ]},
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'สถานที่', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: sanitizeNoEmoji(apt.location || '-'), size: 'sm', flex: 5, wrap: true, color: '#334155' }
    ]},
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'ผู้นัดพบ', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: c, size: 'sm', flex: 5, wrap: true, color: '#334155' }
    ]},
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'สถานะ', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: '[' + st + ']', size: 'sm', flex: 5, weight: 'bold', color: stColor }
    ]},
    { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: 'ผู้สร้าง', color: '#64748b', size: 'sm', flex: 2 },
      { type: 'text', text: creator, size: 'sm', flex: 5, color: '#64748b' }
    ]}
  ];

  if (st === STATUS.COMPLETED && apt.statusChangedBy) {
    infoRows.push({
      type: 'box', layout: 'baseline', spacing: 'sm', contents: [
        { type: 'text', text: 'ผู้เสร็จสิ้น', color: '#64748b', size: 'sm', flex: 2 },
        { type: 'text', text: sanitizeNoEmoji(apt.statusChangedBy), size: 'sm', flex: 5, weight: 'bold', color: '#10b981' }
      ]
    });
  } else if (st === STATUS.CANCELLED) {
    if (apt.statusChangedBy) {
      infoRows.push({
        type: 'box', layout: 'baseline', spacing: 'sm', contents: [
          { type: 'text', text: 'ผู้ยกเลิก', color: '#64748b', size: 'sm', flex: 2 },
          { type: 'text', text: sanitizeNoEmoji(apt.statusChangedBy), size: 'sm', flex: 5, weight: 'bold', color: '#ef4444' }
        ]
      });
    }
    if (apt.statusReason) {
      infoRows.push({
        type: 'box', layout: 'baseline', spacing: 'sm', contents: [
          { type: 'text', text: 'สาเหตุ', color: '#64748b', size: 'sm', flex: 2 },
          { type: 'text', text: sanitizeNoEmoji(apt.statusReason), size: 'sm', flex: 5, wrap: true, color: '#ef4444' }
        ]
      });
    }
  } else if (isUpdate && apt.updatedBy && apt.updatedBy !== creator) {
    infoRows.push({
      type: 'box', layout: 'baseline', spacing: 'sm', contents: [
        { type: 'text', text: 'ผู้แก้ไข', color: '#64748b', size: 'sm', flex: 2 },
        { type: 'text', text: sanitizeNoEmoji(apt.updatedBy), size: 'sm', flex: 5, color: '#64748b' }
      ]
    });
  }

  if (apt.notes) {
    infoRows.push({
      type: 'box', layout: 'baseline', spacing: 'sm', contents: [
        { type: 'text', text: 'หมายเหตุ', color: '#64748b', size: 'sm', flex: 2 },
        { type: 'text', text: sanitizeNoEmoji(apt.notes), size: 'sm', flex: 5, wrap: true, color: '#475569' }
      ]
    });
  }

  var bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingBottom: 'none',
      contents: [
        { type: 'text', text: hdrText, weight: 'bold', color: stColor, size: 'sm' },
        { type: 'text', text: sanitizeNoEmoji(apt.id || '-'), size: 'xs', color: '#64748b', margin: 'xs' }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: sanitizeNoEmoji(apt.title || '-'), weight: 'bold', size: 'md', wrap: true, color: '#0f172a' },
        { type: 'separator', color: '#e2e8f0' },
        { type: 'box', layout: 'vertical', spacing: 'sm', contents: infoRows }
      ]
    }
  };

  if (st === STATUS.CONFIRMED) {
    bubble.footer = {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      paddingTop: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#10b981',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'เสร็จสิ้น',
            data: 'action=quickComplete&id=' + encodeURIComponent(apt.id),
            displayText: 'บันทึกเสร็จสิ้น [' + apt.id + ']'
          }
        },
        {
          type: 'button',
          style: 'secondary',
          color: '#ef4444',
          height: 'sm',
          action: {
            type: 'postback',
            label: 'ยกเลิก',
            data: 'action=quickCancel&id=' + encodeURIComponent(apt.id),
            displayText: 'ขอยกเลิกนัดหมาย [' + apt.id + ']'
          }
        }
      ]
    };
  }

  var altText = hdrText + ' [' + (apt.id || '') + '] ' + sanitizeNoEmoji(apt.title || '');
  return {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: bubble
  };
}

function testNotification_(isDry, custom) {
  var t = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
  if (custom) {
    return pushLine_(t, custom, Utilities.getUuid(), isDry, isDry ? 'DRY_RUN' : 'MANUAL_TEST', 'TEST');
  }
  var sampleApt = {
    id: 'APT-TEST-001',
    title: 'ทดสอบระบบแจ้งเตือนแบบโต้ตอบ (Zero-Emoji)',
    appointmentDate: getBkkNow_().dateStr,
    appointmentTime: '14:00',
    location: 'ห้องประชุมใหญ่ ชั้น 5',
    contactPerson: 'คุณทดสอบ',
    status: STATUS.CONFIRMED,
    createdBy: 'ผู้ดูแลระบบ',
    notes: 'ทดสอบปุ่มเสร็จสิ้นและยกเลิกบน LINE Flex Message'
  };
  var flex = buildAptFlexMsg_(sampleApt, false, false, '');
  return pushLine_(t, flex, Utilities.getUuid(), isDry, isDry ? 'DRY_RUN' : 'MANUAL_TEST', 'TEST');
}

function sendInstantAptNotification_(apt, isUpdate) {
  var target = PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
  if (!target || !apt) return { sent: false, reason: 'NO_TARGET' };
  var m = getMetaMap_(), mask = String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';

  var notifType = isUpdate ? 'INSTANT_UPDATE' : 'INSTANT_CREATE';
  var st = normalizeStatus_(apt.status);
  if (st === STATUS.COMPLETED) notifType = 'INSTANT_COMPLETED';
  else if (st === STATUS.CANCELLED) notifType = 'INSTANT_CANCELLED';
  else if (isUpdate && apt.reopened) notifType = 'INSTANT_REOPEN';

  var flexMsg = buildAptFlexMsg_(apt, isUpdate, mask, m.WEB_APP_URL || '');
  var pushRes = pushLine_(target, flexMsg, Utilities.getUuid(), false, notifType, apt.id);
  if (pushRes.ok) {
    var curUsed = +m.CACHED_QUOTA_USED || 0;
    updateMeta_({ CACHED_QUOTA_USED: String(curUsed + 1) });
  }
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

function handleLinePostback_(ev, gid, uid, props) {
  var pbData = parseQueryString_((ev && ev.postback && ev.postback.data) || '');
  var action = pbData.action || '', id = pbData.id || '';
  if (!id) return '[ข้อผิดพลาด] ไม่พบรหัสนัดหมาย';

  return withLock_(function () {
    var apts = readAllApts_(false), targetApt = null;
    for (var i = 0; i < apts.length; i++) {
      if (apts[i].id === id) { targetApt = apts[i]; break; }
    }
    if (!targetApt) return '[แจ้งเตือน] ไม่พบรายการนัดหมาย ' + id + ' ในระบบ (อาจถูกลบไปแล้ว)';

    var curSt = normalizeStatus_(targetApt.status);
    if (curSt === STATUS.COMPLETED) {
      return '[แจ้งเตือน] นัดหมาย [' + id + '] นี้ได้ถูกบันทึกเสร็จสิ้นไปแล้วโดย ' + (targetApt.statusChangedBy || 'ผู้ใช้งาน') + (targetApt.statusChangedAt ? ' เมื่อ ' + fmtThaiDate_(targetApt.statusChangedAt.slice(0, 10)) : '');
    }
    if (curSt === STATUS.CANCELLED) {
      return '[แจ้งเตือน] นัดหมาย [' + id + '] นี้ได้ถูกยกเลิกไปแล้วโดย ' + (targetApt.statusChangedBy || 'ผู้ใช้งาน') + (targetApt.statusReason ? ' (' + targetApt.statusReason + ')' : '');
    }

    var token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
    var actingUser = getLineUserName_(gid, uid, token);

    if (action === 'quickComplete') {
      updateApt_(id, {
        status: STATUS.COMPLETED,
        statusChangedBy: actingUser,
        statusReason: 'เสร็จสิ้นการนัดหมายผ่าน LINE',
        updatedBy: actingUser
      }, targetApt.updatedAt, 'เสร็จสิ้นผ่าน LINE', actingUser);

      return '[บันทึกเสร็จสิ้นนัดหมายเรียบร้อย]\n' +
        'รหัส: ' + id + '\n' +
        'หัวข้อ: ' + sanitizeNoEmoji(targetApt.title) + '\n' +
        'สถานะ: [' + STATUS.COMPLETED + ']\n' +
        'ผู้ดำเนินการ: ' + actingUser + '\n' +
        'เวลา: ' + getBkkNow_().timeStr + ' น.';
    }

    if (action === 'quickCancel') {
      var cancelReason = 'ยกเลิกผ่าน LINE โดย ' + actingUser;
      updateApt_(id, {
        status: STATUS.CANCELLED,
        statusChangedBy: actingUser,
        statusReason: cancelReason,
        updatedBy: actingUser
      }, targetApt.updatedAt, cancelReason, actingUser);

      return '[บันทึกยกเลิกนัดหมายเรียบร้อย]\n' +
        'รหัส: ' + id + '\n' +
        'หัวข้อ: ' + sanitizeNoEmoji(targetApt.title) + '\n' +
        'สถานะ: [' + STATUS.CANCELLED + ']\n' +
        'ผู้ยกเลิก: ' + actingUser + '\n' +
        'สาเหตุ: ' + cancelReason + '\n' +
        'เวลา: ' + getBkkNow_().timeStr + ' น.';
    }

    return null;
  });
}

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
      appendPlainRow_(ensureSheet_(getSs_(), SH_NOTIF_LOGS, NOTIF_LOG_COLS), ['NLOG-' + Date.now(), getBkkNow_().isoStr, 'JOIN', '-', gid || uid, '200', '-', 'พบ ID สำหรับตั้งค่า: ' + (gid || uid)]);
      return;
    }

    if (ev.type === 'postback') {
      if (grps.length && grps.indexOf(gid) === -1 && (!usrs.length || usrs.indexOf(uid) === -1)) return;
      var pbReply = handleLinePostback_(ev, gid, uid, props);
      if (pbReply && ev.replyToken) {
        sendLineReply_(ev.replyToken, pbReply, props);
      }
      return;
    }

    if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
    if (grps.length && grps.indexOf(gid) === -1 && (!usrs.length || usrs.indexOf(uid) === -1)) return;

    var reply = parseWebhookCmd_(ev.message.text);
    if (reply && ev.replyToken) {
      sendLineReply_(ev.replyToken, reply, props);
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
    return '[คำสั่งตรวจสอบตารางงาน]\n- คิวทั้งหมด (หรือ คิว ทั้งหมด) : นัดที่กำลังจะมาถึงทั้งหมด\n- คิว วันนี้ : นัดวันนี้\n- คิว พรุ่งนี้ : นัดพรุ่งนี้\n- คิว สัปดาห์นี้ : นัดใน 7 วัน\n- คิว ค้างอยู่ : นัดเลยกำหนด\n- คิว เดือนนี้ : สรุปงานเดือนปัจจุบัน\n- คิว เดือน MM/YYYY : เช่น คิว เดือน 12/2569\n- คิว ปีนี้ / คิว ปี YYYY : สรุปสถิติประจำปี\n- คิว ค้นหา <คำค้น> : ค้นหางาน\n- คิว โควตา : เช็คโควตารายเดือน';
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
    var wk = list.filter(function (a) { return a.appointmentDate && a.status !== STATUS.CANCELLED && [diffDays_(now.dateStr, a.appointmentDate)].some(function (d) { return d !== null && d >= 0 && d <= 7; }); });
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
  var mm = arg.match(/^เดือน\s+(\d{1,2})[-/](\d{4})$/);
  if (mm) {
    var yr = +mm[2], mo = +mm[1];
    if (yr > 2400) yr -= 543;
    if (mo >= 1 && mo <= 12) {
      var mpfx = yr + '-' + pad2_(mo) + '-', mlist = list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(mpfx) === 0; });
      return mlist.length ? fmt('[งานเดือน' + (TH_MONTHS[mo - 1] || mo) + ' ' + (yr + 543) + '] (' + mlist.length + ' รายการ)', mlist) : 'ไม่มีนัดหมายในเดือนที่เลือก';
    }
    return '[ข้อผิดพลาด] รูปแบบเดือนไม่ถูกต้อง เช่น คิว เดือน 12/2569';
  }
  if (arg === 'ปีนี้' || arg === 'ปีหน้า') {
    var ty = arg === 'ปีนี้' ? now.year : now.year + 1, yi = list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(ty + '-') === 0; });
    var comp = yi.filter(function(a){ return a.status === STATUS.COMPLETED; }).length;
    var canc = yi.filter(function(a){ return a.status === STATUS.CANCELLED; }).length;
    var act = yi.filter(function(a){ return a.status === STATUS.CONFIRMED; }).length;
    var rate = yi.length > 0 ? Math.round((comp / yi.length) * 100) : 0;
    var hdr = '[สรุปสถิติประจำปี พ.ศ. ' + (ty + 543) + ']\nรวมทั้งหมด: ' + yi.length + ' งาน | นัดหมายแล้ว: ' + act + ' | สิ้นสุด: ' + comp + ' (' + rate + '%) | ยกเลิก: ' + canc;
    if (!yi.length) return hdr + '\nยังไม่มีนัดหมายในปีนี้';
    return hdr + '\n' + yi.slice(0, 8).map(function (a, i) { return (i + 1) + '. [' + a.appointmentDate + '] ' + a.title + ' (' + a.status + ') - สร้างโดย: ' + (a.createdBy || a.updatedBy || '-'); }).join('\n');
  }
  var sm = arg.match(/^ค้นหา\s+(.+)$/);
  if (sm) {
    var kw = sm[1].trim().toLowerCase(), found = list.filter(function (a) { return (a.id + ' ' + a.title + ' ' + a.location + ' ' + a.contactPerson + ' ' + (a.createdBy || '') + ' ' + (a.statusChangedBy || '')).toLowerCase().indexOf(kw) !== -1; });
    return found.length ? fmt('[ผลการค้นหา "' + sm[1].trim() + '"] (' + found.length + ' รายการ)', found.slice(0, 15)) : 'ไม่พบงานที่ตรงกัน';
  }
  return '[ไม่พบคำสั่ง] พิมพ์ "คิว ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด';
}
