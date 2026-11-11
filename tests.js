/**
 * tests.js - Automated Test Suite for Calendar System (v2.1.0)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */
(function () {
  'use strict';

  const Logic = typeof require !== 'undefined' ? require('./logic.js') : window.CalendarLogic;
  const PatchNotes = typeof require !== 'undefined' ? require('./patchnotes.js') : window.PATCH_NOTES;

  const results = [];
  let passedCount = 0, failedCount = 0;

  const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'Assertion failed'); };
  const assertEqual = (act, exp, msg) => { if (act !== exp) throw new Error(`${msg || 'assertEqual failed'}: expected [${exp}] but got [${act}]`); };

  function runTest(suite, name, fn) {
    try {
      fn();
      passedCount++;
      results.push({ suite, name, ok: true });
    } catch (err) {
      failedCount++;
      results.push({ suite, name, ok: false, error: err.message });
    }
  }

  // --- Suite 1: Zero-Emoji Detection & Sanitization ---
  runTest('1. Zero-Emoji Policy', 'ตรวจจับ Pictographic, ZWJ, Flag, Keycap ได้ครบถ้วน', () => {
    assert(Logic.hasEmoji('ประชุม \uD83D\uDCC5'), 'ต้องตรวจจับอิโมจิปฏิทิน');
    assert(Logic.hasEmoji('\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67'), 'ต้องตรวจจับ ZWJ');
    assert(Logic.hasEmoji('\uD83C\uDDF9\uD83C\uDDED'), 'ต้องตรวจจับธงชาติ');
    assert(Logic.hasEmoji('1\uFE0F\u20E3'), 'ต้องตรวจจับ Keycap');
    assert(Logic.hasEmoji('\u00A9\uFE0F'), 'ต้องตรวจจับ U+00A9 พร้อม U+FE0F');
    assert(!Logic.hasEmoji('ประชุมงานประจำปี 2570 [ยืนยัน]'), 'ข้อความปกติต้องไม่ถูกจับผิด');
    assert(!Logic.hasEmoji('Copyright \u00A9 2026 Registered \u00AE'), 'สัญลักษณ์ลิขสิทธิ์ธรรมดาต้องไม่ถูกจับผิด');
  });

  runTest('1. Zero-Emoji Policy', 'sanitizeNoEmoji ลบอิโมจิอัตโนมัติและคงข้อความปกติไว้', () => {
    const raw = 'นัดพบลูกค้า \uD83D\uDCC5 คุณสมชาย \uD83C\uDDF9\uD83C\uDDED เวลา 09:00';
    const cleaned = Logic.sanitizeNoEmoji(raw);
    assertEqual(cleaned, 'นัดพบลูกค้า คุณสมชาย เวลา 09:00', 'ต้องตัดอิโมจิและยุบช่องว่าง');
    assert(!Logic.hasEmoji(cleaned), 'ผลลัพธ์ต้องไม่มีอิโมจิหลงเหลือ');
  });

  // --- Suite 2: Date, Timezone & Buddhist Era ---
  runTest('2. Date & Timezone', 'แปลงปี พ.ศ. และ ค.ศ. รวมถึงตรวจปีอธิกสุรทิน (29 ก.พ. 2571 / 2028)', () => {
    assertEqual(Logic.normalizeYearToCE(2569), 2026, '2569 -> 2026');
    assertEqual(Logic.normalizeYearToCE('2570'), 2027, '2570 -> 2027');
    assertEqual(Logic.toBuddhistYear(2028), 2571, '2028 -> 2571');
    assertEqual(Logic.parseFlexibleDateInput('29/02/2571'), '2028-02-29', '29 ก.พ. 2571 ต้องผ่าน');
    assertEqual(Logic.parseFlexibleDateInput('29/02/2569'), null, '29 ก.พ. 2569 ต้องไม่ผ่าน (ไม่ใช่ปีอธิกสุรทิน)');
  });

  runTest('2. Date & Timezone', 'เขตเวลา Asia/Bangkok ข้ามปีถูกต้อง', () => {
    const bkk = Logic.getBangkokParts('2026-12-31T18:30:00Z');
    assertEqual(bkk.year, 2027, 'เวลา UTC 18:30 ของสิ้นปีต้องเป็นปี 2027 ในไทย');
    assertEqual(bkk.buddhistYear, 2570, 'ต้องเป็น พ.ศ. 2570');
    assertEqual(bkk.dateStr, '2027-01-01', 'วันที่ต้องเป็น 2027-01-01');
    assertEqual(bkk.timeStr, '01:30', 'เวลาต้องเป็น 01:30');
  });

  // --- Suite 3: Streamlined Status & Rescheduling ---
  runTest('3. Status & Reschedule', 'สร้างนัดหมายเสร็จเป็นสถานะ นัดหมายแล้ว ทันที และบังคับกรอกข้อมูลครบ', () => {
    const valid = Logic.validateAppointmentInput({
      title: 'นัดเซ็นสัญญาโครงการ',
      appointmentDate: '2026-11-20',
      appointmentTime: '10:00',
      location: 'สำนักงานใหญ่',
      contactPerson: 'คุณสมศักดิ์'
    });
    assert(valid.valid, 'กรอกข้อมูลครบต้องผ่าน');
    assertEqual(valid.sanitized.status, Logic.STATUS.CONFIRMED, 'สถานะเริ่มต้นต้องเป็น นัดหมายแล้ว');

    const invalid = Logic.validateAppointmentInput({
      title: 'นัดไม่ครบ',
      appointmentDate: '',
      appointmentTime: '10:00'
    });
    assert(!invalid.valid, 'ไม่ระบุวันที่ต้องไม่ผ่าน');
  });

  runTest('3. Status & Reschedule', 'แปลงสถานะเดิม (กำลังนัดหมายวันเวลา, พบหมายแล้ว) เป็น นัดหมายแล้ว อัตโนมัติ', () => {
    assertEqual(Logic.normalizeStatus('กำลังนัดหมายวันเวลา'), Logic.STATUS.CONFIRMED, 'แปลง กำลังนัดหมายวันเวลา -> นัดหมายแล้ว');
    assertEqual(Logic.normalizeStatus('พบหมายแล้ว'), Logic.STATUS.CONFIRMED, 'แปลง พบหมายแล้ว -> นัดหมายแล้ว');
    assertEqual(Logic.normalizeStatus('สิ้นสุดการนัดหมาย'), Logic.STATUS.COMPLETED, 'สิ้นสุดการนัดหมาย คงเดิม');
    assertEqual(Logic.normalizeStatus('ยกเลิกการนัดหมาย'), Logic.STATUS.CANCELLED, 'ยกเลิกการนัดหมาย คงเดิม');
  });

  runTest('3. Status & Reschedule', 'เลื่อนวัน/เวลา และการรีเซ็ต Slot แจ้งเตือน', () => {
    let apt = Logic.createAppointmentRecord({
      title: 'ตรวจรับงานระบบ', appointmentDate: '2026-11-15', appointmentTime: '14:00',
      location: 'อาคาร A', contactPerson: 'คุณเอกชัย'
    }, [], '2026-11-10T09:00:00+07:00');

    apt.notifiedDayForSlot = '2026-11-15';
    apt.notifiedHourForSlot = '2026-11-15T14:00';

    // เลื่อนเฉพาะเวลา
    const resA = Logic.updateAppointmentRecord(apt, { appointmentTime: '16:00', location: 'อาคาร B' }, { nowIso: '2026-11-15T09:30:00+07:00' });
    assertEqual(resA.record.notifiedDayForSlot, '2026-11-15', 'เลื่อนเฉพาะเวลา notifiedDayForSlot ต้องคงเดิม');
    assertEqual(resA.record.notifiedHourForSlot, '', 'เลื่อนเวลา notifiedHourForSlot ต้องถูกล้าง');
    assertEqual(resA.record.rescheduleCount, 1, 'rescheduleCount ต้องเป็น 1');

    // เลื่อนวัน
    const resB = Logic.updateAppointmentRecord(resA.record, { appointmentDate: '2026-11-20' }, { nowIso: '2026-11-15T10:00:00+07:00' });
    assertEqual(resB.record.notifiedDayForSlot, '', 'เลื่อนวัน notifiedDayForSlot ต้องถูกล้าง');
    assertEqual(resB.record.notifiedHourForSlot, '', 'เลื่อนวัน notifiedHourForSlot ต้องถูกล้าง');

    // คืนสถานะนัด (reopened) จาก สิ้นสุด -> นัดหมายแล้ว
    const resComp = Logic.updateAppointmentRecord(resB.record, { status: Logic.STATUS.COMPLETED }, { nowIso: '2026-11-20T17:00:00+07:00' });
    assertEqual(resComp.record.status, Logic.STATUS.COMPLETED, 'สถานะเป็น สิ้นสุดการนัดหมาย');
    const resReopened = Logic.updateAppointmentRecord(resComp.record, { status: Logic.STATUS.CONFIRMED }, { nowIso: '2026-11-20T17:30:00+07:00' });
    assertEqual(resReopened.record.status, Logic.STATUS.CONFIRMED, 'คืนสถานะเป็น นัดหมายแล้ว');
    assert(resReopened.reopened, 'ต้องติดสถานะ reopened');
  });

  runTest('3. Status & Reschedule', 'การแก้ไข remindDaysBefore หรือ remindHoursBefore ต้องรีเซ็ต Slot แจ้งเตือน', () => {
    let apt = Logic.createAppointmentRecord({
      title: 'งานทดสอบรีเซ็ตการเตือน', appointmentDate: '2026-11-20', appointmentTime: '14:00',
      location: 'ห้องประชุม', contactPerson: 'คุณทดสอบ', remindDaysBefore: 1, remindHoursBefore: 1
    }, [], '2026-11-10T09:00:00+07:00');

    apt.notifiedDayForSlot = '2026-11-20';
    apt.notifiedHourForSlot = '2026-11-20T14:00';

    const resDays = Logic.updateAppointmentRecord(apt, { remindDaysBefore: 2 }, { nowIso: '2026-11-10T10:00:00+07:00' });
    assertEqual(resDays.record.notifiedDayForSlot, '', 'เปลี่ยนวันแจ้งเตือนล่วงหน้า notifiedDayForSlot ต้องถูกล้าง');

    const resHours = Logic.updateAppointmentRecord(apt, { remindHoursBefore: 2 }, { nowIso: '2026-11-10T10:00:00+07:00' });
    assertEqual(resHours.record.notifiedHourForSlot, '', 'เปลี่ยนชั่วโมงแจ้งเตือนก่อนเวลานัด notifiedHourForSlot ต้องถูกล้าง');
  });

  runTest('3. Status & Reschedule', 'Optimistic Concurrency ตรวจจับการแก้ไขชนกัน', () => {
    const apt = Logic.createAppointmentRecord({ title: 'ทดสอบชนกัน', appointmentDate: '2026-12-01', appointmentTime: '10:00', location: 'ห้อง 1', contactPerson: 'คุณ ก' }, [], '2026-11-10T09:00:00+07:00');
    let errCode = null;
    try {
      Logic.updateAppointmentRecord(apt, { location: 'ห้อง 2' }, { nowIso: '2026-11-10T09:05:00+07:00', expectedUpdatedAt: '2026-11-10T08:00:00+07:00' });
    } catch (e) { errCode = e.code; }
    assertEqual(errCode, 'CONCURRENCY_CONFLICT', 'ต้องแจ้งข้อผิดพลาด CONCURRENCY_CONFLICT');
  });

  // --- Suite 4: Notification Engine ---
  runTest('4. Notification Engine', 'Daily Digest และ Hourly Reminder พร้อมการกันส่งซ้ำ', () => {
    const apt = Logic.createAppointmentRecord({ title: 'เสนอแผนงาน', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', remindDaysBefore: 1, remindHoursBefore: 1 }, [], '2026-11-10T09:00:00+07:00');
    const p1 = Logic.buildNotificationPlan([apt], '2026-11-11T08:15:00+07:00', { dailyDigestHour: 8 });
    assert(p1.shouldPush && p1.digestItems.length === 1, 'ต้องเข้าเกณฑ์ Daily Digest');
    apt.notifiedDayForSlot = p1.slotUpdates[0].notifiedDayForSlot;

    const p1Repeat = Logic.buildNotificationPlan([apt], '2026-11-11T08:30:00+07:00', { dailyDigestHour: 8 });
    assert(!p1Repeat.shouldPush, 'รันซ้ำต้องไม่ส่งอีก');

    const pHour = Logic.buildNotificationPlan([apt], '2026-11-12T09:15:00+07:00', { dailyDigestHour: 8 });
    assert(pHour.shouldPush && pHour.hourlyItems.length === 1, '45 นาทีก่อนนัดต้องเข้าเกณฑ์เตือน ชม.');
  });

  runTest('4. Notification Engine', 'งานที่ สิ้นสุดการนัดหมาย หรือ ยกเลิกการนัดหมาย ต้องไม่ส่งแจ้งเตือน', () => {
    const aptDone = Logic.createAppointmentRecord({ title: 'งานเสร็จแล้ว', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', status: Logic.STATUS.COMPLETED }, [], '2026-11-10T09:00:00+07:00');
    const aptCanc = Logic.createAppointmentRecord({ title: 'งานยกเลิก', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00');
    const plan = Logic.buildNotificationPlan([aptDone, aptCanc], '2026-11-11T08:15:00+07:00', { dailyDigestHour: 8 });
    assert(!plan.shouldPush, 'งานสิ้นสุดและยกเลิกต้องไม่ถูกส่งแจ้งเตือน');
  });

  // --- Suite 5: Year-End Statistics & LINE Bot ---
  runTest('5. Year-End Statistics', 'calculateYearlyStats คำนวณสรุปผลงานทั้งปีถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งาน 1', appointmentDate: '2026-02-10', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 2', appointmentDate: '2026-05-15', appointmentTime: '13:00', location: 'กทม.', contactPerson: 'คุณ ข', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 3', appointmentDate: '2026-08-20', appointmentTime: '14:00', location: 'กทม.', contactPerson: 'คุณ ค', status: Logic.STATUS.CANCELLED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 4', appointmentDate: '2026-11-25', appointmentTime: '09:30', location: 'กทม.', contactPerson: 'คุณ ง', status: Logic.STATUS.CONFIRMED }, [], '2026-01-01T09:00:00+07:00')
    ];
    list[0].rescheduleCount = 1;
    list[1].rescheduleCount = 2;

    const stats = Logic.calculateYearlyStats(list, '2026-11-10T09:00:00+07:00');
    assertEqual(stats.total, 4, 'งานทั้งหมด 4 งาน');
    assertEqual(stats.active, 1, 'รอดำเนินการ 1 งาน');
    assertEqual(stats.completed, 2, 'สิ้นสุด 2 งาน');
    assertEqual(stats.cancelled, 1, 'ยกเลิก 1 งาน');
    assertEqual(stats.completionRate, 50, 'อัตราสำเร็จ 50%');
    assertEqual(stats.cancellationRate, 25, 'อัตราการยกเลิก 25%');
    assertEqual(stats.rescheduleTotal, 3, 'เลื่อนนัดรวม 3 ครั้ง');
  });

  runTest('5. Year-End Statistics', 'LINE Bot คำสั่ง คิว ปีนี้ แสดงสถิติท้ายปีครบถ้วน', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งานต้นปี 2569', appointmentDate: '2026-03-01', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานปลายปี 2569', appointmentDate: '2026-11-20', appointmentTime: '14:00', location: 'ชลบุรี', contactPerson: 'คุณ ข', status: Logic.STATUS.CONFIRMED }, [], '2026-01-01T09:00:00+07:00')
    ];
    const reply = Logic.parseAndExecuteLineCommand('คิว ปีนี้', list, '2026-11-10T09:00:00+07:00', {});
    assert(reply && reply.includes('สรุปสถิติประจำปี'), 'ต้องมีหัวข้อสรุปสถิติประจำปี');
    assert(reply.includes('รวมทั้งหมด: 2 งาน'), 'ต้องแสดงยอดรวม');
    assert(!Logic.hasEmoji(reply), 'คำตอบบอทต้องไม่มีอิโมจิ');
  });

  runTest('5. Year-End Statistics', 'LINE Bot คำสั่ง คิวทั้งหมด และแจ้งเตือนนัดหมายใหม่ทันทีทำงานถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งานที่ผ่านมาแล้ว', appointmentDate: '2026-11-01', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.CONFIRMED }, [], '2026-10-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานกำลังจะมาถึง 1', appointmentDate: '2026-11-15', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ข', status: Logic.STATUS.CONFIRMED }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานกำลังจะมาถึง 2', appointmentDate: '2026-12-05', appointmentTime: '14:00', location: 'นนทบุรี', contactPerson: 'คุณ ค', status: Logic.STATUS.CONFIRMED }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานที่ยกเลิก', appointmentDate: '2026-11-20', appointmentTime: '11:00', location: 'กทม.', contactPerson: 'คุณ ง', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00')
    ];
    const replyNoSpace = Logic.parseAndExecuteLineCommand('คิวทั้งหมด', list, '2026-11-10T09:00:00+07:00', {});
    const replyWithSpace = Logic.parseAndExecuteLineCommand('คิว ทั้งหมด', list, '2026-11-10T09:00:00+07:00', {});
    assert(replyNoSpace && replyNoSpace.includes('(2 รายการ)'), 'คิวทั้งหมด ต้องแสดงเฉพาะนัดหมายที่กำลังจะมาถึง 2 รายการ');
    assertEqual(replyNoSpace, replyWithSpace, 'คิวทั้งหมด และ คิว ทั้งหมด ต้องได้ผลลัพธ์ตรงกัน');

    const instantMsg = Logic.formatInstantAppointmentMessage(list[1], false, {});
    assert(instantMsg.includes('[แจ้งเตือนนัดหมายใหม่]') && instantMsg.includes('งานกำลังจะมาถึง 1'), 'ข้อความแจ้งเตือนนัดหมายใหม่ต้องครบถ้วน');
    assert(!Logic.hasEmoji(instantMsg), 'ข้อความแจ้งเตือนทันทีต้องไม่มีอิโมจิ');

    const msgDone = Logic.formatInstantAppointmentMessage({ ...list[1], status: Logic.STATUS.COMPLETED }, true, {});
    assert(msgDone.includes('[แจ้งเตือนสิ้นสุดการนัดหมาย]'), 'ต้องเป็นหัวข้อแจ้งเตือนสิ้นสุดการนัดหมาย');

    const msgCanc = Logic.formatInstantAppointmentMessage({ ...list[1], status: Logic.STATUS.CANCELLED }, true, {});
    assert(msgCanc.includes('[แจ้งเตือนยกเลิกการนัดหมาย]'), 'ต้องเป็นหัวข้อแจ้งเตือนยกเลิกการนัดหมาย');
  });

  // --- Suite 6: Patch Notes Integrity ---
  runTest('6. Patch Notes', 'โครงสร้าง patchnotes.js ถูกต้องและมีเวอร์ชัน 2.4.0 และ 2.5.0 ครบถ้วน', () => {
    assert(Array.isArray(PatchNotes) && PatchNotes.length >= 7, 'ต้องมีประวัติอย่างน้อย 7 เวอร์ชัน');
    const v240 = PatchNotes.find(p => p.version === '2.4.0');
    const v250 = PatchNotes.find(p => p.version === '2.5.0');
    assert(v240 && v240.changes && v240.changes.length > 0, 'ต้องมีบันทึกเวอร์ชัน 2.4.0');
    assert(v250 && v250.changes && v250.changes.length > 0, 'ต้องมีบันทึกเวอร์ชัน 2.5.0');
    assert(!Logic.hasEmoji(JSON.stringify(PatchNotes)), 'ใน patchnotes.js ต้องไม่มีอิโมจิ');
  });

  // --- Suite 8: User Authentication & SHA-256 Hashing ---
  runTest('8. User Authentication', 'การเข้ารหัส SHA-256 และการยืนยันตัวตนถูกต้อง', () => {
    const h1234 = Logic.hashPassword('1234');
    assertEqual(h1234, '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'SHA-256 ของ 1234 ถูกต้อง');
    const hAdmin = Logic.hashPassword('admin');
    assertEqual(hAdmin, '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'SHA-256 ของ admin ถูกต้อง');

    // ตรวจสอบการล็อกอิน
    const authSuccess = Logic.authenticateUser(Logic.DEFAULT_USERS, 'admin', 'admin');
    assert(authSuccess.ok && authSuccess.user && authSuccess.user.role === 'ADMIN', 'เข้าสู่ระบบ admin สำเร็จ');

    const authStaff = Logic.authenticateUser(Logic.DEFAULT_USERS, 'somchai', '1234');
    assert(authStaff.ok && authStaff.user && authStaff.user.role === 'STAFF', 'เข้าสู่ระบบ somchai สำเร็จ');

    const authWrongPw = Logic.authenticateUser(Logic.DEFAULT_USERS, 'admin', 'wrongpass');
    assert(!authWrongPw.ok, 'รหัสผ่านผิดต้องไม่ผ่าน');

    const authUnknownUser = Logic.authenticateUser(Logic.DEFAULT_USERS, 'nobody', '1234');
    assert(!authUnknownUser.ok, 'ผู้ใช้ไม่มีในระบบต้องไม่ผ่าน');

    const authDisabledUser = Logic.authenticateUser([
      { userId: 'USR-999', username: 'disabled', displayName: 'ถูกระงับ', role: 'STAFF', passwordHash: h1234, isActive: false }
    ], 'disabled', '1234');
    assert(!authDisabledUser.ok, 'ผู้ใช้ถูกระงับต้องไม่ผ่าน');

    const valNewErr = Logic.validateUserInput({ username: 'ab', displayName: 'สั้นไป', password: '123' }, true);
    assert(!valNewErr.valid, 'สร้างผู้ใช้ใหม่ที่ชื่อผู้ใช้หรือรหัสผ่านสั้นเกินไปต้องไม่ผ่าน');

    const valUpdateOk = Logic.validateUserInput({ username: 'somchai', displayName: 'คุณสมชาย (อัปเดต)', role: 'ADMIN' }, false);
    assert(valUpdateOk.valid && valUpdateOk.sanitized.role === 'ADMIN', 'อัปเดตผู้ใช้เดิมโดยไม่ส่งรหัสผ่านใหม่ต้องผ่าน');

    // ทดสอบการสมัครสมาชิกใหม่ด้วยตนเอง (Self-Registration)
    const regSuccess = Logic.registerUserAccount(Logic.DEFAULT_USERS, {
      username: 'anan01',
      displayName: 'คุณอนันต์ ฝ่ายประสานงาน',
      password: '5678',
      confirmPassword: '5678',
      role: 'ADMIN' // แม้ส่ง ADMIN มา ระบบสมัครต้องบังคับเป็น STAFF เสมอ
    }, '2026-11-11T10:00:00+07:00');
    assert(regSuccess.ok && regSuccess.user.role === 'STAFF' && regSuccess.record.isActive === true, 'สมัครสมาชิกใหม่ต้องได้สิทธิ์ STAFF และเปิดใช้งานทันที');

    // ทดสอบเข้าสู่ระบบด้วยบัญชีที่เพิ่งสมัคร
    const loginNewUser = Logic.authenticateUser([...Logic.DEFAULT_USERS, regSuccess.record], 'anan01', '5678');
    assert(loginNewUser.ok && loginNewUser.user.displayName === 'คุณอนันต์ ฝ่ายประสานงาน', 'บัญชีที่สมัครใหม่ต้องล็อกอินได้ทันที');

    // ทดสอบสมัครชื่อผู้ใช้ซ้ำ
    const regDupUser = Logic.registerUserAccount(Logic.DEFAULT_USERS, {
      username: 'somchai',
      displayName: 'คุณสมชาย คนใหม่',
      password: '1234',
      confirmPassword: '1234'
    });
    assert(!regDupUser.ok, 'สมัครด้วย username ซ้ำต้องไม่ผ่าน');

    // ทดสอบรหัสผ่านยืนยันไม่ตรงกัน
    const regMismatchPw = Logic.registerUserAccount(Logic.DEFAULT_USERS, {
      username: 'newstaff',
      displayName: 'พนักงานใหม่',
      password: '1234',
      confirmPassword: '9999'
    });
    assert(!regMismatchPw.ok, 'รหัสผ่านยืนยันไม่ตรงกันต้องไม่ผ่าน');
  });

  // --- Suite 9: User Attribution & Reschedule Immutability ---
  runTest('9. User Attribution', 'บันทึกผู้สร้าง ผู้เสร็จสิ้น ผู้ยกเลิก และคงชื่อผู้สร้างเดิมไว้เสมอ', () => {
    // 1. นายสมชาย สร้างนัดหมาย
    const apt = Logic.createAppointmentRecord({
      title: 'นัดตรวจระบบสำคัญ',
      appointmentDate: '2026-11-20',
      appointmentTime: '10:00',
      location: 'ห้องประชุม A',
      contactPerson: 'คุณลูกค้า',
      createdBy: 'คุณสมชาย'
    }, [], '2026-11-10T09:00:00+07:00');

    assertEqual(apt.createdBy, 'คุณสมชาย', 'ผู้สร้างต้องเป็นคุณสมชาย');
    assertEqual(apt.statusChangedBy, '', 'ตอนสร้างสถานะเป็น นัดหมายแล้ว ยังไม่มีผู้เปลี่ยนสถานะ');

    // 2. นายวิภาดา เข้ามาเลื่อนเวลา และเปลี่ยนสถานที่
    const resEdit = Logic.updateAppointmentRecord(apt, {
      appointmentTime: '11:00',
      location: 'ห้องประชุม B',
      updatedBy: 'คุณวิภาดา'
    }, { nowIso: '2026-11-10T10:00:00+07:00', reason: 'ห้อง A ติดใช้งาน' });

    assertEqual(resEdit.record.createdBy, 'คุณสมชาย', 'ชื่อผู้สร้างเดิมต้องไม่เปลี่ยน');
    assertEqual(resEdit.record.updatedBy, 'คุณวิภาดา', 'ผู้แก้ไขล่าสุดต้องเป็นคุณวิภาดา');

    // 3. ผู้ดูแลระบบ มากดยืนยัน เสร็จสิ้นการนัดหมาย
    const resComplete = Logic.updateAppointmentRecord(resEdit.record, {
      status: Logic.STATUS.COMPLETED,
      statusChangedBy: 'ผู้ดูแลระบบ',
      updatedBy: 'ผู้ดูแลระบบ'
    }, { nowIso: '2026-11-20T12:00:00+07:00' });

    assertEqual(resComplete.record.createdBy, 'คุณสมชาย', 'ชื่อผู้สร้างเดิมต้องยังคงเป็นคุณสมชาย');
    assertEqual(resComplete.record.statusChangedBy, 'ผู้ดูแลระบบ', 'ผู้ยืนยันเสร็จสิ้นต้องเป็นผู้ดูแลระบบ');
    assertEqual(resComplete.record.status, Logic.STATUS.COMPLETED, 'สถานะเป็น สิ้นสุดการนัดหมาย');

    // 4. ทดสอบกรณียกเลิกนัดหมายพร้อมระบุสาเหตุ
    const resCancel = Logic.updateAppointmentRecord(apt, {
      status: Logic.STATUS.CANCELLED,
      statusChangedBy: 'คุณนภัสสร',
      statusReason: 'ลูกค้ายกเลิกกะทันหัน',
      updatedBy: 'คุณนภัสสร'
    }, { nowIso: '2026-11-15T09:00:00+07:00' });

    assertEqual(resCancel.record.createdBy, 'คุณสมชาย', 'ชื่อผู้สร้างต้องยังคงเป็นคุณสมชาย');
    assertEqual(resCancel.record.statusChangedBy, 'คุณนภัสสร', 'ผู้ยกเลิกต้องเป็นคุณนภัสสร');
    assertEqual(resCancel.record.statusReason, 'ลูกค้ายกเลิกกะทันหัน', 'สาเหตุการยกเลิกต้องถูกต้อง');

    // 5. ทดสอบกรณีคืนสถานะนัดหมายกลับเป็น นัดหมายแล้ว ต้องล้างข้อมูลผู้ยกเลิกและสาเหตุเดิม
    const resReopen = Logic.updateAppointmentRecord(resCancel.record, {
      status: Logic.STATUS.CONFIRMED,
      updatedBy: 'คุณสมชาย'
    }, { nowIso: '2026-11-16T09:00:00+07:00', reason: 'คืนสถานะนัดหมาย' });
    assertEqual(resReopen.record.status, Logic.STATUS.CONFIRMED, 'สถานะต้องกลับมาเป็น นัดหมายแล้ว');
    assertEqual(resReopen.record.statusChangedBy, '', 'ต้องล้างชื่อผู้เปลี่ยนสถานะเดิมเมื่อคืนสถานะนัด');
    assertEqual(resReopen.record.statusReason, '', 'ต้องล้างสาเหตุการยกเลิกเดิมเมื่อคืนสถานะนัด');

    // 6. ทดสอบคำนวณสถิติแยกตามรายชื่อผู้ใช้ (ไม่นับซ้ำระหว่างผู้สร้างและผู้ปิดงาน)
    const userStats = Logic.calculateUserStats([resComplete.record, resCancel.record]);
    const somchaiStat = userStats.find(u => u.user === 'คุณสมชาย');
    const adminStat = userStats.find(u => u.user === 'ผู้ดูแลระบบ');
    const naphatStat = userStats.find(u => u.user === 'คุณนภัสสร');
    assert(somchaiStat && somchaiStat.createdTotal === 2 && somchaiStat.completedTotal === 0, 'คุณสมชายมียอดสร้าง 2 งาน และยอดกดเสร็จสิ้นเอง 0 งาน');
    assert(adminStat && adminStat.createdTotal === 0 && adminStat.completedTotal === 1, 'ผู้ดูแลระบบมียอดกดเสร็จสิ้น 1 งาน');
    assert(naphatStat && naphatStat.createdTotal === 0 && naphatStat.cancelledTotal === 1, 'คุณนภัสสรมียอดกดยกเลิก 1 งาน');
  });

  // --- Suite 10: Time-Slot Conflict Detection ---
  runTest('10. Time-Slot Conflict', 'ตรวจจับเวลานัดหมายที่ชนกันได้อย่างถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ id: 'APT-001', title: 'งานที่ 1', appointmentDate: '2026-11-25', appointmentTime: '10:00', location: 'ตึก A', contactPerson: 'คุณ ก' }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ id: 'APT-002', title: 'งานที่ 2 ยกเลิกแล้ว', appointmentDate: '2026-11-25', appointmentTime: '10:00', location: 'ตึก B', contactPerson: 'คุณ ข', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ id: 'APT-003', title: 'งานที่ 3 บ่าย', appointmentDate: '2026-11-25', appointmentTime: '13:00', location: 'ตึก C', contactPerson: 'คุณ ค' }, [], '2026-11-10T09:00:00+07:00')
    ];

    // ตรวจสอบเวลา 10:00 วันที่ 2026-11-25 (ต้องชนกับงานที่ 1 แต่งานที่ 2 ยกเลิกไปแล้วไม่นับ)
    const conflicts = Logic.findTimeConflicts(list, '2026-11-25', '10:00');
    assertEqual(conflicts.length, 1, 'ต้องพบงานชนกัน 1 งาน');
    assertEqual(conflicts[0].id, 'APT-001', 'ต้องเป็นงาน APT-001');

    // ตรวจสอบเวลา 10:00 โดยยกเว้นตัวเอง (APT-001) ต้องไม่ชน
    const selfConflicts = Logic.findTimeConflicts(list, '2026-11-25', '10:00', 'APT-001');
    assertEqual(selfConflicts.length, 0, 'เมื่อแก้ไขงานตัวเองต้องไม่แจ้งชนกับตัวเอง');

    // ตรวจสอบเวลาที่ว่าง (14:00)
    const noConflicts = Logic.findTimeConflicts(list, '2026-11-25', '14:00');
    assertEqual(noConflicts.length, 0, 'เวลาที่ว่างต้องไม่พบงานชนกัน');
  });

  // --- Suite 7: Full Codebase Zero-Emoji Audit ---
  if (typeof require !== 'undefined') {
    runTest('7. Codebase Audit', 'ไฟล์ทั้งหมดใน C:\\Calendar ต้องไม่มีอิโมจิหลุดรอด (ยกเว้นไอคอนปุ่มสลับธีมตามคำอนุญาตพิเศษ)', () => {
      const fs = require('fs'), path = require('path');
      const files = ['index.html', 'style.css', 'logic.js', 'app.js', 'patchnotes.js', 'tests.html', 'tests.js', 'README.md', 'CHANGELOG.md', 'SETUP_GUIDE.md', path.join('gas', 'Code.gs'), path.join('gas', 'appsscript.json')];
      files.forEach(f => {
        const full = path.join(__dirname, f);
        if (fs.existsSync(full)) {
          let content = fs.readFileSync(full, 'utf8');
          if (f === 'index.html' || f === 'tests.js') {
            content = content.replace(/[\u2600\uFE0F\uD83C\uDF19]/gu, '');
          }
          assert(!Logic.hasEmoji(content), `พบอิโมจิในไฟล์ ${f}`);
        }
      });
    });
  }

  // --- Runner Output ---
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      const s = document.getElementById('testSummary'), l = document.getElementById('testList');
      if (s) {
        s.textContent = `ผลการทดสอบทั้งหมด: ผ่าน ${passedCount} รายการ | ไม่ผ่าน ${failedCount} รายการ`;
        s.className = failedCount === 0 ? 'summary-pass' : 'summary-fail';
      }
      if (l) {
        l.innerHTML = results.map(r => `<li class="${r.ok ? 'pass' : 'fail'}">[${r.ok ? 'PASS' : 'FAIL'}] ${r.suite} -> ${r.name}${r.error ? ' - ' + r.error : ''}</li>`).join('');
      }
    });
  } else {
    results.forEach(r => console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.suite} -> ${r.name}${r.error ? ' : ' + r.error : ''}`));
    console.log(`\nTest Summary: ${passedCount} passed, ${failedCount} failed.`);
    if (failedCount > 0) process.exit(1);
  }
})();
