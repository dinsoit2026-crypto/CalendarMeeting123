/**
 * Code.gs - Google Apps Script Backend for Calendar & LINE System (v2.6.7)
 * Zero-Emoji Policy | Request-Level Sheet & Props Cache | Short-Lock I/O | Lazy Webhook Read
 */
var API_VER = '2.6.7';
var SH_USERS = 'Users', SH_APTS = 'Appointments', SH_RE_LOGS = 'RescheduleLogs', SH_NOTIF_LOGS = 'NotificationLogs', SH_META = 'SystemMeta';
var USER_COLS = ['userId', 'username', 'passwordHash', 'displayName', 'role', 'isActive', 'createdAt', 'lastLoginAt'];
var APT_COLS = ['id', 'title', 'appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status', 'remindDaysBefore', 'remindHoursBefore', 'notifiedDayForSlot', 'notifiedHourForSlot', 'rescheduleCount', 'notes', 'createdBy', 'statusChangedBy', 'statusChangedAt', 'statusReason', 'updatedBy', 'createdAt', 'updatedAt', 'deletedAt', 'mapUrl', 'imageUrl'];
var RE_LOG_COLS = ['logId', 'appointmentId', 'changedAt', 'changedBy', 'fieldChanged', 'oldValue', 'newValue', 'reason'];
var NOTIF_LOG_COLS = ['logId', 'sentAt', 'triggerType', 'appointmentIds', 'targetId', 'httpStatus', 'retryKey', 'errorMessage'];
var META_COLS = ['key', 'value', 'updatedAt']; var STATUS = { CONFIRMED: 'เริ่มนัด', COMPLETED: 'สิ้นสุดการนัดหมาย', CANCELLED: 'ยกเลิกการนัดหมาย' };
var TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var EMOJI_EXT_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic}(?:\uFE0F|\u200D(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic})*)/gu;
var EMOJI_MOD_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;
function sanitizeNoEmoji(s) { return s == null ? '' : String(s).replace(EMOJI_EXT_RE, '').replace(EMOJI_MOD_RE, '').replace(/[ \t]{2,}/g, ' ').trim(); }
function normalizeStatus_(st) { var s = sanitizeNoEmoji(st || STATUS.CONFIRMED); return (s === STATUS.COMPLETED || s === STATUS.CANCELLED) ? s : STATUS.CONFIRMED; }
function cmpSlot_(x, y) { var sx = (x.appointmentDate || '') + 'T' + (x.appointmentTime || ''), sy = (y.appointmentDate || '') + 'T' + (y.appointmentTime || ''); return sx < sy ? -1 : (sx > sy ? 1 : 0); }
function hashPassword_(str) { var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str || ''), Utilities.Charset.UTF_8), out = '';
  for (var i = 0; i < raw.length; i++) out += ((raw[i] < 0 ? raw[i] + 256 : raw[i]).toString(16)).padStart(2, '0'); return out; }
// Request-Level Caches (Spreadsheet, Sheet handles, Sheet data, SystemMeta, ScriptProperties)
var _ss = null, _shMap = {}, _metaCache = null, _dataCache = {}, _propsCache = null;
function getSs_() { return _ss || (_ss = SpreadsheetApp.getActiveSpreadsheet()); }
function getProps_() { return _propsCache || (_propsCache = PropertiesService.getScriptProperties().getProperties() || {}); }
function getProp_(k) { return String(getProps_()[k] || ''); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); if (_propsCache) _propsCache[k] = v; }
function delProp_(k) { PropertiesService.getScriptProperties().deleteProperty(k); if (_propsCache) delete _propsCache[k]; }
function invalidateSheetCache_(name) { if (name) delete _dataCache[name]; else _dataCache = {}; }
function formatPlainText_(sh, colCount) { sh.getRange(1, 1, Math.max(sh.getMaxRows(), 500), Math.max(colCount || 1, 1)).setNumberFormat('@'); }
function appendPlainRow_(sh, rowVals, knownLastRow) { var nextRow = (knownLastRow != null ? knownLastRow : sh.getLastRow()) + 1;
  sh.getRange(nextRow, 1, 1, rowVals.length).setNumberFormat('@').setValues([rowVals]); invalidateSheetCache_(sh.getName()); }
function ensureSheet_(ss, name, cols, isSetup) { if (_shMap[name]) return _shMap[name];
  var s = ss || getSs_(), sh = s.getSheetByName(name) || s.insertSheet(name); if (sh.getLastRow() === 0 && cols) {
    sh.appendRow(cols); sh.getRange(1, 1, 1, cols.length).setFontWeight('bold'); sh.setFrozenRows(1); formatPlainText_(sh, cols.length);
  } else if (isSetup && cols) { var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0];
    cols.forEach(function (c) { if (headers.indexOf(c) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold'); });
    formatPlainText_(sh, Math.max(sh.getLastColumn(), cols.length)); }
  if (name === SH_USERS && sh.getLastRow() <= 1) { var nowIso = getBkkNow_().isoStr, defPw = hashPassword_('1234');
    [['USR-001', 'admin', hashPassword_('admin'), 'ผู้ดูแลระบบ', 'ADMIN', 'TRUE', nowIso, nowIso], ['USR-002', 'somchai', defPw, 'คุณสมชาย', 'STAFF', 'TRUE', nowIso, ''], ['USR-003', 'wipada', defPw, 'คุณวิภาดา', 'STAFF', 'TRUE', nowIso, ''], ['USR-004', 'naphatsorn', defPw, 'คุณนภัสสร', 'STAFF', 'TRUE', nowIso, '']].forEach(function (r) { sh.appendRow(r); });
    formatPlainText_(sh, USER_COLS.length); }
  return (_shMap[name] = sh); }
function getSheetData_(name, cols) { if (_dataCache[name]) return _dataCache[name]; var sh = ensureSheet_(getSs_(), name, cols), lr = sh.getLastRow();
  if (lr <= 1) return (_dataCache[name] = { sh: sh, headers: cols || [], rows: [] });
  var lc = Math.max(sh.getLastColumn(), 1), all = sh.getRange(1, 1, lr, lc).getDisplayValues(), hdrs = all[0], added = false;
  if (cols) cols.forEach(function (c) {
    if (hdrs.indexOf(c) === -1) { hdrs.push(c); added = true; sh.getRange(1, hdrs.length).setNumberFormat('@').setValue(c).setFontWeight('bold'); }
  }); if (added) for (var ri = 1, diff = hdrs.length - lc; ri < all.length; ri++) for (var k = 0; k < diff; k++) all[ri].push('');
  return (_dataCache[name] = { sh: sh, headers: hdrs, rows: all.slice(1) }); }
function setupDatabase() { var ss = getSs_();
  [[SH_USERS, USER_COLS], [SH_APTS, APT_COLS], [SH_RE_LOGS, RE_LOG_COLS], [SH_NOTIF_LOGS, NOTIF_LOG_COLS], [SH_META, META_COLS]].forEach(function (p) { ensureSheet_(ss, p[0], p[1], true); });
  var defs = { LAST_TRIGGER_RUN_AT: '', CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '0', QUOTA_UPDATED_AT: '', DAILY_DIGEST_HOUR: '8', QUIET_HOURS_START: '22', QUIET_HOURS_END: '7', ENABLE_LINE_BOT_QUERY: 'TRUE', PRIVACY_MASK_CONTACT: 'FALSE', NOTIFY_ON_STATUS_CHANGE: 'FALSE', WEB_APP_URL: '' };
  var cur = getMetaMap_(), now = getBkkNow_().isoStr, mSh = ensureSheet_(ss, SH_META, META_COLS, true);
  Object.keys(defs).forEach(function (k) { if (cur[k] === undefined) { mSh.appendRow([k, defs[k], now]); cur[k] = defs[k]; } });
  formatPlainText_(mSh, META_COLS.length); invalidateSheetCache_(SH_META); return 'ตั้งค่าโครงสร้างชีต Plain Text และบัญชีเริ่มต้นสำเร็จ'; }
// Trigger Management & Smart Trigger Sync Fast-Skip
function removeNotificationTriggers() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'runNotificationEngine') ScriptApp.deleteTrigger(t); });
  try { delProp_('ONEOFF_TRIGGERS_JSON'); } catch (_) {} return 'ลบ Trigger แจ้งเตือนอัตโนมัติทั้งหมดเรียบร้อย'; }
function getTrigMs_(e) { return e && typeof e === 'object' ? (+e.ms || 0) : (+e || 0); }
function getTrigId_(e) { return e && typeof e === 'object' ? String(e.id || '') : ''; }
function cleanExpiredTriggers_(existingTriggers) { try {
    var map = JSON.parse(getProp_('ONEOFF_TRIGGERS_JSON') || '{}'), nowMs = Date.now(), changed = false;
    if (!Object.keys(map).some(function (u) { var ms = getTrigMs_(map[u]); return ms && ms <= nowMs; })) return;
    (existingTriggers || ScriptApp.getProjectTriggers()).forEach(function (t) { var uid = t.getUniqueId(), ms = getTrigMs_(map[uid]);
      if (ms && ms <= nowMs) { ScriptApp.deleteTrigger(t); delete map[uid]; changed = true; } });
    if (changed) setProp_('ONEOFF_TRIGGERS_JSON', JSON.stringify(map)); } catch (_) {} }
