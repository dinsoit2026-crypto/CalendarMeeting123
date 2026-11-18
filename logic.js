/** logic.js - Core Domain Logic, Bangkok Timezone, Notification & Analytics Engine (v2.6.7) */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.CalendarLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () { 'use strict';
  const API_VERSION = '2.6.7', BKK_OFFSET_MS = 7 * 3600 * 1000, LINE_MAX_LEN = 4500, S_SYS = 'ผู้ใช้งานระบบ', NO_ITEM = 'ไม่มีรายการนัดหมาย';
  const STATUS = Object.freeze({ CONFIRMED: 'เริ่มนัด', COMPLETED: 'สิ้นสุดการนัดหมาย', CANCELLED: 'ยกเลิกการนัดหมาย' });
  const S_CF = STATUS.CONFIRMED, S_CP = STATUS.COMPLETED, S_CN = STATUS.CANCELLED, VALID_STATUSES = Object.freeze([S_CF, S_CP, S_CN]);
  const USER_ROLES = Object.freeze({ ADMIN: 'ADMIN', STAFF: 'STAFF' }), DEF_TS = '2026-11-01T08:00:00+07:00';
  const THAI_MONTHS_SHORT = Object.freeze(['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']);
  const THAI_MONTHS_FULL = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
  const EMOJI_EXT_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic}(?:\uFE0F|\u200D(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic})*)/gu;
  const EMOJI_MOD_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;
  const FAST_SAFE_RE = /^[\x00-\x7F\u0E00-\u0E7F]*$/, ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/, TIME_24_RE = /^(\d{2}):(\d{2})$/;
  const hasEmoji = s => typeof s === 'string' && s.length > 0 && !FAST_SAFE_RE.test(s) && (EMOJI_EXT_RE.lastIndex = EMOJI_MOD_RE.lastIndex = 0, EMOJI_EXT_RE.test(s) || EMOJI_MOD_RE.test(s));
  const sanitizeNoEmoji = s => { if (s == null) return ''; const str = String(s); return (FAST_SAFE_RE.test(str) ? str : str.replace(EMOJI_EXT_RE, '').replace(EMOJI_MOD_RE, '')).replace(/[ \t]{2,}/g, ' ').trim(); }, sn = sanitizeNoEmoji;
  const clipTxt = (s, fn) => (s = sn(s), s.length > LINE_MAX_LEN ? s.slice(0, LINE_MAX_LEN - 80) + `\n...(ดูเพิ่มเติมบน${fn ? 'หน้า' : ''}เว็บแอป)` : s);
  const normalizeStatus = st => (st === S_CF || st === S_CP || st === S_CN) ? st : ((!st || ((st = sn(st)) !== S_CP && st !== S_CN)) ? S_CF : st), ns = normalizeStatus;
  const SHA_H = [], SHA_K = [], _pwCache = new Map();
  (() => { const maxW = 4294967296, comp = {}; for (let c = 2, pCnt = 0; pCnt < 64; c++) if (!comp[c]) { for (let i = 0; i < 313; i += c) comp[i] = c;
    if (pCnt < 8) SHA_H[pCnt] = (Math.pow(c, 0.5) * maxW) | 0; SHA_K[pCnt++] = (Math.pow(c, 1 / 3) * maxW) | 0; } })();
  function hashPassword(str) { const key = String(str || ''); if (_pwCache.has(key)) return _pwCache.get(key);
    const raw = unescape(encodeURIComponent(key)), maxW = 4294967296, words = [], bitLen = raw.length * 8;
    let hash = SHA_H.slice(), ascii = raw + '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8; words.push((bitLen / maxW) | 0, bitLen);
    for (let j = 0; j < words.length;) { const w = words.slice(j, j += 16), old = hash.slice(0, 8); for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        const t1 = hash[7] + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & hash[5]) ^ ((~e) & hash[6])) + SHA_K[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + ((w15 >>> 7 | w15 << 25) ^ (w15 >>> 18 | w15 << 14) ^ (w15 >>> 3)) + w[i - 7] + ((w2 >>> 17 | w2 << 15) ^ (w2 >>> 19 | w2 << 13) ^ (w2 >>> 10))) | 0);
        const t2 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0, a, hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]]; }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0; }
    let out = ''; for (let i = 0; i < 8; i++) for (let j = 3; j >= 0; j--) out += (((hash[i] >> (j * 8)) & 255) + 256).toString(16).slice(1);
    if (_pwCache.size < 256) _pwCache.set(key, out); return out; }
  const DEFAULT_USERS = Object.freeze([
    { userId: 'USR-001', username: 'admin', displayName: 'ผู้ดูแลระบบ', role: 'ADMIN', passwordHash: hashPassword('admin'), isActive: true, createdAt: DEF_TS },
    { userId: 'USR-002', username: 'somchai', displayName: 'คุณสมชาย', role: 'STAFF', passwordHash: hashPassword('1234'), isActive: true, createdAt: DEF_TS },
    { userId: 'USR-003', username: 'wipada', displayName: 'คุณวิภาดา', role: 'STAFF', passwordHash: hashPassword('1234'), isActive: true, createdAt: DEF_TS } ]);
  function authenticateUser(users, username, password) { const un = sn(username || '').toLowerCase(), pw = String(password || ''); if (!un || !pw) return { ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    const found = (Array.isArray(users) && users.length ? users : DEFAULT_USERS).find(u => u && sn(u.username).toLowerCase() === un);
    if (!found) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' }; if (found.isActive === false || String(found.isActive).toUpperCase() === 'FALSE') return { ok: false, error: 'บัญชีนี้ถูกระงับการใช้งาน' };
    return found.passwordHash !== hashPassword(pw) ? { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' } : { ok: true, user: { userId: found.userId, username: found.username, displayName: sn(found.displayName || found.username), role: found.role === 'ADMIN' ? 'ADMIN' : 'STAFF' } }; }
  function validateUserInput(input, isCreate = true) { const errs = [], un = sn(input.username || '').toLowerCase(), disp = sn(input.displayName || '');
    if (isCreate) { if (!un || un.length < 3 || un.length > 30 || !/^[a-z0-9_.-]+$/.test(un)) errs.push('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 3-30 ตัวอักษร'); if (!input.password || String(input.password).length < 4) errs.push('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร'); }
    if (!disp) errs.push('กรุณาระบุชื่อ-นามสกุล หรือชื่อเรียก');
    return { valid: !errs.length, errors: errs, sanitized: { username: un, displayName: disp, role: (input.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF', isActive: input.isActive !== false && String(input.isActive).toUpperCase() !== 'FALSE', passwordHash: input.password ? hashPassword(input.password) : (input.passwordHash || '') } }; }
  function registerUserAccount(users, input, nowIso) { if (!input || typeof input !== 'object') return { ok: false, error: 'ข้อมูลการสมัครสมาชิกไม่ถูกต้อง' };
    const pw = String(input.password || ''), confirmPw = input.confirmPassword !== undefined ? String(input.confirmPassword || '') : pw; if (pw !== confirmPw) return { ok: false, error: 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน' };
    const v = validateUserInput({ ...input, role: 'STAFF', isActive: true }, true); if (!v.valid) return { ok: false, error: v.errors.join(' | ') };
    const s = v.sanitized, list = Array.isArray(users) ? users : DEFAULT_USERS;
    if (list.some(u => u && sn(u.username || '').toLowerCase() === s.username)) return { ok: false, error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
    if (list.some(u => u && sn(u.displayName || '').toLowerCase() === s.displayName.toLowerCase())) return { ok: false, error: 'ชื่อที่ใช้แสดงผลนี้มีอยู่ในระบบแล้ว กรุณาระบุชื่อหรือแผนกเพิ่มเติม' };
    const maxNum = list.reduce((m, u) => { const n = u && u.userId && String(u.userId).startsWith('USR-') ? parseInt(String(u.userId).slice(4), 10) : 0; return n > m ? n : m; }, 0);
    const userId = `USR-${String(maxNum + 1).padStart(3, '0')}`, now = gb(nowIso).isoStr, record = { userId, username: s.username, displayName: s.displayName, role: 'STAFF', passwordHash: s.passwordHash, isActive: true, createdAt: now, lastLoginAt: now };
    return { ok: true, record, user: { userId, username: record.username, displayName: record.displayName, role: 'STAFF' } }; }
  const pad2 = n => String(Math.floor(Math.abs(Number(n) || 0))).padStart(2, '0'), normalizeYearToCE = y => { const n = Number(String(y || '').trim()); return !Number.isInteger(n) || n < 1900 || n > 3000 ? null : (n > 2400 ? n - 543 : n); };
  const toBuddhistYear = ce => { const y = normalizeYearToCE(ce); return y ? y + 543 : null; }, isLeapYearCE = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0, MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const getDaysInMonth = (y, m) => { const ce = normalizeYearToCE(y), mi = Number(m); return !ce || mi < 1 || mi > 12 ? 0 : (mi === 2 && isLeapYearCE(ce) ? 29 : MDAYS[mi - 1]); };
  function parseFlexibleDateInput(raw) { const s = String(raw || '').trim(); if (!s) return '';
    let y, m, d, m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/), m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m1) [y, m, d] = [normalizeYearToCE(m1[1]), +m1[2], +m1[3]]; else if (m2) [d, m, y] = [+m2[1], +m2[2], normalizeYearToCE(m2[3])]; else return null;
    return !y || m < 1 || m > 12 || d < 1 || d > getDaysInMonth(y, m) ? null : `${y}-${pad2(m)}-${pad2(d)}`; }
  const pfd = parseFlexibleDateInput, parseTimeInput = raw => { const s = String(raw || '').trim(); if (!s) return ''; const m = s.match(/^(\d{1,2}):(\d{2})$/); return !m || +m[1] > 23 || +m[2] > 59 ? null : `${pad2(m[1])}:${pad2(m[2])}`; };
  let _lastBkkKey = '', _lastBkkVal = null;
  function bangkokSlotToEpochMs(dateStr, timeStr) { let y, m, dy, hh = 0, mm = 0; const dm = typeof dateStr === 'string' && ISO_DATE_RE.exec(dateStr);
    if (dm && +dm[1] >= 1900 && +dm[1] <= 2400) { y = +dm[1]; m = +dm[2]; dy = +dm[3]; if (m < 1 || m > 12 || dy < 1 || dy > (m === 2 && isLeapYearCE(y) ? 29 : MDAYS[m - 1])) return null; }
    else { const d = pfd(dateStr); if (!d) return null; y = +d.slice(0, 4); m = +d.slice(5, 7); dy = +d.slice(8, 10); }
    const ts = timeStr || '00:00', tm = typeof ts === 'string' && TIME_24_RE.exec(ts);
    if (tm) { hh = +tm[1]; mm = +tm[2]; if (hh > 23 || mm > 59) return null; } else { const t = parseTimeInput(ts); if (!t) return null; hh = +t.slice(0, 2); mm = +t.slice(3, 5); }
    return Date.UTC(y, m - 1, dy, hh, mm, 0, 0) - BKK_OFFSET_MS; }
  const toEp = bangkokSlotToEpochMs;
  function parseToEpochMs(isoOrDate) { if (isoOrDate instanceof Date) return isoOrDate.getTime(); if (typeof isoOrDate === 'number') return isoOrDate;
    const s = String(isoOrDate || '').trim(); if (!s) return Date.now(); const slot = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
    if (slot) { const base = toEp(slot[1], slot[2]); return base !== null ? base + (slot[3] ? +slot[3] * 1000 : 0) : Date.now(); }
    const p = Date.parse(s); return Number.isNaN(p) ? Date.now() : p; }
  function getBangkokParts(isoOrDate) { const isStr = typeof isoOrDate === 'string' && isoOrDate.length > 0; if (isStr && isoOrDate === _lastBkkKey) return _lastBkkVal;
    const epochMs = parseToEpochMs(isoOrDate), b = new Date(epochMs + BKK_OFFSET_MS), year = b.getUTCFullYear(), month = b.getUTCMonth() + 1, day = b.getUTCDate(), hour = b.getUTCHours(), minute = b.getUTCMinutes(), second = b.getUTCSeconds();
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`, timeStr = `${pad2(hour)}:${pad2(minute)}`, res = { epochMs, year, buddhistYear: year + 543, month, day, hour, minute, second, dateStr, timeStr, slotStr: `${dateStr}T${timeStr}`, isoStr: `${dateStr}T${timeStr}:${pad2(second)}+07:00` };
    if (isStr) { _lastBkkKey = isoOrDate; _lastBkkVal = res; } return res; }
  const gb = getBangkokParts, daysBetweenDates = (s, e) => { const sm = toEp(s, '00:00'), em = toEp(e, '00:00'); return sm === null || em === null ? null : Math.round((em - sm) / 86400000); };
  const formatThaiDateDisplay = (dateStr, includeCE = true) => { const d = pfd(dateStr); return !d ? 'ยังไม่กำหนดวันที่' : `${+d.slice(8, 10)} ${THAI_MONTHS_SHORT[+d.slice(5, 7) - 1]} ${+d.slice(0, 4) + 543}` + (includeCE ? ` (${d})` : ''); }, ftd = formatThaiDateDisplay;
  const isActiveStatus = st => ns(st) === S_CF, isAct = isActiveStatus, buildAppointmentSlot = a => a && a.appointmentDate && a.appointmentTime ? `${a.appointmentDate}T${a.appointmentTime}` : '';
  const cmpSlot = (a, b) => { const ad = (a && a.appointmentDate) || '', bd = (b && b.appointmentDate) || '';
    if (ad && bd && a.appointmentTime && b.appointmentTime) return ad < bd ? -1 : (ad > bd ? 1 : (a.appointmentTime < b.appointmentTime ? -1 : (a.appointmentTime > b.appointmentTime ? 1 : 0)));
    const sa = buildAppointmentSlot(a), sb = buildAppointmentSlot(b); return sa < sb ? -1 : (sa > sb ? 1 : 0); };
  function isPastBkkSlot(d, t, bkk) { if (!d || !t) return false; let y, m, dy;
    if (ISO_DATE_RE.test(d) && TIME_24_RE.test(t) && (y = +d.slice(0, 4)) >= 1900 && y <= 2400 && (m = +d.slice(5, 7)) >= 1 && m <= 12 && (dy = +d.slice(8, 10)) >= 1 && dy <= (m === 2 && isLeapYearCE(y) ? 29 : MDAYS[m - 1]) && +t.slice(0, 2) <= 23 && +t.slice(3, 5) <= 59 && d !== bkk.dateStr) return d < bkk.dateStr;
    const ep = toEp(d, t); return ep !== null && bkk.epochMs > ep; }
  const isOverdue = (a, nowIso) => Boolean(a && !a.deletedAt && isAct(a.status) && isPastBkkSlot(a.appointmentDate, a.appointmentTime, gb(nowIso)));
  const findTimeConflicts = (appointments, dateStr, timeStr, excludeId) => { const d = pfd(dateStr), t = parseTimeInput(timeStr);
    return (!d || !t) ? [] : (appointments || []).filter(a => a && !a.deletedAt && (!excludeId || a.id !== excludeId) && ns(a.status) !== S_CN && a.appointmentDate === d && a.appointmentTime === t); };
  const validateAppointmentInput = input => { if (!input || typeof input !== 'object') return { valid: false, errors: ['ข้อมูลไม่ถูกต้อง'] };
    const errs = [], title = sn(input.title || ''), status = ns(input.status), location = sn(input.location || ''), contactPerson = sn(input.contactPerson || '');
    const pDate = input.appointmentDate ? pfd(input.appointmentDate) : '', pTime = input.appointmentTime ? parseTimeInput(input.appointmentTime) : '';
    if (!title) errs.push('กรุณาระบุหัวข้องาน'); if (!pDate) errs.push('กรุณาระบุวันที่นัดหมาย'); if (!pTime) errs.push('กรุณาระบุเวลานัดหมาย (HH:mm)');
    if (!location) errs.push('กรุณาระบุสถานที่นัดหมาย'); if (!contactPerson) errs.push('กรุณาระบุชื่อผู้นัดพบ');
    if (input.appointmentDate && pDate === null) errs.push('รูปแบบวันที่ไม่ถูกต้อง'); if (input.appointmentTime && pTime === null) errs.push('รูปแบบเวลาไม่ถูกต้อง (HH:mm)');
    const rDays = input.remindDaysBefore != null && input.remindDaysBefore !== '' ? Number(input.remindDaysBefore) : 0, rHours = input.remindHoursBefore != null && input.remindHoursBefore !== '' ? Number(input.remindHoursBefore) : 0;
    if (!Number.isInteger(rDays) || rDays < 0 || rDays > 365) errs.push('จำนวนวันแจ้งเตือนต้องเป็น 0-365'); if (!Number.isInteger(rHours) || rHours < 0 || rHours > 168) errs.push('จำนวนชั่วโมงแจ้งเตือนต้องเป็น 0-168');
    const mapUrl = sn(input.mapUrl || ''), imageUrl = sn(input.imageUrl || ''); if (imageUrl.length > 48000) errs.push('ขนาดไฟล์รูปภาพใหญ่เกินขีดจำกัด (กรุณาใช้รูปภาพขนาดเล็กลง)');
    const createdBy = sn(input.createdBy || input.updatedBy || S_SYS) || S_SYS;
    return { valid: !errs.length, errors: errs, sanitized: { title, appointmentDate: pDate || '', appointmentTime: pTime || '', location, contactPerson, status, remindDaysBefore: rDays, remindHoursBefore: rHours, notes: sn(input.notes || ''), mapUrl, imageUrl, createdBy, updatedBy: sn(input.updatedBy || createdBy) || createdBy, statusChangedBy: sn(input.statusChangedBy || ''), statusChangedAt: sn(input.statusChangedAt || ''), statusReason: sn(input.statusReason || '') } }; };
  const generateAppointmentId = (existing, nowIso) => { const pfx = `APT-${gb(nowIso).dateStr.replace(/-/g, '')}-`;
    return `${pfx}${String((existing || []).reduce((m, x) => (x && x.id && x.id.startsWith(pfx) ? Math.max(m, +x.id.slice(pfx.length) || 0) : m), 0) + 1).padStart(3, '0')}`; };
  function createAppointmentRecord(input, existing, nowIso) { const v = validateAppointmentInput(input); if (!v.valid) throw new Error(v.errors.join(' | '));
    const now = gb(nowIso).isoStr, s = v.sanitized, isChg = s.status !== S_CF;
    return { id: input.id ? sn(input.id) : generateAppointmentId(existing, now), ...s, createdBy: s.createdBy, statusChangedBy: isChg ? (s.statusChangedBy || s.createdBy) : '', statusChangedAt: isChg ? now : '', statusReason: isChg ? s.statusReason : '', notifiedDayForSlot: '', notifiedHourForSlot: '', rescheduleCount: 0, createdAt: now, updatedAt: now, deletedAt: '' }; }
  function updateAppointmentRecord(existing, patch, options) { if (!existing || !existing.id) throw new Error('ไม่พบรายการนัดหมาย');
    const opts = options || {}; if (opts.expectedUpdatedAt && existing.updatedAt && opts.expectedUpdatedAt !== existing.updatedAt) { const err = new Error('ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรชก่อนทำรายการ'); err.code = 'CONCURRENCY_CONFLICT'; throw err; }
    const v = validateAppointmentInput({ ...existing, ...patch }); if (!v.valid) throw new Error(v.errors.join(' | '));
    const s = v.sanitized, bkk = gb(opts.nowIso), reason = sn(patch.reason || opts.reason || patch.statusReason || ''), dateChanged = String(existing.appointmentDate || '') !== String(s.appointmentDate || ''), timeChanged = String(existing.appointmentTime || '') !== String(s.appointmentTime || ''), statusChanged = ns(existing.status) !== ns(s.status), reopened = !isAct(existing.status) && isAct(s.status);
    const logs = ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status'].filter(f => String(existing[f] || '') !== String(s[f] || '')).map((f, i) => ({ logId: `LOG-${bkk.epochMs}-${i + 1}`, appointmentId: existing.id, changedAt: bkk.isoStr, changedBy: s.updatedBy, fieldChanged: f, oldValue: String(existing[f] || ''), newValue: String(s[f] || ''), reason }));
    const countInc = ((existing.appointmentDate || existing.appointmentTime) && (dateChanged || timeChanged)) ? 1 : 0, suppressReset = Boolean(opts.suppressSlotReset && !dateChanged && !timeChanged && +existing.remindDaysBefore === +s.remindDaysBefore && +existing.remindHoursBefore === +s.remindHoursBefore);
    const curSlot = buildAppointmentSlot(s), epNow = (s.appointmentDate && s.appointmentTime) ? toEp(s.appointmentDate, s.appointmentTime) : null, diffD = s.appointmentDate ? daysBetweenDates(bkk.dateStr, s.appointmentDate) : null, diffH = epNow ? (epNow - bkk.epochMs) / 3600000 : -1;
    let daySlot = suppressReset ? (existing.notifiedDayForSlot || '') : ((dateChanged || reopened || +existing.remindDaysBefore !== +s.remindDaysBefore) ? '' : (existing.notifiedDayForSlot || '')), hourSlot = suppressReset ? (existing.notifiedHourForSlot || '') : ((dateChanged || timeChanged || reopened || +existing.remindHoursBefore !== +s.remindHoursBefore) ? '' : (existing.notifiedHourForSlot || ''));
    if (suppressReset && reopened) { if (!daySlot && s.appointmentDate && +s.remindDaysBefore > 0 && diffD !== null && diffD <= +s.remindDaysBefore) daySlot = s.appointmentDate; if (!hourSlot && curSlot && +s.remindHoursBefore > 0 && diffH > 0 && diffH <= +s.remindHoursBefore) hourSlot = curSlot; }
    const createdBy = existing.createdBy || s.createdBy || existing.updatedBy || S_SYS;
    let statusChangedBy = existing.statusChangedBy || '', statusChangedAt = existing.statusChangedAt || '', statusReason = existing.statusReason || '';
    if (statusChanged) { if (s.status === S_CF) statusChangedBy = statusChangedAt = statusReason = ''; else { statusChangedBy = sn(patch.statusChangedBy || s.updatedBy || S_SYS); statusChangedAt = bkk.isoStr; statusReason = sn(patch.statusReason || reason || ''); } } else if (patch.statusReason !== undefined) statusReason = sn(patch.statusReason);
    return { record: { ...existing, ...s, createdBy, statusChangedBy, statusChangedAt, statusReason, notifiedDayForSlot: daySlot, notifiedHourForSlot: hourSlot, rescheduleCount: (+existing.rescheduleCount || 0) + countInc, updatedAt: bkk.isoStr, updatedBy: s.updatedBy }, logs, dateChanged, timeChanged, reopened, statusChanged }; }
  const isInQuietHours = (h, s = 22, e = 7) => { const hi = +h, si = +s, ei = +e; return si === ei ? false : (si > ei ? (hi >= si || hi < ei) : (hi >= si && hi < ei)); };
  function evaluateAppointmentNotification(apt, nowIso, settings) { const cfg = settings || {};
    if (!apt || apt.deletedAt || !isAct(apt.status) || !apt.appointmentDate || !apt.appointmentTime) return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'INVALID_OR_INACTIVE' };
    const nowBkk = gb(nowIso), aptEp = toEp(apt.appointmentDate, apt.appointmentTime); if (aptEp === null || nowBkk.epochMs >= aptEp) return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'PAST' };
    const quiet = isInQuietHours(nowBkk.hour, cfg.quietHoursStart, cfg.quietHoursEnd), curSlot = buildAppointmentSlot(apt), rHours = +apt.remindHoursBefore || 0, rDays = +apt.remindDaysBefore || 0, diffH = (aptEp - nowBkk.epochMs) / 3600000;
    if (rHours > 0 && apt.notifiedHourForSlot !== curSlot && diffH > 0 && diffH <= rHours && (!quiet || cfg.allowHourlyInQuietHours)) return { shouldNotifyDay: false, shouldNotifyHour: true, supersedesDay: true, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffHours: diffH, reason: 'HOURLY_DUE' };
    const diffD = Math.floor((aptEp + BKK_OFFSET_MS) / 86400000) - Math.floor((nowBkk.epochMs + BKK_OFFSET_MS) / 86400000);
    if (rDays > 0 && apt.notifiedDayForSlot !== apt.appointmentDate && diffD >= 0 && diffD <= rDays && !quiet && (cfg.requireDigestWindow === false || nowBkk.hour >= (cfg.dailyDigestHour != null ? +cfg.dailyDigestHour : 8))) return { shouldNotifyDay: true, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffCalDays: diffD, reason: 'DAY_DUE' };
    return { shouldNotifyDay: false, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, reason: 'NOT_DUE' }; }
  const maskContact = (c, mask) => !mask || !c || c.length <= 2 ? (c || '-') : `${c.slice(0, 2)}***`, formatAptLine = (a, idx, cfg) => {
    const st = ns(a.status), lines = [`${idx ? `${idx}. ` : ''}[${a.id}] ${sn(a.title)}`, `   วันนัด: ${ftd(a.appointmentDate, false)} เวลา ${a.appointmentTime || '-'} น.`, `   สถานที่: ${sn(a.location || '-')}`, `   ผู้นัดพบ: ${maskContact(a.contactPerson, cfg && cfg.privacyMaskContact)}`, `   สถานะ: [${sn(st)}]`, `   ผู้สร้าง: ${sn(a.createdBy || a.updatedBy || '-')}`];
    if (a.statusChangedBy && st !== S_CF) lines.push(`   ผู้ดำเนินการ: ${sn(a.statusChangedBy)}`); return lines.join('\n'); };
  function buildNotificationPlan(appointments, nowIso, settings) { const cfg = settings || {}, hourly = [], digest = [], slotUpdates = [];
    (Array.isArray(appointments) ? appointments : []).forEach(a => { const ev = evaluateAppointmentNotification(a, nowIso, cfg);
      if (ev.shouldNotifyHour) { hourly.push(a); slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: ev.targetHourSlot, triggerType: 'HOURLY_REMINDER' }); }
      else if (ev.shouldNotifyDay) { digest.push(a); slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: a.notifiedHourForSlot || '', triggerType: 'DAILY_DIGEST' }); } });
    hourly.sort(cmpSlot); digest.sort(cmpSlot); if (!hourly.length && !digest.length) return { shouldPush: false, hourlyItems: [], digestItems: [], slotUpdates: [], messageText: '' };
    const parts = [], bkk = gb(nowIso), limit = +cfg.quotaLimit || 300, used = +cfg.quotaUsed || 0;
    if (hourly.length) parts.push(`[แจ้งเตือนก่อนถึงเวลานัดหมาย] (${hourly.length} รายการ)\n` + hourly.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n'));
    if (digest.length) parts.push(`[สรุปคิวงานล่วงหน้าประจำวัน ${ftd(bkk.dateStr, false)}] (${digest.length} รายการ)\n` + digest.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n'));
    if (limit > 0 && used / limit >= 0.8) parts.push(`[แจ้งเตือนโควตา] เดือนนี้ใช้โควตา LINE ไปแล้ว ${used}/${limit} ข้อความ`); if (cfg.webAppUrl) parts.push(`ดูตารางงาน: ${sn(cfg.webAppUrl)}`);
    return { shouldPush: true, hourlyItems: hourly, digestItems: digest, slotUpdates, messageText: clipTxt(parts.join('\n\n'), 1) }; }
  const mkStats = () => ({ total: 0, active: 0, completed: 0, cancelled: 0, overdue: 0, rescheduleTotal: 0, completionRate: 0, cancellationRate: 0 }), finStats = s => { if (s.total > 0) { s.completionRate = Math.round(s.completed / s.total * 100); s.cancellationRate = Math.round(s.cancelled / s.total * 100); } return s; };
  function calculateYearlyStats(list, nowIso) { const s = mkStats(), bkk = gb(nowIso), arr = list || [];
    for (let i = 0; i < arr.length; i++) { const a = arr[i]; if (!a || a.deletedAt) continue; s.total++; s.rescheduleTotal += (+a.rescheduleCount || 0);
      const st = ns(a.status); if (st === S_CF) { s.active++; if (isPastBkkSlot(a.appointmentDate, a.appointmentTime, bkk)) s.overdue++; } else if (st === S_CP) s.completed++; else s.cancelled++; }
    return finStats(s); }
  function calculateUserStats(list) { const userMap = {}, ensure = name => { const n = sn(name || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ'; return userMap[n] || (userMap[n] = { user: n, createdTotal: 0, completedTotal: 0, cancelledTotal: 0, activeTotal: 0 }); };
    (list || []).forEach(a => { if (!a || a.deletedAt) return; const cBy = sn(a.createdBy || a.updatedBy || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ', cs = ensure(cBy), st = ns(a.status);
      cs.createdTotal++; if (st === S_CF) cs.activeTotal++; else if (st === S_CP) ensure(a.statusChangedBy || cBy).completedTotal++; else if (st === S_CN) ensure(a.statusChangedBy || cBy).cancelledTotal++; });
    return Object.values(userMap).sort((a, b) => (b.createdTotal + b.completedTotal + b.cancelledTotal) - (a.createdTotal + a.completedTotal + a.cancelledTotal) || b.createdTotal - a.createdTotal); }
  function queryByMonth(appointments, yInput, mInput, options) { const ce = normalizeYearToCE(yInput), m = Number(mInput), pfx = `${ce}-${pad2(m)}-`; if (!ce || m < 1 || m > 12) throw new Error('ระบุเดือนหรือปีไม่ถูกต้อง');
    const items = (appointments || []).filter(a => a && !a.deletedAt && a.appointmentDate && a.appointmentDate.startsWith(pfx)).sort(cmpSlot);
    return { ceYear: ce, buddhistYear: ce + 543, month: m, monthNameThai: THAI_MONTHS_FULL[m - 1], items, stats: calculateYearlyStats(items, (options || {}).nowIso) }; }
  function queryByYear(appointments, yInput, options) { const nowIso = (options || {}).nowIso, ce = normalizeYearToCE(yInput), pfx = `${ce}-`; if (!ce) throw new Error('ระบุปีไม่ถูกต้อง');
    const items = (appointments || []).filter(a => a && !a.deletedAt && a.appointmentDate && a.appointmentDate.startsWith(pfx)).sort(cmpSlot), buckets = Array.from({ length: 12 }, () => []), extra = [];
    items.forEach(a => { const mi = +a.appointmentDate.slice(5, 7) - 1; if (mi >= 0 && mi < 12) buckets[mi].push(a); else extra.push(a); });
    const months = buckets.map((mItems, i) => ({ month: i + 1, monthNameThai: THAI_MONTHS_FULL[i], monthShortThai: THAI_MONTHS_SHORT[i], items: mItems, stats: mItems.length ? calculateYearlyStats(mItems, nowIso) : mkStats() })), stats = extra.length ? calculateYearlyStats(extra, nowIso) : mkStats();
    months.forEach(m => { const ms = m.stats; stats.total += ms.total; stats.active += ms.active; stats.completed += ms.completed; stats.cancelled += ms.cancelled; stats.overdue += ms.overdue; stats.rescheduleTotal += ms.rescheduleTotal; });
    return { ceYear: ce, buddhistYear: ce + 543, items, stats: finStats(stats), userStats: calculateUserStats(items), months }; }
  function queryMultiYearOverview(appointments, startY, endY, options) { const opts = options || {}, sCE = normalizeYearToCE(startY), eCE = normalizeYearToCE(endY), years = [];
    if (!sCE || !eCE || eCE < sCE) throw new Error('ช่วงปีไม่ถูกต้อง'); for (let y = sCE; y <= eCE; y++) years.push(queryByYear(appointments, y, opts)); return { startCE: sCE, endCE: eCE, years }; }
  function formatInstantAppointmentMessage(apt, isUpdate, cfg) { if (!apt) return '';
    const st = ns(apt.status), creator = sn(apt.createdBy || apt.updatedBy || '-'), hdr = st === S_CP ? '[แจ้งเตือนสิ้นสุดการนัดหมาย]' : (st === S_CN ? '[แจ้งเตือนยกเลิกการนัดหมาย]' : (isUpdate && apt.reopened ? '[แจ้งเตือนการคืนสถานะนัดหมาย]' : (isUpdate ? '[แจ้งเตือนการอัปเดตนัดหมาย]' : '[แจ้งเตือนนัดหมายใหม่]')));
    const lines = [hdr, `รหัส: ${sn(apt.id || '-')}`, `หัวข้อ: ${sn(apt.title || '-')}`, `วันนัด: ${ftd(apt.appointmentDate, false)} เวลา ${sn(apt.appointmentTime || '-')} น.`, `สถานที่: ${sn(apt.location || '-')}`, `ผู้นัดพบ: ${maskContact(apt.contactPerson, cfg && cfg.privacyMaskContact)}`, `สถานะ: [${sn(st)}]`, `ผู้สร้างนัดหมาย: ${creator}`];
    if (st === S_CP && apt.statusChangedBy) lines.push(`ผู้ยืนยันเสร็จสิ้น: ${sn(apt.statusChangedBy)}`); else if (st === S_CN) { if (apt.statusChangedBy) lines.push(`ผู้ยกเลิกนัด: ${sn(apt.statusChangedBy)}`); if (apt.statusReason) lines.push(`สาเหตุการยกเลิก: ${sn(apt.statusReason)}`); } else if (isUpdate && apt.updatedBy && apt.updatedBy !== creator) lines.push(`ผู้แก้ไขล่าสุด: ${sn(apt.updatedBy)}`);
    if (apt.notes) lines.push(`หมายเหตุ: ${sn(apt.notes)}`); if (apt.mapUrl) lines.push(`แผนที่: ${sn(apt.mapUrl)}`); return sn(lines.join('\n')); }
  const Q_KEYS = 'ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ', C_KW = '(?:สร้างนัด|เพิ่มนัด|นัดใหม่)';
  const CMD_RE = new RegExp(`^คิว(?:\\s+|${Q_KEYS}|${C_KW}|$)|^(?:${Q_KEYS}|help|เดือน\\s+\\d{1,2}[-/]\\d{4}|ปี\\s*\\d{4}|ค้นหา\\s+.+|${C_KW}(?:\\s+[\\s\\S]+)?)$`, 'i');
  function parseLineCreateCmd(arg, bkk, defCreator) { const cm = arg.match(/^(?:สร้างนัด|เพิ่มนัด|นัดใหม่)(?:\s+([\s\S]+))?$/i); if (!cm) return null;
    const body = (cm[1] || '').trim(); if (!body) return { help: true };
    const pSmartDt = r => { const s = sn(r); if (!s) return null; if (s === 'วันนี้') return bkk.dateStr; if (s === 'พรุ่งนี้') return gb(bkk.epochMs + 86400000).dateStr;
      if (s === 'มะรืน' || s === 'มะรืนนี้') return gb(bkk.epochMs + 172800000).dateStr;
      const dm = s.match(/^(\d{1,2})[-/](\d{1,2})$/); if (dm) { const d = +dm[1], m = +dm[2], mx = getDaysInMonth(bkk.year, m); return mx && d >= 1 && d <= mx ? `${bkk.year}-${pad2(m)}-${pad2(d)}` : null; }
      return pfd(s); };
    const pSmartTm = r => parseTimeInput(String(r || '').trim().replace(/\s*น\.?$/, '').replace(/\./g, ':'));
    const pRem = s => { const dM = s.match(/(\d+)\s*(?:วัน|ว\.?|d)/i), hM = s.match(/(\d+)\s*(?:ชั่วโมง|ชม\.?|h)/i); return { d: dM ? +dM[1] : 0, h: hM ? +hM[1] : 0 }; };
    let title = '', dateRaw = '', timeRaw = '', location = '', contactPerson = '', notes = '', mapUrl = '', rD = 0, rH = 0;
    const kvTest = /^(หัวข้อ|งาน|เรื่อง|วันที่|วันนัด|วัน|วันเวลา|เวลา|เวลานัด|สถานที่|ที่นัดหมาย|ผู้นัดพบ|ผู้นัด|ลูกค้า|ผู้ติดต่อ|เตือน|แจ้งเตือน|หมายเหตุ|รายละเอียด|แผนที่|พิกัด)\s*[:：]\s*(.+)$/i;
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.some(l => kvTest.test(l))) { lines.forEach(l => { const m = l.match(kvTest); if (!m) return; const k = m[1], v = m[2].trim();
        if (/^(?:หัวข้อ|งาน|เรื่อง)$/.test(k)) title = v; else if (/^(?:วันที่|วันนัด|วัน)$/.test(k)) dateRaw = v; else if (k === 'วันเวลา') { const p = v.split(/\s+/); dateRaw = p[0] || ''; timeRaw = p[1] || ''; }
        else if (/^(?:เวลา|เวลานัด)$/.test(k)) timeRaw = v; else if (/^(?:สถานที่|ที่นัดหมาย)$/.test(k)) location = v; else if (/^(?:ผู้นัดพบ|ผู้นัด|ลูกค้า|ผู้ติดต่อ)$/.test(k)) contactPerson = v;
        else if (/^(?:เตือน|แจ้งเตือน)$/.test(k)) { const r = pRem(v); rD = r.d; rH = r.h; } else if (/^(?:หมายเหตุ|รายละเอียด)$/.test(k)) notes = v; else if (/^(?:แผนที่|พิกัด)$/.test(k)) mapUrl = v; });
      if (dateRaw && !timeRaw && /\s/.test(dateRaw)) { const p = dateRaw.split(/\s+/); dateRaw = p[0]; timeRaw = p[1] || ''; }
    } else { const segs = body.replace(/\r?\n/g, ' ').split(/\s*[\/|]\s*/).map(x => x.trim()).filter(Boolean);
      const dtTmRe = /^(วันนี้|พรุ่งนี้|มะรืน(?:นี้)?|\d{1,4}[-/]\d{1,2}(?:[-/]\d{2,4})?)\s+(\d{1,2}[:.]\d{2}(?:\s*น\.?)?)(?:\s+([\s\S]+))?$/i;
      const m0 = segs[0] && segs[0].match(dtTmRe), m1 = !m0 && segs[1] && segs[1].match(dtTmRe);
      let extraIdx = 4;
      if (m0) { dateRaw = m0[1]; timeRaw = m0[2]; const r0 = (m0[3] || '').trim();
        if (segs.length === 1) { title = r0; extraIdx = 1; } else { title = r0 ? `${r0} ${segs[1]}` : segs[1]; location = segs[2] || ''; contactPerson = segs[3] || ''; }
      } else if (m1) { title = segs[0] || ''; dateRaw = m1[1]; timeRaw = m1[2]; location = segs[2] || ''; contactPerson = segs[3] || ''; }
      const noteList = []; segs.slice(extraIdx).forEach(s => { if (/^(?:เตือน|แจ้งเตือน)\s+/i.test(s)) { const r = pRem(s); rD = r.d; rH = r.h; } else noteList.push(s); });
      if (segs.length === 3 && m0 && /^(?:เตือน|แจ้งเตือน)\s+/i.test(location)) { const r = pRem(location); rD = r.d; rH = r.h; location = ''; }
      notes = noteList.join(' / '); }
    const appointmentDate = pSmartDt(dateRaw), appointmentTime = pSmartTm(timeRaw), cleanTitle = sn(title);
    if (!appointmentDate || !appointmentTime || !cleanTitle) return { error: '[ข้อผิดพลาด] รูปแบบคำสั่งสร้างนัดไม่ถูกต้อง\nตัวอย่าง: สร้างนัด พรุ่งนี้ 10:30 / ประชุมตรวจรับงาน / ห้อง B / คุณสมชาย' };
    const creator = sn(defCreator) || S_SYS;
    return { payload: { title: cleanTitle, appointmentDate, appointmentTime, location: sn(location) || 'ไม่ระบุสถานที่', contactPerson: sn(contactPerson) || sn(defCreator) || 'ผู้ใช้งาน LINE', status: S_CF, remindDaysBefore: rD, remindHoursBefore: rH, notes: sn(notes), mapUrl: sn(mapUrl), createdBy: creator } }; }
  function parseAndExecuteLineCommand(rawText, appointments, nowIso, settings) { const text = sn(rawText || ''); if (!CMD_RE.test(text)) return null; const cfg = settings || {}, arg = text.replace(/^คิว\s*/, '').trim();
    if (cfg.enableLineBotQuery === false) return '[ระบบปิดการค้นหาผ่านแชทชั่วคราว] กรุณาตรวจสอบผ่านหน้าเว็บแอป';
    if (!arg || arg === 'ช่วยเหลือ' || arg.toLowerCase() === 'help') return ['[คำสั่งตรวจสอบตารางงาน]', '- ทั้งหมด : นัดหมายที่กำลังจะมาถึงทั้งหมด', '- วันนี้ : นัดหมายวันนี้', '- พรุ่งนี้ : นัดหมายพรุ่งนี้', '- สัปดาห์นี้ : นัดหมาย 7 วันข้างหน้า', '- ค้างอยู่ : งานเลยกำหนดเวลา', '- เดือนนี้ : สรุปงานเดือนปัจจุบัน', '- เดือน MM/YYYY : เช่น เดือน 12/2569', '- ปีนี้ : สรุปงานและสถิติท้ายปีปัจจุบัน', '- ปี YYYY : เช่น ปี 2570', '- ค้นหา <คำค้น> : ค้นหาตามชื่อ/สถานที่/หัวข้อ/ผู้สร้าง', '- สร้างนัด <วัน> <เวลา> / <หัวข้อ> / <สถานที่> / <ผู้นัด> : สร้างนัดผ่านแชท', '- โควตา : ตรวจสอบโควตารายเดือน'].join('\n');
    if (arg === 'โควตา') return `[สถานะโควตา LINE ประจำเดือน]\nใช้ไปแล้ว: ${+cfg.quotaUsed || 0} / ${+cfg.quotaLimit || 300} ข้อความ`;
    const bkk = gb(nowIso), list = (appointments || []).filter(a => a && !a.deletedAt), cRes = parseLineCreateCmd(arg, bkk, cfg.defaultCreator || 'ผู้ใช้งาน LINE');
    if (cRes) { if (cRes.help) return ['[วิธีพิมพ์สร้างนัดหมายในแชท]', '1) แบบบรรทัดเดียว (คั่นด้วย /):', 'สร้างนัด พรุ่งนี้ 10:30 / ประชุมงาน / ห้อง B / คุณสมชาย', '(หรือแบบย่อ: สร้างนัด วันนี้ 14:00 / สรุปงานทีม)', '2) แบบหลายบรรทัด:', 'สร้างนัด', 'หัวข้อ: ประชุมตรวจรับงาน', 'วันที่: 25/11/2569', 'เวลา: 10:30', 'สถานที่: ห้อง B', 'ผู้นัดพบ: คุณสมชาย'].join('\n');
      if (cRes.error) return cRes.error;
      const rec = createAppointmentRecord(cRes.payload, list, nowIso), conflicts = findTimeConflicts(list, rec.appointmentDate, rec.appointmentTime, rec.id);
      if (typeof cfg.onCreate === 'function') cfg.onCreate(rec, conflicts);
      return formatInstantAppointmentMessage(rec, false, cfg) + (conflicts.length ? `\n[คำเตือน] มีนัดหมายอื่นในวันและเวลานี้แล้ว (${conflicts.length} งาน: ${conflicts.map(c => c.title).join(', ')})` : ''); }
    const fmtList = (hdr, itms) => clipTxt(`${hdr}\n` + itms.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n\n'));
    const fmtM = r => { const hdr = `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}`; return r.items.length ? fmtList(`${hdr} (${r.ceYear})] รวม ${r.stats.total} รายการ (สิ้นสุด ${r.stats.completed} | ยกเลิก ${r.stats.cancelled})`, r.items) : `${hdr}]\n${NO_ITEM}`; };
    if (arg === 'ทั้งหมด' || arg === 'นัดทั้งหมด' || arg === 'งานทั้งหมด') { const ttl = '[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด]', itms = list.filter(a => ns(a.status) === S_CF && a.appointmentDate && a.appointmentDate >= bkk.dateStr).sort(cmpSlot); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\n${NO_ITEM}ที่กำลังจะมาถึง`; }
    if (arg === 'วันนี้' || arg === 'พรุ่งนี้') { const td = arg === 'วันนี้' ? bkk.dateStr : gb(bkk.epochMs + 86400000).dateStr, ttl = `[คิวงาน${arg} ${ftd(td, false)}]`, itms = list.filter(a => a.appointmentDate === td && a.status !== S_CN); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\n${NO_ITEM}`; }
    if (arg === 'สัปดาห์นี้') { const maxDt = gb(bkk.epochMs + 7 * 86400000).dateStr, itms = list.filter(a => a.appointmentDate && a.status !== S_CN && (ISO_DATE_RE.test(a.appointmentDate) ? (a.appointmentDate >= bkk.dateStr && a.appointmentDate <= maxDt) : (() => { const d = daysBetweenDates(bkk.dateStr, a.appointmentDate); return d !== null && d >= 0 && d <= 7; })())); return itms.length ? fmtList(`[คิวงานใน 7 วันข้างหน้า] (${itms.length} รายการ)`, itms) : `[คิวงานใน 7 วันข้างหน้า]\n${NO_ITEM}`; }
    if (arg === 'ค้างอยู่') { const itms = list.filter(a => isAct(a.status) && isPastBkkSlot(a.appointmentDate, a.appointmentTime, bkk)); return itms.length ? fmtList(`[คิวงานเลยกำหนดเวลา] (${itms.length} รายการ)`, itms) : '[คิวงานเลยกำหนด]\nไม่มีรายการค้าง'; }
    if (arg === 'เดือนนี้') { const r = queryByMonth(list, bkk.year, bkk.month, { nowIso }); return r.items.length ? fmtM(r) : `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}]\n${NO_ITEM}ในเดือนนี้`; }
    const mm = arg.match(/^เดือน\s+(\d{1,2})[-/](\d{4})$/); if (mm) { const y = normalizeYearToCE(mm[2]), m = +mm[1]; return (!y || m < 1 || m > 12) ? '[ข้อผิดพลาด] รูปแบบเดือนไม่ถูกต้อง เช่น เดือน 12/2569' : fmtM(queryByMonth(list, y, m, { nowIso })); }
    if (arg === 'ปีนี้' || arg === 'ปีหน้า') return formatYearCommandReply(queryByYear(list, arg === 'ปีนี้' ? bkk.year : bkk.year + 1, { nowIso }));
    const ym = arg.match(/^ปี\s*(\d{4})$/); if (ym) { const y = normalizeYearToCE(ym[1]); return y ? formatYearCommandReply(queryByYear(list, y, { nowIso })) : '[ข้อผิดพลาด] รูปแบบปีไม่ถูกต้อง เช่น ปี 2570'; }
    const sm = arg.match(/^ค้นหา\s+(.+)$/); if (sm) { const q = sm[1].trim(), ttl = `[ผลการค้นหา "${q}"]`, kw = q.toLowerCase(), itms = list.filter(a => `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${a.status} ${a.notes}`.toLowerCase().includes(kw)); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\nไม่พบรายการที่ตรงกัน`; }
    return '[ไม่พบคำสั่งที่ระบุ] พิมพ์ "ช่วยเหลือ" เพื่อดูรายการคำสั่ง'; }
  function formatYearCommandReply(r) { const s = r.stats, hdr = `[สรุปสถิติประจำปี พ.ศ. ${r.buddhistYear} (ค.ศ. ${r.ceYear})]\nรวมทั้งหมด: ${s.total} งาน | เริ่มนัด: ${s.active} งาน\nสิ้นสุด: ${s.completed} งาน (สำเร็จ ${s.completionRate}%) | ยกเลิก: ${s.cancelled} งาน (${s.cancellationRate}%)\nเลื่อนนัดสะสม: ${s.rescheduleTotal} ครั้ง`;
    if (!s.total) return `${hdr}\n\nยังไม่มีรายการนัดหมายในปีนี้`; const lines = [hdr, '\n[แยกตามเดือน]']; r.months.forEach(m => { if (m.stats.total > 0) { lines.push(`- ${m.monthNameThai}: รวม ${m.stats.total} งาน (เสร็จ ${m.stats.completed} / ยกเลิก ${m.stats.cancelled})`);
      m.items.slice(0, 2).forEach(a => lines.push(`   [${a.appointmentDate} ${a.appointmentTime || ''}] ${a.title} - ${ns(a.status)} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`)); } });
    return clipTxt(lines.join('\n'), 1); }
  return { API_VERSION, STATUS, VALID_STATUSES, USER_ROLES, DEFAULT_USERS, THAI_MONTHS_SHORT, THAI_MONTHS_FULL, LINE_MAX_TEXT_LENGTH: LINE_MAX_LEN, hasEmoji, sanitizeNoEmoji, normalizeStatus, hashPassword, authenticateUser, validateUserInput, registerUserAccount, normalizeYearToCE, toBuddhistYear, isLeapYearCE, getDaysInMonth, parseFlexibleDateInput, parseTimeInput, bangkokSlotToEpochMs, getBangkokParts, daysBetweenDates, formatThaiDateDisplay, isActiveStatus, isOverdue, buildAppointmentSlot, findTimeConflicts, validateAppointmentInput, generateAppointmentId, createAppointmentRecord, updateAppointmentRecord, isInQuietHours, evaluateAppointmentNotification, buildNotificationPlan, calculateYearlyStats, calculateUserStats, queryByMonth, queryByYear, queryMultiYearOverview, formatInstantAppointmentMessage, parseAndExecuteLineCommand }; });
