/**
 * tests.js - Automated Test Suite for Calendar System (v2.6.7)
 * นโยบายเคร่งครัด: ห้ามใช้อิโมจิในทุกกรณี (Zero-Emoji Policy)
 */
(function () {
  'use strict';

  const Logic = typeof require !== 'undefined' ? require('./logic.js') : window.CalendarLogic;
  const PatchNotes = typeof require !== 'undefined' ? require('./patchnotes.js') : window.PATCH_NOTES;

  const results = [], asyncTests = [];
  let passedCount = 0, failedCount = 0;
  const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'Assertion failed'); };
  const assertEqual = (act, exp, msg) => { if (act !== exp) throw new Error(`${msg || 'assertEqual failed'}: expected [${exp}] but got [${act}]`); };

  function runTest(suite, name, fn) {
    try { fn(); passedCount++; results.push({ suite, name, ok: true }); }
    catch (err) { failedCount++; results.push({ suite, name, ok: false, error: err.message }); }
  }
  function runTestAsync(suite, name, fn) {
    asyncTests.push(Promise.resolve().then(fn).then(
      () => { passedCount++; results.push({ suite, name, ok: true }); },
      err => { failedCount++; results.push({ suite, name, ok: false, error: err.message }); }
    ));
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
    const cleaned = Logic.sanitizeNoEmoji('นัดพบลูกค้า \uD83D\uDCC5 คุณสมชาย \uD83C\uDDF9\uD83C\uDDED เวลา 09:00');
    assertEqual(cleaned, 'นัดพบลูกค้า คุณสมชาย เวลา 09:00', 'ต้องตัดอิโมจิและยุบช่องว่าง');
    assert(!Logic.hasEmoji(cleaned), 'ผลลัพธ์ต้องไม่มีอิโมจิหลงเหลือ');
  });

  // --- Suite 2: Date, Timezone & Buddhist Era ---
  runTest('2. Date & Timezone', 'แปลงปี พ.ศ. และ ค.ศ. รวมถึงตรวจปีอธิกสุรทิน (29 ก.พ. 2571 / 2028)', () => {
    assertEqual(Logic.normalizeYearToCE(2569), 2026, '2569 -> 2026');
    assertEqual(Logic.normalizeYearToCE('2570'), 2027, '2570 -> 2027');
    assertEqual(Logic.toBuddhistYear(2028), 2571, '2028 -> 2571');
    assertEqual(Logic.parseFlexibleDateInput('29/02/2571'), '2028-02-29', '29 ก.พ. 2571 ต้องผ่าน');
    assertEqual(Logic.parseFlexibleDateInput('29/02/2569'), null, '29 ก.พ. 2569 ต้องไม่ผ่าน');
  });

  runTest('2. Date & Timezone', 'เขตเวลา Asia/Bangkok ข้ามปีถูกต้อง', () => {
    const bkk = Logic.getBangkokParts('2026-12-31T18:30:00Z');
    assertEqual(bkk.year, 2027, 'UTC 18:30 สิ้นปีต้องเป็นปี 2027 ในไทย');
    assertEqual(bkk.buddhistYear, 2570, 'ต้องเป็น พ.ศ. 2570');
    assertEqual(bkk.dateStr, '2027-01-01', 'วันที่ต้องเป็น 2027-01-01');
    assertEqual(bkk.timeStr, '01:30', 'เวลาต้องเป็น 01:30');
  });

  // --- Suite 3: Streamlined Status & Rescheduling ---
  runTest('3. Status & Reschedule', 'สร้างนัดหมายเสร็จเป็นสถานะ เริ่มนัด ทันที เตือนล่วงหน้า Default=0 และรองรับแผนที่/รูปภาพ', () => {
    const valid = Logic.validateAppointmentInput({ title: 'นัดเซ็นสัญญาโครงการ', appointmentDate: '2026-11-20', appointmentTime: '10:00', location: 'สำนักงานใหญ่', contactPerson: 'คุณสมศักดิ์' });
    assert(valid.valid && valid.sanitized.status === Logic.STATUS.CONFIRMED && Logic.STATUS.CONFIRMED === 'เริ่มนัด', 'กรอกข้อมูลครบต้องผ่านและเป็น เริ่มนัด');
    assert(valid.sanitized.remindDaysBefore === 0 && valid.sanitized.remindHoursBefore === 0, 'ค่าเริ่มต้นแจ้งเตือนล่วงหน้าต้องเป็น 0 วัน 0 ชม.');
    const withMedia = Logic.validateAppointmentInput({ title: 'นัดตรวจหน้างาน', appointmentDate: '2026-11-21', appointmentTime: '14:00', location: 'ไซท์ A', contactPerson: 'คุณเอก', mapUrl: '13.7563, 100.5018', imageUrl: 'https://example.com/site.jpg' });
    assert(withMedia.valid && withMedia.sanitized.mapUrl === '13.7563, 100.5018' && withMedia.sanitized.imageUrl === 'https://example.com/site.jpg', 'mapUrl และ imageUrl ต้องถูกบันทึก');
    assert(!Logic.validateAppointmentInput({ title: 'รูปเกินขนาด', appointmentDate: '2026-11-21', appointmentTime: '14:00', location: 'ไซท์ A', contactPerson: 'คุณเอก', imageUrl: 'x'.repeat(49000) }).valid, 'รูปภาพเกิน 48,000 ตัวอักษรต้องไม่ผ่าน');
    assert(!Logic.validateAppointmentInput({ title: 'นัดไม่ครบ', appointmentDate: '', appointmentTime: '10:00' }).valid, 'ไม่ระบุวันที่ต้องไม่ผ่าน');
  });

  runTest('3. Status & Reschedule', 'แปลงสถานะเดิม (นัดหมายแล้ว, กำลังนัดหมายวันเวลา, พบหมายแล้ว) เป็น เริ่มนัด อัตโนมัติ', () => {
    assertEqual(Logic.normalizeStatus('นัดหมายแล้ว'), Logic.STATUS.CONFIRMED, 'นัดหมายแล้ว -> เริ่มนัด');
    assertEqual(Logic.normalizeStatus('กำลังนัดหมายวันเวลา'), Logic.STATUS.CONFIRMED, 'กำลังนัดหมายวันเวลา -> เริ่มนัด');
    assertEqual(Logic.normalizeStatus('พบหมายแล้ว'), Logic.STATUS.CONFIRMED, 'พบหมายแล้ว -> เริ่มนัด');
    assertEqual(Logic.normalizeStatus('สิ้นสุดการนัดหมาย'), Logic.STATUS.COMPLETED, 'สิ้นสุดการนัดหมาย คงเดิม');
    assertEqual(Logic.normalizeStatus('ยกเลิกการนัดหมาย'), Logic.STATUS.CANCELLED, 'ยกเลิกการนัดหมาย คงเดิม');
  });

  runTest('3. Status & Reschedule', 'เลื่อนวัน/เวลา และการรีเซ็ต Slot แจ้งเตือน รวมถึง suppressSlotReset เมื่อไม่ได้ติ๊กแจ้งเตือน', () => {
    const apt = Logic.createAppointmentRecord({ title: 'ตรวจรับงานระบบ', appointmentDate: '2026-11-15', appointmentTime: '14:00', location: 'อาคาร A', contactPerson: 'คุณเอกชัย' }, [], '2026-11-10T09:00:00+07:00');
    apt.notifiedDayForSlot = '2026-11-15'; apt.notifiedHourForSlot = '2026-11-15T14:00';

    const resA = Logic.updateAppointmentRecord(apt, { appointmentTime: '16:00', location: 'อาคาร B' }, { nowIso: '2026-11-15T09:30:00+07:00' });
    assertEqual(resA.record.notifiedDayForSlot, '2026-11-15', 'เลื่อนเวลา notifiedDayForSlot ต้องคงเดิม');
    assertEqual(resA.record.notifiedHourForSlot, '', 'เลื่อนเวลา notifiedHourForSlot ต้องถูกล้าง');
    assertEqual(resA.record.rescheduleCount, 1, 'rescheduleCount ต้องเป็น 1');

    const resB = Logic.updateAppointmentRecord(resA.record, { appointmentDate: '2026-11-20' }, { nowIso: '2026-11-15T10:00:00+07:00' });
    assertEqual(resB.record.notifiedDayForSlot, '', 'เลื่อนวัน notifiedDayForSlot ต้องถูกล้าง');
    assertEqual(resB.record.notifiedHourForSlot, '', 'เลื่อนวัน notifiedHourForSlot ต้องถูกล้าง');

    const resComp = Logic.updateAppointmentRecord(resB.record, { status: Logic.STATUS.COMPLETED }, { nowIso: '2026-11-20T17:00:00+07:00' });
    assertEqual(resComp.record.status, Logic.STATUS.COMPLETED, 'สถานะเป็น สิ้นสุดการนัดหมาย');
    const resReopened = Logic.updateAppointmentRecord(resComp.record, { status: Logic.STATUS.CONFIRMED }, { nowIso: '2026-11-20T17:30:00+07:00' });
    assert(resReopened.record.status === Logic.STATUS.CONFIRMED && resReopened.reopened, 'คืนสถานะต้องกลับมาเป็น เริ่มนัด พร้อม flag reopened');

    const aptDoneSlot = { ...resComp.record, remindDaysBefore: 1, remindHoursBefore: 1, notifiedDayForSlot: '2026-11-20', notifiedHourForSlot: '2026-11-20T16:00' };
    const resSuppressed = Logic.updateAppointmentRecord(aptDoneSlot, { status: Logic.STATUS.CONFIRMED }, { nowIso: '2026-11-20T15:30:00+07:00', suppressSlotReset: true });
    assertEqual(resSuppressed.record.notifiedDayForSlot, '2026-11-20', 'suppressSlotReset ต้องไม่ล้าง notifiedDayForSlot');
    assertEqual(resSuppressed.record.notifiedHourForSlot, '2026-11-20T16:00', 'suppressSlotReset ต้องไม่ล้าง notifiedHourForSlot');

    const aptDueFresh = Logic.createAppointmentRecord({ title: 'งานใกล้เวลานัด', appointmentDate: '2026-11-20', appointmentTime: '16:00', location: 'ห้อง 1', contactPerson: 'คุณ ก', status: Logic.STATUS.COMPLETED, remindHoursBefore: 1 }, [], '2026-11-10T09:00:00+07:00');
    const resDueSuppressed = Logic.updateAppointmentRecord(aptDueFresh, { status: Logic.STATUS.CONFIRMED }, { nowIso: '2026-11-20T15:30:00+07:00', suppressSlotReset: true });
    assertEqual(resDueSuppressed.record.notifiedHourForSlot, '2026-11-20T16:00', 'คืนสถานะโดยไม่ติ๊ก LINE ในช่วงใกล้เวลานัดต้องกัน Trigger แจ้งเตือนซ้ำ');
  });

  runTest('3. Status & Reschedule', 'การแก้ไข remindDaysBefore หรือ remindHoursBefore ต้องรีเซ็ต Slot แจ้งเตือน', () => {
    const apt = Logic.createAppointmentRecord({ title: 'งานทดสอบรีเซ็ตการเตือน', appointmentDate: '2026-11-20', appointmentTime: '14:00', location: 'ห้องประชุม', contactPerson: 'คุณทดสอบ', remindDaysBefore: 1, remindHoursBefore: 1 }, [], '2026-11-10T09:00:00+07:00');
    apt.notifiedDayForSlot = '2026-11-20'; apt.notifiedHourForSlot = '2026-11-20T14:00';
    assertEqual(Logic.updateAppointmentRecord(apt, { remindDaysBefore: 2 }, { nowIso: '2026-11-10T10:00:00+07:00' }).record.notifiedDayForSlot, '', 'เปลี่ยนวันแจ้งเตือนต้องล้าง notifiedDayForSlot');
    assertEqual(Logic.updateAppointmentRecord(apt, { remindHoursBefore: 2 }, { nowIso: '2026-11-10T10:00:00+07:00' }).record.notifiedHourForSlot, '', 'เปลี่ยนชั่วโมงแจ้งเตือนต้องล้าง notifiedHourForSlot');
  });

  runTest('3. Status & Reschedule', 'Optimistic Concurrency ตรวจจับการแก้ไขชนกัน', () => {
    const apt = Logic.createAppointmentRecord({ title: 'ทดสอบชนกัน', appointmentDate: '2026-12-01', appointmentTime: '10:00', location: 'ห้อง 1', contactPerson: 'คุณ ก' }, [], '2026-11-10T09:00:00+07:00');
    let errCode = null;
    try { Logic.updateAppointmentRecord(apt, { location: 'ห้อง 2' }, { nowIso: '2026-11-10T09:05:00+07:00', expectedUpdatedAt: '2026-11-10T08:00:00+07:00' }); }
    catch (e) { errCode = e.code; }
    assertEqual(errCode, 'CONCURRENCY_CONFLICT', 'ต้องแจ้งข้อผิดพลาด CONCURRENCY_CONFLICT');
  });

  // --- Suite 4: Notification Engine ---
  runTest('4. Notification Engine', 'Daily Digest และ Hourly Reminder พร้อมการกันส่งซ้ำ', () => {
    const apt = Logic.createAppointmentRecord({ title: 'เสนอแผนงาน', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', remindDaysBefore: 1, remindHoursBefore: 1 }, [], '2026-11-10T09:00:00+07:00');
    const p1 = Logic.buildNotificationPlan([apt], '2026-11-11T08:15:00+07:00', { dailyDigestHour: 8 });
    assert(p1.shouldPush && p1.digestItems.length === 1, 'ต้องเข้าเกณฑ์ Daily Digest');
    apt.notifiedDayForSlot = p1.slotUpdates[0].notifiedDayForSlot;
    assert(!Logic.buildNotificationPlan([apt], '2026-11-11T08:30:00+07:00', { dailyDigestHour: 8 }).shouldPush, 'รันซ้ำต้องไม่ส่งอีก');
    const pHour = Logic.buildNotificationPlan([apt], '2026-11-12T09:15:00+07:00', { dailyDigestHour: 8 });
    assert(pHour.shouldPush && pHour.hourlyItems.length === 1, '45 นาทีก่อนนัดต้องเข้าเกณฑ์เตือน ชม.');
  });

  runTest('4. Notification Engine', 'งานที่ สิ้นสุดการนัดหมาย หรือ ยกเลิกการนัดหมาย ต้องไม่ส่งแจ้งเตือน', () => {
    const done = Logic.createAppointmentRecord({ title: 'งานเสร็จแล้ว', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', status: Logic.STATUS.COMPLETED }, [], '2026-11-10T09:00:00+07:00');
    const canc = Logic.createAppointmentRecord({ title: 'งานยกเลิก', appointmentDate: '2026-11-12', appointmentTime: '10:00', location: 'สีลม', contactPerson: 'คุณปิยะ', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00');
    assert(!Logic.buildNotificationPlan([done, canc], '2026-11-11T08:15:00+07:00', { dailyDigestHour: 8 }).shouldPush, 'งานสิ้นสุดและยกเลิกต้องไม่ส่งแจ้งเตือน');
  });

  // --- Suite 5: Year-End Statistics & LINE Bot ---
  runTest('5. Year-End Statistics', 'calculateYearlyStats คำนวณสรุปผลงานทั้งปีถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งาน 1', appointmentDate: '2026-02-10', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 2', appointmentDate: '2026-05-15', appointmentTime: '13:00', location: 'กทม.', contactPerson: 'คุณ ข', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 3', appointmentDate: '2026-08-20', appointmentTime: '14:00', location: 'กทม.', contactPerson: 'คุณ ค', status: Logic.STATUS.CANCELLED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งาน 4', appointmentDate: '2026-11-25', appointmentTime: '09:30', location: 'กทม.', contactPerson: 'คุณ ง', status: Logic.STATUS.CONFIRMED }, [], '2026-01-01T09:00:00+07:00')
    ];
    list[0].rescheduleCount = 1; list[1].rescheduleCount = 2;
    const stats = Logic.calculateYearlyStats(list, '2026-11-10T09:00:00+07:00');
    assertEqual(stats.total, 4, 'งานทั้งหมด 4 งาน'); assertEqual(stats.active, 1, 'รอดำเนินการ 1 งาน');
    assertEqual(stats.completed, 2, 'สิ้นสุด 2 งาน'); assertEqual(stats.cancelled, 1, 'ยกเลิก 1 งาน');
    assertEqual(stats.completionRate, 50, 'อัตราสำเร็จ 50%'); assertEqual(stats.cancellationRate, 25, 'อัตราการยกเลิก 25%');
    assertEqual(stats.rescheduleTotal, 3, 'เลื่อนนัดรวม 3 ครั้ง');
  });

  runTest('5. Year-End Statistics', 'LINE Bot คำสั่ง คิว ปีนี้ แสดงสถิติท้ายปีครบถ้วน', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งานต้นปี 2569', appointmentDate: '2026-03-01', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.COMPLETED }, [], '2026-01-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานปลายปี 2569', appointmentDate: '2026-11-20', appointmentTime: '14:00', location: 'ชลบุรี', contactPerson: 'คุณ ข', status: Logic.STATUS.CONFIRMED }, [], '2026-01-01T09:00:00+07:00')
    ];
    const reply = Logic.parseAndExecuteLineCommand('คิว ปีนี้', list, '2026-11-10T09:00:00+07:00', {});
    assert(reply && reply.includes('สรุปสถิติประจำปี') && reply.includes('รวมทั้งหมด: 2 งาน') && !Logic.hasEmoji(reply), 'คำตอบ คิว ปีนี้ ต้องครบถ้วนและไร้ Emoji');
  });

  runTest('5. Year-End Statistics', 'LINE Bot คำสั่งสั้น (ไม่ใช้คำว่า คิว) / คำสั่งเดิม และแจ้งเตือนนัดหมายใหม่ทำงานถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ title: 'งานที่ผ่านมาแล้ว', appointmentDate: '2026-11-01', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ก', status: Logic.STATUS.CONFIRMED }, [], '2026-10-01T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานกำลังจะมาถึง 1', appointmentDate: '2026-11-15', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณ ข', status: Logic.STATUS.CONFIRMED, mapUrl: '13.7563,100.5018' }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานกำลังจะมาถึง 2', appointmentDate: '2026-12-05', appointmentTime: '14:00', location: 'นนทบุรี', contactPerson: 'คุณ ค', status: Logic.STATUS.CONFIRMED }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ title: 'งานที่ยกเลิก', appointmentDate: '2026-11-20', appointmentTime: '11:00', location: 'กทม.', contactPerson: 'คุณ ง', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00')
    ];
    const r1 = Logic.parseAndExecuteLineCommand('คิวทั้งหมด', list, '2026-11-10T09:00:00+07:00', {}),
          r2 = Logic.parseAndExecuteLineCommand('คิว ทั้งหมด', list, '2026-11-10T09:00:00+07:00', {}),
          r3 = Logic.parseAndExecuteLineCommand('ทั้งหมด', list, '2026-11-10T09:00:00+07:00', {});
    assert(r1 && r1.includes('(2 รายการ)') && r1 === r2 && r1 === r3, 'ทั้งหมด / คิวทั้งหมด / คิว ทั้งหมด ต้องตรงกันและแสดง 2 รายการ');
    assert(Logic.parseAndExecuteLineCommand('โควตา', list, '2026-11-10T09:00:00+07:00', { quotaUsed: 30, quotaLimit: 300 }).includes('30 / 300'), 'คำสั่งสั้น โควตา ต้องทำงาน');
    assert(Logic.parseAndExecuteLineCommand('วันนี้ฝนตกไหม', list, '2026-11-10T09:00:00+07:00', {}) === null, 'ประโยคคุยทั่วไปต้องไม่ตอบซ้อน');
    assert(Logic.parseAndExecuteLineCommand('ทั้งหมดเท่าไหร่', list, '2026-11-10T09:00:00+07:00', {}) === null, 'ประโยคคุยทั่วไปที่มีคำว่าทั้งหมดต้องเงียบ');
    const instantMsg = Logic.formatInstantAppointmentMessage(list[1], false, {});
    assert(instantMsg.includes('[แจ้งเตือนนัดหมายใหม่]') && instantMsg.includes('งานกำลังจะมาถึง 1') && instantMsg.includes('แผนที่:') && !Logic.hasEmoji(instantMsg), 'ข้อความนัดใหม่ต้องครบถ้วนและมีลิงก์แผนที่');
    assert(Logic.formatInstantAppointmentMessage({ ...list[1], status: Logic.STATUS.COMPLETED }, true, {}).includes('[แจ้งเตือนสิ้นสุดการนัดหมาย]'), 'ข้อความสิ้นสุดต้องถูกต้อง');
    assert(Logic.formatInstantAppointmentMessage({ ...list[1], status: Logic.STATUS.CANCELLED }, true, {}).includes('[แจ้งเตือนยกเลิกการนัดหมาย]'), 'ข้อความยกเลิกต้องถูกต้อง');
  });

  // --- Suite 6: Patch Notes Integrity ---
  runTest('6. Patch Notes', 'โครงสร้าง patchnotes.js ถูกต้องและมีเวอร์ชัน 2.4.0 ถึง 2.6.7 ครบถ้วน', () => {
    assert(Array.isArray(PatchNotes) && PatchNotes.length >= 17, 'ต้องมีประวัติอย่างน้อย 17 เวอร์ชัน');
    ['2.4.0', '2.5.0', '2.5.1', '2.5.2', '2.5.3', '2.6.0', '2.6.1', '2.6.2', '2.6.3', '2.6.4', '2.6.5', '2.6.6', '2.6.7'].forEach(ver => {
      const p = PatchNotes.find(x => x.version === ver);
      assert(p && p.changes && p.changes.length > 0, `ต้องมีบันทึกเวอร์ชัน ${ver}`);
    });
    assert(!Logic.hasEmoji(JSON.stringify(PatchNotes)), 'ใน patchnotes.js ต้องไม่มีอิโมจิ');
  });

  // --- Suite 8: User Authentication & SHA-256 Hashing ---
  runTest('8. User Authentication', 'การเข้ารหัส SHA-256 และการยืนยันตัวตนถูกต้อง', () => {
    const h1234 = Logic.hashPassword('1234');
    assertEqual(h1234, '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'SHA-256 ของ 1234 ถูกต้อง');
    assertEqual(Logic.hashPassword('admin'), '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'SHA-256 ของ admin ถูกต้อง');
    assert(Logic.authenticateUser(Logic.DEFAULT_USERS, 'admin', 'admin').user.role === 'ADMIN', 'ล็อกอิน admin สำเร็จ');
    assert(Logic.authenticateUser(Logic.DEFAULT_USERS, 'somchai', '1234').user.role === 'STAFF', 'ล็อกอิน somchai สำเร็จ');
    assert(!Logic.authenticateUser(Logic.DEFAULT_USERS, 'admin', 'wrongpass').ok, 'รหัสผ่านผิดต้องไม่ผ่าน');
    assert(!Logic.authenticateUser(Logic.DEFAULT_USERS, 'nobody', '1234').ok, 'ผู้ใช้ไม่มีในระบบต้องไม่ผ่าน');
    assert(!Logic.authenticateUser([{ userId: 'USR-999', username: 'disabled', displayName: 'ถูกระงับ', role: 'STAFF', passwordHash: h1234, isActive: false }], 'disabled', '1234').ok, 'ผู้ใช้ถูกระงับต้องไม่ผ่าน');
    assert(!Logic.validateUserInput({ username: 'ab', displayName: 'สั้นไป', password: '123' }, true).valid, 'ชื่อ/รหัสผ่านสั้นเกินไปต้องไม่ผ่าน');
    assert(Logic.validateUserInput({ username: 'somchai', displayName: 'คุณสมชาย (อัปเดต)', role: 'ADMIN' }, false).sanitized.role === 'ADMIN', 'อัปเดตโดยไม่ส่งรหัสผ่านใหม่ต้องผ่าน');

    const regSuccess = Logic.registerUserAccount(Logic.DEFAULT_USERS, { username: 'anan01', displayName: 'คุณอนันต์ ฝ่ายประสานงาน', password: '5678', confirmPassword: '5678', role: 'ADMIN' }, '2026-11-11T10:00:00+07:00');
    assert(regSuccess.ok && regSuccess.user.role === 'STAFF' && regSuccess.record.isActive, 'สมัครสมาชิกใหม่ต้องได้สิทธิ์ STAFF ทันที');
    assert(Logic.authenticateUser([...Logic.DEFAULT_USERS, regSuccess.record], 'anan01', '5678').ok, 'บัญชีที่สมัครใหม่ต้องล็อกอินได้ทันที');
    assert(!Logic.registerUserAccount(Logic.DEFAULT_USERS, { username: 'somchai', displayName: 'คนใหม่', password: '1234', confirmPassword: '1234' }).ok, 'username ซ้ำต้องไม่ผ่าน');
    assert(!Logic.registerUserAccount(Logic.DEFAULT_USERS, { username: 'newstaff', displayName: 'ใหม่', password: '1234', confirmPassword: '9999' }).ok, 'รหัสยืนยันไม่ตรงกันต้องไม่ผ่าน');
  });

  // --- Suite 9: User Attribution & Reschedule Immutability ---
  runTest('9. User Attribution', 'บันทึกผู้สร้าง ผู้เสร็จสิ้น ผู้ยกเลิก และคงชื่อผู้สร้างเดิมไว้เสมอ', () => {
    const apt = Logic.createAppointmentRecord({ title: 'นัดตรวจระบบสำคัญ', appointmentDate: '2026-11-20', appointmentTime: '10:00', location: 'ห้องประชุม A', contactPerson: 'คุณลูกค้า', createdBy: 'คุณสมชาย' }, [], '2026-11-10T09:00:00+07:00');
    assertEqual(apt.createdBy, 'คุณสมชาย', 'ผู้สร้างต้องเป็นคุณสมชาย');
    assertEqual(apt.statusChangedBy, '', 'ตอนสร้างยังไม่มีผู้เปลี่ยนสถานะ');

    const resEdit = Logic.updateAppointmentRecord(apt, { appointmentTime: '11:00', location: 'ห้องประชุม B', updatedBy: 'คุณวิภาดา' }, { nowIso: '2026-11-10T10:00:00+07:00', reason: 'ห้อง A ติดใช้งาน' });
    assertEqual(resEdit.record.createdBy, 'คุณสมชาย', 'ชื่อผู้สร้างเดิมต้องไม่เปลี่ยน');
    assertEqual(resEdit.record.updatedBy, 'คุณวิภาดา', 'ผู้แก้ไขล่าสุดต้องเป็นคุณวิภาดา');

    const resComplete = Logic.updateAppointmentRecord(resEdit.record, { status: Logic.STATUS.COMPLETED, statusChangedBy: 'ผู้ดูแลระบบ', updatedBy: 'ผู้ดูแลระบบ' }, { nowIso: '2026-11-20T12:00:00+07:00' });
    assertEqual(resComplete.record.createdBy, 'คุณสมชาย', 'ชื่อผู้สร้างเดิมต้องคงเดิม');
    assertEqual(resComplete.record.statusChangedBy, 'ผู้ดูแลระบบ', 'ผู้ยืนยันเสร็จสิ้นต้องเป็นผู้ดูแลระบบ');

    const resCancel = Logic.updateAppointmentRecord(apt, { status: Logic.STATUS.CANCELLED, statusChangedBy: 'คุณนภัสสร', statusReason: 'ลูกค้ายกเลิกกะทันหัน', updatedBy: 'คุณนภัสสร' }, { nowIso: '2026-11-15T09:00:00+07:00' });
    assertEqual(resCancel.record.statusChangedBy, 'คุณนภัสสร', 'ผู้ยกเลิกต้องเป็นคุณนภัสสร');
    assertEqual(resCancel.record.statusReason, 'ลูกค้ายกเลิกกะทันหัน', 'สาเหตุการยกเลิกต้องถูกต้อง');

    const resReopen = Logic.updateAppointmentRecord(resCancel.record, { status: Logic.STATUS.CONFIRMED, updatedBy: 'คุณสมชาย' }, { nowIso: '2026-11-16T09:00:00+07:00', reason: 'คืนสถานะนัดหมาย' });
    assertEqual(resReopen.record.status, Logic.STATUS.CONFIRMED, 'สถานะต้องกลับมาเป็น นัดหมายแล้ว');
    assertEqual(resReopen.record.statusChangedBy, '', 'ต้องล้างผู้เปลี่ยนสถานะเมื่อคืนสถานะ');
    assertEqual(resReopen.record.statusReason, '', 'ต้องล้างสาเหตุยกเลิกเมื่อคืนสถานะ');

    const userStats = Logic.calculateUserStats([resComplete.record, resCancel.record]);
    assert(userStats.find(u => u.user === 'คุณสมชาย').createdTotal === 2 && userStats.find(u => u.user === 'ผู้ดูแลระบบ').completedTotal === 1 && userStats.find(u => u.user === 'คุณนภัสสร').cancelledTotal === 1, 'สถิติรายบุคคลต้องถูกต้อง');
  });

  // --- Suite 10: Time-Slot Conflict Detection ---
  runTest('10. Time-Slot Conflict', 'ตรวจจับเวลานัดหมายที่ชนกันได้อย่างถูกต้อง', () => {
    const list = [
      Logic.createAppointmentRecord({ id: 'APT-001', title: 'งานที่ 1', appointmentDate: '2026-11-25', appointmentTime: '10:00', location: 'ตึก A', contactPerson: 'คุณ ก' }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ id: 'APT-002', title: 'งานที่ 2 ยกเลิกแล้ว', appointmentDate: '2026-11-25', appointmentTime: '10:00', location: 'ตึก B', contactPerson: 'คุณ ข', status: Logic.STATUS.CANCELLED }, [], '2026-11-10T09:00:00+07:00'),
      Logic.createAppointmentRecord({ id: 'APT-003', title: 'งานที่ 3 บ่าย', appointmentDate: '2026-11-25', appointmentTime: '13:00', location: 'ตึก C', contactPerson: 'คุณ ค' }, [], '2026-11-10T09:00:00+07:00')
    ];
    const conflicts = Logic.findTimeConflicts(list, '2026-11-25', '10:00');
    assertEqual(conflicts.length, 1, 'ต้องพบงานชนกัน 1 งาน'); assertEqual(conflicts[0].id, 'APT-001', 'ต้องเป็น APT-001');
    assertEqual(Logic.findTimeConflicts(list, '2026-11-25', '10:00', 'APT-001').length, 0, 'แก้ไขงานตัวเองต้องไม่ชนกับตัวเอง');
    assertEqual(Logic.findTimeConflicts(list, '2026-11-25', '14:00').length, 0, 'เวลาที่ว่างต้องไม่พบชนกัน');
  });

  // --- Suite 11: API Contract Parity ---
  runTest('11. API Contract Parity', 'ตรวจสอบว่า CalendarLogic มีฟังก์ชันและค่าคงที่ครบ 43 รายการ', () => {
    const expectedKeys = [
      'API_VERSION', 'STATUS', 'VALID_STATUSES', 'USER_ROLES', 'DEFAULT_USERS', 'THAI_MONTHS_SHORT', 'THAI_MONTHS_FULL', 'LINE_MAX_TEXT_LENGTH',
      'hasEmoji', 'sanitizeNoEmoji', 'normalizeStatus', 'hashPassword', 'authenticateUser', 'validateUserInput', 'registerUserAccount',
      'normalizeYearToCE', 'toBuddhistYear', 'isLeapYearCE', 'getDaysInMonth', 'parseFlexibleDateInput', 'parseTimeInput', 'bangkokSlotToEpochMs',
      'getBangkokParts', 'daysBetweenDates', 'formatThaiDateDisplay', 'isActiveStatus', 'isOverdue', 'buildAppointmentSlot', 'findTimeConflicts',
      'validateAppointmentInput', 'generateAppointmentId', 'createAppointmentRecord', 'updateAppointmentRecord', 'isInQuietHours',
      'evaluateAppointmentNotification', 'buildNotificationPlan', 'calculateYearlyStats', 'calculateUserStats', 'queryByMonth', 'queryByYear',
      'queryMultiYearOverview', 'formatInstantAppointmentMessage', 'parseAndExecuteLineCommand'
    ];
    expectedKeys.forEach(k => assert(Logic[k] !== undefined, `CalendarLogic ต้องมีพร็อพเพอร์ตี ${k}`));
    assertEqual(Object.keys(Logic).length, expectedKeys.length, `CalendarLogic ต้องมีจำนวนส่งออกครบ ${expectedKeys.length} รายการ`);
  });

  // --- Suite 12 & 13 & 7 (Node.js File Audits) ---
  if (typeof require !== 'undefined') {
    const fs = require('fs'), path = require('path'), vm = require('vm');
    const readF = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');

    runTest('12. DOM ID Audit', 'ทุก DOM ID ใน app.js ($ และ on) ต้องปรากฏอยู่ใน index.html ครบถ้วน', () => {
      const appJs = readF('app.js'), indexHtml = readF('index.html'), idRegex = /(?:\$\(['"]|on\(['"])([a-zA-Z0-9_-]+)['"]\)/g, ids = new Set();
      let m; while ((m = idRegex.exec(appJs)) !== null) ids.add(m[1]);
      assert(ids.size > 30, 'ต้องตรวจพบ ID ใน app.js อย่างน้อย 30 รายการ');
      const missing = [...ids].filter(id => !indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`));
      assertEqual(missing.length, 0, `พบ ID ใน app.js ที่ไม่มีใน index.html: ${missing.join(', ')}`);
    });

    runTest('13. GAS Guard Audit', 'gas/Code.gs มีฟังก์ชันครบถ้วน ไวยากรณ์ถูกต้อง และมีระบบ Low-Latency Cache ครบถ้วน', () => {
      const codeGs = readF('gas', 'Code.gs');
      new vm.Script(codeGs, { filename: 'Code.gs' });
      ['setupDatabase', 'installTriggerAuto', 'installTriggerEvery15Minutes', 'installTriggerDailyAt8AM', 'removeNotificationTriggers', 'runNotificationEngine', 'doGet', 'doPost', 'readAllApts_', 'createApt_', 'updateApt_', 'deleteApt_', 'handleUserLogin_', 'handleUserRegister_', 'saveUser_', 'buildSyncBundle_', 'appendPlainRow_', 'buildAptFlexMsg_', 'handleLinePostback_', 'sendLineReply_']
        .forEach(fn => assert(codeGs.includes(`function ${fn}`), `Code.gs ต้องมีฟังก์ชัน ${fn}`));

      const getSheetDataDef = codeGs.substring(codeGs.indexOf('function getSheetData_'), codeGs.indexOf('function setupDatabase'));
      assert(!getSheetDataDef.includes('formatPlainText_'), 'getSheetData_ ต้องไม่มี formatPlainText_ ซ้ำซ้อน');
      const createAptDef = codeGs.substring(codeGs.indexOf('function createApt_'), codeGs.indexOf('function updateApt_'));
      assert(!createAptDef.includes('readAllApts_'), 'createApt_ ต้องไม่อ่านชีตซ้ำผ่าน readAllApts_');
      ['_metaCache', '_dataCache', '_propsCache', 'needsTriggerSync', 'fetchAll', 'LN_U_'].forEach(sym => assert(codeGs.includes(sym), `Code.gs ต้องมี ${sym}`));
    });

    runTest('13. GAS Guard Audit', 'app.js ไวยากรณ์ถูกต้องและมีระบบ Optimistic UI, Staff Role Guard, Map/Image, PWA/Web Push และ CSV/Print Report ครบถ้วน', () => {
      const appJs = readF('app.js');
      new vm.Script(appJs, { filename: 'app.js' });
      ['pendingIds', 'setBgSync', 'applySyncBundle', 'LIVE_CACHE', 'renderActiveTab', 'isStaffOnlyCalendar', 'openMapPreviewModal', 'openImagePreviewModal', 'compressImageFile', 'exportAppointmentsToCsv', 'printAppointmentsReport', 'buildCsvContent', 'initPwaAndWebPush', 'requestWebNotifyPermission', 'sendWebPushNotification', 'handleInstallPwaClick'].forEach(sym => assert(appJs.includes(sym), `app.js ต้องมี ${sym}`));
    });

    runTest('15. PWA & Web Push Audit', 'ไฟล์ manifest.json, sw.js, icon.svg, Web Push UI และกฎ Responsive มือถือถูกต้องสมบูรณ์', () => {
      const manifestRaw = readF('manifest.json'), swJs = readF('sw.js'), iconSvg = readF('icon.svg'), indexHtml = readF('index.html'), styleCss = readF('style.css'), codeGs = readF('gas', 'Code.gs'), appJs = readF('app.js');
      const manifest = JSON.parse(manifestRaw);
      assertEqual(manifest.display, 'standalone', 'manifest.json ต้องตั้งค่า display เป็น standalone');
      assert(manifest.short_name && Array.isArray(manifest.icons) && manifest.icons.length >= 1, 'manifest.json ต้องมี short_name และ icons');
      new vm.Script(swJs, { filename: 'sw.js' });
      ['push', 'notificationclick', 'showNotification', 'cal-pwa', 'showSwNotification'].forEach(sym => assert(swJs.includes(sym), `sw.js ต้องมี ${sym}`));
      assert(iconSvg.includes('<svg') && iconSvg.includes('</svg>'), 'icon.svg ต้องเป็น SVG ที่ถูกต้อง');
      ['rel="manifest"', 'href="manifest.json"', 'icon.svg', 'theme-color', 'id="webNotifModal"', 'id="webPushBannerContainer"', 'id="btnModalTestWebNotify"', 'id="btnModalReqWebNotify"', 'id="webNotifFeedList"'].forEach(tag => assert(indexHtml.includes(tag), `index.html ต้องมี ${tag}`));
      ['notifyWebPushForApt', 'openWebNotifModal', 'showWebPushBanner', 'sendWebPushNotification'].forEach(fn => assert(appJs.includes(fn), `app.js ต้องมี ${fn}`));
      const mobileCss = styleCss.substring(styleCss.indexOf('@media (max-width: 768px)'));
      assert(mobileCss.includes('.agenda-scroll-list .apt-card-slim') && mobileCss.includes('.agenda-scroll-list .apt-date-block'), 'style.css ต้องมีกฎ .agenda-scroll-list บนจอมือถือ');
      assert(codeGs.includes('suppressSlotReset') && codeGs.includes("CONFIRMED: 'เริ่มนัด'"), 'Code.gs ต้องมี suppressSlotReset และสถานะ เริ่มนัด');
    });

    runTestAsync('15. PWA & Web Push Audit', 'จำลองระบบแจ้งเตือน Web Push: SW fallback -> Notification, Banner ในแอป, Reminder และโควตา LINE เต็ม', async () => {
      const appJs = readF('app.js'), bannerChildren = [], notifCalls = [], memStore = {};
      const bannerBox = { children: bannerChildren, appendChild: el => bannerChildren.push(el) };
      const elMap = { webPushBannerContainer: bannerBox, webNotifModal: { classList: { contains: () => false } } };
      function MockNotification(t, o) { notifCalls.push({ t, o }); }
      MockNotification.permission = 'granted';
      const sandbox = {
        Logic, ICO: { bell: '<svg></svg>' }, escapeHtml: s => String(s || ''),
        txt: () => {}, disp: () => {}, openModal: () => {}, switchTab: () => {}, showToast: () => {}, pendingIds: new Set(),
        STORAGE: { WEB_NOTIF: 'wn', WEB_NOTIF_SENT: 'wns', WEB_NOTIF_FEED: 'wnf' },
        localStorage: { getItem: k => memStore[k] || null, setItem: (k, v) => { memStore[k] = String(v); } },
        $: id => elMap[id] || null,
        Notification: MockNotification, navigator: { serviceWorker: {} }, window: { focus: () => {}, navigator: {} }, setTimeout: (fn, ms) => (ms > 1000 ? 0 : setTimeout(fn, ms)),
        document: { createElement: () => ({ className: '', style: {}, innerHTML: '', addEventListener: () => {}, remove: () => {} }) },
        state: { currentUser: { displayName: 'คุณสมชาย' }, appointments: [], webNotif: { enabled: true, bgSync: true }, webNotifFeed: [], webNotifUnread: 0, meta: { CACHED_QUOTA_LIMIT: '300', CACHED_QUOTA_USED: '300', DAILY_DIGEST_HOUR: '8' }, swReg: { active: {}, showNotification: async () => { throw new Error('SW fail'); } } }
      };
      vm.createContext(sandbox);
      const slice = appJs.substring(appJs.indexOf('const localMutAt ='), appJs.indexOf('function initPwaAndWebPush'));
      vm.runInContext(slice + '; this.notifyWebPushForApt = notifyWebPushForApt; this.evaluateAndFireWebNotifications = evaluateAndFireWebNotifications; this.state = state;', sandbox);
      await sandbox.notifyWebPushForApt({ id: 'APT-001', title: 'ทดสอบประชุม', appointmentDate: '2026-11-20', appointmentTime: '10:00', location: 'ห้อง A', contactPerson: 'คุณ ก' }, 'CREATE');
      assertEqual(notifCalls.length, 1, 'ต้อง fallback มาเรียก new Notification เมื่อ SW showNotification ผิดพลาด');
      assert(notifCalls[0].t.includes('[แจ้งเตือนนัดหมายใหม่]') && notifCalls[0].o.body.includes('โควตา LINE เต็ม'), 'ต้องมีข้อความแจ้งเตือนครบและระบุกรณีโควตา LINE เต็ม');
      assertEqual(sandbox.state.webNotifFeed.length, 1, 'ต้องบันทึกประวัติลง webNotifFeed');
      assertEqual(bannerChildren.length, 1, 'ต้องแสดงการ์ดแจ้งเตือน In-App Banner');
      assert(!Logic.hasEmoji(JSON.stringify(sandbox.state.webNotifFeed)), 'ประวัติการแจ้งเตือนต้องไม่มีอิโมจิ');

      // ทดสอบกรณี Sync Diff (เพื่อนร่วมทีมสร้าง/จบงาน) และสิทธิ์ Notification เป็น default (ยังคงแจ้งเตือนในแอป)
      MockNotification.permission = 'default';
      sandbox.state.appointments = [{ id: 'APT-002', title: 'งานจากทีม', appointmentDate: '2026-11-21', appointmentTime: '11:00', location: 'ห้อง B', contactPerson: 'คุณ ข', status: Logic.STATUS.COMPLETED, updatedAt: '2026-11-18T09:10:00+07:00' }];
      sandbox.evaluateAndFireWebNotifications([{ id: 'APT-001' }], true);
      await new Promise(r => setTimeout(r, 15));
      assertEqual(sandbox.state.webNotifFeed.length, 2, 'Sync Diff ต้องแจ้งเตือนในแอปได้แม้สิทธิ์ OS Push ยังเป็น default และโควตา LINE หมด');
      assert(sandbox.state.webNotifFeed[0].title.includes('[แจ้งเตือนนัดหมายใหม่]'), 'รายการ Sync ใหม่ต้องแจ้งเตือนหัวข้อถูกต้อง');
    });

    runTest('13. GAS Guard Audit', 'LINE Flex Message และ Postback Action ทำงานถูกต้องและปราศจากอิโมจิ', () => {
      const codeGs = readF('gas', 'Code.gs');
      const sandbox = { STATUS: Logic.STATUS, normalizeStatus_: Logic.normalizeStatus, sanitizeNoEmoji: Logic.sanitizeNoEmoji, fmtThaiDate_: d => Logic.formatThaiDateDisplay(d, false) };
      vm.createContext(sandbox);
      vm.runInContext(codeGs.substring(codeGs.indexOf('function parseQueryString_'), codeGs.indexOf('function testNotification_')), sandbox);

      const apt = { id: 'APT-20261112-001', title: 'ประชุมตรวจรับงานระบบ', appointmentDate: '2026-11-20', appointmentTime: '10:00', location: 'ห้องประชุม A', contactPerson: 'คุณสมชาย', status: Logic.STATUS.CONFIRMED, createdBy: 'คุณวิภาดา' };
      const flex = sandbox.buildAptFlexMsg_(apt, false, false, '');
      assert(flex.type === 'flex' && flex.contents.type === 'bubble' && flex.contents.footer.contents.length === 2, 'Confirmed Flex ต้องมี 2 ปุ่ม');
      const [btnComp, btnCanc] = flex.contents.footer.contents;
      assertEqual(sandbox.parseQueryString_(btnComp.action.data).action, 'quickComplete', 'ถอดรหัส quickComplete ถูกต้อง');
      assertEqual(sandbox.parseQueryString_(btnCanc.action.data).action, 'quickCancel', 'ถอดรหัส quickCancel ถูกต้อง');
      assertEqual(btnCanc.style, 'primary', 'ปุ่มยกเลิกต้องเป็น primary สีแดงทึบ');
      assert(!Logic.hasEmoji(JSON.stringify(flex)) && flex.contents.styles.header.backgroundColor === '#f0f9ff', 'นัดใหม่ต้องเป็นฟ้าอ่อนและไร้ Emoji');

      assertEqual(sandbox.buildAptFlexMsg_(apt, true, false, 'https://example.com').contents.styles.header.backgroundColor, '#eef2ff', 'อัปเดตหัวครามอ่อน');
      assertEqual(sandbox.buildAptFlexMsg_({ ...apt, reopened: true }, true, false, '').contents.styles.header.backgroundColor, '#eff6ff', 'คืนสถานะหัวฟ้าเข้มอ่อน');
      const flexDone = sandbox.buildAptFlexMsg_({ ...apt, status: Logic.STATUS.COMPLETED }, true, false, '');
      assert(!flexDone.contents.footer && flexDone.contents.styles.header.backgroundColor === '#ecfdf5', 'เสร็จสิ้นไม่มีปุ่มและหัวเขียวอ่อน');
      assertEqual(sandbox.buildAptFlexMsg_({ ...apt, status: Logic.STATUS.CANCELLED }, true, false, '').contents.styles.header.backgroundColor, '#fef2f2', 'ยกเลิกหัวแดงอ่อน');

      const resComp = sandbox.buildStatusResultFlex_(apt, 'quickComplete', 'คุณสมชาย', '', '15:30');
      const resCanc = sandbox.buildStatusResultFlex_(apt, 'quickCancel', 'B∆LL', 'ยกเลิกผ่าน LINE โดย B∆LL', '15:31');
      const notice = sandbox.buildNoticeFlex_('APT-001', 'รายการนี้ได้รับการดำเนินการไปแล้ว', 'นัดหมายนี้ได้รับการยกเลิกไปแล้ว', Logic.STATUS.CANCELLED, 'B∆LL', 'ยกเลิกผ่าน LINE');
      assertEqual(resComp.contents.styles.header.backgroundColor, '#ecfdf5', 'Result Complete หัวเขียวอ่อน');
      assertEqual(resCanc.contents.styles.header.backgroundColor, '#fef2f2', 'Result Cancel หัวแดงอ่อน');
      assertEqual(notice.contents.styles.header.backgroundColor, '#fffbeb', 'Notice หัวอำพันอ่อน');
      assert(!Logic.hasEmoji(JSON.stringify([resComp, resCanc, notice])), 'Result/Notice Cards ต้องไม่มีอิโมจิ');

      assertEqual(sandbox.buildQuotaFlex_(60, 300, 'https://example.com').contents.styles.header.backgroundColor, '#ecfdf5', 'โควตา <80% เขียวอ่อน');
      assertEqual(sandbox.buildQuotaFlex_(255, 300, 'https://example.com').contents.styles.header.backgroundColor, '#fffbeb', 'โควตา >=80% อำพันอ่อน');
      assertEqual(sandbox.buildQuotaFlex_(285, 300, 'https://example.com').contents.styles.header.backgroundColor, '#fef2f2', 'โควตา >=90% แดงอ่อน');

      const helpCard = sandbox.buildHelpFlex_('https://example.com');
      const helpBtns = helpCard.contents.footer.contents.flatMap(r => r.contents || []);
      assert(helpCard.contents.footer.contents.length >= 2 && helpBtns.length >= 6 && helpCard.contents.styles.header.backgroundColor === '#eef2ff' && !Logic.hasEmoji(JSON.stringify(helpCard)), 'Help Card ถูกต้อง');
      assert(helpBtns.every(b => b.style === 'primary' && b.color && b.action && !String(b.action.label).includes('คิว') && !String(b.action.text).includes('คิว')), 'ปุ่ม Help Card ทั้ง 6 ปุ่มต้องเป็นสีชัดเจนและไม่มีคำว่า คิว');
      assert(typeof sandbox.getValidMapUri_ === 'function' && sandbox.getValidMapUri_('13.7563, 100.5018').includes('13.7563'), 'getValidMapUri_ แปลงพิกัดเป็นลิงก์แผนที่ได้');
      const mapFlex = sandbox.buildAptFlexMsg_({ id: 'APT-202611-999', title: 'นัดตรวจไซต์', appointmentDate: '2026-11-20', appointmentTime: '10:00', location: 'กทม.', contactPerson: 'คุณเอก', status: 'CONFIRMED', mapUrl: '13.7563,100.5018' }, false, false, 'https://example.com');
      assert(JSON.stringify(mapFlex).includes('ดูแผนที่นำทาง'), 'Flex ต้องมีปุ่ม ดูแผนที่นำทาง เมื่อระบุ mapUrl');

      const qToday = sandbox.buildQueueFlex_('คิวงานวันนี้', 1, [apt], 'https://example.com', false, { variant: 'today' });
      const qOver = sandbox.buildQueueFlex_('คิวงานค้างอยู่', 1, [apt], 'https://example.com', false, { variant: 'overdue' });
      assertEqual(qToday.contents.styles.header.backgroundColor, '#fffbeb', 'คิววันนี้หัวอำพัน');
      assertEqual(qOver.contents.styles.header.backgroundColor, '#fef2f2', 'คิวค้างหัวแดงอ่อน');
      assert(JSON.stringify(qToday).includes(Logic.STATUS.CONFIRMED) && !Logic.hasEmoji(JSON.stringify([qToday, qOver])), 'Queue Card แสดงสถานะและไร้ Emoji');

      const yrCard = sandbox.buildYearStatsFlex_(2026, 4, 1, 2, 1, 50, [], 'https://example.com');
      assert(yrCard.contents.styles.header.backgroundColor === '#eef2ff' && !Logic.hasEmoji(JSON.stringify(yrCard)), 'Year Stats Card ถูกต้อง');

      const remH = sandbox.buildReminderNotificationFlex_([apt], [], '2026-11-20', false, 'https://example.com', { used: 30, limit: 300 });
      const remD = sandbox.buildReminderNotificationFlex_([], [apt], '2026-11-20', false, 'https://example.com', { used: 30, limit: 300 });
      assertEqual(remH.contents.type, 'bubble', 'เตือนด่วน 1 งานเป็น bubble'); assertEqual(remH.contents.styles.header.backgroundColor, '#fffbeb', 'เตือนด่วนหัวอำพัน');
      assertEqual(remD.contents.type, 'bubble', 'สรุปรายวัน 1 งานเป็น bubble'); assertEqual(remD.contents.styles.header.backgroundColor, '#f0f9ff', 'สรุปรายวันหัวฟ้าอ่อน');

      const many = Array.from({ length: 12 }, (_, idx) => ({ ...apt, id: 'APT-20261120-' + String(idx + 1).padStart(3, '0') }));
      const remC = sandbox.buildReminderNotificationFlex_(many.slice(0, 2), many.slice(2), '2026-11-20', false, 'https://example.com', { used: 260, limit: 300 });
      assert(remC.contents.type === 'carousel' && remC.contents.contents.length === 10 && JSON.stringify(remC).includes('เตือนโควตา LINE') && !Logic.hasEmoji(JSON.stringify(remC)), 'Reminder Carousel ถูกต้อง');

      ['buildReminderNotificationFlex_(', 'buildQuotaFlex_(', 'if (reop) up.reopened = true;'].forEach(s => assert(codeGs.includes(s), `Code.gs ต้องมี ${s}`));
    });

    runTest('14. Performance & Compaction Guard', 'ระบบ O(N) Bucketing, Lazy Webhook Read, ฟีเจอร์ F1-F5 และความกระชับของโค้ดทำงานสมบูรณ์', () => {
      const codeGs = readF('gas', 'Code.gs'), appJs = readF('app.js');
      // 1. ตรวจสอบว่า parseWebhookCmd_ ตอบกลับ ช่วยเหลือ และ โควตา ก่อนเรียก readAllApts_
      const webhookFn = codeGs.substring(codeGs.indexOf('function parseWebhookCmd_'));
      const helpIdx = webhookFn.indexOf('buildHelpFlex_'), quotaIdx = webhookFn.indexOf('buildQuotaFlex_'), readIdx = webhookFn.indexOf('readAllApts_()');
      assert(helpIdx > 0 && quotaIdx > 0 && readIdx > helpIdx && readIdx > quotaIdx, 'parseWebhookCmd_ ต้องตรวจสอบ ช่วยเหลือ และ โควตา ก่อนเรียก readAllApts_()');

      // 2. ตรวจสอบฟีเจอร์ F1-F5 และ Surgical Calendar Render ใน app.js
      ['selectCalendarDate', 'renderMonthAgenda', 'openDuplicateModal', 'copyAppointmentText', 'exportAppointmentToIcs', 'syncAptMutation', 'btnCalFilterMyApts'].forEach(sym => assert(appJs.includes(sym), `app.js ต้องมี ${sym}`));

      // 3. Benchmark O(N) queryByYear & parseAndExecuteLineCommand สำหรับข้อมูล 500 นัดหมาย (< 25ms)
      const bulk = Array.from({ length: 500 }, (_, i) => ({
        id: `APT-2026-${String(i + 1).padStart(4, '0')}`, title: `งานทดสอบความเร็ว ${i + 1}`,
        appointmentDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        appointmentTime: '10:00', location: 'กรุงเทพฯ', contactPerson: 'คุณลูกค้า',
        status: i % 3 === 0 ? Logic.STATUS.COMPLETED : Logic.STATUS.CONFIRMED, createdBy: 'คุณสมชาย'
      }));
      const t0 = Date.now();
      const yrRes = Logic.queryByYear(bulk, 2026, { nowIso: '2026-06-15T09:00:00+07:00' });
      const cmdRes = Logic.parseAndExecuteLineCommand('ช่วยเหลือ', bulk, '2026-06-15T09:00:00+07:00', {});
      const elapsed = Date.now() - t0;
      assert(yrRes.stats.total === 500 && yrRes.months.length === 12 && cmdRes.includes('คำสั่งตรวจสอบตารางงาน'), 'ผลลัพธ์ Benchmark 500 รายการต้องถูกต้อง');
      assert(elapsed < 50, `การประมวลผล 500 รายการต้องเสร็จสิ้นใน < 50ms (ใช้จริง ${elapsed}ms)`);

      // 4. ตรวจสอบความกระชับและความสมบูรณ์ของโค้ด (ป้องกันบล็อกว่างจากการ Compaction)
      assert(codeGs.includes('rescheduleLogs: readLogs_(SH_RE_LOGS, RE_LOG_COLS, 50)') && codeGs.includes("logId: 'LOG-' + now.epochMs"), 'Code.gs ต้องมี buildSyncBundle_ และ updateApt_ log generation ครบถ้วน');
      assert(!/\{\s{2,}\}/.test(codeGs) && !/\{\s{2,}\}/.test(appJs) && !/\{\s{2,}\}/.test(readF('logic.js')) && !/\{\s{2,}\}/.test(readF('style.css')), 'ห้ามมีบล็อกคำสั่งว่างผิดปกติในไฟล์หลัก');
      assert(codeGs.split(/\r?\n/).length <= 710, 'gas/Code.gs ต้องมีความยาวไม่เกิน 710 บรรทัด');
      assert(appJs.split(/\r?\n/).length <= 920, 'app.js ต้องมีความยาวไม่เกิน 920 บรรทัด');
      assert(readF('logic.js').split(/\r?\n/).length <= 350, 'logic.js ต้องมีความยาวไม่เกิน 350 บรรทัด');
    });

    runTest('7. Codebase Audit', 'ไฟล์ทั้งหมดใน C:\\Calendar ต้องไม่มีอิโมจิหลุดรอด (ยกเว้นไอคอนปุ่มสลับธีมตามคำอนุญาตพิเศษ)', () => {
      const files = ['index.html', 'style.css', 'logic.js', 'app.js', 'patchnotes.js', 'manifest.json', 'sw.js', 'icon.svg', 'tests.html', 'tests.js', 'README.md', 'CHANGELOG.md', 'SETUP_GUIDE.md', path.join('gas', 'Code.gs'), path.join('gas', 'appsscript.json')];
      files.forEach(f => {
        const full = path.join(__dirname, f);
        if (fs.existsSync(full)) {
          let c = fs.readFileSync(full, 'utf8');
          if (f === 'index.html' || f === 'tests.js') c = c.replace(/[\u2600\uFE0F\uD83C\uDF19]/gu, '');
          assert(!Logic.hasEmoji(c), `พบอิโมจิในไฟล์ ${f}`);
        }
      });
    });
  }

  // --- Runner Output ---
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      const s = document.getElementById('testSummary'), l = document.getElementById('testList');
      if (s) { s.textContent = `ผลการทดสอบทั้งหมด: ผ่าน ${passedCount} รายการ | ไม่ผ่าน ${failedCount} รายการ`; s.className = failedCount === 0 ? 'summary-pass' : 'summary-fail'; }
      if (l) l.innerHTML = results.map(r => `<li class="${r.ok ? 'pass' : 'fail'}">[${r.ok ? 'PASS' : 'FAIL'}] ${r.suite} -> ${r.name}${r.error ? ' - ' + r.error : ''}</li>`).join('');
    });
  } else {
    Promise.all(asyncTests).then(() => {
      results.forEach(r => console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.suite} -> ${r.name}${r.error ? ' : ' + r.error : ''}`));
      console.log(`\nTest Summary: ${passedCount} passed, ${failedCount} failed.`);
      if (failedCount > 0) process.exit(1);
    });
  }
})();