function installTriggerAuto() { removeNotificationTriggers(); ScriptApp.newTrigger('runNotificationEngine').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('runNotificationEngine').timeBased().everyHours(1).create(); return 'ติดตั้ง Trigger แจ้งเตือนอัตโนมัติ (รอบเช้า 08:00 น. และตรวจก่อนเวลานัดทุก 1 ชั่วโมง) เรียบร้อย'; }
function installTriggerEvery15Minutes() { removeNotificationTriggers(); ScriptApp.newTrigger('runNotificationEngine').timeBased().everyMinutes(15).create(); return 'ติดตั้ง Trigger ตรวจเช็คทุก 15 นาที เรียบร้อย'; }
function installTriggerDailyAt8AM() { removeNotificationTriggers(); ScriptApp.newTrigger('runNotificationEngine').timeBased().everyDays(1).atHour(8).create(); return 'ติดตั้ง Trigger แจ้งเตือนวันละ 1 ครั้ง (ช่วง 08:00 น.) เรียบร้อย'; }
function setupNotificationTriggers_(m) { return m === 'every15Min' ? installTriggerEvery15Minutes() : (m === 'daily' ? installTriggerDailyAt8AM() : (m === 'off' ? removeNotificationTriggers() : installTriggerAuto())); }
function scheduleExactReminderForApt_(apt) { try { if (!apt || !apt.id) return;
    var map = JSON.parse(getProp_('ONEOFF_TRIGGERS_JSON') || '{}'), uids = Object.keys(map), aptUids = uids.filter(function (u) { return getTrigId_(map[u]) === apt.id; });
    var ep = (apt.status === STATUS.CONFIRMED && apt.appointmentDate && apt.appointmentTime) ? bkkSlotToEpoch_(apt.appointmentDate, apt.appointmentTime) : null;
    var rH = (apt.remindHoursBefore != null && apt.remindHoursBefore !== '') ? +apt.remindHoursBefore : 0;
    var remindMs = (ep && rH > 0) ? ep - (rH * 3600000) : 0, nowMs = getBkkNow_().epochMs;
    var shouldCreate = Boolean(ep && rH > 0 && remindMs > nowMs + 180000 && remindMs <= nowMs + (48 * 3600000));
    if (!shouldCreate && !aptUids.length) return;
    if (shouldCreate && !aptUids.length && uids.some(function (u) { return Math.abs(getTrigMs_(map[u]) - remindMs) < 60000; })) return;
    if (shouldCreate && aptUids.length === 1 && Math.abs(getTrigMs_(map[aptUids[0]]) - remindMs) < 60000) return;
    var allTriggers = ScriptApp.getProjectTriggers(), changed = false, activeCount = allTriggers.length, slotCovered = false;
    allTriggers.forEach(function (t) { var uid = t.getUniqueId(), ms = getTrigMs_(map[uid]), tAptId = getTrigId_(map[uid]);
      if ((ms && ms <= nowMs) || (tAptId && tAptId === apt.id)) { ScriptApp.deleteTrigger(t); delete map[uid]; activeCount--; changed = true; }
      else if (shouldCreate && ms && Math.abs(ms - remindMs) < 60000) slotCovered = true; });
    if (shouldCreate && !slotCovered) {
      if (activeCount >= 16) for (var i = 0; i < allTriggers.length; i++) { var tUid = allTriggers[i].getUniqueId(); if (map[tUid]) { ScriptApp.deleteTrigger(allTriggers[i]); delete map[tUid]; changed = true; break; } }
      var newTrig = ScriptApp.newTrigger('runNotificationEngine').timeBased().at(new Date(remindMs)).create();
      map[newTrig.getUniqueId()] = { ms: remindMs, id: apt.id }; changed = true; }
    if (changed) setProp_('ONEOFF_TRIGGERS_JSON', JSON.stringify(map)); } catch (_) {} }
function buildSyncBundle_(optUsers) {
  return { appointments: readAllApts_(), users: optUsers || readPublicUsers_(), rescheduleLogs: readLogs_(SH_RE_LOGS, RE_LOG_COLS, 50), meta: getMetaMap_(), serverTime: getBkkNow_().isoStr }; }
