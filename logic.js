/**
 * logic.js - Core Business Logic, Validation, Timezone (Asia/Bangkok),
 * Notification Engine, Multi-Year & Year-End Statistics, User Auth & Attribution (v2.5.0)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalendarLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const API_VERSION = '2.5.0', BKK_OFFSET_MS = 7 * 3600 * 1000, LINE_MAX_LEN = 4500;
  const STATUS = Object.freeze({
    CONFIRMED: 'นัดหมายแล้ว',
    COMPLETED: 'สิ้นสุดการนัดหมาย',
    CANCELLED: 'ยกเลิกการนัดหมาย'
  });
  const VALID_STATUSES = Object.freeze([STATUS.CONFIRMED, STATUS.COMPLETED, STATUS.CANCELLED]);
  const USER_ROLES = Object.freeze({ ADMIN: 'ADMIN', STAFF: 'STAFF' });
  const THAI_MONTHS_SHORT = Object.freeze(['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']);
  const THAI_MONTHS_FULL = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);

  // --- Zero-Emoji Sanitizer ---
  const EMOJI_EXT_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic}(?:\uFE0F|\u200D(?![\u00A9\u00AE\u2122](?!\uFE0F))\p{Extended_Pictographic})*)/gu;
  const EMOJI_MOD_RE = /[\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu;
  const hasEmoji = s => !s || typeof s !== 'string' ? false : (EMOJI_EXT_RE.lastIndex = EMOJI_MOD_RE.lastIndex = 0, EMOJI_EXT_RE.test(s) || EMOJI_MOD_RE.test(s));
  const sanitizeNoEmoji = s => s == null ? '' : String(s).replace(EMOJI_EXT_RE, '').replace(EMOJI_MOD_RE, '').replace(/[ \t]{2,}/g, ' ').trim();

  // Normalize legacy status names
  const normalizeStatus = st => {
    const s = sanitizeNoEmoji(st || STATUS.CONFIRMED);
    if (s === 'กำลังนัดหมายวันเวลา' || s === 'พบหมายแล้ว' || s === STATUS.CONFIRMED) return STATUS.CONFIRMED;
    if (s === STATUS.COMPLETED || s === STATUS.CANCELLED) return s;
    return STATUS.CONFIRMED;
  };

  // --- Cryptographic Hash (SHA-256) for Passwords ---
  function hashPassword(str) {
    const raw = unescape(encodeURIComponent(String(str || '')));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = raw[lengthProperty] * 8;
    let hash = [];
    const k = [];
    let primeCounter = 0;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    let ascii = raw + '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      const w = words.slice(j, j += 16);
      const oldHash = hash.slice(0);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + ((w15 >>> 7 | w15 << 25) ^ (w15 >>> 18 | w15 << 14) ^ (w15 >>> 3))
            + w[i - 7]
            + ((w2 >>> 17 | w2 << 15) ^ (w2 >>> 19 | w2 << 13) ^ (w2 >>> 10))
          ) | 0);
        const temp2 = ((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // Default seed users
  const DEFAULT_USERS = Object.freeze([
    { userId: 'USR-001', username: 'admin', displayName: 'ผู้ดูแลระบบ', role: 'ADMIN', passwordHash: hashPassword('admin'), isActive: true, createdAt: '2026-11-01T08:00:00+07:00' },
    { userId: 'USR-002', username: 'somchai', displayName: 'คุณสมชาย', role: 'STAFF', passwordHash: hashPassword('1234'), isActive: true, createdAt: '2026-11-01T08:00:00+07:00' },
    { userId: 'USR-003', username: 'wipada', displayName: 'คุณวิภาดา', role: 'STAFF', passwordHash: hashPassword('1234'), isActive: true, createdAt: '2026-11-01T08:00:00+07:00' }
  ]);

  function authenticateUser(users, username, password) {
    const un = sanitizeNoEmoji(username || '').toLowerCase();
    const pw = String(password || '');
    if (!un || !pw) return { ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
    const list = Array.isArray(users) && users.length ? users : DEFAULT_USERS;
    const found = list.find(u => u && sanitizeNoEmoji(u.username).toLowerCase() === un);
    if (!found) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ' };
    if (found.isActive === false || String(found.isActive).toUpperCase() === 'FALSE') return { ok: false, error: 'บัญชีนี้ถูกระงับการใช้งาน' };
    const h = hashPassword(pw);
    if (found.passwordHash !== h) return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    return {
      ok: true,
      user: {
        userId: found.userId,
        username: found.username,
        displayName: sanitizeNoEmoji(found.displayName || found.username),
        role: found.role === 'ADMIN' ? 'ADMIN' : 'STAFF'
      }
    };
  }

  function validateUserInput(input, isCreate = true) {
    const errs = [];
    const username = sanitizeNoEmoji(input.username || '').toLowerCase();
    const displayName = sanitizeNoEmoji(input.displayName || '');
    const role = (input.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const isActive = input.isActive !== false && String(input.isActive).toUpperCase() !== 'FALSE';

    if (isCreate) {
      if (!username || username.length < 3 || username.length > 20 || !/^[a-z0-9_.-]+$/.test(username)) {
        errs.push('ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษหรือตัวเลข 3-20 ตัวอักษร');
      }
      if (!input.password || String(input.password).length < 4) {
        errs.push('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      }
    }
    if (!displayName) errs.push('กรุณาระบุชื่อ-นามสกุล หรือชื่อเรียก');

    let passwordHash = '';
    if (input.password) passwordHash = hashPassword(input.password);
    else if (input.passwordHash) passwordHash = input.passwordHash;

    return {
      valid: !errs.length,
      errors: errs,
      sanitized: { username, displayName, role, isActive, passwordHash }
    };
  }

  // --- Time & Date Helpers (Asia/Bangkok UTC+07:00) ---
  const pad2 = n => String(Math.floor(Math.abs(Number(n) || 0))).padStart(2, '0');
  const normalizeYearToCE = y => { const n = Number(String(y || '').trim()); return !Number.isInteger(n) || n < 1900 || n > 3000 ? null : (n > 2400 ? n - 543 : n); };
  const toBuddhistYear = ce => { const y = normalizeYearToCE(ce); return y ? y + 543 : null; };
  const isLeapYearCE = y => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const getDaysInMonth = (y, m) => {
    const ce = normalizeYearToCE(y), mi = Number(m);
    return !ce || mi < 1 || mi > 12 ? 0 : [31, isLeapYearCE(ce) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mi - 1];
  };

  function parseFlexibleDateInput(raw) {
    const s = String(raw || '').trim(); if (!s) return '';
    let y, m, d, m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/), m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m1) [y, m, d] = [normalizeYearToCE(m1[1]), +m1[2], +m1[3]];
    else if (m2) [d, m, y] = [+m2[1], +m2[2], normalizeYearToCE(m2[3])];
    else return null;
    return !y || m < 1 || m > 12 || d < 1 || d > getDaysInMonth(y, m) ? null : `${y}-${pad2(m)}-${pad2(d)}`;
  }

  function parseTimeInput(raw) {
    const s = String(raw || '').trim(); if (!s) return '';
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    return !m || +m[1] < 0 || +m[1] > 23 || +m[2] < 0 || +m[2] > 59 ? null : `${pad2(m[1])}:${pad2(m[2])}`;
  }

  function bangkokSlotToEpochMs(dateStr, timeStr) {
    const d = parseFlexibleDateInput(dateStr), t = parseTimeInput(timeStr || '00:00');
    if (!d || !t) return null;
    const [y, m, dy] = d.split('-').map(Number), [hh, mm] = t.split(':').map(Number);
    return Date.UTC(y, m - 1, dy, hh, mm, 0, 0) - BKK_OFFSET_MS;
  }

  function parseToEpochMs(isoOrDate) {
    if (isoOrDate instanceof Date) return isoOrDate.getTime();
    if (typeof isoOrDate === 'number') return isoOrDate;
    const s = String(isoOrDate || '').trim(); if (!s) return Date.now();
    const slot = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
    if (slot) {
      const base = bangkokSlotToEpochMs(slot[1], slot[2]);
      return base !== null ? base + (slot[3] ? +slot[3] * 1000 : 0) : Date.now();
    }
    const parsed = Date.parse(s);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  function getBangkokParts(isoOrDate) {
    const epochMs = parseToEpochMs(isoOrDate), b = new Date(epochMs + BKK_OFFSET_MS);
    const year = b.getUTCFullYear(), month = b.getUTCMonth() + 1, day = b.getUTCDate();
    const hour = b.getUTCHours(), minute = b.getUTCMinutes(), second = b.getUTCSeconds();
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`, timeStr = `${pad2(hour)}:${pad2(minute)}`;
    return { epochMs, year, buddhistYear: year + 543, month, day, hour, minute, second, dateStr, timeStr, slotStr: `${dateStr}T${timeStr}`, isoStr: `${dateStr}T${timeStr}:${pad2(second)}+07:00` };
  }

  const daysBetweenDates = (s, e) => {
    const sm = bangkokSlotToEpochMs(s, '00:00'), em = bangkokSlotToEpochMs(e, '00:00');
    return sm === null || em === null ? null : Math.round((em - sm) / 86400000);
  };

  const formatThaiDateDisplay = (dateStr, includeCE = true) => {
    const d = parseFlexibleDateInput(dateStr); if (!d) return 'ยังไม่กำหนดวันที่';
    const [y, m, dy] = d.split('-').map(Number);
    return `${dy} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}` + (includeCE ? ` (${d})` : '');
  };

  // --- Status & Overdue ---
  const isActiveStatus = st => normalizeStatus(st) === STATUS.CONFIRMED;
  const buildAppointmentSlot = a => a && a.appointmentDate && a.appointmentTime ? `${a.appointmentDate}T${a.appointmentTime}` : '';
  const isOverdue = (a, nowIso) => {
    if (!a || a.deletedAt || !isActiveStatus(a.status) || !a.appointmentDate || !a.appointmentTime) return false;
    const ep = bangkokSlotToEpochMs(a.appointmentDate, a.appointmentTime);
    return ep !== null && getBangkokParts(nowIso).epochMs > ep;
  };

  // --- Time-Slot Conflict Detection ---
  function findTimeConflicts(appointments, dateStr, timeStr, excludeId) {
    const d = parseFlexibleDateInput(dateStr), t = parseTimeInput(timeStr);
    if (!d || !t) return [];
    return (appointments || []).filter(a => {
      if (!a || a.deletedAt || (excludeId && a.id === excludeId)) return false;
      if (normalizeStatus(a.status) === STATUS.CANCELLED) return false;
      return a.appointmentDate === d && a.appointmentTime === t;
    });
  }

  // --- Validation, Creation & Reschedule Updates with User Attribution ---
  function validateAppointmentInput(input) {
    if (!input || typeof input !== 'object') return { valid: false, errors: ['ข้อมูลไม่ถูกต้อง'] };
    const errs = [];
    const title = sanitizeNoEmoji(input.title || '');
    const status = normalizeStatus(input.status);
    const location = sanitizeNoEmoji(input.location || '');
    const contactPerson = sanitizeNoEmoji(input.contactPerson || '');
    const pDate = input.appointmentDate ? parseFlexibleDateInput(input.appointmentDate) : '';
    const pTime = input.appointmentTime ? parseTimeInput(input.appointmentTime) : '';

    if (!title) errs.push('กรุณาระบุหัวข้องาน');
    if (!pDate) errs.push('กรุณาระบุวันที่นัดหมาย');
    if (!pTime) errs.push('กรุณาระบุเวลานัดหมาย (HH:mm)');
    if (!location) errs.push('กรุณาระบุสถานที่นัดหมาย');
    if (!contactPerson) errs.push('กรุณาระบุชื่อผู้นัดพบ');
    if (input.appointmentDate && pDate === null) errs.push('รูปแบบวันที่ไม่ถูกต้อง');
    if (input.appointmentTime && pTime === null) errs.push('รูปแบบเวลาไม่ถูกต้อง (HH:mm)');

    const rDays = input.remindDaysBefore != null && input.remindDaysBefore !== '' ? Number(input.remindDaysBefore) : 1;
    const rHours = input.remindHoursBefore != null && input.remindHoursBefore !== '' ? Number(input.remindHoursBefore) : 1;
    if (!Number.isInteger(rDays) || rDays < 0 || rDays > 365) errs.push('จำนวนวันแจ้งเตือนต้องเป็น 0-365');
    if (!Number.isInteger(rHours) || rHours < 0 || rHours > 168) errs.push('จำนวนชั่วโมงแจ้งเตือนต้องเป็น 0-168');

    const createdBy = sanitizeNoEmoji(input.createdBy || input.updatedBy || 'ผู้ใช้งานระบบ') || 'ผู้ใช้งานระบบ';
    const updatedBy = sanitizeNoEmoji(input.updatedBy || createdBy) || createdBy;
    const statusChangedBy = sanitizeNoEmoji(input.statusChangedBy || '');
    const statusChangedAt = sanitizeNoEmoji(input.statusChangedAt || '');
    const statusReason = sanitizeNoEmoji(input.statusReason || '');

    return {
      valid: !errs.length,
      errors: errs,
      sanitized: {
        title, appointmentDate: pDate || '', appointmentTime: pTime || '', location, contactPerson, status,
        remindDaysBefore: rDays, remindHoursBefore: rHours, notes: sanitizeNoEmoji(input.notes || ''),
        createdBy, updatedBy, statusChangedBy, statusChangedAt, statusReason
      }
    };
  }

  function generateAppointmentId(existing, nowIso) {
    const prefix = `APT-${getBangkokParts(nowIso).dateStr.replace(/-/g, '')}-`;
    const max = (existing || []).reduce((m, x) => (x && x.id && x.id.startsWith(prefix) ? Math.max(m, +x.id.slice(prefix.length) || 0) : m), 0);
    return `${prefix}${pad2(max + 1).padStart(3, '0')}`;
  }

  function createAppointmentRecord(input, existing, nowIso) {
    const v = validateAppointmentInput(input);
    if (!v.valid) throw new Error(v.errors.join(' | '));
    const now = getBangkokParts(nowIso).isoStr, s = v.sanitized;
    const isStatusChanged = s.status !== STATUS.CONFIRMED;

    return {
      id: input.id ? sanitizeNoEmoji(input.id) : generateAppointmentId(existing, now),
      ...s,
      createdBy: s.createdBy,
      statusChangedBy: isStatusChanged ? (s.statusChangedBy || s.createdBy) : '',
      statusChangedAt: isStatusChanged ? now : '',
      statusReason: isStatusChanged ? s.statusReason : '',
      notifiedDayForSlot: '',
      notifiedHourForSlot: '',
      rescheduleCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: ''
    };
  }

  function updateAppointmentRecord(existing, patch, options) {
    if (!existing || !existing.id) throw new Error('ไม่พบรายการนัดหมาย');
    const opts = options || {};
    if (opts.expectedUpdatedAt && existing.updatedAt && opts.expectedUpdatedAt !== existing.updatedAt) {
      const err = new Error('ข้อมูลถูกแก้ไขโดยผู้อื่นแล้ว กรุณารีเฟรชก่อนทำรายการ');
      err.code = 'CONCURRENCY_CONFLICT';
      throw err;
    }
    const merged = { ...existing, ...patch };
    const v = validateAppointmentInput(merged);
    if (!v.valid) throw new Error(v.errors.join(' | '));

    const s = v.sanitized, bkk = getBangkokParts(opts.nowIso), reason = sanitizeNoEmoji(patch.reason || opts.reason || patch.statusReason || '');
    const logs = ['appointmentDate', 'appointmentTime', 'location', 'contactPerson', 'status']
      .filter(f => String(existing[f] || '') !== String(s[f] || ''))
      .map((f, i) => ({
        logId: `LOG-${bkk.epochMs}-${i + 1}`, appointmentId: existing.id, changedAt: bkk.isoStr,
        changedBy: s.updatedBy, fieldChanged: f, oldValue: String(existing[f] || ''), newValue: String(s[f] || ''), reason
      }));

    const dateChanged = String(existing.appointmentDate || '') !== String(s.appointmentDate || '');
    const timeChanged = String(existing.appointmentTime || '') !== String(s.appointmentTime || '');
    const remindDaysChanged = Number(existing.remindDaysBefore || 0) !== Number(s.remindDaysBefore || 0);
    const remindHoursChanged = Number(existing.remindHoursBefore || 0) !== Number(s.remindHoursBefore || 0);
    const statusChanged = normalizeStatus(existing.status) !== normalizeStatus(s.status);
    const reopened = !isActiveStatus(existing.status) && isActiveStatus(s.status);
    const countInc = ((existing.appointmentDate || existing.appointmentTime) && (dateChanged || timeChanged)) ? 1 : 0;

    let daySlot = existing.notifiedDayForSlot || '', hourSlot = existing.notifiedHourForSlot || '';
    if (dateChanged || reopened || remindDaysChanged) daySlot = '';
    if (dateChanged || timeChanged || reopened || remindHoursChanged) hourSlot = '';

    // User Attribution: Preserve original creator, track who changed status
    const createdBy = existing.createdBy || s.createdBy || existing.updatedBy || 'ผู้ใช้งานระบบ';
    let statusChangedBy = existing.statusChangedBy || '';
    let statusChangedAt = existing.statusChangedAt || '';
    let statusReason = existing.statusReason || '';

    if (statusChanged) {
      if (s.status === STATUS.CONFIRMED) {
        statusChangedBy = '';
        statusChangedAt = '';
        statusReason = '';
      } else {
        statusChangedBy = sanitizeNoEmoji(patch.statusChangedBy || s.updatedBy || 'ผู้ใช้งานระบบ');
        statusChangedAt = bkk.isoStr;
        statusReason = s.status === STATUS.CANCELLED ? sanitizeNoEmoji(patch.statusReason || reason || '') : sanitizeNoEmoji(patch.statusReason || '');
      }
    } else if (patch.statusReason !== undefined) {
      statusReason = sanitizeNoEmoji(patch.statusReason);
    }

    return {
      record: {
        ...existing,
        ...s,
        createdBy,
        statusChangedBy,
        statusChangedAt,
        statusReason,
        notifiedDayForSlot: daySlot,
        notifiedHourForSlot: hourSlot,
        rescheduleCount: (+existing.rescheduleCount || 0) + countInc,
        updatedAt: bkk.isoStr,
        updatedBy: s.updatedBy
      },
      logs, dateChanged, timeChanged, reopened, statusChanged
    };
  }

  // --- Notification Engine ---
  const isInQuietHours = (h, s = 22, e = 7) => {
    const hi = +h, si = +s, ei = +e;
    return si === ei ? false : (si > ei ? (hi >= si || hi < ei) : (hi >= si && hi < ei));
  };

  function evaluateAppointmentNotification(apt, nowIso, settings) {
    const cfg = settings || {};
    if (!apt || apt.deletedAt || !isActiveStatus(apt.status) || !apt.appointmentDate || !apt.appointmentTime) {
      return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'INVALID_OR_INACTIVE' };
    }
    const nowBkk = getBangkokParts(nowIso), aptEp = bangkokSlotToEpochMs(apt.appointmentDate, apt.appointmentTime);
    if (aptEp === null || nowBkk.epochMs >= aptEp) return { shouldNotifyDay: false, shouldNotifyHour: false, reason: 'PAST' };

    const quiet = isInQuietHours(nowBkk.hour, cfg.quietHoursStart, cfg.quietHoursEnd);
    const curSlot = buildAppointmentSlot(apt), rHours = +apt.remindHoursBefore || 0, rDays = +apt.remindDaysBefore || 0;
    const diffH = (aptEp - nowBkk.epochMs) / 3600000;

    if (rHours > 0 && apt.notifiedHourForSlot !== curSlot && diffH > 0 && diffH <= rHours && (!quiet || cfg.allowHourlyInQuietHours)) {
      return { shouldNotifyDay: false, shouldNotifyHour: true, supersedesDay: true, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffHours: diffH, reason: 'HOURLY_DUE' };
    }

    const diffD = daysBetweenDates(nowBkk.dateStr, apt.appointmentDate);
    if (rDays > 0 && apt.notifiedDayForSlot !== apt.appointmentDate && diffD !== null && diffD >= 0 && diffD <= rDays) {
      const dHour = cfg.dailyDigestHour != null ? +cfg.dailyDigestHour : 8;
      if (!quiet && (cfg.requireDigestWindow === false || nowBkk.hour >= dHour)) {
        return { shouldNotifyDay: true, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, diffCalDays: diffD, reason: 'DAY_DUE' };
      }
    }
    return { shouldNotifyDay: false, shouldNotifyHour: false, targetDaySlot: apt.appointmentDate, targetHourSlot: curSlot, reason: 'NOT_DUE' };
  }

  const maskContact = (c, mask) => !mask || !c || c.length <= 2 ? (c || '-') : `${c.slice(0, 2)}***`;
  const formatAptLine = (a, idx, cfg) => {
    const lines = [
      `${idx ? `${idx}. ` : ''}[${a.id}] ${sanitizeNoEmoji(a.title)}`,
      `   วันนัด: ${formatThaiDateDisplay(a.appointmentDate, false)} เวลา ${a.appointmentTime || '-'} น.`,
      `   สถานที่: ${sanitizeNoEmoji(a.location || '-')}`,
      `   ผู้นัดพบ: ${maskContact(a.contactPerson, cfg && cfg.privacyMaskContact)}`,
      `   สถานะ: [${sanitizeNoEmoji(normalizeStatus(a.status))}]`,
      `   ผู้สร้าง: ${sanitizeNoEmoji(a.createdBy || a.updatedBy || '-')}`
    ];
    if (a.statusChangedBy && normalizeStatus(a.status) !== STATUS.CONFIRMED) {
      lines.push(`   ผู้ดำเนินการ: ${sanitizeNoEmoji(a.statusChangedBy)}`);
    }
    return lines.join('\n');
  };

  function buildNotificationPlan(appointments, nowIso, settings) {
    const cfg = settings || {}, list = Array.isArray(appointments) ? appointments : [];
    const hourly = [], digest = [], slotUpdates = [];

    list.forEach(a => {
      const ev = evaluateAppointmentNotification(a, nowIso, cfg);
      if (ev.shouldNotifyHour) {
        hourly.push(a);
        slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: ev.targetHourSlot, triggerType: 'HOURLY_REMINDER' });
      } else if (ev.shouldNotifyDay) {
        digest.push(a);
        slotUpdates.push({ id: a.id, notifiedDayForSlot: ev.targetDaySlot, notifiedHourForSlot: a.notifiedHourForSlot || '', triggerType: 'DAILY_DIGEST' });
      }
    });

    const sortFn = (a, b) => buildAppointmentSlot(a).localeCompare(buildAppointmentSlot(b));
    hourly.sort(sortFn); digest.sort(sortFn);
    if (!hourly.length && !digest.length) return { shouldPush: false, hourlyItems: [], digestItems: [], slotUpdates: [], messageText: '' };

    const parts = [], bkk = getBangkokParts(nowIso);
    if (hourly.length) parts.push(`[แจ้งเตือนก่อนถึงเวลานัดหมาย] (${hourly.length} รายการ)\n` + hourly.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n'));
    if (digest.length) parts.push(`[สรุปคิวงานล่วงหน้าประจำวัน ${formatThaiDateDisplay(bkk.dateStr, false)}] (${digest.length} รายการ)\n` + digest.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n'));

    const limit = +cfg.quotaLimit || 300, used = +cfg.quotaUsed || 0;
    if (limit > 0 && used / limit >= 0.8) parts.push(`[แจ้งเตือนโควตา] เดือนนี้ใช้โควตา LINE ไปแล้ว ${used}/${limit} ข้อความ`);
    if (cfg.webAppUrl) parts.push(`ดูตารางงาน: ${sanitizeNoEmoji(cfg.webAppUrl)}`);

    let txt = sanitizeNoEmoji(parts.join('\n\n'));
    if (txt.length > LINE_MAX_LEN) txt = txt.slice(0, LINE_MAX_LEN - 80) + '\n...(ดูเพิ่มเติมบนหน้าเว็บแอป)';
    return { shouldPush: true, hourlyItems: hourly, digestItems: digest, slotUpdates, messageText: txt };
  }

  // --- Year-End & User Statistics ---
  function calculateYearlyStats(list, nowIso) {
    const stats = {
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
      rescheduleTotal: 0,
      completionRate: 0,
      cancellationRate: 0
    };
    (list || []).forEach(a => {
      if (!a || a.deletedAt) return;
      stats.total += 1;
      stats.rescheduleTotal += (+a.rescheduleCount || 0);
      const st = normalizeStatus(a.status);
      if (st === STATUS.CONFIRMED) stats.active += 1;
      else if (st === STATUS.COMPLETED) stats.completed += 1;
      else if (st === STATUS.CANCELLED) stats.cancelled += 1;
      if (isOverdue(a, nowIso)) stats.overdue += 1;
    });

    if (stats.total > 0) {
      stats.completionRate = Math.round((stats.completed / stats.total) * 100);
      stats.cancellationRate = Math.round((stats.cancelled / stats.total) * 100);
    }
    return stats;
  }

  function calculateUserStats(list) {
    const userMap = {};
    const ensureUser = name => {
      const n = sanitizeNoEmoji(name || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ';
      if (!userMap[n]) {
        userMap[n] = { user: n, createdTotal: 0, completedTotal: 0, cancelledTotal: 0, activeTotal: 0 };
      }
      return userMap[n];
    };

    (list || []).forEach(a => {
      if (!a || a.deletedAt) return;
      const cBy = sanitizeNoEmoji(a.createdBy || a.updatedBy || 'ไม่ระบุชื่อ') || 'ไม่ระบุชื่อ';
      const creatorStat = ensureUser(cBy);
      creatorStat.createdTotal += 1;

      const st = normalizeStatus(a.status);
      if (st === STATUS.CONFIRMED) {
        creatorStat.activeTotal += 1;
      } else if (st === STATUS.COMPLETED) {
        const closer = ensureUser(a.statusChangedBy || cBy);
        closer.completedTotal += 1;
      } else if (st === STATUS.CANCELLED) {
        const canceller = ensureUser(a.statusChangedBy || cBy);
        canceller.cancelledTotal += 1;
      }
    });
    return Object.values(userMap).sort((a, b) => (b.createdTotal + b.completedTotal + b.cancelledTotal) - (a.createdTotal + a.completedTotal + a.cancelledTotal) || b.createdTotal - a.createdTotal);
  }

  function queryByMonth(appointments, yInput, mInput, options) {
    const opts = options || {}, ce = normalizeYearToCE(yInput), m = Number(mInput);
    if (!ce || m < 1 || m > 12) throw new Error('ระบุเดือนหรือปีไม่ถูกต้อง');
    const pfx = `${ce}-${pad2(m)}-`;
    const items = (appointments || []).filter(a => a && !a.deletedAt && a.appointmentDate && a.appointmentDate.startsWith(pfx));
    items.sort((a, b) => buildAppointmentSlot(a).localeCompare(buildAppointmentSlot(b)));
    return { ceYear: ce, buddhistYear: ce + 543, month: m, monthNameThai: THAI_MONTHS_FULL[m - 1], items, stats: calculateYearlyStats(items, opts.nowIso) };
  }

  function queryByYear(appointments, yInput, options) {
    const opts = options || {}, ce = normalizeYearToCE(yInput);
    if (!ce) throw new Error('ระบุปีไม่ถูกต้อง');
    const pfx = `${ce}-`;
    const items = (appointments || []).filter(a => a && !a.deletedAt && a.appointmentDate && a.appointmentDate.startsWith(pfx));
    items.sort((a, b) => buildAppointmentSlot(a).localeCompare(buildAppointmentSlot(b)));
    const months = Array.from({ length: 12 }, (_, i) => {
      const mi = i + 1, mItems = items.filter(a => a.appointmentDate.startsWith(`${ce}-${pad2(mi)}-`));
      return { month: mi, monthNameThai: THAI_MONTHS_FULL[i], monthShortThai: THAI_MONTHS_SHORT[i], items: mItems, stats: calculateYearlyStats(mItems, opts.nowIso) };
    });
    return { ceYear: ce, buddhistYear: ce + 543, items, stats: calculateYearlyStats(items, opts.nowIso), userStats: calculateUserStats(items), months };
  }

  function queryMultiYearOverview(appointments, startY, endY, options) {
    const opts = options || {}, sCE = normalizeYearToCE(startY), eCE = normalizeYearToCE(endY);
    if (!sCE || !eCE || eCE < sCE) throw new Error('ช่วงปีไม่ถูกต้อง');
    const years = [];
    for (let y = sCE; y <= eCE; y++) years.push(queryByYear(appointments, y, opts));
    return { startCE: sCE, endCE: eCE, years };
  }

  function formatInstantAppointmentMessage(apt, isUpdate, cfg) {
    if (!apt) return '';
    const st = normalizeStatus(apt.status);
    let hdr = isUpdate ? '[แจ้งเตือนการอัปเดตนัดหมาย]' : '[แจ้งเตือนนัดหมายใหม่]';
    if (st === STATUS.COMPLETED) hdr = '[แจ้งเตือนสิ้นสุดการนัดหมาย]';
    else if (st === STATUS.CANCELLED) hdr = '[แจ้งเตือนยกเลิกการนัดหมาย]';
    else if (isUpdate && apt.reopened) hdr = '[แจ้งเตือนการคืนสถานะนัดหมาย]';

    const creator = sanitizeNoEmoji(apt.createdBy || apt.updatedBy || '-');
    const lines = [
      hdr,
      `รหัส: ${sanitizeNoEmoji(apt.id || '-')}`,
      `หัวข้อ: ${sanitizeNoEmoji(apt.title || '-')}`,
      `วันนัด: ${formatThaiDateDisplay(apt.appointmentDate, false)} เวลา ${sanitizeNoEmoji(apt.appointmentTime || '-')} น.`,
      `สถานที่: ${sanitizeNoEmoji(apt.location || '-')}`,
      `ผู้นัดพบ: ${maskContact(apt.contactPerson, cfg && cfg.privacyMaskContact)}`,
      `สถานะ: [${sanitizeNoEmoji(st)}]`,
      `ผู้สร้างนัดหมาย: ${creator}`
    ];
    if (st === STATUS.COMPLETED && apt.statusChangedBy) {
      lines.push(`ผู้ยืนยันเสร็จสิ้น: ${sanitizeNoEmoji(apt.statusChangedBy)}`);
    } else if (st === STATUS.CANCELLED) {
      if (apt.statusChangedBy) lines.push(`ผู้ยกเลิกนัด: ${sanitizeNoEmoji(apt.statusChangedBy)}`);
      if (apt.statusReason) lines.push(`สาเหตุการยกเลิก: ${sanitizeNoEmoji(apt.statusReason)}`);
    } else if (isUpdate && apt.updatedBy && apt.updatedBy !== creator) {
      lines.push(`ผู้แก้ไขล่าสุด: ${sanitizeNoEmoji(apt.updatedBy)}`);
    }
    if (apt.notes) lines.push(`หมายเหตุ: ${sanitizeNoEmoji(apt.notes)}`);
    return sanitizeNoEmoji(lines.join('\n'));
  }

  // --- LINE Bot Command Parser (Prefix: "คิว") ---
  function parseAndExecuteLineCommand(rawText, appointments, nowIso, settings) {
    const text = sanitizeNoEmoji(rawText || '').trim();
    if (!/^คิว(?:\s+|ทั้งหมด|นัดทั้งหมด|งานทั้งหมด|วันนี้|พรุ่งนี้|สัปดาห์นี้|ค้างอยู่|เดือนนี้|ปีนี้|ปีหน้า|โควตา|ช่วยเหลือ|$)/.test(text)) return null;
    const cfg = settings || {};
    if (cfg.enableLineBotQuery === false) return '[ระบบปิดการค้นหาผ่านแชทชั่วคราว] กรุณาตรวจสอบผ่านหน้าเว็บแอป';

    const arg = text.replace(/^คิว\s*/, '').trim(), bkk = getBangkokParts(nowIso);
    const list = (appointments || []).filter(a => a && !a.deletedAt);
    const fmtList = (hdr, itms) => {
      let o = `${hdr}\n` + itms.map((a, i) => formatAptLine(a, i + 1, cfg)).join('\n\n');
      return sanitizeNoEmoji(o.length > LINE_MAX_LEN ? o.slice(0, LINE_MAX_LEN - 80) + '\n...(ดูเพิ่มเติมบนเว็บแอป)' : o);
    };

    if (!arg || arg === 'ช่วยเหลือ' || arg.toLowerCase() === 'help') {
      return [
        '[คำสั่งตรวจสอบตารางงาน]',
        '- คิวทั้งหมด (หรือ คิว ทั้งหมด) : นัดหมายที่กำลังจะมาถึงทั้งหมด',
        '- คิว วันนี้ : นัดหมายวันนี้',
        '- คิว พรุ่งนี้ : นัดหมายพรุ่งนี้',
        '- คิว สัปดาห์นี้ : นัดหมาย 7 วันข้างหน้า',
        '- คิว ค้างอยู่ : งานเลยกำหนดเวลา',
        '- คิว เดือนนี้ : สรุปงานเดือนปัจจุบัน',
        '- คิว เดือน MM/YYYY : เช่น คิว เดือน 12/2569',
        '- คิว ปีนี้ : สรุปงานและสถิติท้ายปีปัจจุบัน',
        '- คิว ปี YYYY : เช่น คิว ปี 2570',
        '- คิว ค้นหา <คำค้น> : ค้นหาตามชื่อ/สถานที่/หัวข้อ/ผู้สร้าง',
        '- คิว โควตา : ตรวจสอบโควตารายเดือน'
      ].join('\n');
    }
    if (arg === 'โควตา') return `[สถานะโควตา LINE ประจำเดือน]\nใช้ไปแล้ว: ${+cfg.quotaUsed || 0} / ${+cfg.quotaLimit || 300} ข้อความ`;
    if (arg === 'ทั้งหมด' || arg === 'นัดทั้งหมด' || arg === 'งานทั้งหมด') {
      const itms = list
        .filter(a => normalizeStatus(a.status) === STATUS.CONFIRMED && a.appointmentDate && a.appointmentDate >= bkk.dateStr)
        .sort((a, b) => buildAppointmentSlot(a).localeCompare(buildAppointmentSlot(b)));
      return itms.length ? fmtList(`[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด] (${itms.length} รายการ)`, itms) : '[คิวนัดหมายที่กำลังจะมาถึงทั้งหมด]\nไม่มีรายการนัดหมายที่กำลังจะมาถึง';
    }
    if (arg === 'วันนี้') {
      const itms = list.filter(a => a.appointmentDate === bkk.dateStr && a.status !== STATUS.CANCELLED);
      return itms.length ? fmtList(`[คิวงานวันนี้ ${formatThaiDateDisplay(bkk.dateStr, false)}] (${itms.length} รายการ)`, itms) : `[คิวงานวันนี้ ${formatThaiDateDisplay(bkk.dateStr, false)}]\nไม่มีรายการนัดหมาย`;
    }
    if (arg === 'พรุ่งนี้') {
      const tmr = getBangkokParts(bkk.epochMs + 86400000).dateStr;
      const itms = list.filter(a => a.appointmentDate === tmr && a.status !== STATUS.CANCELLED);
      return itms.length ? fmtList(`[คิวงานพรุ่งนี้ ${formatThaiDateDisplay(tmr, false)}] (${itms.length} รายการ)`, itms) : `[คิวงานพรุ่งนี้ ${formatThaiDateDisplay(tmr, false)}]\nไม่มีรายการนัดหมาย`;
    }
    if (arg === 'สัปดาห์นี้') {
      const itms = list.filter(a => a.appointmentDate && a.status !== STATUS.CANCELLED && [daysBetweenDates(bkk.dateStr, a.appointmentDate)].some(d => d !== null && d >= 0 && d <= 7));
      return itms.length ? fmtList(`[คิวงานใน 7 วันข้างหน้า] (${itms.length} รายการ)`, itms) : '[คิวงานใน 7 วันข้างหน้า]\nไม่มีรายการนัดหมาย';
    }
    if (arg === 'ค้างอยู่') {
      const itms = list.filter(a => isOverdue(a, nowIso));
      return itms.length ? fmtList(`[คิวงานเลยกำหนดเวลา] (${itms.length} รายการ)`, itms) : '[คิวงานเลยกำหนด]\nไม่มีรายการค้าง';
    }
    if (arg === 'เดือนนี้') {
      const r = queryByMonth(list, bkk.year, bkk.month, { nowIso });
      return r.items.length ? fmtList(`[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear} (${r.ceYear})] รวม ${r.stats.total} รายการ (สิ้นสุด ${r.stats.completed} | ยกเลิก ${r.stats.cancelled})`, r.items) : `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}]\nไม่มีรายการนัดหมายในเดือนนี้`;
    }
    const mm = arg.match(/^เดือน\s+(\d{1,2})[-/](\d{4})$/);
    if (mm) {
      const y = normalizeYearToCE(mm[2]), m = +mm[1];
      if (!y || m < 1 || m > 12) return '[ข้อผิดพลาด] รูปแบบเดือนไม่ถูกต้อง เช่น คิว เดือน 12/2569';
      const r = queryByMonth(list, y, m, { nowIso });
      return r.items.length ? fmtList(`[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear} (${r.ceYear})] รวม ${r.stats.total} รายการ (สิ้นสุด ${r.stats.completed} | ยกเลิก ${r.stats.cancelled})`, r.items) : `[ตารางงานเดือน${r.monthNameThai} พ.ศ. ${r.buddhistYear}]\nไม่มีรายการนัดหมาย`;
    }
    if (arg === 'ปีนี้' || arg === 'ปีหน้า') {
      const targetY = arg === 'ปีนี้' ? bkk.year : bkk.year + 1;
      return formatYearCommandReply(queryByYear(list, targetY, { nowIso }), cfg);
    }
    const ym = arg.match(/^ปี\s*(\d{4})$/);
    if (ym) {
      const y = normalizeYearToCE(ym[1]);
      return y ? formatYearCommandReply(queryByYear(list, y, { nowIso }), cfg) : '[ข้อผิดพลาด] รูปแบบปีไม่ถูกต้อง เช่น คิว ปี 2570';
    }
    const sm = arg.match(/^ค้นหา\s+(.+)$/);
    if (sm) {
      const kw = sm[1].trim().toLowerCase();
      const itms = list.filter(a => `${a.id} ${a.title} ${a.location} ${a.contactPerson} ${a.createdBy || ''} ${a.statusChangedBy || ''} ${a.status} ${a.notes}`.toLowerCase().includes(kw));
      return itms.length ? fmtList(`[ผลการค้นหา "${sm[1].trim()}"] (${itms.length} รายการ)`, itms) : `[ผลการค้นหา "${sm[1].trim()}"]\nไม่พบรายการที่ตรงกัน`;
    }
    return '[ไม่พบคำสั่งที่ระบุ] พิมพ์ "คิว ช่วยเหลือ" เพื่อดูรายการคำสั่ง';
  }

  function formatYearCommandReply(r, cfg) {
    const s = r.stats;
    const hdr = `[สรุปสถิติประจำปี พ.ศ. ${r.buddhistYear} (ค.ศ. ${r.ceYear})]\nรวมทั้งหมด: ${s.total} งาน | นัดหมายแล้ว: ${s.active} งาน\nสิ้นสุด: ${s.completed} งาน (สำเร็จ ${s.completionRate}%) | ยกเลิก: ${s.cancelled} งาน (${s.cancellationRate}%)\nเลื่อนนัดสะสม: ${s.rescheduleTotal} ครั้ง`;
    if (!s.total) return `${hdr}\n\nยังไม่มีรายการนัดหมายในปีนี้`;
    const lines = [hdr, '\n[แยกตามเดือน]'];
    r.months.forEach(m => {
      if (m.stats.total > 0) {
        lines.push(`- ${m.monthNameThai}: รวม ${m.stats.total} งาน (เสร็จ ${m.stats.completed} / ยกเลิก ${m.stats.cancelled})`);
        m.items.slice(0, 2).forEach(a => lines.push(`   [${a.appointmentDate} ${a.appointmentTime || ''}] ${a.title} - ${normalizeStatus(a.status)} (ผู้สร้าง: ${a.createdBy || a.updatedBy || '-'})`));
      }
    });
    let o = lines.join('\n');
    return sanitizeNoEmoji(o.length > LINE_MAX_LEN ? o.slice(0, LINE_MAX_LEN - 80) + '\n...(ดูเพิ่มเติมบนหน้าเว็บแอป)' : o);
  }

  return {
    API_VERSION, STATUS, VALID_STATUSES, USER_ROLES, DEFAULT_USERS,
    THAI_MONTHS_SHORT, THAI_MONTHS_FULL, LINE_MAX_TEXT_LENGTH: LINE_MAX_LEN,
    hasEmoji, sanitizeNoEmoji, normalizeStatus, hashPassword, authenticateUser, validateUserInput,
    normalizeYearToCE, toBuddhistYear, isLeapYearCE, getDaysInMonth,
    parseFlexibleDateInput, parseTimeInput, bangkokSlotToEpochMs, getBangkokParts, daysBetweenDates,
    formatThaiDateDisplay, isActiveStatus, isOverdue, buildAppointmentSlot, findTimeConflicts,
    validateAppointmentInput, generateAppointmentId, createAppointmentRecord, updateAppointmentRecord,
    isInQuietHours, evaluateAppointmentNotification, buildNotificationPlan,
    calculateYearlyStats, calculateUserStats, queryByMonth, queryByYear, queryMultiYearOverview,
    formatInstantAppointmentMessage, parseAndExecuteLineCommand
  };
});
