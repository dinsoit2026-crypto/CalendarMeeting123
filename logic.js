/** logic.js - Core Domain Logic, Bangkok Timezone, Notification & Analytics Engine (v2.8.0) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalendarLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // === 1. Constants & Domain Enums ===
  const API_VERSION = '2.8.0', BKK_OFFSET_MS = 7 * 3600 * 1000, LINE_MAX_LEN = 4500, S_SYS = 'ผู้ใช้งานระบบ', NO_ITEM = 'ไม่มีรายการนัดหมาย', DEF_TS = '2026-11-01T08:00:00+07:00';
  const STATUS = Object.freeze({ CONFIRMED: 'เริ่มนัด', COMPLETED: 'สิ้นสุดการนัดหมาย', CANCELLED: 'ยกเลิกการนัดหมาย' });
  const S_CF = STATUS.CONFIRMED, S_CP = STATUS.COMPLETED, S_CN = STATUS.CANCELLED, VALID_STATUSES = Object.freeze([S_CF, S_CP, S_CN]);
  const USER_ROLES = Object.freeze({ ADMIN: 'ADMIN', STAFF: 'STAFF' });
  const SUSPEND_DURATIONS = Object.freeze({ '1d': { days: 1, label: '1 วัน' }, '3d': { days: 3, label: '3 วัน' }, '7d': { days: 7, label: '7 วัน' }, '15d': { days: 15, label: '15 วัน' }, PERMANENT: { days: 0, label: 'ถาวร' } });
  const THAI_MONTHS_SHORT = Object.freeze(['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']);
  const THAI_MONTHS_FULL = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
  const TH_MO_MAP = new Map(), MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  THAI_MONTHS_FULL.forEach((m, i) => TH_MO_MAP.set(m, i + 1));
  THAI_MONTHS_SHORT.forEach((m, i) => { TH_MO_MAP.set(m, i + 1); TH_MO_MAP.set(m.replace(/\./g, ''), i + 1); });

  // === 2. Zero-Emoji Policy & Text Sanitization ===
  const EMOJI_EXT_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic}(?:\uFE0F|\u200D(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic})*)/gu;
  const EMOJI_MOD_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;
  const FAST_SAFE_RE = /^[\x00-\x7F\u0E00-\u0E7F]*$/, ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/, TIME_24_RE = /^(\d{2}):(\d{2})$/;
  const hasEmoji = s => typeof s === 'string' && s.length > 0 && !FAST_SAFE_RE.test(s) && (EMOJI_EXT_RE.lastIndex = EMOJI_MOD_RE.lastIndex = 0, EMOJI_EXT_RE.test(s) || EMOJI_MOD_RE.test(s));
  const sanitizeNoEmoji = s => { if (s == null) return ''; const str = String(s); return (FAST_SAFE_RE.test(str) ? str : str.replace(EMOJI_EXT_RE, '').replace(EMOJI_MOD_RE, '')).replace(/[ \t]{2,}/g, ' ').trim(); };
  const normalizeStatus = st => (st === S_CF || st === S_CP || st === S_CN) ? st : ((!st || ((st = sanitizeNoEmoji(st)) !== S_CP && st !== S_CN)) ? S_CF : st);
  const clipTxt_ = (s, fn) => { const c = sanitizeNoEmoji(s); return c.length > LINE_MAX_LEN ? c.slice(0, LINE_MAX_LEN - 80) + `\n...(ดูเพิ่มเติมบน${fn ? 'หน้า' : ''}เว็บแอป)` : c; };
  const fifoPut_ = (map, key, val, lim = 1024) => { if (map.size >= lim) map.delete(map.keys().next().value); map.set(key, val); return val; };

  // === 3. SHA-256 Hashing, User Auth, Suspension & Registration ===
  const SHA_H = [], SHA_K = [], _pwCache = new Map();
  (() => { const maxW = 4294967296, comp = {}; for (let c = 2, pCnt = 0; pCnt < 64; c++) if (!comp[c]) { for (let i = 0; i < 313; i += c) comp[i] = c; if (pCnt < 8) SHA_H[pCnt] = (Math.pow(c, 0.5) * maxW) | 0; SHA_K[pCnt++] = (Math.pow(c, 1 / 3) * maxW) | 0; } })();
  function hashPassword(str) {
    const key = String(str || ''); if (_pwCache.has(key)) return _pwCache.get(key); const raw = unescape(encodeURIComponent(key)), maxW = 4294967296, words = [], bitLen = raw.length * 8; let hash = SHA_H.slice(), ascii = raw + '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00'; for (let i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8; words.push((bitLen / maxW) | 0, bitLen); for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), old = hash.slice(0, 8); for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        const t1 = hash[7] + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & hash[5]) ^ ((~e) & hash[6])) + SHA_K[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + ((w15 >>> 7 | w15 << 25) ^ (w15 >>> 18 | w15 << 14) ^ (w15 >>> 3)) + w[i - 7] + ((w2 >>> 17 | w2 << 15) ^ (w2 >>> 19 | w2 << 13) ^ (w2 >>> 10))) | 0);
        const t2 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])); hash = [(t1 + t2) | 0, a, hash[1], hash[2], (hash[3] + t1) | 0, hash[4], hash[5], hash[6]];
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    let out = ''; for (let i = 0; i < 8; i++) for (let j = 3; j >= 0; j--) out += (((hash[i] >> (j * 8)) & 255) + 256).toString(16).slice(1); return fifoPut_(_pwCache, key, out, 256);
  }
  const mkDefUser_ = (userId, username, displayName, role, pw) => ({ userId, username, displayName, role, passwordHash: hashPassword(pw), isActive: true, createdAt: DEF_TS, suspendedUntil: '', suspendReason: '', hasLineLinked: false });
  const DEFAULT_USERS = Object.freeze([mkDefUser_('USR-001', 'admin', 'ผู้ดูแลระบบ', 'ADMIN', 'admin'), mkDefUser_('USR-002', 'somchai', 'คุณสมชาย', 'STAFF', '1234'), mkDefUser_('USR-003', 'wipada', 'คุณวิภาดา', 'STAFF', '1234')]);
  const computeSuspendedUntil = (durationKey, nowIso) => (durationKey === 'PERMANENT' || durationKey === 'UNSUSPEND') ? '' : ((SUSPEND_DURATIONS[durationKey] && SUSPEND_DURATIONS[durationKey].days) ? getBangkokParts(getBangkokParts(nowIso).epochMs + SUSPEND_DURATIONS[durationKey].days * 86400000).isoStr : null);
  const permSuspResult_ = reason => ({ suspended: true, permanent: true, expired: false, until: '', reason, remainingMs: Infinity, untilDisplay: 'ถาวร', message: 'บัญชีนี้ถูกระงับการใช้งานถาวร' + (reason ? ' (เหตุผล: ' + reason + ')' : '') });
  function evaluateUserSuspension(user, nowIso) {
    if (!user || (user.isActive !== false && String(user.isActive).toUpperCase() !== 'FALSE')) return { suspended: false, permanent: false, expired: false, until: '', reason: '', remainingMs: 0, untilDisplay: '', message: '' };
    const reason = sanitizeNoEmoji(user.suspendReason || ''), rawUntil = String(user.suspendedUntil || '').trim(), untilMs = rawUntil ? Date.parse(rawUntil) : NaN; if (!rawUntil || Number.isNaN(untilMs)) return permSuspResult_(reason);
    const nowMs = getBangkokParts(nowIso).epochMs; if (nowMs >= untilMs) return { suspended: false, permanent: false, expired: true, until: '', reason: '', remainingMs: 0, untilDisplay: '', message: '' };
    const rem = untilMs - nowMs; let remDays = Math.floor(rem / 86400000), remHrs = Math.ceil((rem % 86400000) / 3600000); if (remHrs >= 24) { remDays++; remHrs = 0; }
    const ub = getBangkokParts(untilMs), untilDisplay = formatThaiDateDisplay(ub.dateStr, false) + ' เวลา ' + ub.timeStr + ' น.', remTxt = (remDays > 0 ? remDays + ' วัน' : '') + (remDays > 0 && remHrs > 0 ? ' ' : '') + (remHrs > 0 ? remHrs + ' ชม.' : (remDays === 0 ? 'น้อยกว่า 1 ชม.' : ''));
    return { suspended: true, permanent: false, expired: false, until: rawUntil, reason, remainingMs: rem, untilDisplay, message: 'บัญชีนี้ถูกระงับการใช้งานชั่วคราว จนถึง ' + untilDisplay + ' (เหลืออีก ' + remTxt + ')' + (reason ? ' เหตุผล: ' + reason : '') };
  }
  function authenticateUser(users, username, password, nowIso) {
    const un = sanitizeNoEmoji(username || '').toLowerCase(), pw = String(password || ''); if (!un || !pw) return { ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    const found = (Array.isArray(users) && users.length ? users : DEFAULT_USERS).find(u => u && sanitizeNoEmoji(u.username).toLowerCase() === un); if (!found) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };
    const susp = evaluateUserSuspension(found, nowIso); if (susp.suspended) return { ok: false, error: susp.message, suspended: true, suspendedUntil: susp.until, permanent: susp.permanent };
    if (found.passwordHash !== hashPassword(pw)) return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    return { ok: true, autoUnsuspended: susp.expired, user: { userId: found.userId, username: found.username, displayName: sanitizeNoEmoji(found.displayName || found.username), role: found.role === 'ADMIN' ? 'ADMIN' : 'STAFF', createdAt: found.createdAt || '', hasLineLinked: Boolean(found.hasLineLinked || found.lineUserId) } };
  }
  function guardAdminTarget_(users, userId, actorUser, verb) {
    if (actorUser && actorUser.role !== 'ADMIN') return { error: `เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถ${verb}บัญชีได้` }; const list = Array.isArray(users) ? users : DEFAULT_USERS, idx = list.findIndex(u => u && u.userId === userId);
    if (idx === -1) return { error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' }; const target = list[idx], tun = sanitizeNoEmoji(target.username || '').toLowerCase(); if (tun === 'admin') return { error: `ไม่สามารถ${verb}บัญชีผู้ดูแลระบบหลัก (admin) ได้` };
    if (actorUser && (target.userId === actorUser.userId || tun === sanitizeNoEmoji(actorUser.username || '').toLowerCase())) return { error: `ไม่สามารถ${verb}บัญชีของตนเองที่กำลังใช้งานอยู่ได้` }; return { list, idx, target };
  }
  function applyUserSuspension(users, userId, durationKey, reason, actorUser, nowIso) {
    const g = guardAdminTarget_(users, userId, actorUser, 'ระงับ'); if (g.error) return { ok: false, error: g.error };
    if (durationKey === 'UNSUSPEND') { const upd = { ...g.target, isActive: true, suspendedUntil: '', suspendReason: '' }; return { ok: true, user: upd, users: g.list.map((u, i) => (i === g.idx ? upd : u)) }; }
    const until = computeSuspendedUntil(durationKey, nowIso); if (until === null) return { ok: false, error: 'รูปแบบระยะเวลาการระงับไม่ถูกต้อง' };
    const upd = { ...g.target, isActive: false, suspendedUntil: until, suspendReason: sanitizeNoEmoji(reason || '') }; return { ok: true, user: upd, users: g.list.map((u, i) => (i === g.idx ? upd : u)) };
  }
  const deleteUserAccount = (users, userId, actorUser) => { const g = guardAdminTarget_(users, userId, actorUser, 'ลบ'); return g.error ? { ok: false, error: g.error } : { ok: true, deletedUser: g.target, users: g.list.filter(u => u && u.userId !== g.target.userId) }; };
  function validateUserInput(input, isCreate = true) {
    const errs = [], un = sanitizeNoEmoji(input.username || '').toLowerCase(), disp = sanitizeNoEmoji(input.displayName || '');
    if (isCreate) { if (!un || un.length < 3 || un.length > 30 || !/^[a-z0-9_.-]+$/.test(un)) errs.push('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 3-30 ตัวอักษร'); if (!input.password || String(input.password).length < 4) errs.push('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร'); }
    if (!disp) errs.push('กรุณาระบุชื่อ-นามสกุล หรือชื่อเรียก');
    return { valid: !errs.length, errors: errs, sanitized: { username: un, displayName: disp, role: (input.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF', isActive: input.isActive !== false && String(input.isActive).toUpperCase() !== 'FALSE', passwordHash: input.password ? hashPassword(input.password) : (input.passwordHash || '') } };
  }
  function registerUserAccount(users, input, nowIso) {
    if (!input || typeof input !== 'object') return { ok: false, error: 'ข้อมูลการสมัครสมาชิกไม่ถูกต้อง' }; const pw = String(input.password || ''), confirmPw = input.confirmPassword !== undefined ? String(input.confirmPassword || '') : pw;
    if (pw !== confirmPw) return { ok: false, error: 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน' }; const v = validateUserInput({ ...input, role: 'STAFF', isActive: true }, true); if (!v.valid) return { ok: false, error: v.errors.join(' | ') };
    const s = v.sanitized, list = Array.isArray(users) ? users : DEFAULT_USERS; if (list.some(u => u && sanitizeNoEmoji(u.username || '').toLowerCase() === s.username)) return { ok: false, error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น' };
    if (list.some(u => u && sanitizeNoEmoji(u.displayName || '').toLowerCase() === s.displayName.toLowerCase())) return { ok: false, error: 'ชื่อที่ใช้แสดงผลนี้มีอยู่ในระบบแล้ว กรุณาระบุชื่อหรือแผนกเพิ่มเติม' };
    const maxNum = list.reduce((m, u) => Math.max(m, u && u.userId && String(u.userId).startsWith('USR-') ? (parseInt(String(u.userId).slice(4), 10) || 0) : 0), 0);
    const userId = `USR-${String(maxNum + 1).padStart(3, '0')}`, now = getBangkokParts(nowIso).isoStr;
    const record = { userId, username: s.username, displayName: s.displayName, role: 'STAFF', passwordHash: s.passwordHash, isActive: true, createdAt: now, lastLoginAt: now, suspendedUntil: '', suspendReason: '', hasLineLinked: false };
    return { ok: true, record, user: { userId, username: record.username, displayName: record.displayName, role: 'STAFF', createdAt: now, hasLineLinked: false } };
  }

  // === 4. Bangkok Timezone & Date/Time Engine ===
  const p2 = n => (n >= 0 && n < 10 ? '0' : '') + n;
  const normalizeYearToCE = y => { const n = Number(String(y || '').trim()); return (!Number.isInteger(n) || n < 1900 || n > 3000) ? null : (n > 2400 ? n - 543 : n); };
  const toBuddhistYear = ce => { const y = normalizeYearToCE(ce); return y ? y + 543 : null; };
  const isLeapYearCE = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const getDaysInMonth = (y, m) => { const ce = normalizeYearToCE(y), mi = Number(m); return (!ce || mi < 1 || mi > 12) ? 0 : (mi === 2 && isLeapYearCE(ce) ? 29 : MDAYS[mi - 1]); };
  const validIsoYmd = d => { if (typeof d !== 'string' || d.length !== 10 || !ISO_DATE_RE.test(d)) return null; const y = +d.slice(0, 4), m = +d.slice(5, 7), dy = +d.slice(8, 10); return (y >= 1900 && y <= 2400 && m >= 1 && m <= 12 && dy >= 1 && dy <= (m === 2 && isLeapYearCE(y) ? 29 : MDAYS[m - 1])) ? [y, m, dy] : null; };
  function parseFlexibleDateInput(raw) {
    if (validIsoYmd(raw)) return raw; const s = String(raw || '').trim(); if (!s) return ''; if (validIsoYmd(s)) return s; const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/), m2 = !m1 && s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!m1 && !m2) return null; const [y, m, d] = m1 ? [normalizeYearToCE(m1[1]), +m1[2], +m1[3]] : [normalizeYearToCE(m2[3]), +m2[2], +m2[1]];
    return (!y || m < 1 || m > 12 || d < 1 || d > (m === 2 && isLeapYearCE(y) ? 29 : MDAYS[m - 1])) ? null : `${y}-${p2(m)}-${p2(d)}`;
  }
  const parseTimeInput = raw => { if (typeof raw === 'string' && raw.length === 5 && TIME_24_RE.test(raw) && +raw.slice(0, 2) <= 23 && +raw.slice(3, 5) <= 59) return raw; const s = String(raw || '').trim(); if (!s) return ''; const m = s.match(/^(\d{1,2}):(\d{2})$/); return (!m || +m[1] > 23 || +m[2] > 59) ? null : `${p2(+m[1])}:${p2(+m[2])}`; };
  let _lastBkkKey = '', _lastBkkVal = null;
  const _dayEpCache = new Map(), _slotEpCache = new Map();
  function bangkokSlotToEpochMs(dateStr, timeStr) {
    const ts = timeStr || '00:00', isDay = ts === '00:00', isStrD = typeof dateStr === 'string' && dateStr.length === 10; if (isStrD && isDay) { const c = _dayEpCache.get(dateStr); if (c !== undefined) return c; }
    else if (isStrD && typeof ts === 'string' && ts.length === 5) { const c = _slotEpCache.get(dateStr + ts); if (c !== undefined) return c; } let d = dateStr, vp = validIsoYmd(d);
    if (!vp) { d = parseFlexibleDateInput(dateStr); if (!d) return null; vp = [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)]; } const t = parseTimeInput(ts); if (!t) return null;
    const ep = Date.UTC(vp[0], vp[1] - 1, vp[2], +t.slice(0, 2), +t.slice(3, 5), 0, 0) - BKK_OFFSET_MS; return d === dateStr ? (isDay ? fifoPut_(_dayEpCache, dateStr, ep) : (t === ts ? fifoPut_(_slotEpCache, dateStr + ts, ep) : ep)) : ep;
  }
  function parseToEpochMs_(isoOrDate) {
    if (isoOrDate instanceof Date) return isoOrDate.getTime(); if (typeof isoOrDate === 'number') return isoOrDate; const s = String(isoOrDate || '').trim(); if (!s) return Date.now();
    const slot = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/); if (slot) { const base = bangkokSlotToEpochMs(slot[1], slot[2]); return base !== null ? base + (slot[3] ? +slot[3] * 1000 : 0) : Date.now(); }
    const p = Date.parse(s); return Number.isNaN(p) ? Date.now() : p;
  }
  function getBangkokParts(isoOrDate) {
    const isStr = typeof isoOrDate === 'string' && isoOrDate.length > 0; if (isStr && isoOrDate === _lastBkkKey) return _lastBkkVal;
    const epochMs = parseToEpochMs_(isoOrDate), b = new Date(epochMs + BKK_OFFSET_MS), year = b.getUTCFullYear(), month = b.getUTCMonth() + 1, day = b.getUTCDate(), hour = b.getUTCHours(), minute = b.getUTCMinutes(), second = b.getUTCSeconds();
    const dateStr = `${year}-${p2(month)}-${p2(day)}`, timeStr = `${p2(hour)}:${p2(minute)}`;
    const res = { epochMs, year, buddhistYear: year + 543, month, day, hour, minute, second, dateStr, timeStr, slotStr: `${dateStr}T${timeStr}`, isoStr: `${dateStr}T${timeStr}:${p2(second)}+07:00` }; if (isStr) { _lastBkkKey = isoOrDate; _lastBkkVal = res; }
    return res;
  }
  const daysBetweenDates = (s, e) => { const sm = bangkokSlotToEpochMs(s, '00:00'), em = bangkokSlotToEpochMs(e, '00:00'); return sm === null || em === null ? null : Math.round((em - sm) / 86400000); };
  const formatThaiDateDisplay = (dateStr, includeCE = true) => { const d = parseFlexibleDateInput(dateStr); return !d ? 'ยังไม่กำหนดวันที่' : `${+d.slice(8, 10)} ${THAI_MONTHS_SHORT[+d.slice(5, 7) - 1]} ${+d.slice(0, 4) + 543}` + (includeCE ? ` (${d})` : ''); };

  // === 5. Appointment Validation, CRUD & Conflict Engine ===
  const isActiveStatus = st => normalizeStatus(st) === S_CF;
  const buildAppointmentSlot = a => (a && a.appointmentDate && a.appointmentTime) ? `${a.appointmentDate}T${a.appointmentTime}` : '';
  const cmpSlot = (a, b) => { const ad = (a && a.appointmentDate) || '', bd = (b && b.appointmentDate) || ''; if (ad && bd && a.appointmentTime && b.appointmentTime) return ad < bd ? -1 : (ad > bd ? 1 : (a.appointmentTime < b.appointmentTime ? -1 : (a.appointmentTime > b.appointmentTime ? 1 : 0))); const sa = buildAppointmentSlot(a), sb = buildAppointmentSlot(b); return sa < sb ? -1 : (sa > sb ? 1 : 0); };
  const isPastBkkSlot_ = (d, t, bkk) => { if (!d || !t) return false; if (validIsoYmd(d) && typeof t === 'string' && t.length === 5 && TIME_24_RE.test(t) && +t.slice(0, 2) <= 23 && +t.slice(3, 5) <= 59) return d !== bkk.dateStr ? d < bkk.dateStr : (t !== bkk.timeStr ? t < bkk.timeStr : ((bkk.epochMs % 60000) + 60000) % 60000 > 0); const ep = bangkokSlotToEpochMs(d, t); return ep !== null && bkk.epochMs > ep; };
  const isOverdue = (a, nowIso) => Boolean(a && !a.deletedAt && isActiveStatus(a.status) && isPastBkkSlot_(a.appointmentDate, a.appointmentTime, getBangkokParts(nowIso)));
  const findTimeConflicts = (appointments, dateStr, timeStr, excludeId) => { const d = parseFlexibleDateInput(dateStr), t = parseTimeInput(timeStr); return (!d || !t) ? [] : (appointments || []).filter(a => a && !a.deletedAt && (!excludeId || a.id !== excludeId) && normalizeStatus(a.status) !== S_CN && a.appointmentDate === d && a.appointmentTime === t); };
  function validateAppointmentInput(input) {
    if (!input || typeof input !== 'object') return { valid: false, errors: ['ข้อมูลไม่ถูกต้อง'] };
    const g = k => sanitizeNoEmoji(input[k] || ''), errs = [], title = g('title'), status = normalizeStatus(input.status), location = g('location'), contactPerson = g('contactPerson');
    const pDate = input.appointmentDate ? parseFlexibleDateInput(input.appointmentDate) : '', pTime = input.appointmentTime ? parseTimeInput(input.appointmentTime) : '';
    [[title, 'หัวข้องาน'], [pDate, 'วันที่นัดหมาย'], [pTime, 'เวลานัดหมาย (HH:mm)'], [location, 'สถานที่นัดหมาย']].forEach(([v, m]) => { if (!v) errs.push('กรุณาระบุ' + m); }); if (input.appointmentDate && pDate === null) errs.push('รูปแบบวันที่ไม่ถูกต้อง');
    if (input.appointmentTime && pTime === null) errs.push('รูปแบบเวลาไม่ถูกต้อง (HH:mm)');
    const rDays = input.remindDaysBefore != null && input.remindDaysBefore !== '' ? +input.remindDaysBefore : 0, rHours = input.remindHoursBefore != null && input.remindHoursBefore !== '' ? +input.remindHoursBefore : 0;
    if (!Number.isInteger(rDays) || rDays < 0 || rDays > 365) errs.push('จำนวนวันแจ้งเตือนต้องเป็น 0-365'); if (!Number.isInteger(rHours) || rHours < 0 || rHours > 168) errs.push('จำนวนชั่วโมงแจ้งเตือนต้องเป็น 0-168');
    const mapUrl = g('mapUrl'), imageUrl = g('imageUrl'), createdBy = g('createdBy') || g('updatedBy') || S_SYS; if (imageUrl.length > 48000) errs.push('ขนาดไฟล์รูปภาพใหญ่เกินขีดจำกัด (กรุณาใช้รูปภาพขนาดเล็กลง)');
    return { valid: !errs.length, errors: errs, sanitized: { title, appointmentDate: pDate || '', appointmentTime: pTime || '', location, contactPerson, status, remindDaysBefore: rDays, remindHoursBefore: rHours, notes: g('notes'), mapUrl, imageUrl, createdBy, updatedBy: g('updatedBy') || createdBy, statusChangedBy: g('statusChangedBy'), statusChangedAt: g('statusChangedAt'), statusReason: g('statusReason') } };
  }
  const generateAppointmentId = (existing, nowIso) => { const pfx = `APT-${getBangkokParts(nowIso).dateStr.replace(/-/g, '')}-`; return `${pfx}${String((existing || []).reduce((m, x) => (x && x.id && x.id.startsWith(pfx) ? Math.max(m, +x.id.slice(pfx.length) || 0) : m), 0) + 1).padStart(3, '0')}`; };
  function createAppointmentRecord(input, existing, nowIso) {
    const v = validateAppointmentInput(input); if (!v.valid) throw new Error(v.errors.join(' | ')); const now = getBangkokParts(nowIso).isoStr, s = v.sanitized, isChg = s.status !== S_CF;
    return { id: input.id ? sanitizeNoEmoji(input.id) : generateAppointmentId(existing, now), ...s, createdBy: s.createdBy, statusChangedBy: isChg ? (s.statusChangedBy || s.createdBy) : '', statusChangedAt: isChg ? now : '', statusReason: isChg ? s.statusReason : '', notifiedDayForSlot: '', notifiedHourForSlot: '', rescheduleCount: 0, createdAt: now, updatedAt: now, deletedAt: '' };
  }
  function updateAppointmentRecord(existing, patch, options) {
    if (!existing || !existing.id) throw new Error('ไม่พบรายการนัดหมาย'); const opts = options || {};
    if (opts.expectedUpdatedAt && existing.updatedAt && opts.expectedUpdatedAt !== existing.updatedAt) { const err = new Error('ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรชก่อนทำรายการ'); err.code = 'CONCURRENCY_CONFLICT'; throw err; }
    const v = validateAppointmentInput({ ...existing, ...patch }); if (!v.valid) throw new Error(v.errors.join(' | '));
    const s = v.sanitized, bkk = getBangkokParts(opts.nowIso), reason = sanitizeNoEmoji(patch.reason || opts.reason || patch.statusReason || '');
    const dChg = String(existing.appointmentDate || '') !== String(s.appointmentDate || ''), tChg = String(existing.appointmentTime || '') !== String(s.appointmentTime || '');
    const sChg = normalizeStatus(existing.status) !== normalizeStatus(s.status), reop = !isActiveStatus(existing.status) && isActiveStatus(s.status);
    const logs = ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status'].filter(f => String(existing[f] || '') !== String(s[f] || '')).map((f, i) => ({ logId: `LOG-${bkk.epochMs}-${i + 1}`, appointmentId: existing.id, changedAt: bkk.isoStr, changedBy: s.updatedBy, fieldChanged: f, oldValue: String(existing[f] || ''), newValue: String(s[f] || ''), reason }));
    const countInc = ((existing.appointmentDate || existing.appointmentTime) && (dChg || tChg)) ? 1 : 0, sup = Boolean(opts.suppressSlotReset && !dChg && !tChg && +existing.remindDaysBefore === +s.remindDaysBefore && +existing.remindHoursBefore === +s.remindHoursBefore);
    const curSlot = buildAppointmentSlot(s), epNow = (s.appointmentDate && s.appointmentTime) ? bangkokSlotToEpochMs(s.appointmentDate, s.appointmentTime) : null;
    let daySlot = sup ? (existing.notifiedDayForSlot || '') : ((dChg || reop || +existing.remindDaysBefore !== +s.remindDaysBefore) ? '' : (existing.notifiedDayForSlot || ''));
    let hourSlot = sup ? (existing.notifiedHourForSlot || '') : ((dChg || tChg || reop || +existing.remindHoursBefore !== +s.remindHoursBefore) ? '' : (existing.notifiedHourForSlot || '')); if (sup && reop) {
      const diffD = s.appointmentDate ? daysBetweenDates(bkk.dateStr, s.appointmentDate) : null, diffH = epNow ? (epNow - bkk.epochMs) / 3600000 : -1;
      if (!daySlot && s.appointmentDate && +s.remindDaysBefore > 0 && diffD !== null && diffD <= +s.remindDaysBefore) daySlot = s.appointmentDate;
      if (!hourSlot && curSlot && +s.remindHoursBefore > 0 && diffH > 0 && diffH <= +s.remindHoursBefore) hourSlot = curSlot;
    }
    const createdBy = existing.createdBy || s.createdBy || existing.updatedBy || S_SYS; let sBy = existing.statusChangedBy || '', sAt = existing.statusChangedAt || '', sRsn = existing.statusReason || '';
    if (sChg) { if (s.status === S_CF) sBy = sAt = sRsn = ''; else { sBy = sanitizeNoEmoji(patch.statusChangedBy || s.updatedBy || S_SYS); sAt = bkk.isoStr; sRsn = sanitizeNoEmoji(patch.statusReason || reason || ''); } }
    else if (patch.statusReason !== undefined) sRsn = sanitizeNoEmoji(patch.statusReason);
    return { record: { ...existing, ...s, createdBy, statusChangedBy: sBy, statusChangedAt: sAt, statusReason: sRsn, notifiedDayForSlot: daySlot, notifiedHourForSlot: hourSlot, rescheduleCount: (+existing.rescheduleCount || 0) + countInc, updatedAt: bkk.isoStr, updatedBy: s.updatedBy }, logs, dateChanged: dChg, timeChanged: tChg, reopened: reop, statusChanged: sChg };
  }

  // === 6. Notification Scheduling & Plan Builder ===
  const isInQuietHours = (h, s = 22, e = 7) => { const hi = +h, si = +s, ei = +e; return si !== ei && (si > ei ? (hi >= si || hi < ei) : (hi >= si && hi < ei)); };
  function evaluateAppointmentNotification(apt, nowIso, settings) {
    const cfg = settings || {}; if (!apt || apt.deletedAt || !isActiveStatus(apt.status) || !apt.appointmentDate || !apt.appointmentTime) return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'INVALID_OR_INACTIVE' };
    const nowBkk = getBangkokParts(nowIso), aptEp = bangkokSlotToEpochMs(apt.appointmentDate, apt.appointmentTime); if (aptEp === null || nowBkk.epochMs >= aptEp) return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'PAST' };
    const quiet = isInQuietHours(nowBkk.hour, cfg.quietHoursStart, cfg.quietHoursEnd), curSlot = buildAppointmentSlot(apt), rHours = +apt.remindHoursBefore || 0, rDays = +apt.remindDaysBefore || 0, diffH = (aptEp - nowBkk.epochMs) / 3600000;
    if (rHours > 0 && apt.notifiedHourForSlot !== curSlot && diffH > 0 && diffH <= rHours && (!quiet || cfg.allowHourlyInQuietHours)) return { shouldNotifyDay: false, shouldNotifyHour: true, supersedesDay: true, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffHours: diffH, reason: 'HOURLY_DUE' };
    const diffD = Math.floor((aptEp + BKK_OFFSET_MS) / 86400000) - Math.floor((nowBkk.epochMs + BKK_OFFSET_MS) / 86400000);
    if (rDays > 0 && apt.notifiedDayForSlot !== apt.appointmentDate && diffD >= 0 && diffD <= rDays && !quiet && (cfg.requireDigestWindow === false || nowBkk.hour >= (cfg.dailyDigestHour != null ? +cfg.dailyDigestHour : 8))) return { shouldNotifyDay: true, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffCalDays: diffD, reason: 'DAY_DUE' };
    return { shouldNotifyDay: false, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, reason: 'NOT_DUE' };
  }
  const maskContact_ = (c, mask) => (!mask || !c || c.length <= 2) ? (c || '-') : `${c.slice(0, 2)}***`;
  const formatAptLine_ = (a, idx, cfg) => { const st = normalizeStatus(a.status), lines = [`${idx ? `${idx}. ` : ''}[${a.id}] ${sanitizeNoEmoji(a.title)}`, `   วันนัด: ${formatThaiDateDisplay(a.appointmentDate, false)} เวลา ${a.appointmentTime || '-'} น.`, `   สถานที่: ${sanitizeNoEmoji(a.location || '-')}`, `   ผู้นัดพบ: ${maskContact_(a.contactPerson, cfg && cfg.privacyMaskContact)}`, `   สถานะ: [${sanitizeNoEmoji(st)}]`, `   ผู้สร้าง: ${sanitizeNoEmoji(a.createdBy || a.updatedBy || '-')}`]; if (a.statusChangedBy && st !== S_CF) lines.push(`   ผู้ดำเนินการ: ${sanitizeNoEmoji(a.statusChangedBy)}`); return lines.join('\n'); };
  function buildNotificationPlan(appointments, nowIso, settings) {
    const cfg = settings || {}, hourly = [], digest = [], slotUpdates = []; (Array.isArray(appointments) ? appointments : []).forEach(a => {
      const ev = evaluateAppointmentNotification(a, nowIso, cfg); if (ev.shouldNotifyHour) { hourly.push(a); slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: ev.targetHourSlot, triggerType: 'HOURLY_REMINDER' }); }
      else if (ev.shouldNotifyDay) { digest.push(a); slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: a.notifiedHourForSlot || '', triggerType: 'DAILY_DIGEST' }); }
    }); if (!hourly.length && !digest.length) return { shouldPush: false, hourlyItems: [], digestItems: [], slotUpdates: [], messageText: '' }; hourly.sort(cmpSlot); digest.sort(cmpSlot);
    const parts = [], bkk = getBangkokParts(nowIso), limit = +cfg.quotaLimit || 300, used = +cfg.quotaUsed || 0;
    if (hourly.length) parts.push(`[แจ้งเตือนก่อนถึงเวลานัดหมาย] (${hourly.length} รายการ)\n` + hourly.map((a, i) => formatAptLine_(a, i + 1, cfg)).join('\n'));
    if (digest.length) parts.push(`[สรุปคิวงานล่วงหน้าประจำวัน ${formatThaiDateDisplay(bkk.dateStr, false)}] (${digest.length} รายการ)\n` + digest.map((a, i) => formatAptLine_(a, i + 1, cfg)).join('\n'));
    if (limit > 0 && used / limit >= 0.8) parts.push(`[แจ้งเตือนโควตา] เดือนนี้ใช้โควตา LINE ไปแล้ว ${used}/${limit} ข้อความ`); if (cfg.webAppUrl) parts.push(`ดูตารางงาน: ${sanitizeNoEmoji(cfg.webAppUrl)}`);
    return { shouldPush: true, hourlyItems: hourly, digestItems: digest, slotUpdates, messageText: clipTxt_(parts.join('\n\n'), 1) };
  }

  // === 7. Analytics & Multi-Year / Month / User Queries ===
  const mkStats_ = () => ({ total: 0, active: 0, completed: 0, cancelled: 0, overdue: 0, rescheduleTotal: 0, completionRate: 0, cancellationRate: 0 });
  const finStats_ = s => { if (s.total > 0) { s.completionRate = Math.round(s.completed / s.total * 100); s.cancellationRate = Math.round(s.cancelled / s.total * 100); } return s; };
  function calculateYearlyStats(list, nowIso) {
    const s = mkStats_(), bkk = getBangkokParts(nowIso), arr = list || [];
    for (let i = 0; i < arr.length; i++) { const a = arr[i]; if (!a || a.deletedAt) continue; s.total++; s.rescheduleTotal += (+a.rescheduleCount || 0); const st = normalizeStatus(a.status); if (st === S_CF) { s.active++; if (isPastBkkSlot_(a.appointmentDate, a.appointmentTime, bkk)) s.overdue++; } else if (st === S_CP) s.completed++; else s.cancelled++; }
    return finStats_(s);
  }
  function calculateUserStats(list) {
    const userMap = {}, ensure = name => { const n = sanitizeNoEmoji(name || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ'; return userMap[n] || (userMap[n] = { user: n, createdTotal: 0, completedTotal: 0, cancelledTotal: 0, activeTotal: 0 }); };
    (list || []).forEach(a => { if (!a || a.deletedAt) return; const cBy = sanitizeNoEmoji(a.createdBy || a.updatedBy || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ', cs = ensure(cBy), st = normalizeStatus(a.status); cs.createdTotal++; if (st === S_CF) cs.activeTotal++; else if (st === S_CP) ensure(a.statusChangedBy || cBy).completedTotal++; else if (st === S_CN) ensure(a.statusChangedBy || cBy).cancelledTotal++; });
    return Object.values(userMap).sort((a, b) => (b.createdTotal + b.completedTotal + b.cancelledTotal) - (a.createdTotal + a.completedTotal + a.cancelledTotal) || b.createdTotal - a.createdTotal);
  }
  function queryByMonth(appointments, yInput, mInput, options) {
    const ce = normalizeYearToCE(yInput), m = Number(mInput); if (!ce || m < 1 || m > 12) throw new Error('ระบุเดือนหรือปีไม่ถูกต้อง');
    const pfx = `${ce}-${p2(m)}-`, items = (appointments || []).filter(a => a && !a.deletedAt && a.appointmentDate && a.appointmentDate.startsWith(pfx)).sort(cmpSlot);
    return { ceYear: ce, buddhistYear: ce + 543, month: m, monthNameThai: THAI_MONTHS_FULL[m - 1], items, stats: calculateYearlyStats(items, (options || {}).nowIso) };
  }
  function queryByYear(appointments, yInput, options) {
    const nowIso = (options || {}).nowIso, ce = normalizeYearToCE(yInput); if (!ce) throw new Error('ระบุปีไม่ถูกต้อง'); const pfx = `${ce}-`, buckets = Array.from({ length: 12 }, () => []), extra = [], arr = appointments || [];
    for (let i = 0; i < arr.length; i++) { const a = arr[i]; if (!a || a.deletedAt || !a.appointmentDate || !a.appointmentDate.startsWith(pfx)) continue; const mi = +a.appointmentDate.slice(5, 7) - 1; if (mi >= 0 && mi < 12) buckets[mi].push(a); else extra.push(a); }
    for (let i = 0; i < 12; i++) if (buckets[i].length > 1) buckets[i].sort(cmpSlot); if (extra.length > 1) extra.sort(cmpSlot); const items = extra.length ? [].concat(...buckets, extra).sort(cmpSlot) : [].concat(...buckets);
    const months = buckets.map((mItems, i) => ({ month: i + 1, monthNameThai: THAI_MONTHS_FULL[i], monthShortThai: THAI_MONTHS_SHORT[i], items: mItems, stats: mItems.length ? calculateYearlyStats(mItems, nowIso) : mkStats_() })), stats = extra.length ? calculateYearlyStats(extra, nowIso) : mkStats_();
    months.forEach(m => { for (const k of ['total', 'active', 'completed', 'cancelled', 'overdue', 'rescheduleTotal']) stats[k] += m.stats[k]; });
    return { ceYear: ce, buddhistYear: ce + 543, items, stats: finStats_(stats), userStats: calculateUserStats(items), months };
  }
  function queryMultiYearOverview(appointments, startY, endY, options) {
    const opts = options || {}, sCE = normalizeYearToCE(startY), eCE = normalizeYearToCE(endY), years = [], yMap = Object.create(null), arr = appointments || []; if (!sCE || !eCE || eCE < sCE) throw new Error('ช่วงปีไม่ถูกต้อง');
    for (let i = 0; i < arr.length; i++) { const a = arr[i]; if (!a || a.deletedAt || !a.appointmentDate) continue; const y = +a.appointmentDate.slice(0, 4); if (y >= sCE && y <= eCE) (yMap[y] || (yMap[y] = [])).push(a); }
    for (let y = sCE; y <= eCE; y++) years.push(queryByYear(yMap[y] || [], y, opts)); return { startCE: sCE, endCE: eCE, years };
  }

  // === 8. LINE Bot Message Formatter & Smart Natural Parser ===
  function formatInstantAppointmentMessage(apt, isUpdate, cfg) {
    if (!apt) return ''; const st = normalizeStatus(apt.status), creator = sanitizeNoEmoji(apt.createdBy || apt.updatedBy || '-');
    const hdr = st === S_CP ? '[แจ้งเตือนสิ้นสุดการนัดหมาย]' : (st === S_CN ? '[แจ้งเตือนยกเลิกการนัดหมาย]' : (isUpdate && apt.reopened ? '[แจ้งเตือนการคืนสถานะนัดหมาย]' : (isUpdate ? '[แจ้งเตือนการอัปเดตนัดหมาย]' : '[แจ้งเตือนนัดหมายใหม่]')));
    const lines = [hdr, `รหัส: ${sanitizeNoEmoji(apt.id || '-')}`, `หัวข้อ: ${sanitizeNoEmoji(apt.title || '-')}`, `วันนัด: ${formatThaiDateDisplay(apt.appointmentDate, false)} เวลา ${sanitizeNoEmoji(apt.appointmentTime || '-')} น.`, `สถานที่: ${sanitizeNoEmoji(apt.location || '-')}`, `ผู้นัดพบ: ${maskContact_(apt.contactPerson, cfg && cfg.privacyMaskContact)}`, `สถานะ: [${sanitizeNoEmoji(st)}]`, `ผู้สร้างนัดหมาย: ${creator}`];
    if (st === S_CP && apt.statusChangedBy) lines.push(`ผู้ยืนยันเสร็จสิ้น: ${sanitizeNoEmoji(apt.statusChangedBy)}`);
    else if (st === S_CN) { if (apt.statusChangedBy) lines.push(`ผู้ยกเลิกนัด: ${sanitizeNoEmoji(apt.statusChangedBy)}`); if (apt.statusReason) lines.push(`สาเหตุการยกเลิก: ${sanitizeNoEmoji(apt.statusReason)}`); }
    else if (isUpdate && apt.updatedBy && apt.updatedBy !== creator) lines.push(`ผู้แก้ไขล่าสุด: ${sanitizeNoEmoji(apt.updatedBy)}`); if (apt.notes) lines.push(`หมายเหตุ: ${sanitizeNoEmoji(apt.notes)}`);
    if (apt.mapUrl) lines.push(`แผนที่: ${sanitizeNoEmoji(apt.mapUrl)}`); return sanitizeNoEmoji(lines.join('\n'));
  }
  const Q_KEYS = 'ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ';
  const C_KW = '(?:สร้างนัด(?:หมาย)?|เพิ่มนัด(?:หมาย)?|นัด(?:หมาย)?ใหม่|สร้างงาน|เพิ่มงาน|งานใหม่|ลงนัด|ตั้งนัด|สร้างคิว|เพิ่มคิว|จองคิว)';
  const TH_ALT = THAI_MONTHS_FULL.concat(THAI_MONTHS_SHORT.map(s => s.replace(/\./g, '\\.?'))).join('|');
  const CMD_RE = new RegExp(`^คิว(?:\\s+|${Q_KEYS}|${C_KW}|$)|^(?:${Q_KEYS}|help|เดือน\\s+\\d{1,2}[-/]\\d{4}|ปี\\s*\\d{4}|ค้นหา\\s+.+|${C_KW}(?:[\\s:：]+[\\s\\S]+)?)$`, 'i');
  const CREATE_CMD_RE = new RegExp(`^${C_KW}(?:[\\s:：]+([\\s\\S]+))?$`, 'i');
  const KV_RE = /^(หัวข้อ|งาน|เรื่อง|วันที่|วันนัด|วัน|วันเวลา|เวลา|เวลานัด|สถานที่|ที่นัดหมาย|ผู้นัดพบ|ผู้นัด|ลูกค้า|ผู้ติดต่อ|เตือน|แจ้งเตือน|หมายเหตุ|รายละเอียด|แผนที่|พิกัด)\s*[:：]\s*(.+)$/i;
  const DT_TOK_RE = new RegExp(`(?:^|\\s)((?:(?:วันที่|วันนัด|วัน(?=\\s|[:：]))\\s*[:：]?\\s*)?(?:วันนี้|พรุ่งนี้|มะรืน(?:นี้)?|\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/]\\d{1,2}(?:[-/]\\d{2,4})?|\\d{1,2}\\s*(?:${TH_ALT})(?:\\s*(?:\\d{4}|\\d{2}(?!\\s*(?:โมง|[:.]))))?))(?=\\s|$)`, 'i');
  const TM_TOK_RE = /(?:^|\s)((?:(?:เวลา|เวลานัด)\s*[:：]?\s*)?(?:\d{1,2}[:.]\d{2}(?:\s*[-~ถึง]\s*\d{1,2}[:.]\d{2})?\s*(?:น\.?|โมง)?|\d{1,2}\s*โมง(?:ครึ่ง)?))(?=\s|$)/i;
  const yr2ce_ = y => { const n = Number(y); return (!Number.isInteger(n) || n < 0) ? null : (n < 100 ? (n >= 40 ? 2500 + n - 543 : 2000 + n) : normalizeYearToCE(n)); };
  const parseSmartTime_ = r => { const s = String(r || '').trim().replace(/^(?:เวลา|เวลานัด)\s*[:：]?\s*/, '').trim(); if (!s) return null; const mg = s.match(/^(\d{1,2})\s*โมง(ครึ่ง)?(?:\s*[-~ถึง].*)?$/i); return mg ? (+mg[1] <= 23 ? `${p2(+mg[1])}:${mg[2] ? '30' : '00'}` : null) : parseTimeInput(s.replace(/(?:\s*[-~ถึง]\s*\d{1,2}(?:[:.]\d{2})?)?\s*(?:น\.?|โมง)?$/i, '').replace(/\./g, ':').trim()); };
  const parseRemind_ = s => { const dM = s.match(/(\d+)\s*(?:วัน|ว\.?|d)/i), hM = s.match(/(\d+)\s*(?:ชั่วโมง|ชม\.?|h)/i); return { d: dM ? +dM[1] : 0, h: hM ? +hM[1] : 0 }; };
  function parseSmartDate_(r, bkk) {
    const s = sanitizeNoEmoji(r).replace(/^(?:วันที่|วันนัด|วัน(?=\s|[:：]))\s*[:：]?\s*/, '').trim(); if (!s) return null;
    if (s === 'วันนี้') return bkk.dateStr; if (s === 'พรุ่งนี้') return getBangkokParts(bkk.epochMs + 86400000).dateStr; if (s === 'มะรืน' || s === 'มะรืนนี้') return getBangkokParts(bkk.epochMs + 172800000).dateStr;
    const dm = s.match(/^(\d{1,2})[-/](\d{1,2})$/); if (dm) { const d = +dm[1], m = +dm[2], mx = getDaysInMonth(bkk.year, m); return mx && d >= 1 && d <= mx ? `${bkk.year}-${p2(m)}-${p2(d)}` : null; }
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); if (dmy) { const ce = yr2ce_(dmy[3]), d = +dmy[1], m = +dmy[2], mx = ce ? getDaysInMonth(ce, m) : 0; return mx && d >= 1 && d <= mx ? `${ce}-${p2(m)}-${p2(d)}` : null; }
    const th = s.match(/^(\d{1,2})\s*([\u0E01-\u0E4E.]+?)(?:\s*(\d{2,4}))?$/); if (th) { const ms = th[2].trim(), mo = TH_MO_MAP.get(ms) || TH_MO_MAP.get(ms.replace(/\./g, '')) || 0; if (mo) { const ce = th[3] ? yr2ce_(th[3]) : bkk.year, dy = +th[1], mx = ce ? getDaysInMonth(ce, mo) : 0; return mx && dy >= 1 && dy <= mx ? `${ce}-${p2(mo)}-${p2(dy)}` : null; } }
    return parseFlexibleDateInput(s);
  }
  function parseLineCreateCmd_(arg, bkk, defCreator) {
    const cm = arg.match(CREATE_CMD_RE); if (!cm) return null; const body = (cm[1] || '').trim(); if (!body) return { help: true }; let title = '', dateRaw = '', timeRaw = '', location = '', contactPerson = '', notes = '', mapUrl = '', rD = 0, rH = 0;
    const lines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean); if (lines.length > 1 && lines.some(l => KV_RE.test(l))) {
      lines.forEach(l => {
        const m = l.match(KV_RE); if (!m) return; const k = m[1], v = m[2].trim(); if (/^(?:หัวข้อ|งาน|เรื่อง)$/.test(k)) title = v; else if (/^(?:วันที่|วันนัด|วัน)$/.test(k)) dateRaw = v;
        else if (k === 'วันเวลา') { const dm = v.match(/^(.*?)\s+(\d{1,2}(?:[:.]\d{2}|\s*โมง).*)$/); if (dm) { dateRaw = dm[1]; timeRaw = dm[2]; } else { const p = v.split(/\s+/); dateRaw = p[0] || ''; timeRaw = p.slice(1).join(' '); } }
        else if (/^(?:เวลา|เวลานัด)$/.test(k)) timeRaw = v; else if (/^(?:สถานที่|ที่นัดหมาย)$/.test(k)) location = v;
        else if (/^(?:ผู้นัดพบ|ผู้นัด|ลูกค้า|ผู้ติดต่อ)$/.test(k)) contactPerson = v; else if (/^(?:เตือน|แจ้งเตือน)$/.test(k)) { const r = parseRemind_(v); rD = r.d; rH = r.h; }
        else if (/^(?:หมายเหตุ|รายละเอียด)$/.test(k)) notes = v; else if (/^(?:แผนที่|พิกัด)$/.test(k)) mapUrl = v;
      }); if (dateRaw && !timeRaw) { const tm = dateRaw.match(/^(.+?)\s+(?:เวลา\s*)?(\d{1,2}[:.]\d{2}(?:\s*น\.?)?|\d{1,2}\s*โมง(?:ครึ่ง)?)$/i); if (tm) { dateRaw = tm[1]; timeRaw = tm[2]; } }
    } else {
      const urls = [], safeBody = body.replace(/https?:\/\/\S+/gi, u => (urls.push(u), `\x02${urls.length - 1}\x02`)).replace(/(\d)\/(?=\d)/g, '$1\x01');
      const hasSep = /[\/|]/.test(safeBody), rest = s => s.replace(/\x01/g, '/').replace(/\x02(\d+)\x02/g, (_, i) => urls[+i] || '').trim();
      const segs = (hasSep ? safeBody.replace(/\r?\n/g, ' ').split(/\s*[\/|]\s*/) : (lines.length > 1 ? safeBody.split(/\r?\n/) : [safeBody])).map(rest).filter(Boolean), txtSegs = []; segs.forEach(seg => {
        if (/^(?:เตือน|แจ้งเตือน)\s+/i.test(seg)) { const r = parseRemind_(seg); rD = r.d; rH = r.h; return; } let w = seg;
        if (!dateRaw) { const dm = w.match(DT_TOK_RE); if (dm && parseSmartDate_(dm[1], bkk)) { dateRaw = dm[1]; w = w.replace(dm[0], ' ').trim(); } }
        if (!timeRaw) { const tm = w.match(TM_TOK_RE); if (tm && parseSmartTime_(tm[1])) { timeRaw = tm[1]; w = w.replace(tm[0], ' ').trim(); } } if (w) txtSegs.push(w);
      }); title = txtSegs[0] || ''; location = txtSegs[1] || ''; contactPerson = txtSegs[2] || ''; notes = txtSegs.slice(3).join(' / ');
    }
    const appointmentDate = parseSmartDate_(dateRaw, bkk), appointmentTime = parseSmartTime_(timeRaw), cleanTitle = sanitizeNoEmoji(title);
    if (!appointmentDate || !appointmentTime || !cleanTitle) return { error: '[ข้อผิดพลาด] รูปแบบคำสั่งสร้างนัดไม่ถูกต้อง\nตัวอย่าง: สร้างนัด พรุ่งนี้ 10:30 / ประชุมตรวจรับงาน / ห้อง B / คุณสมชาย' };
    return { payload: { title: cleanTitle, appointmentDate, appointmentTime, location: sanitizeNoEmoji(location) || 'ไม่ระบุสถานที่', contactPerson: sanitizeNoEmoji(contactPerson) || sanitizeNoEmoji(defCreator) || 'ผู้ใช้งาน LINE', status: S_CF, remindDaysBefore: rD, remindHoursBefore: rH, notes: sanitizeNoEmoji(notes), mapUrl: sanitizeNoEmoji(mapUrl), createdBy: sanitizeNoEmoji(defCreator) || S_SYS } };
  }
  function formatYearCommandReply_(r) {
    const s = r.stats, hdr = `[สรุปสถิติประจำปี พ.ศ. ${r.buddhistYear} (ค.ศ. ${r.ceYear})]\nรวมทั้งหมด: ${s.total} งาน | เริ่มนัด: ${s.active} งาน\nสิ้นสุด: ${s.completed} งาน (สำเร็จ ${s.completionRate}%) | ยกเลิก: ${s.cancelled} งาน (${s.cancellationRate}%)\nเลื่อนนัดสะสม: ${s.rescheduleTotal} ครั้ง`;
    if (!s.total) return `${hdr}\n\nยังไม่มีรายการนัดหมายในปีนี้`; const lines = [hdr, '\n[แยกตามเดือน]'];
    r.months.forEach(m => { if (m.stats.total > 0) { lines.push(`- ${m.monthNameThai}: รวม ${m.stats.total} งาน (เสร็จ ${m.stats.completed} / ยกเลิก ${m.stats.cancelled})`); m.items.slice(0, 2).forEach(a => lines.push(`   [${a.appointmentDate} ${a.appointmentTime || ''}] ${a.title} - ${normalizeStatus(a.status)} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`)); } });
    return clipTxt_(lines.join('\n'), 1);
  }
  function parseAndExecuteLineCommand(rawText, appointments, nowIso, settings) {
    const text = sanitizeNoEmoji(rawText || ''); if (!CMD_RE.test(text)) return null; const cfg = settings || {}, arg = text.replace(/^คิว\s*/, '').trim();
    if (cfg.enableLineBotQuery === false) return '[ระบบปิดการค้นหาผ่านแชทชั่วคราว] กรุณาตรวจสอบผ่านหน้าเว็บแอป';
    if (!arg || arg === 'ช่วยเหลือ' || arg.toLowerCase() === 'help') return ['[คำสั่งตรวจสอบตารางงาน]', '- ทั้งหมด : นัดหมายที่กำลังจะมาถึงทั้งหมด', '- วันนี้ : นัดหมายวันนี้', '- พรุ่งนี้ : นัดหมายพรุ่งนี้', '- สัปดาห์นี้ : นัดหมาย 7 วันข้างหน้า', '- ค้างอยู่ : งานเลยกำหนดเวลา', '- เดือนนี้ : สรุปงานเดือนปัจจุบัน', '- เดือน MM/YYYY : เช่น เดือน 12/2569', '- ปีนี้ : สรุปงานและสถิติท้ายปีปัจจุบัน', '- ปี YYYY : เช่น ปี 2570', '- ค้นหา <คำค้น> : ค้นหาตามชื่อ/สถานที่/หัวข้อ/ผู้สร้าง', '- สร้างนัด / สร้างงาน <วัน> <เวลา> / <หัวข้อ> / <สถานที่> / <ผู้นัด> : สร้างนัดผ่านแชท', '- โควตา : ตรวจสอบโควตารายเดือน'].join('\n');
    if (arg === 'โควตา') return `[สถานะโควตา LINE ประจำเดือน]\nใช้ไปแล้ว: ${+cfg.quotaUsed || 0} / ${+cfg.quotaLimit || 300} ข้อความ`; const bkk = getBangkokParts(nowIso), cRes = parseLineCreateCmd_(arg, bkk, cfg.defaultCreator || 'ผู้ใช้งาน LINE');
    if (cRes) {
      if (cRes.help) return ['[วิธีพิมพ์สร้างนัดหมายในแชท]', '1) แบบบรรทัดเดียว (คั่นด้วย /):', 'สร้างนัด พรุ่งนี้ 10:30 / ประชุมงาน / ห้อง B / คุณสมชาย', '(หรือแบบย่อ: สร้างนัด วันนี้ 14:00 / สรุปงานทีม)', '2) แบบหลายบรรทัด:', 'สร้างนัด', 'หัวข้อ: ประชุมตรวจรับงาน', 'วันที่: 25/11/2569', 'เวลา: 10:30', 'สถานที่: ห้อง B', 'ผู้นัดพบ: คุณสมชาย'].join('\n');
      if (cRes.error) return cRes.error; const list = (appointments || []).filter(a => a && !a.deletedAt), rec = createAppointmentRecord(cRes.payload, list, nowIso), conflicts = findTimeConflicts(list, rec.appointmentDate, rec.appointmentTime, rec.id);
      if (typeof cfg.onCreate === 'function') cfg.onCreate(rec, conflicts);
      return formatInstantAppointmentMessage(rec, false, cfg) + (conflicts.length ? `\n[คำเตือน] มีนัดหมายอื่นในวันและเวลานี้แล้ว (${conflicts.length} งาน: ${conflicts.map(c => c.title).join(', ')})` : '');
    }
    const list = (appointments || []).filter(a => a && !a.deletedAt), fmtList = (hdr, itms) => clipTxt_(`${hdr}\n` + itms.sort(cmpSlot).map((a, i) => formatAptLine_(a, i + 1, cfg)).join('\n\n'));
    const fmtM = r => { const hdr = `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}`; return r.items.length ? fmtList(`${hdr} (${r.ceYear})] รวม ${r.stats.total} รายการ (สิ้นสุด ${r.stats.completed} | ยกเลิก ${r.stats.cancelled})`, r.items) : `${hdr}]\n${NO_ITEM}`; };
    if (arg === 'ทั้งหมด' || arg === 'นัดทั้งหมด' || arg === 'งานทั้งหมด') { const ttl = '[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด]', itms = list.filter(a => normalizeStatus(a.status) === S_CF && a.appointmentDate && a.appointmentDate >= bkk.dateStr); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\n${NO_ITEM}ที่กำลังจะมาถึง`; }
    if (arg === 'วันนี้' || arg === 'พรุ่งนี้') { const td = arg === 'วันนี้' ? bkk.dateStr : getBangkokParts(bkk.epochMs + 86400000).dateStr, ttl = `[คิวงาน${arg} ${formatThaiDateDisplay(td, false)}]`, itms = list.filter(a => a.appointmentDate === td && normalizeStatus(a.status) !== S_CN); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\n${NO_ITEM}`; }
    if (arg === 'สัปดาห์นี้') { const maxDt = getBangkokParts(bkk.epochMs + 7 * 86400000).dateStr, itms = list.filter(a => a.appointmentDate && normalizeStatus(a.status) !== S_CN && (ISO_DATE_RE.test(a.appointmentDate) ? (a.appointmentDate >= bkk.dateStr && a.appointmentDate <= maxDt) : (() => { const d = daysBetweenDates(bkk.dateStr, a.appointmentDate); return d !== null && d >= 0 && d <= 7; })())); return itms.length ? fmtList(`[คิวงานใน 7 วันข้างหน้า] (${itms.length} รายการ)`, itms) : `[คิวงานใน 7 วันข้างหน้า]\n${NO_ITEM}`; }
    if (arg === 'ค้างอยู่') { const itms = list.filter(a => isActiveStatus(a.status) && isPastBkkSlot_(a.appointmentDate, a.appointmentTime, bkk)); return itms.length ? fmtList(`[คิวงานเลยกำหนดเวลา] (${itms.length} รายการ)`, itms) : '[คิวงานเลยกำหนด]\nไม่มีรายการค้าง'; }
    if (arg === 'เดือนนี้') { const r = queryByMonth(list, bkk.year, bkk.month, { nowIso }); return r.items.length ? fmtM(r) : `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}]\n${NO_ITEM}ในเดือนนี้`; }
    const mm = arg.match(/^เดือน\s+(\d{1,2})[-/](\d{4})$/); if (mm) { const y = normalizeYearToCE(mm[2]), m = +mm[1]; return (!y || m < 1 || m > 12) ? '[ข้อผิดพลาด] รูปแบบเดือนไม่ถูกต้อง เช่น เดือน 12/2569' : fmtM(queryByMonth(list, y, m, { nowIso })); }
    if (arg === 'ปีนี้' || arg === 'ปีหน้า') return formatYearCommandReply_(queryByYear(list, arg === 'ปีนี้' ? bkk.year : bkk.year + 1, { nowIso }));
    const ym = arg.match(/^ปี\s*(\d{4})$/); if (ym) { const y = normalizeYearToCE(ym[1]); return y ? formatYearCommandReply_(queryByYear(list, y, { nowIso })) : '[ข้อผิดพลาด] รูปแบบปีไม่ถูกต้อง เช่น ปี 2570'; }
    const sm = arg.match(/^ค้นหา\s+(.+)$/); if (sm) { const q = sm[1].trim(), ttl = `[ผลการค้นหา "${q}"]`, kw = q.toLowerCase(), itms = list.filter(a => `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${a.status} ${a.notes}`.toLowerCase().includes(kw)); return itms.length ? fmtList(`${ttl} (${itms.length} รายการ)`, itms) : `${ttl}\nไม่พบรายการที่ตรงกัน`; }
    return '[ไม่พบคำสั่งที่ระบุ] พิมพ์ "ช่วยเหลือ" เพื่อดูรายการคำสั่ง';
  }

  return { API_VERSION, STATUS, VALID_STATUSES, USER_ROLES, DEFAULT_USERS, SUSPEND_DURATIONS, THAI_MONTHS_SHORT, THAI_MONTHS_FULL, LINE_MAX_TEXT_LENGTH: LINE_MAX_LEN, hasEmoji, sanitizeNoEmoji, normalizeStatus, hashPassword, computeSuspendedUntil, evaluateUserSuspension, authenticateUser, applyUserSuspension, deleteUserAccount, validateUserInput, registerUserAccount, normalizeYearToCE, toBuddhistYear, isLeapYearCE, getDaysInMonth, parseFlexibleDateInput, parseTimeInput, bangkokSlotToEpochMs, getBangkokParts, daysBetweenDates, formatThaiDateDisplay, isActiveStatus, isOverdue, buildAppointmentSlot, findTimeConflicts, validateAppointmentInput, generateAppointmentId, createAppointmentRecord, updateAppointmentRecord, isInQuietHours, evaluateAppointmentNotification, buildNotificationPlan, calculateYearlyStats, calculateUserStats, queryByMonth, queryByYear, queryMultiYearOverview, formatInstantAppointmentMessage, parseAndExecuteLineCommand };
});