// HTTP Endpoints (API Gateway & Webhook Router)
function doGet(e) { try { var p = (e && e.parameter) || {};
    if (!verifyPasscode_(p.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' });
    if ((p.action || 'list') === 'list') return json_({ ok: true, data: { appointments: readAllApts_(), users: readPublicUsers_(), meta: getMetaMap_(), serverTime: getBkkNow_().isoStr } });
    return json_({ ok: false, error: 'ไม่รองรับ GET action' }); } catch (err) { return json_({ ok: false, error: err.message || String(err) }); } }
function doPost(e) { try { var body = JSON.parse((e && e.postData && e.postData.contents) || '{}'), p = (e && e.parameter) || {};
    if (Array.isArray(body.events)) return handleLineWebhook_(body, p);
    if (!verifyPasscode_(body.passcode)) return json_({ ok: false, error: 'API Passcode ไม่ถูกต้อง' }); var a = body.action || '';
    if (a === 'login') return json_({ ok: true, data: handleUserLogin_(body.username, body.password) });
    if (a === 'register') return withLock_(function () { return json_({ ok: true, data: handleUserRegister_(body.payload || body.userPayload || {}) }); });
    if (a === 'listUsers') return json_({ ok: true, data: { users: readPublicUsers_() } });
    if (a === 'saveUser') return withLock_(function () { return json_({ ok: true, data: { user: saveUser_(body.userPayload) } }); });
    if (a === 'deleteUser') return withLock_(function () { return json_({ ok: true, data: { result: deleteUser_(body.userId) } }); });
    if (a === 'list') return json_({ ok: true, data: buildSyncBundle_() });
    if (a === 'create') { var apt = withLock_(function () { return createApt_(body.payload || {}); });
      var wantCreateNotif = body.notifyLine === true || String(body.notifyLine).toUpperCase() === 'TRUE';
      var lineNotif = wantCreateNotif ? sendInstantAptNotification_(apt, false) : null;
      if (+apt.remindHoursBefore > 0) scheduleExactReminderForApt_(apt);
      return json_({ ok: true, data: { appointment: apt, lineNotification: lineNotif, meta: getMetaMap_() } }); }
    if (a === 'update') { var wantUpdNotif = body.notifyLine === true || String(body.notifyLine).toUpperCase() === 'TRUE';
      var res = withLock_(function () { return updateApt_(body.id, body.payload || {}, body.expectedUpdatedAt, body.reason, body.currentUser, !wantUpdNotif); });
      if (wantUpdNotif && res && res.appointment) { res.lineNotification = sendInstantAptNotification_(res.appointment, true); res.meta = getMetaMap_(); }
      if (res && res.appointment && res.needsTriggerSync) scheduleExactReminderForApt_(res.appointment); return json_({ ok: true, data: res }); }
    if (a === 'delete') return withLock_(function () { return json_({ ok: true, data: { appointment: deleteApt_(body.id, body.updatedBy) } }); });
    if (a === 'updateMeta') return withLock_(function () { return json_({ ok: true, data: { meta: updateMeta_(body.meta || {}) } }); });
    if (a === 'setupTriggers') return json_({ ok: true, data: { message: setupNotificationTriggers_(body.mode) } });
    if (a === 'refreshQuota') return json_({ ok: true, data: refreshLineQuotaCache_() });
    if (a === 'testNotification') return json_({ ok: true, data: testNotification_(body.dryRun !== false, body.sampleText) });
    if (a === 'runEngineNow') return json_({ ok: true, data: runNotificationEngine() }); return json_({ ok: false, error: 'ไม่รู้จัก action: ' + a });
  } catch (err) { return json_({ ok: false, code: err.code || 'SERVER_ERROR', error: err.message || String(err) }); } }
function json_(o) { return ContentService.createTextOutput(JSON.stringify({ ok: Boolean(o.ok), version: API_VER, data: o.data || null, code: o.code || null, error: o.error || null })).setMimeType(ContentService.MimeType.JSON); }
function withLock_(fn) { var l = LockService.getScriptLock(); l.waitLock(15000); try { return fn(); } finally { l.releaseLock(); } }
function verifyPasscode_(p) { var exp = getProp_('API_PASSCODE'); return !exp || String(p || '') === exp; }
// Date & Time Helpers (BKK UTC+07:00)
function pad2_(n) { return String(Math.floor(Math.abs(Number(n) || 0))).padStart(2, '0'); }
function getBkkNow_(opt) { var ep = (opt ? new Date(opt) : new Date()).getTime(), b = new Date(ep + 7 * 3600 * 1000);
  var yr = b.getUTCFullYear(), mo = b.getUTCMonth() + 1, dy = b.getUTCDate(), hr = b.getUTCHours(), mi = b.getUTCMinutes(), sc = b.getUTCSeconds();
  var ds = yr + '-' + pad2_(mo) + '-' + pad2_(dy), ts = pad2_(hr) + ':' + pad2_(mi);
  return { epochMs: ep, year: yr, buddhistYear: yr + 543, month: mo, day: dy, hour: hr, minute: mi, dateStr: ds, timeStr: ts, isoStr: ds + 'T' + ts + ':' + pad2_(sc) + '+07:00' };
}
function bkkSlotToEpoch_(d, t) { if (!d) return null; var dp = String(d).split('-').map(Number), tp = String(t || '00:00').split(':').map(Number);
  return (dp.length !== 3 || tp.length < 2) ? null : Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0, 0) - (7 * 3600 * 1000); }
function diffDays_(s, e) { var sm = bkkSlotToEpoch_(s, '00:00'), em = bkkSlotToEpoch_(e, '00:00'); return (sm === null || em === null) ? null : Math.round((em - sm) / 86400000); }
function fmtThaiDate_(d) { var p = String(d || '').split('-').map(Number); return p.length !== 3 ? (d || 'ยังไม่กำหนดวัน') : (p[2] + ' ' + (TH_MONTHS_S[p[1] - 1] || '') + ' ' + (p[0] + 543)); }
// User Operations
function readAllUsersInternal_() { var d = getSheetData_(SH_USERS, USER_COLS); return d.rows.reduce(function (arr, r, idx) { var o = { _rowIndex: idx + 2, _headers: d.headers, _sh: d.sh }; d.headers.forEach(function (h, i) { o[h] = String(r[i] || '').trim(); }); if (o.userId && o.username) arr.push(o); return arr; }, []); }
function toPublicUser_(u) { return { userId: u.userId, username: u.username, displayName: sanitizeNoEmoji(u.displayName || u.username), role: u.role === 'ADMIN' ? 'ADMIN' : 'STAFF', isActive: String(u.isActive).toUpperCase() !== 'FALSE', createdAt: u.createdAt, lastLoginAt: u.lastLoginAt }; }
function readPublicUsers_() { return readAllUsersInternal_().map(toPublicUser_); }
function buildUserRow_(headers, id, un, pwHash, disp, role, active, created, login) {
  var map = { userId: id, username: un, passwordHash: pwHash, displayName: disp, role: role, isActive: active, createdAt: created, lastLoginAt: login || '' };
  return headers.map(function (h) { return map[h] !== undefined ? map[h] : ''; }); }
function handleUserLogin_(username, password) { var un = sanitizeNoEmoji(username || '').toLowerCase(), pw = String(password || '');
  if (!un || !pw) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  var users = readAllUsersInternal_(), target = users.filter(function (u) { return u.username.toLowerCase() === un; })[0];
  if (!target) throw new Error('ไม่พบบัญชีผู้ใช้งานนี้'); if (String(target.isActive).toUpperCase() === 'FALSE') throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  if (target.passwordHash !== hashPassword_(pw)) throw new Error('รหัสผ่านไม่ถูกต้อง');
  var nowIso = getBkkNow_().isoStr, colIdx = (target._headers || USER_COLS).indexOf('lastLoginAt') + 1;
  if (colIdx > 0 && target._rowIndex > 1 && target._sh) target._sh.getRange(target._rowIndex, colIdx).setValue(nowIso); target.lastLoginAt = nowIso;
  var bundle = buildSyncBundle_(users.map(toPublicUser_));
  bundle.user = { userId: target.userId, username: target.username, displayName: sanitizeNoEmoji(target.displayName || target.username), role: target.role === 'ADMIN' ? 'ADMIN' : 'STAFF' };
  return bundle; }
function handleUserRegister_(payload) {
  var p = payload || {}, un = sanitizeNoEmoji(p.username || '').toLowerCase(), disp = sanitizeNoEmoji(p.displayName || ''), pw = String(p.password || ''), confirmPw = p.confirmPassword !== undefined ? String(p.confirmPassword || '') : pw;
  if (!un || un.length < 3 || un.length > 30 || !/^[a-z0-9_.-]+$/.test(un)) throw new Error('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 3-30 ตัวอักษร');
  if (!disp) throw new Error('กรุณาระบุชื่อ-นามสกุล หรือชื่อเรียกที่ใช้แสดงในระบบ');
  if (!pw || pw.length < 4) throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร'); if (pw !== confirmPw) throw new Error('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
  var d = getSheetData_(SH_USERS, USER_COLS), rows = d.rows, headers = d.headers, maxIdNum = 0, pubUsers = []; for (var i = 0; i < rows.length; i++) {
    var uObj = {}; headers.forEach(function (h, c) { uObj[h] = String(rows[i][c] || '').trim(); });
    if (uObj.userId.indexOf('USR-') === 0) { var num = parseInt(uObj.userId.slice(4), 10); if (num > maxIdNum) maxIdNum = num; }
    if (uObj.username.toLowerCase() === un) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
    if (uObj.displayName && uObj.displayName.toLowerCase() === disp.toLowerCase()) throw new Error('ชื่อที่ใช้แสดงผลนี้มีอยู่ในระบบแล้ว กรุณาระบุชื่อหรือแผนกเพิ่มเติม');
    if (uObj.userId && uObj.username) pubUsers.push(toPublicUser_(uObj)); }
  var nowIso = getBkkNow_().isoStr, newId = 'USR-' + String(maxIdNum + 1).padStart(3, '0');
  appendPlainRow_(d.sh, buildUserRow_(headers, newId, un, hashPassword_(pw), disp, 'STAFF', 'TRUE', nowIso, nowIso), rows.length + 1);
  pubUsers.push({ userId: newId, username: un, displayName: disp, role: 'STAFF', isActive: true, createdAt: nowIso, lastLoginAt: nowIso });
  var bundle = buildSyncBundle_(pubUsers); bundle.user = { userId: newId, username: un, displayName: disp, role: 'STAFF' }; return bundle; }
function saveUser_(payload) { var p = payload || {}, uid = sanitizeNoEmoji(p.userId || '').trim(), un = sanitizeNoEmoji(p.username || '').toLowerCase();
  var d = getSheetData_(SH_USERS, USER_COLS), rows = d.rows, headers = d.headers, idIdx = headers.indexOf('userId'), unIdx = headers.indexOf('username'), dispIdx = headers.indexOf('displayName'), roleIdx = headers.indexOf('role'), actIdx = headers.indexOf('isActive');
  var foundIdx = -1, foundByUn = -1, maxIdNum = 0; for (var i = 0; i < rows.length; i++) {
    var rId = String(rows[i][idIdx] || '').trim(), rUn = String(rows[i][unIdx] || '').trim().toLowerCase();
    if (rId.indexOf('USR-') === 0) { var num = parseInt(rId.slice(4), 10); if (num > maxIdNum) maxIdNum = num; }
    if (uid && rId === uid) foundIdx = i; if (un && rUn === un) foundByUn = i; }
  if (p.isNew && foundByUn !== -1) throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
  if (foundIdx === -1 && !p.isNew && foundByUn !== -1) foundIdx = foundByUn; var nowIso = getBkkNow_().isoStr; if (foundIdx !== -1) {
    var curRow = rows[foundIdx], curUserId = String(curRow[idIdx] || '').trim(), curUn = String(curRow[unIdx] || '').trim().toLowerCase();
    var nextDisp = p.displayName !== undefined ? sanitizeNoEmoji(p.displayName) : String(curRow[dispIdx] || curUn).trim(); if (!nextDisp) throw new Error('กรุณาระบุชื่อที่แสดงผล');
    var nextRole = (p.role !== undefined ? String(p.role) : String(curRow[roleIdx] || 'STAFF')).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';
    var nextActive = (p.isActive !== undefined ? (p.isActive !== false && String(p.isActive).toUpperCase() !== 'FALSE') : (String(curRow[actIdx]).toUpperCase() !== 'FALSE')) ? 'TRUE' : 'FALSE';
    if (curUn === 'admin' && nextActive === 'FALSE') throw new Error('ไม่สามารถระงับบัญชีผู้ดูแลระบบหลัก (admin) ได้');
    var updatedRow = headers.map(function (h, colI) { if (h === 'displayName') return nextDisp; if (h === 'role') return nextRole; if (h === 'isActive') return nextActive;
      if (h === 'passwordHash' && p.password) { if (String(p.password).length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร'); return hashPassword_(p.password); } return curRow[colI]; });
    d.sh.getRange(foundIdx + 2, 1, 1, headers.length).setNumberFormat('@').setValues([updatedRow]);
    invalidateSheetCache_(SH_USERS); return { userId: curUserId, username: curUn, displayName: nextDisp, role: nextRole, isActive: nextActive === 'TRUE' };
  }
  if (foundIdx === -1 && uid && !p.isNew && !un) throw new Error('ไม่พบรหัสผู้ใช้: ' + uid);
  if (!un || un.length < 3) throw new Error('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
  var disp = sanitizeNoEmoji(p.displayName || un); if (!disp) throw new Error('กรุณาระบุชื่อที่แสดงผล');
  if (!p.password || String(p.password).length < 4) throw new Error('กรุณาระบุรหัสผ่านอย่างน้อย 4 ตัวอักษรสำหรับผู้ใช้ใหม่');
  var role = (p.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF', isActive = p.isActive !== false && String(p.isActive).toUpperCase() !== 'FALSE' ? 'TRUE' : 'FALSE', newId = 'USR-' + String(maxIdNum + 1).padStart(3, '0');
  appendPlainRow_(d.sh, buildUserRow_(headers, newId, un, hashPassword_(p.password), disp, role, isActive, nowIso, ''), rows.length + 1);
  return { userId: newId, username: un, displayName: disp, role: role, isActive: isActive === 'TRUE' }; }
function deleteUser_(userId) { if (!userId) throw new Error('ไม่พบรหัสผู้ใช้: ' + userId); saveUser_({ userId: userId, isActive: false }); return { success: true, userId: userId }; }
// Data Operations (Appointments & Attribution)
function readAllApts_(includeDeleted) { var d = getSheetData_(SH_APTS, APT_COLS); if (!d.rows.length) return [];
  var delIdx = d.headers.indexOf('deletedAt'); return d.rows.reduce(function (arr, r) {
    var o = {}; d.headers.forEach(function (c, i) { o[c] = String(r[i] || '').trim(); }); o.status = normalizeStatus_(o.status);
    o.remindDaysBefore = (o.remindDaysBefore !== '' && o.remindDaysBefore != null) ? Number(o.remindDaysBefore) : 0;
    o.remindHoursBefore = (o.remindHoursBefore !== '' && o.remindHoursBefore != null) ? Number(o.remindHoursBefore) : 0;
    o.rescheduleCount = Number(o.rescheduleCount || 0); o.mapUrl = sanitizeNoEmoji(o.mapUrl || ''); o.imageUrl = sanitizeNoEmoji(o.imageUrl || '');
    o.createdBy = sanitizeNoEmoji(o.createdBy || o.updatedBy || 'ผู้ใช้งานระบบ');
    o.statusChangedBy = sanitizeNoEmoji(o.statusChangedBy || ''); o.statusChangedAt = sanitizeNoEmoji(o.statusChangedAt || ''); o.statusReason = sanitizeNoEmoji(o.statusReason || '');
    var isDel = delIdx !== -1 && Boolean(String(r[delIdx] || '').trim()); if (o.id && (includeDeleted || !isDel)) arr.push(o); return arr; }, []); }
function createApt_(inp) {
  var d = getSheetData_(SH_APTS, APT_COLS), now = getBkkNow_(), pfx = 'APT-' + now.dateStr.replace(/-/g, '') + '-', idIdx = Math.max(0, d.headers.indexOf('id'));
  var max = d.rows.reduce(function (m, r) { var rid = String(r[idIdx] || '').trim(); return rid.indexOf(pfx) === 0 ? Math.max(m, +rid.slice(pfx.length) || 0) : m; }, 0);
  var creator = sanitizeNoEmoji(inp.createdBy || inp.updatedBy || 'ผู้ใช้งานระบบ') || 'ผู้ใช้งานระบบ', st = normalizeStatus_(inp.status);
  var rec = { id: pfx + String(max + 1).padStart(3, '0'), title: sanitizeNoEmoji(inp.title), appointmentDate: sanitizeNoEmoji(inp.appointmentDate), appointmentTime: sanitizeNoEmoji(inp.appointmentTime), location: sanitizeNoEmoji(inp.location), contactPerson: sanitizeNoEmoji(inp.contactPerson), status: st, remindDaysBefore: (inp.remindDaysBefore != null && inp.remindDaysBefore !== '') ? +inp.remindDaysBefore : 0, remindHoursBefore: (inp.remindHoursBefore != null && inp.remindHoursBefore !== '') ? +inp.remindHoursBefore : 0, notifiedDayForSlot: '', notifiedHourForSlot: '', rescheduleCount: 0, notes: sanitizeNoEmoji(inp.notes), mapUrl: sanitizeNoEmoji(inp.mapUrl || ''), imageUrl: sanitizeNoEmoji(inp.imageUrl || ''), createdBy: creator, statusChangedBy: st !== STATUS.CONFIRMED ? (sanitizeNoEmoji(inp.statusChangedBy) || creator) : '', statusChangedAt: st !== STATUS.CONFIRMED ? now.isoStr : '', statusReason: sanitizeNoEmoji(inp.statusReason || ''), updatedBy: creator, createdAt: now.isoStr, updatedAt: now.isoStr, deletedAt: '' };
  validateApt_(rec); appendPlainRow_(d.sh, d.headers.map(function (c) { return rec[c] !== undefined ? String(rec[c]) : ''; }), d.rows.length + 1); return rec; }
function updateApt_(id, patch, expUpdated, reason, currentUser, suppressSlotReset) {
  var d = getSheetData_(SH_APTS, APT_COLS), rows = d.rows, headers = d.headers, delIdx = headers.indexOf('deletedAt'), targetRow = -1, cur = null;
  for (var r = rows.length - 1; r >= 0; r--) { var isDel = delIdx !== -1 && Boolean(String(rows[r][delIdx] || '').trim());
    if (String(rows[r][0]).trim() === String(id).trim() && !isDel) { targetRow = r + 2; cur = {}; headers.forEach(function (c, i) { cur[c] = String(rows[r][i] || '').trim(); }); break; } }
  if (!cur) throw new Error('ไม่พบรหัส: ' + id); if (expUpdated && cur.updatedAt && String(expUpdated).trim() !== String(cur.updatedAt).trim()) { var err = new Error('ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรชก่อนทำรายการ'); err.code = 'CONCURRENCY_CONFLICT'; throw err; }
  var now = getBkkNow_(), up = {}; headers.forEach(function (c) { up[c] = patch[c] !== undefined ? sanitizeNoEmoji(patch[c]) : cur[c]; });
  up.id = cur.id; up.status = normalizeStatus_(up.status); up.createdAt = cur.createdAt; up.updatedAt = now.isoStr;
  up.createdBy = cur.createdBy || cur.updatedBy || 'ผู้ใช้งานระบบ'; var actingUser = sanitizeNoEmoji(currentUser || patch.updatedBy || up.createdBy);
  up.updatedBy = actingUser; var statusChanged = normalizeStatus_(cur.status) !== normalizeStatus_(up.status); if (statusChanged) {
    if (up.status === STATUS.CONFIRMED) up.statusChangedBy = up.statusChangedAt = up.statusReason = '';
    else { up.statusChangedBy = sanitizeNoEmoji(patch.statusChangedBy || actingUser); up.statusChangedAt = now.isoStr; up.statusReason = sanitizeNoEmoji(patch.statusReason || reason || ''); }
  } else { up.statusChangedBy = cur.statusChangedBy || ''; up.statusChangedAt = cur.statusChangedAt || ''; up.statusReason = patch.statusReason !== undefined ? sanitizeNoEmoji(patch.statusReason) : (cur.statusReason || ''); }
  var dChg = cur.appointmentDate !== up.appointmentDate, tChg = cur.appointmentTime !== up.appointmentTime, rDChg = String(cur.remindDaysBefore) !== String(up.remindDaysBefore), rHChg = String(cur.remindHoursBefore) !== String(up.remindHoursBefore);
  var reop = (cur.status === STATUS.COMPLETED || cur.status === STATUS.CANCELLED) && up.status === STATUS.CONFIRMED;
  var suppressReset = Boolean(suppressSlotReset && !dChg && !tChg && !rDChg && !rHChg);
  if (!suppressReset) { if (dChg || reop || rDChg) up.notifiedDayForSlot = ''; if (dChg || tChg || reop || rHChg) up.notifiedHourForSlot = ''; }
  else if (reop) {
    var slotNow = (up.appointmentDate && up.appointmentTime) ? (up.appointmentDate + 'T' + up.appointmentTime) : '';
    var epNow = slotNow ? bkkSlotToEpoch_(up.appointmentDate, up.appointmentTime) : null;
    var diffHNow = epNow ? (epNow - now.epochMs) / 3600000 : -1, diffDNow = up.appointmentDate ? diffDays_(now.dateStr, up.appointmentDate) : null;
    if (!up.notifiedDayForSlot && up.appointmentDate && (+up.remindDaysBefore || 0) > 0 && diffDNow !== null && diffDNow <= (+up.remindDaysBefore || 0)) up.notifiedDayForSlot = up.appointmentDate;
    if (!up.notifiedHourForSlot && slotNow && (+up.remindHoursBefore || 0) > 0 && diffHNow > 0 && diffHNow <= (+up.remindHoursBefore || 0)) up.notifiedHourForSlot = slotNow;
  }
  if ((cur.appointmentDate || cur.appointmentTime) && (dChg || tChg)) up.rescheduleCount = String((+cur.rescheduleCount || 0) + 1); validateApt_(up);
  var logs = []; ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status'].forEach(function (f, idx) {
    if (String(cur[f] || '') !== String(up[f] || '')) logs.push({ logId: 'LOG-' + now.epochMs + '-' + (idx + 1), appointmentId: cur.id, changedAt: now.isoStr, changedBy: up.updatedBy, fieldChanged: f, oldValue: cur[f] || '', newValue: up[f] || '', reason: sanitizeNoEmoji(reason || up.statusReason || '') }); });
  if (logs.length) { var lSh = ensureSheet_(getSs_(), SH_RE_LOGS, RE_LOG_COLS), logRows = logs.map(function (le) { return RE_LOG_COLS.map(function (c) { return le[c]; }); });
    lSh.getRange(lSh.getLastRow() + 1, 1, logRows.length, RE_LOG_COLS.length).setNumberFormat('@').setValues(logRows); invalidateSheetCache_(SH_RE_LOGS); }
  d.sh.getRange(targetRow, 1, 1, headers.length).setNumberFormat('@').setValues([headers.map(function (c) { return String(up[c] !== undefined ? up[c] : ''); })]);
  invalidateSheetCache_(SH_APTS); if (reop) up.reopened = true;
  return { appointment: up, logs: logs, needsTriggerSync: Boolean(!(suppressSlotReset && !dChg && !tChg && !rHChg && up.status === STATUS.CONFIRMED) && (+cur.remindHoursBefore > 0 || +up.remindHoursBefore > 0) && (dChg || tChg || rHChg || statusChanged)) }; }
function deleteApt_(id, user) {
  var d = getSheetData_(SH_APTS, APT_COLS), rows = d.rows, headers = d.headers, delIdx = headers.indexOf('deletedAt'), removed = null, now = getBkkNow_();
  for (var r = rows.length - 1; r >= 0; r--) { var rowId = String(rows[r][0]).trim(), isDel = delIdx !== -1 && Boolean(String(rows[r][delIdx] || '').trim());
    if (rowId === String(id).trim() || isDel) { if (rowId === String(id).trim() && !removed) {
        removed = {}; headers.forEach(function (c, i) { removed[c] = String(rows[r][i] || '').trim(); });
        var lSh = ensureSheet_(getSs_(), SH_RE_LOGS, RE_LOG_COLS), le = { logId: 'LOG-' + now.epochMs + '-DEL', appointmentId: id, changedAt: now.isoStr, changedBy: sanitizeNoEmoji(user || 'ผู้ใช้งานระบบ'), fieldChanged: 'DELETED', oldValue: removed.title || '-', newValue: 'ลบนัดหมาย', reason: 'ลบออกจากระบบ' };
        appendPlainRow_(lSh, RE_LOG_COLS.map(function (c) { return le[c]; })); } d.sh.deleteRow(r + 2); } }
  invalidateSheetCache_(SH_APTS); return removed || { id: id }; }
function validateApt_(r) { if (!r.title) throw new Error('กรุณาระบุหัวข้องาน');
  if (!r.appointmentDate || !r.appointmentTime || !r.location || !r.contactPerson) throw new Error('กรุณาระบุวันที่, เวลา, สถานที่ และผู้นัดพบให้ครบถ้วน');
  if (r.imageUrl && String(r.imageUrl).length > 48000) throw new Error('ขนาดรูปภาพเกินขีดจำกัดของ Google Sheets'); }
function getMetaMap_() { if (_metaCache) return _metaCache; var d = getSheetData_(SH_META, META_COLS);
  return (_metaCache = d.rows.reduce(function (m, r) { if (r[0]) m[String(r[0]).trim()] = String(r[1] || '').trim(); return m; }, {})); }
function updateMeta_(obj) { var d = getSheetData_(SH_META, META_COLS), now = getBkkNow_().isoStr, m = getMetaMap_(), keyMap = {}, wrote = false;
  for (var i = 0; i < d.rows.length; i++) { var k = String(d.rows[i][0]).trim(); if (k) keyMap[k] = i + 2; }
  var nextRow = d.rows.length + 1; Object.keys(obj || {}).forEach(function (k) { var v = sanitizeNoEmoji(obj[k]); if (keyMap[k] && m[k] === v) return;
    m[k] = v; wrote = true; if (keyMap[k]) d.sh.getRange(keyMap[k], 2, 1, 2).setNumberFormat('@').setValues([[v, now]]);
    else { appendPlainRow_(d.sh, [k, v, now], nextRow); keyMap[k] = ++nextRow; } });
  if (wrote) invalidateSheetCache_(SH_META); return m; }
function readLogs_(name, cols, lim) { var d = getSheetData_(name, cols); if (!d.rows.length) return [];
  return d.rows.slice(Math.max(0, d.rows.length - (lim || 30))).reverse().map(function (row) { var o = {}; d.headers.forEach(function (c, i) { o[c] = row[i]; }); return o; }); }
// Notification Engine & LINE Messaging API
function runNotificationEngine() { return withLock_(function () { cleanExpiredTriggers_();
    var now = getBkkNow_(); updateMeta_({ LAST_TRIGGER_RUN_AT: now.isoStr });
    var m = getMetaMap_(), qs = +m.QUIET_HOURS_START || 22, qe = +m.QUIET_HOURS_END || 7, dh = +m.DAILY_DIGEST_HOUR || 8;
    if (qs > qe ? (now.hour >= qs || now.hour < qe) : (now.hour >= qs && now.hour < qe)) return { sent: false, reason: 'QUIET_HOURS' };
    var apts = readAllApts_(), hourly = [], digest = [], slotUp = []; apts.forEach(function (a) {
      if (a.status !== STATUS.CONFIRMED || !a.appointmentDate || !a.appointmentTime) return;
      var ep = bkkSlotToEpoch_(a.appointmentDate, a.appointmentTime); if (ep === null || now.epochMs >= ep) return;
      var slot = a.appointmentDate + 'T' + a.appointmentTime, diffH = (ep - now.epochMs) / 3600000, rH = +a.remindHoursBefore || 0, rD = +a.remindDaysBefore || 0;
      if (rH > 0 && a.notifiedHourForSlot !== slot && diffH > 0 && diffH <= rH) { hourly.push(a); slotUp.push({ id: a.id, dSlot: a.appointmentDate, hSlot: slot }); return; }
      var diffD = diffDays_(now.dateStr, a.appointmentDate);
      if (rD > 0 && a.notifiedDayForSlot !== a.appointmentDate && diffD !== null && diffD >= 0 && diffD <= rD && now.hour >= dh) { digest.push(a); slotUp.push({ id: a.id, dSlot: a.appointmentDate, hSlot: a.notifiedHourForSlot || '' }); }
    }); if (!hourly.length && !digest.length) return { sent: false, reason: 'NONE_DUE' }; hourly.sort(cmpSlot_); digest.sort(cmpSlot_);
    var qInfo = { limit: +m.CACHED_QUOTA_LIMIT || 300, used: +m.CACHED_QUOTA_USED || 0 };
    var flexMsg = buildReminderNotificationFlex_(hourly, digest, now.dateStr, String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE', m.WEB_APP_URL || '', qInfo);
    var pushRes = pushLine_(getProp_('LINE_TARGET_ID'), flexMsg, Utilities.getUuid(), false, hourly.length ? 'HOURLY' : 'DAILY', slotUp.map(function (u) { return u.id; }).join(','));
    if (pushRes.ok) { applySlotUpdates_(slotUp); updateMeta_({ CACHED_QUOTA_USED: String(qInfo.used + 1) }); }
    return { sent: pushRes.ok, httpStatus: pushRes.httpStatus, count: slotUp.length }; }); }
function applySlotUpdates_(ups) { var d = getSheetData_(SH_APTS, APT_COLS); if (!d.rows.length || !ups.length) return;
  var dCol = d.headers.indexOf('notifiedDayForSlot') + 1, hCol = d.headers.indexOf('notifiedHourForSlot') + 1, delIdx = d.headers.indexOf('deletedAt'), idMap = {};
  for (var r = 0; r < d.rows.length; r++) if (!(delIdx !== -1 && String(d.rows[r][delIdx] || '').trim())) idMap[String(d.rows[r][0]).trim()] = r + 2;
  ups.forEach(function (u) { var rowNum = idMap[u.id]; if (!rowNum) return;
    if (dCol > 0 && hCol === dCol + 1) d.sh.getRange(rowNum, dCol, 1, 2).setNumberFormat('@').setValues([[u.dSlot, u.hSlot]]);
    else { if (dCol > 0) d.sh.getRange(rowNum, dCol).setValue(u.dSlot); if (hCol > 0) d.sh.getRange(rowNum, hCol).setValue(u.hSlot); }
  }); invalidateSheetCache_(SH_APTS); }
function pushLine_(target, msg, retryKey, isDry, type, aptIds) { var token = getProp_('LINE_CHANNEL_ACCESS_TOKEN'), now = getBkkNow_().isoStr;
  if (!token) return { ok: false, error: 'ไม่มี Token' };
  var url = isDry ? 'https://api.line.me/v2/bot/message/validate/push' : 'https://api.line.me/v2/bot/message/push';
  var msgObj = (typeof msg === 'object' && msg !== null) ? msg : { type: 'text', text: sanitizeNoEmoji(msg) };
  var hdrs = { Authorization: 'Bearer ' + token }; if (!isDry && retryKey) hdrs['X-Line-Retry-Key'] = retryKey;
  var res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: hdrs, payload: JSON.stringify(isDry ? { messages: [msgObj] } : { to: target, messages: [msgObj] }), muteHttpExceptions: true });
  var code = res.getResponseCode(), ok = code >= 200 && code < 300;
  appendPlainRow_(ensureSheet_(getSs_(), SH_NOTIF_LOGS, NOTIF_LOG_COLS), ['NLOG-' + Date.now(), now, type || 'PUSH', aptIds || '-', target || '-', String(code), retryKey || '-', ok ? '' : res.getContentText()]);
  return { ok: ok, httpStatus: code, error: ok ? null : res.getContentText() }; }
function sendLineReply_(replyToken, msg) { var token = getProp_('LINE_CHANNEL_ACCESS_TOKEN'); if (!token || !replyToken) return;
  var msgObj = (typeof msg === 'object' && msg !== null) ? msg : { type: 'text', text: sanitizeNoEmoji(msg) };
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ replyToken: replyToken, messages: [msgObj] }), muteHttpExceptions: true }); }
function getLineUserName_(gid, uid, token) { if (!token || !uid) return 'สมาชิก LINE'; var cKey = 'LN_U_' + (gid || 'DM') + '_' + uid; try {
    var cache = CacheService.getScriptCache(), cached = cache.get(cKey); if (cached) return cached;
    var url = gid ? ('https://api.line.me/v2/bot/group/' + gid + '/member/' + uid) : ('https://api.line.me/v2/bot/profile/' + uid);
    var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }); if (res.getResponseCode() === 200) {
      var data = JSON.parse(res.getContentText()); if (data && data.displayName) { var nm = sanitizeNoEmoji(data.displayName); cache.put(cKey, nm, 21600); return nm; } }
  } catch (_) {} return 'สมาชิก LINE'; }
// --- Pure Flex Builders (Executed directly in GAS & tests.js VM Sandbox) ---
function parseQueryString_(qs) { var obj = {};
  String(qs || '').split('&').forEach(function (pair) { var p = pair.split('='); if (p.length === 2) obj[decodeURIComponent(p[0])] = decodeURIComponent(p[1]); });
  return obj; }
function fTxt(t, o) { var b = { type: 'text', text: sanitizeNoEmoji(String(t == null ? '-' : t)) }; if (o) Object.keys(o).forEach(function (k) { if (o[k] !== undefined) b[k] = o[k]; }); return b; }
function fBox(layout, contents, o) { var b = { type: 'box', layout: layout, contents: contents }; if (o) Object.keys(o).forEach(function (k) { if (o[k] !== undefined) b[k] = o[k]; }); return b; }
function fBtn(style, action, color) { var b = { type: 'button', style: style, height: 'sm', action: action }; if (color) b.color = color; return b; }
function fSep(col, m) { var s = { type: 'separator', color: col }; if (m) s.margin = m; return s; }
function fLinkFt(url, lbl) { return url ? fBox('vertical', [fBtn('link', { type: 'uri', label: lbl, uri: url })]) : null; }
function fRow(lbl, val, bold, col, wrap) { return fBox('baseline', [fTxt(lbl, { color: '#64748b', size: 'sm', flex: 2 }), fTxt(val || '-', { size: 'sm', flex: 5, color: col || '#334155', weight: bold ? 'bold' : undefined, wrap: wrap || undefined })], { spacing: 'sm' }); }
function fBar(pct, fillCol) { var p = Math.max(0, Math.min(100, Number(pct) || 0)); return fBox('horizontal', [fBox('vertical', [], { width: (p > 0 ? p : 1) + '%', height: '8px', backgroundColor: p > 0 ? fillCol : '#e2e8f0', cornerRadius: 'md' })], { height: '8px', backgroundColor: '#e2e8f0', cornerRadius: 'md', margin: 'md' }); }
function fBubble(bgHdr, hdrItems, bodyItems, footerBox) { var b = { type: 'bubble', size: 'mega', styles: { header: { backgroundColor: bgHdr } }, header: fBox('vertical', hdrItems), body: fBox('vertical', bodyItems, { spacing: 'sm' }) }; if (footerBox) b.footer = footerBox; return b; }
function wrapFlex_(alt, contents) { return { type: 'flex', altText: sanitizeNoEmoji(alt).slice(0, 400), contents: contents }; }
function getAptStatusColor_(st) { var s = normalizeStatus_(st); return s === STATUS.COMPLETED ? '#059669' : (s === STATUS.CANCELLED ? '#dc2626' : '#0284c7'); }
function getAptFlexTheme_(st, isUpd, isReop) { var s = normalizeStatus_(st);
  if (s === STATUS.COMPLETED) return { tag: '[แจ้งเตือนสิ้นสุดการนัดหมาย]', stColor: '#059669', bgHdr: '#ecfdf5', hdrColor: '#065f46', subColor: '#047857', sepColor: '#a7f3d0' };
  if (s === STATUS.CANCELLED) return { tag: '[แจ้งเตือนยกเลิกการนัดหมาย]', stColor: '#dc2626', bgHdr: '#fef2f2', hdrColor: '#991b1b', subColor: '#b91c1c', sepColor: '#fecaca' };
  if (isUpd && isReop) return { tag: '[แจ้งเตือนการคืนสถานะนัดหมาย]', stColor: '#0284c7', bgHdr: '#eff6ff', hdrColor: '#1d4ed8', subColor: '#2563eb', sepColor: '#bfdbfe' };
  if (isUpd) return { tag: '[แจ้งเตือนการอัปเดตนัดหมาย]', stColor: '#0284c7', bgHdr: '#eef2ff', hdrColor: '#4338ca', subColor: '#4f46e5', sepColor: '#c7d2fe' };
  return { tag: '[แจ้งเตือนนัดหมายใหม่]', stColor: '#0284c7', bgHdr: '#f0f9ff', hdrColor: '#0369a1', subColor: '#0284c7', sepColor: '#bae6fd' }; }
function buildStatusResultFlex_(apt, actionType, actingUser, reason, nowTime) {
  var isComp = actionType === 'COMPLETED' || actionType === 'quickComplete', hdr = isComp ? '[บันทึกสิ้นสุดนัดหมายเรียบร้อย]' : '[บันทึกยกเลิกนัดหมายเรียบร้อย]';
  var stCol = isComp ? '#059669' : '#dc2626', bgHdr = isComp ? '#ecfdf5' : '#fef2f2', hdrCol = isComp ? '#065f46' : '#991b1b', sepCol = isComp ? '#a7f3d0' : '#fecaca';
  var rows = [fRow('สถานะ', isComp ? '[สิ้นสุดการนัดหมาย]' : '[ยกเลิกการนัดหมาย]', true, stCol), fRow(isComp ? 'ผู้เสร็จสิ้น' : 'ผู้ยกเลิก', actingUser || 'สมาชิก LINE', true, '#1e293b')];
  if (!isComp && reason) rows.push(fRow('สาเหตุ', reason, false, '#dc2626', true));
  if (apt && apt.appointmentDate) rows.push(fRow('วันนัด', fmtThaiDate_(apt.appointmentDate) + ' (' + (apt.appointmentTime || '-') + ' น.)', false, '#475569'));
  if (apt && apt.location) rows.push(fRow('สถานที่', apt.location, false, '#334155', true));
  if (apt && apt.contactPerson) rows.push(fRow('ผู้นัดพบ', apt.contactPerson, false, '#334155', true));
  if (apt && apt.createdBy) rows.push(fRow('ผู้สร้าง', apt.createdBy, false, '#64748b'));
  var b = fBubble(bgHdr, [fBox('baseline', [fTxt(hdr, { weight: 'bold', color: hdrCol, size: 'sm', flex: 8 }), fTxt((nowTime || '') + ' น.', { color: '#64748b', size: 'xs', align: 'end', flex: 4 })]), fTxt((apt && apt.id) || '-', { size: 'xs', color: stCol, margin: 'xs', weight: 'bold' })], [fTxt((apt && apt.title) || '-', { weight: 'bold', size: 'md', color: '#0f172a', wrap: true }), fSep(sepCol, 'sm'), fBox('vertical', rows, { spacing: 'xs', margin: 'md' })]);
  return wrapFlex_(hdr + ' [' + ((apt && apt.id) || '') + '] ' + ((apt && apt.title) || ''), b); }
function buildNoticeFlex_(id, title, desc, curStatus, actor, reason) { var rows = [];
  if (curStatus) rows.push(fRow('สถานะปัจจุบัน', '[' + curStatus + ']', true, getAptStatusColor_(curStatus)));
  if (actor) rows.push(fRow('ดำเนินการโดย', actor + (reason ? ' (' + reason + ')' : ''), false, '#475569', true));
  var b = fBubble('#fffbeb', [fTxt('[แจ้งเตือนสถานะนัดหมาย]', { weight: 'bold', color: '#b45309', size: 'sm' }), fTxt(id || '-', { size: 'xs', color: '#92400e', margin: 'xs', weight: 'bold' })], [fTxt(title || 'รายการนี้ได้รับการดำเนินการไปแล้ว', { weight: 'bold', size: 'md', color: '#1e293b', wrap: true }), fSep('#fde68a', 'sm'), fTxt(desc || '', { size: 'sm', color: '#64748b', wrap: true }), fBox('vertical', rows, { spacing: 'xs', margin: 'sm' })]);
  return wrapFlex_('[แจ้งเตือน] นัดหมาย [' + id + '] ' + (desc || ''), b); }
function buildQuotaFlex_(used, limit, webAppUrl) {
  var uUsed = Math.max(0, Number(used) || 0), uLim = Math.max(1, Number(limit) || 300), rem = Math.max(0, uLim - uUsed), pct = Math.min(100, Math.round((uUsed / uLim) * 100));
  var t = pct >= 90 ? { bg: '#fef2f2', hc: '#991b1b', sc: '#dc2626', bc: '#ef4444', sep: '#fecaca', st: '[วิกฤต - ใกล้เต็มโควตา]' } : (pct >= 80 ? { bg: '#fffbeb', hc: '#92400e', sc: '#d97706', bc: '#f59e0b', sep: '#fde68a', st: '[เฝ้าระวัง - ใช้ไปเกิน 80%]' } : { bg: '#ecfdf5', hc: '#065f46', sc: '#047857', bc: '#10b981', sep: '#a7f3d0', st: '[สถานะปกติ - พร้อมใช้งาน]' });
  var rows = [fRow('ใช้ไปแล้ว', uUsed + ' / ' + uLim + ' ข้อความ (' + pct + '%)', true, '#0f172a'), fRow('คงเหลือ', rem + ' ข้อความ', true, t.sc), fRow('ระดับเตือน', t.st, true, t.sc)];
  var b = fBubble(t.bg, [fTxt('[สถานะโควตาข้อความ LINE]', { weight: 'bold', color: t.hc, size: 'sm' }), fTxt('โควตาการส่งข้อความแจ้งเตือนประจำเดือน', { size: 'xs', color: t.sc, margin: 'xs' })], [fTxt('อัตราการใช้งาน: ' + pct + '%', { weight: 'bold', size: 'md', color: '#0f172a' }), fBar(pct, t.bc), fSep(t.sep, 'md'), fBox('vertical', rows, { spacing: 'xs', margin: 'md' })], fLinkFt(webAppUrl, 'เปิดหน้าตั้งค่าและตารางงาน'));
  return wrapFlex_('[โควตา LINE] ใช้ไปแล้ว ' + uUsed + '/' + uLim + ' (' + pct + '%)', b); }
function buildHelpFlex_(webAppUrl) {
  var cmds = [['วันนี้', 'ดูนัดหมายเฉพาะวันนี้'], ['พรุ่งนี้', 'ดูนัดหมายวันพรุ่งนี้'], ['สัปดาห์นี้', 'ดูนัดหมาย 7 วันข้างหน้า'], ['ค้างอยู่', 'ดูนัดหมายที่เลยกำหนดเวลา'], ['ทั้งหมด', 'ดูนัดหมายรอพบทั้งหมด'], ['เดือนนี้', 'ดูรายการงานประจำเดือนนี้'], ['ปีนี้', 'สรุปผลงานและสถิติประจำปี'], ['โควตา', 'เช็คโควตาข้อความ LINE'], ['ค้นหา <คำ>', 'ค้นหาจากชื่อ งาน หรือสถานที่']];
  var rows = cmds.map(function (c) { return fBox('horizontal', [fTxt(c[0], { weight: 'bold', color: '#4f46e5', size: 'sm', flex: 4 }), fTxt(c[1], { color: '#64748b', size: 'sm', flex: 6, wrap: true })], { spacing: 'sm', margin: 'xs' }); });
  var qBtn = function (lbl, col) { return fBtn('primary', { type: 'message', label: lbl, text: lbl }, col || '#4f46e5'); };
  var ftItems = [fBox('horizontal', [qBtn('วันนี้', '#4f46e5'), qBtn('พรุ่งนี้', '#4f46e5')], { spacing: 'sm' }), fBox('horizontal', [qBtn('ค้างอยู่', '#dc2626'), qBtn('ทั้งหมด', '#0284c7')], { spacing: 'sm' }), fBox('horizontal', [qBtn('ปีนี้', '#059669'), qBtn('โควตา', '#334155')], { spacing: 'sm' })];
  if (webAppUrl) ftItems.push(fBtn('link', { type: 'uri', label: 'เปิดดูตารางงานบนเว็บแอป', uri: webAppUrl }));
  var b = fBubble('#eef2ff', [fTxt('[คำสั่งตรวจสอบตารางงาน]', { weight: 'bold', color: '#4338ca', size: 'sm' }), fTxt('แตะปุ่มด้านล่างหรือพิมพ์คำสั่งเพื่อค้นหา', { size: 'xs', color: '#4f46e5', margin: 'xs' })], [fTxt('คำสั่งลัดที่ใช้งานบ่อย:', { weight: 'bold', size: 'sm', color: '#0f172a' }), fSep('#c7d2fe'), fBox('vertical', rows, { spacing: 'xs', margin: 'md' }), fTxt('รองรับคำสั่งสั้นทันที หรือพิมพ์ "คิว ..." ตามเดิม', { size: 'xxs', color: '#64748b', margin: 'sm' })], fBox('vertical', ftItems, { spacing: 'sm' }));
  return wrapFlex_('[คำสั่งตรวจสอบตารางงาน] แตะเพื่อดูคำสั่งทั้งหมด', b); }
function buildQueueFlex_(title, count, items, webAppUrl, mask, opts) { var v = (opts && opts.variant) || 'default';
  var t = v === 'overdue' ? { bg: '#fef2f2', hc: '#991b1b', sc: '#dc2626', sep: '#fecaca', empty: 'ไม่มีนัดหมายที่ค้างหรือเลยกำหนดเวลา' } : (v === 'today' ? { bg: '#fffbeb', hc: '#92400e', sc: '#d97706', sep: '#fde68a', empty: 'ไม่มีนัดหมายสำหรับวันนี้' } : { bg: '#eef2ff', hc: '#3730a3', sc: '#4f46e5', sep: '#c7d2fe', empty: 'ไม่มีรายการนัดหมายตามเงื่อนไขที่เลือก' });
  var safeItems = Array.isArray(items) ? items : [], rows = []; safeItems.forEach(function (a, i) {
    var c = sanitizeNoEmoji(a.contactPerson || '-'); if (mask && c.length > 2) c = c.slice(0, 2) + '***';
    var st = normalizeStatus_(a.status), stCol = v === 'overdue' && st === STATUS.CONFIRMED ? '#dc2626' : getAptStatusColor_(st);
    if (i > 0) rows.push(fSep('#e2e8f0', 'md'));
    rows.push(fBox('horizontal', [fBox('vertical', [], { width: '4px', backgroundColor: stCol, cornerRadius: 'sm' }), fBox('vertical', [fBox('baseline', [fTxt((i + 1) + '. ' + (a.appointmentDate ? fmtThaiDate_(a.appointmentDate) : '-') + ' ' + (a.appointmentTime ? a.appointmentTime + ' น.' : '-'), { size: 'xs', color: '#475569', weight: 'bold', flex: 6 }), fTxt('[' + st + ']', { size: 'xs', color: stCol, weight: 'bold', align: 'end', flex: 4 })], { spacing: 'sm' }), fTxt(a.title || '-', { size: 'sm', weight: 'bold', color: '#0f172a', wrap: true }), fTxt('สถานที่: ' + (a.location || '-') + ' | ผู้นัด: ' + c, { size: 'xs', color: '#64748b', wrap: true })], { spacing: 'xs', flex: 1 })], { spacing: 'sm', margin: 'md' }));
  }); if (!safeItems.length) rows.push(fTxt(t.empty, { size: 'sm', color: '#64748b', margin: 'md' }));
  var b = fBubble(t.bg, [fTxt(title, { weight: 'bold', color: t.hc, size: 'sm', wrap: true }), fTxt('พบ ' + count + ' รายการ' + (count > safeItems.length ? ' (แสดง ' + safeItems.length + ' รายการแรก)' : ''), { size: 'xs', color: t.sc, margin: 'xs' })], [fTxt('รายการนัดหมาย:', { weight: 'bold', size: 'sm', color: '#0f172a' }), fSep(t.sep), fBox('vertical', rows)], fLinkFt(webAppUrl, 'เปิดดูตารางงานทั้งหมดบนเว็บแอป'));
  return wrapFlex_(title + ' (' + count + ' รายการ)', b); }
function buildYearStatsFlex_(year, total, act, comp, canc, rate, sampleItems, webAppUrl) { var safeRate = Math.max(0, Math.min(100, Number(rate) || 0));
  var yRow = function (lbl, val, col) { return fBox('baseline', [fTxt(lbl, { size: 'sm', color: '#64748b', flex: 4 }), fTxt(val, { size: 'sm', weight: 'bold', color: col || '#1e293b', flex: 6 })], { spacing: 'sm' }); };
  var b = fBubble('#eef2ff', [fTxt('[สรุปสถิติประจำปี พ.ศ. ' + (year + 543) + ']', { weight: 'bold', color: '#4338ca', size: 'sm' }), fTxt('สรุปผลงานและการดำเนินงานตลอดทั้งปี', { size: 'xs', color: '#4f46e5', margin: 'xs' })], [fTxt('ภาพรวมผลงานประจำปี:', { weight: 'bold', size: 'sm', color: '#0f172a' }), fSep('#c7d2fe'), fBox('vertical', [yRow('งานทั้งหมด', total + ' งาน', '#0f172a'), yRow('เริ่มนัด', act + ' งาน', '#0284c7'), yRow('สิ้นสุดการนัดหมาย', comp + ' งาน (สำเร็จ ' + safeRate + '%)', '#059669'), yRow('ยกเลิกการนัดหมาย', canc + ' งาน', '#dc2626')], { spacing: 'xs', margin: 'md' }), fBar(safeRate, '#10b981')], fLinkFt(webAppUrl, 'เปิดดูแดชบอร์ดรายปีบนเว็บแอป'));
  return wrapFlex_('[สรุปสถิติประจำปี พ.ศ. ' + (year + 543) + '] รวม ' + total + ' งาน', b); }
function getValidMapUri_(raw) { var s = sanitizeNoEmoji(raw || '').trim(); if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.indexOf(' ') !== -1 ? s.replace(/ /g, '%20') : s;
  var ll = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/); return ll ? ('https://www.google.com/maps?q=' + ll[1] + ',' + ll[2]) : ''; }
function buildAptBubble_(apt, opts) { opts = opts || {};
  var isUpd = Boolean(opts.isUpdate), webAppUrl = opts.webAppUrl || '', mapUri = getValidMapUri_(apt.mapUrl), c = sanitizeNoEmoji(apt.contactPerson || '-');
  if (opts.maskContact && c.length > 2) c = c.slice(0, 2) + '***';
  var creator = sanitizeNoEmoji(apt.createdBy || apt.updatedBy || 'ผู้ใช้งานระบบ'), st = normalizeStatus_(apt.status), theme = getAptFlexTheme_(st, isUpd, Boolean(apt.reopened));
  var infoRows = [fRow('วันนัด', fmtThaiDate_(apt.appointmentDate), true, '#0f172a'), fRow('เวลา', (apt.appointmentTime || '-') + ' น.', true, '#0f172a'), fRow('สถานที่', apt.location || '-', false, '#334155', true), fRow('ผู้นัดพบ', c, false, '#334155', true), fRow('สถานะ', '[' + st + ']', true, theme.stColor), fRow('ผู้สร้าง', creator, false, '#64748b')];
  if (st === STATUS.COMPLETED && apt.statusChangedBy) infoRows.push(fRow('ผู้เสร็จสิ้น', apt.statusChangedBy, true, '#059669'));
  else if (st === STATUS.CANCELLED) { if (apt.statusChangedBy) infoRows.push(fRow('ผู้ยกเลิก', apt.statusChangedBy, true, '#dc2626')); if (apt.statusReason) infoRows.push(fRow('สาเหตุ', apt.statusReason, false, '#dc2626', true)); }
  else if (isUpd && apt.updatedBy && apt.updatedBy !== creator) infoRows.push(fRow('ผู้แก้ไข', apt.updatedBy, false, '#64748b'));
  if (apt.notes) infoRows.push(fRow('หมายเหตุ', apt.notes, false, '#475569', true));
  var bodyItems = [fTxt(apt.title || '-', { weight: 'bold', size: 'md', wrap: true, color: '#0f172a' }), fSep(opts.sepColorOverride || theme.sepColor), fBox('vertical', infoRows, { spacing: 'sm' })];
  if (opts.quotaWarnText) bodyItems.push(fBox('vertical', [fTxt(opts.quotaWarnText, { size: 'xs', color: '#b45309', weight: 'bold', wrap: true })], { backgroundColor: '#fffbeb', cornerRadius: 'md', paddingAll: 'sm', margin: 'sm' }));
  var ft = null; if (st === STATUS.CONFIRMED) {
    var actionBtns = [fBtn('primary', { type: 'postback', label: 'เสร็จสิ้น', data: 'action=quickComplete&id=' + encodeURIComponent(apt.id), displayText: 'บันทึกเสร็จสิ้น [' + apt.id + ']' }, '#10b981'), fBtn('primary', { type: 'postback', label: 'ยกเลิก', data: 'action=quickCancel&id=' + encodeURIComponent(apt.id), displayText: 'ขอยกเลิกนัดหมาย [' + apt.id + ']' }, '#ef4444')];
    if (mapUri || webAppUrl) { var ftList = [fBox('horizontal', actionBtns, { spacing: 'md' })]; if (mapUri) ftList.push(fBtn('link', { type: 'uri', label: 'ดูแผนที่นำทาง', uri: mapUri }));
      if (webAppUrl) ftList.push(fBtn('link', { type: 'uri', label: 'เปิดดูรายละเอียดบนเว็บแอป', uri: webAppUrl })); ft = fBox('vertical', ftList, { spacing: 'sm', paddingTop: 'sm' }); }
    else ft = fBox('horizontal', actionBtns, { spacing: 'md', paddingTop: 'sm' });
  } else if (mapUri || webAppUrl) { var linkList = []; if (mapUri) linkList.push(fBtn('link', { type: 'uri', label: 'ดูแผนที่นำทาง', uri: mapUri }));
    if (webAppUrl) linkList.push(fBtn('link', { type: 'uri', label: 'เปิดดูตารางงานบนเว็บแอป', uri: webAppUrl })); ft = fBox('vertical', linkList, { spacing: 'xs', paddingTop: 'sm' }); }
  var b = fBubble(opts.bgHdrOverride || theme.bgHdr, [fTxt(opts.hdrOverride || theme.tag, { weight: 'bold', color: opts.hdrColorOverride || theme.hdrColor, size: 'sm' }), fTxt(apt.id || '-', { size: 'xs', color: opts.subColorOverride || theme.subColor, margin: 'xs', weight: 'bold' })], bodyItems, ft);
  b.header.paddingBottom = 'md'; b.body.spacing = 'md'; return b; }
function buildAptFlexMsg_(apt, isUpdate, maskContact, webAppUrl) { var theme = getAptFlexTheme_(normalizeStatus_(apt.status), Boolean(isUpdate), Boolean(apt.reopened));
  return wrapFlex_(theme.tag + ' [' + (apt.id || '') + '] ' + sanitizeNoEmoji(apt.title || ''), buildAptBubble_(apt, { isUpdate: isUpdate, maskContact: maskContact, webAppUrl: webAppUrl })); }
function buildReminderNotificationFlex_(hourly, digest, todayDateStr, maskContact, webAppUrl, qInfo) {
  var hList = Array.isArray(hourly) ? hourly : [], dList = Array.isArray(digest) ? digest : [], entries = [];
  hList.forEach(function (a) { entries.push({ apt: a, kind: 'HOURLY' }); }); dList.forEach(function (a) { entries.push({ apt: a, kind: 'DAILY' }); });
  if (!entries.length) return buildQueueFlex_('[ไม่มีนัดหมายที่ถึงกำหนดแจ้งเตือน]', 0, [], webAppUrl, maskContact);
  var qWarn = (qInfo && qInfo.limit > 0 && (qInfo.used / qInfo.limit) >= 0.8) ? ('[เตือนโควตา LINE] ใช้ไปแล้ว ' + qInfo.used + '/' + qInfo.limit + ' ข้อความ') : '', dailyTag = '[สรุปคิวงานล่วงหน้า ' + fmtThaiDate_(todayDateStr) + ']';
  var makeBubble = function (e, warn) { var isH = e.kind === 'HOURLY';
    return buildAptBubble_(e.apt, { maskContact: maskContact, webAppUrl: webAppUrl, hdrOverride: isH ? '[แจ้งเตือนก่อนเวลานัด]' : dailyTag, bgHdrOverride: isH ? '#fffbeb' : '#f0f9ff', hdrColorOverride: isH ? '#b45309' : '#0369a1', subColorOverride: isH ? '#d97706' : '#0284c7', sepColorOverride: isH ? '#fde68a' : '#bae6fd', quotaWarnText: warn || '' }); };
  if (entries.length === 1) return wrapFlex_((entries[0].kind === 'HOURLY' ? '[แจ้งเตือนก่อนเวลานัด]' : '[สรุปคิวงานล่วงหน้า]') + ' [' + (entries[0].apt.id || '') + '] ' + (entries[0].apt.title || ''), makeBubble(entries[0], qWarn));
  var bubbles = entries.slice(0, entries.length > 9 ? 9 : entries.length).map(function (e, idx) { return makeBubble(e, entries.length <= 9 && idx === 0 ? qWarn : ''); });
  if (entries.length > 9) { var ov = entries.slice(9), ovRows = ov.slice(0, 6).map(function (e, i) { return fBox('baseline', [fTxt((10 + i) + '. ' + (e.apt.appointmentTime ? e.apt.appointmentTime + ' น.' : '-'), { size: 'xs', color: '#4f46e5', weight: 'bold', flex: 3 }), fTxt(e.apt.title || '-', { size: 'xs', color: '#1e293b', flex: 7, wrap: true })], { spacing: 'sm', margin: 'xs' }); });
    if (ov.length > 6) ovRows.push(fTxt('...และอีก ' + (ov.length - 6) + ' รายการบนเว็บแอป', { size: 'xs', color: '#64748b', margin: 'sm' }));
    var sumBody = [fTxt('รายการนัดหมายที่เหลืออีก ' + ov.length + ' รายการ', { weight: 'bold', size: 'md', color: '#0f172a', wrap: true }), fSep('#c7d2fe'), fBox('vertical', ovRows, { spacing: 'xs', margin: 'sm' })];
    if (qWarn) sumBody.push(fBox('vertical', [fTxt(qWarn, { size: 'xs', color: '#b45309', weight: 'bold', wrap: true })], { backgroundColor: '#fffbeb', cornerRadius: 'md', paddingAll: 'sm', margin: 'md' }));
    bubbles.push(fBubble('#eef2ff', [fTxt('[สรุปคิวงานเพิ่มเติม]', { weight: 'bold', color: '#4338ca', size: 'sm' }), fTxt('รวมทั้งหมดในรอบนี้ ' + entries.length + ' รายการ', { size: 'xs', color: '#4f46e5', margin: 'xs' })], sumBody, fLinkFt(webAppUrl, 'ดูตารางงานทั้งหมดบนเว็บแอป'))); }
  var alt = hList.length && dList.length ? ('[แจ้งเตือน ' + hList.length + ' นัดด่วน + ' + dList.length + ' คิวล่วงหน้า]') : (hList.length ? '[แจ้งเตือนก่อนเวลานัด] ' + hList.length + ' รายการ' : dailyTag + ' ' + dList.length + ' รายการ');
  return wrapFlex_(alt, { type: 'carousel', contents: bubbles }); }
function testNotification_(isDry, custom) { var t = getProp_('LINE_TARGET_ID');
  if (custom) return pushLine_(t, custom, Utilities.getUuid(), isDry, isDry ? 'DRY_RUN' : 'MANUAL_TEST', 'TEST');
  var sample = { id: 'APT-TEST-001', title: 'ทดสอบระบบแจ้งเตือนแบบโต้ตอบ (Zero-Emoji)', appointmentDate: getBkkNow_().dateStr, appointmentTime: '14:00', location: 'ห้องประชุมใหญ่ ชั้น 5', contactPerson: 'คุณทดสอบ', status: STATUS.CONFIRMED, createdBy: 'ผู้ดูแลระบบ', notes: 'ทดสอบปุ่มเสร็จสิ้นและยกเลิกบน LINE Flex Message' };
  return pushLine_(t, buildAptFlexMsg_(sample, false, false, ''), Utilities.getUuid(), isDry, isDry ? 'DRY_RUN' : 'MANUAL_TEST', 'TEST'); }
function sendInstantAptNotification_(apt, isUpdate) { var target = getProp_('LINE_TARGET_ID'); if (!target || !apt) return { sent: false, reason: 'NO_TARGET' };
  var m = getMetaMap_(), st = normalizeStatus_(apt.status), notifType = st === STATUS.COMPLETED ? 'INSTANT_COMPLETED' : (st === STATUS.CANCELLED ? 'INSTANT_CANCELLED' : (isUpdate && apt.reopened ? 'INSTANT_REOPEN' : (isUpdate ? 'INSTANT_UPDATE' : 'INSTANT_CREATE')));
  var pushRes = pushLine_(target, buildAptFlexMsg_(apt, isUpdate, String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE', m.WEB_APP_URL || ''), Utilities.getUuid(), false, notifType, apt.id);
  if (pushRes.ok) updateMeta_({ CACHED_QUOTA_USED: String((+m.CACHED_QUOTA_USED || 0) + 1) }); return { sent: pushRes.ok, httpStatus: pushRes.httpStatus, error: pushRes.error }; }
function refreshLineQuotaCache_() { var token = getProp_('LINE_CHANNEL_ACCESS_TOKEN'), m = getMetaMap_(), lim = +m.CACHED_QUOTA_LIMIT || 300, used = +m.CACHED_QUOTA_USED || 0;
  if (!token) return { limit: lim, used: used }; try { var hdrs = { Authorization: 'Bearer ' + token };
    var resps = UrlFetchApp.fetchAll([{ url: 'https://api.line.me/v2/bot/message/quota', method: 'get', headers: hdrs, muteHttpExceptions: true }, { url: 'https://api.line.me/v2/bot/message/quota/consumption', method: 'get', headers: hdrs, muteHttpExceptions: true }]);
    if (resps[0].getResponseCode() === 200) lim = +JSON.parse(resps[0].getContentText()).value || lim;
    if (resps[1].getResponseCode() === 200) used = +JSON.parse(resps[1].getContentText()).totalUsage || used;
    updateMeta_({ CACHED_QUOTA_LIMIT: String(lim), CACHED_QUOTA_USED: String(used), QUOTA_UPDATED_AT: getBkkNow_().isoStr }); return { limit: lim, used: used }; } catch (e) { return { limit: lim, used: used, error: e.message }; } }
function handleLinePostback_(ev, gid, uid) {
  var pbData = parseQueryString_((ev && ev.postback && ev.postback.data) || ''), action = pbData.action || '', id = pbData.id || '';
  if (!id) return buildNoticeFlex_('-', 'ข้อมูลไม่ถูกต้อง', 'ไม่พบรหัสนัดหมายในการทำรายการ', '', '', '');
  var actingUser = (action === 'quickComplete' || action === 'quickCancel') ? getLineUserName_(gid, uid, getProp_('LINE_CHANNEL_ACCESS_TOKEN')) : '';
  return withLock_(function () {
    var targetApt = readAllApts_(false).filter(function (a) { return a.id === id; })[0];
    if (!targetApt) return buildNoticeFlex_(id, 'ไม่พบรายการนัดหมาย', 'ไม่พบรายการนัดหมาย ' + id + ' ในระบบ (อาจถูกลบไปแล้ว)', '', '', '');
    var curSt = normalizeStatus_(targetApt.status);
    if (curSt === STATUS.COMPLETED) return buildNoticeFlex_(id, 'รายการนี้ได้รับการดำเนินการไปแล้ว', 'นัดหมายนี้ได้รับการบันทึกเสร็จสิ้นไปแล้ว', STATUS.COMPLETED, (targetApt.statusChangedBy || 'ผู้ใช้งาน') + (targetApt.statusChangedAt ? ' เมื่อ ' + fmtThaiDate_(targetApt.statusChangedAt.slice(0, 10)) : ''), '');
    if (curSt === STATUS.CANCELLED) return buildNoticeFlex_(id, 'รายการนี้ได้รับการดำเนินการไปแล้ว', 'นัดหมายนี้ได้รับการยกเลิกไปแล้ว', STATUS.CANCELLED, targetApt.statusChangedBy || 'ผู้ใช้งาน', targetApt.statusReason || '');
    if (action === 'quickComplete') {
      updateApt_(id, { status: STATUS.COMPLETED, statusChangedBy: actingUser, statusReason: 'เสร็จสิ้นการนัดหมายผ่าน LINE', updatedBy: actingUser }, targetApt.updatedAt, 'เสร็จสิ้นผ่าน LINE', actingUser);
      return buildStatusResultFlex_(targetApt, 'COMPLETED', actingUser, '', getBkkNow_().timeStr); }
    if (action === 'quickCancel') { var cancelReason = 'ยกเลิกผ่าน LINE โดย ' + actingUser;
      updateApt_(id, { status: STATUS.CANCELLED, statusChangedBy: actingUser, statusReason: cancelReason, updatedBy: actingUser }, targetApt.updatedAt, cancelReason, actingUser);
      return buildStatusResultFlex_(targetApt, 'CANCELLED', actingUser, cancelReason, getBkkNow_().timeStr); }
    return null; }); }
function handleLineWebhook_(body, qParams) { var expKey = getProp_('WEBHOOK_SECRET_KEY');
  if (expKey && String(qParams.webhookKey || '') !== expKey) return json_({ ok: false, error: 'INVALID_KEY' }); var cache = CacheService.getScriptCache();
  var grps = getProp_('ALLOWED_GROUP_IDS').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var usrs = getProp_('ALLOWED_USER_IDS').split(',').map(function (s) { return s.trim(); }).filter(Boolean); (body.events || []).forEach(function (ev) {
    if (ev.webhookEventId && cache.get('WH_' + ev.webhookEventId)) return; if (ev.webhookEventId) cache.put('WH_' + ev.webhookEventId, '1', 600);
    var src = ev.source || {}, gid = src.groupId || src.roomId || '', uid = src.userId || '';
    if (ev.type === 'join') { appendPlainRow_(ensureSheet_(getSs_(), SH_NOTIF_LOGS, NOTIF_LOG_COLS), ['NLOG-' + Date.now(), getBkkNow_().isoStr, 'JOIN', '-', gid || uid, '200', '-', 'พบ ID สำหรับตั้งค่า: ' + (gid || uid)]); return; }
    if (grps.length && grps.indexOf(gid) === -1 && (!usrs.length || usrs.indexOf(uid) === -1)) return;
    if (ev.type === 'postback') { var pb = handleLinePostback_(ev, gid, uid); if (pb && ev.replyToken) sendLineReply_(ev.replyToken, pb); return; }
    if (ev.type === 'message' && ev.message && ev.message.type === 'text') { var reply = parseWebhookCmd_(ev.message.text); if (reply && ev.replyToken) sendLineReply_(ev.replyToken, reply); }
  }); return json_({ ok: true }); }
function parseWebhookCmd_(raw) { var txt = sanitizeNoEmoji(raw || '').trim();
  var isLegacy = /^คิว(?:\s+|ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ|$)/.test(txt);
  var isShort = /^(?:ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ|help|เดือน\s+\d{1,2}[-/]\d{4}|ปี\s*\d{4}|ค้นหา\s+.+)$/i.test(txt);
  if (!isLegacy && !isShort) return null; var m = getMetaMap_(), webAppUrl = m.WEB_APP_URL || '';
  if (String(m.ENABLE_LINE_BOT_QUERY).toUpperCase() === 'FALSE') return buildNoticeFlex_('-', 'ระบบปิดค้นหาชั่วคราว', 'ผู้ดูแลระบบปิดการค้นหาผ่านแชทชั่วคราว กรุณาดูบนเว็บแอป', '', '', '');
  var arg = txt.replace(/^คิว\s*/, '').trim(); if (!arg || arg === 'ช่วยเหลือ' || arg.toLowerCase() === 'help') return buildHelpFlex_(webAppUrl);
  if (arg === 'โควตา') return buildQuotaFlex_(m.CACHED_QUOTA_USED || '0', m.CACHED_QUOTA_LIMIT || '300', webAppUrl);
  var now = getBkkNow_(), list = readAllApts_(), mask = String(m.PRIVACY_MASK_CONTACT).toUpperCase() === 'TRUE';
  var sendQ = function (title, arr, opts) { var s = arr.sort(cmpSlot_); return buildQueueFlex_(title, s.length, s.slice(0, 5), webAppUrl, mask, opts); };
  if (arg === 'ทั้งหมด' || arg === 'นัดทั้งหมด' || arg === 'งานทั้งหมด') return sendQ('[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด]', list.filter(function (a) { return a.status === STATUS.CONFIRMED && a.appointmentDate >= now.dateStr; }));
  if (arg === 'วันนี้' || arg === 'พรุ่งนี้') { var dt = arg === 'วันนี้' ? now.dateStr : getBkkNow_(now.epochMs + 86400000).dateStr;
    return sendQ('[คิวงาน' + arg + ' ' + fmtThaiDate_(dt) + ']', list.filter(function (a) { return a.appointmentDate === dt && a.status !== STATUS.CANCELLED; }), arg === 'วันนี้' ? { variant: 'today' } : undefined); }
  if (arg === 'สัปดาห์นี้') return sendQ('[คิวงานใน 7 วันข้างหน้า]', list.filter(function (a) { return a.appointmentDate && a.status !== STATUS.CANCELLED && [diffDays_(now.dateStr, a.appointmentDate)].some(function (d) { return d !== null && d >= 0 && d <= 7; }); }));
  if (arg === 'ค้างอยู่') return sendQ('[คิวงานเลยกำหนดเวลา]', list.filter(function (a) { if (a.status !== STATUS.CONFIRMED || !a.appointmentDate) return false; var ep = bkkSlotToEpoch_(a.appointmentDate, a.appointmentTime || '23:59'); return ep !== null && now.epochMs > ep; }), { variant: 'overdue' });
  if (arg === 'เดือนนี้') { var pfx = now.year + '-' + pad2_(now.month) + '-'; return sendQ('[งานเดือน' + TH_MONTHS[now.month - 1] + ' ' + (now.year + 543) + ']', list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(pfx) === 0; })); }
  var mm = arg.match(/^เดือน\s+(\d{1,2})[-/](\d{4})$/); if (mm) { var yr = +mm[2], mo = +mm[1]; if (yr > 2400) yr -= 543;
    return (mo >= 1 && mo <= 12) ? sendQ('[งานเดือน' + (TH_MONTHS[mo - 1] || mo) + ' ' + (yr + 543) + ']', list.filter(function (a) { return a.appointmentDate && a.appointmentDate.indexOf(yr + '-' + pad2_(mo) + '-') === 0; })) : buildNoticeFlex_('-', 'รูปแบบเดือนไม่ถูกต้อง', 'กรุณาระบุรูปแบบเดือน เช่น เดือน 12/2569', '', '', ''); }
  if (arg === 'ปีนี้' || arg === 'ปีหน้า') {
    var ty = arg === 'ปีนี้' ? now.year : now.year + 1, yPfx = ty + '-', total = 0, act = 0, comp = 0, canc = 0;
    list.forEach(function (a) { if (!a.appointmentDate || a.appointmentDate.indexOf(yPfx) !== 0) return; total++;
      if (a.status === STATUS.COMPLETED) comp++; else if (a.status === STATUS.CANCELLED) canc++; else act++; });
    return buildYearStatsFlex_(ty, total, act, comp, canc, total > 0 ? Math.round((comp / total) * 100) : 0, [], webAppUrl); }
  var sm = arg.match(/^ค้นหา\s+(.+)$/); if (sm) { var kw = sm[1].trim().toLowerCase();
    return sendQ('[ผลการค้นหา "' + sm[1].trim() + '"]', list.filter(function (a) { return (a.id + ' ' + a.title + ' ' + a.location + ' ' + a.contactPerson + ' ' + (a.createdBy || '') + ' ' + (a.statusChangedBy || '')).toLowerCase().indexOf(kw) !== -1; })); }
  return buildHelpFlex_(webAppUrl); }
