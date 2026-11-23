# Calendar & Appointment Management System (v2.8.0)

ระบบบริหารจัดการคิวนัดหมายและแจ้งเตือนผ่าน LINE สำหรับทีมงาน ธีม Executive Indigo-Slate พร้อมสถาปัตยกรรม Ultra Low-Latency & Delta Sync, ระบบรีเซ็ตรหัสผ่านด้วย LINE OTP (ไม่ต่อฐานข้อมูลอื่น), ระบบระงับผู้ใช้แบบกำหนดเวลาและลบบัญชีถาวรฝั่ง Admin, รองรับการติดตั้งเว็บแอปลงเครื่อง (PWA Standalone) และระบบแจ้งเตือนผ่านเว็บ (Web Push / Browser Notification), หน้าเริ่มต้น "ปฏิทินเดือน" พร้อมระบบสิทธิ์ STAFF ดูเฉพาะปฏิทินเดือนและตัวกรอง "เฉพาะงานของฉัน", ปุ่มคัดลอกนัด/คัดลอกข้อความ/ส่งออกปฏิทิน (.ics), ระบบส่งออกรายงาน Excel (CSV) และพิมพ์ใบสรุปงาน PDF (A4), ระบบปักหมุดแผนที่และแนบรูปภาพแบบ Optional, ปุ่มคำสั่ง LINE Bot แบบสั้นและ Flex Message แนวทางเดียวกันครบทุกจุด, Optimistic UI (< 20ms) และ Responsive UI สำหรับมือถือและคอมพิวเตอร์

## คุณสมบัติเด่น (Features)
- **ระบบรีเซ็ตรหัสผ่านบนหน้า Login ผ่าน LINE + Apps Script + Google Sheets (v2.8.0)**: ผูกบัญชี LINE 1-on-1 ผ่านหน้าต่าง `บัญชี / LINE` ได้ทั้ง `STAFF` และ `ADMIN`, ขอ OTP 6 หลัก (SHA-256 ใน `CacheService`, อายุ 10 นาที) ทาง LINE หรือพิมพ์ `รีเซ็ตรหัส` ในแชทส่วนตัวฟรี 0 โควตา พร้อม Fallback แจ้ง `ADMIN` ออก OTP ชั่วคราว
- **จัดการบัญชีฝั่ง ADMIN แบบกำหนดช่วงเวลา & ลบบัญชีถาวร (v2.8.0)**: เลือกระงับผู้ใช้ได้ `1 วัน`, `3 วัน`, `7 วัน`, `15 วัน` หรือ `ถาวร` พร้อมปลดระงับอัตโนมัติเมื่อครบกำหนด และลบบัญชีผู้ใช้ออกจาก Google Sheets ถาวร (ต้องสร้างบัญชีใหม่เท่านั้น โดยประวัตินัดหมายเดิมยังคงอยู่) พร้อม Force Logout อัตโนมัติ
- **ชื่อผู้นัดพบแบบ Optional (v2.8.0)**: สามารถสร้างและแก้ไขนัดหมายโดยเว้นว่างชื่อผู้นัดพบได้ทั้งหน้าเว็บและ API
- **Delta Sync & Cross-Request Cache (v2.7.0)**: ซิงก์หลายอุปกรณ์/แท็บ/LINE Bot ไวขึ้นด้วย `sinceRev` (0 Sheet reads เมื่อไม่มีการเปลี่ยนแปลง), `CacheService` แยก Scope พร้อม Chunking & Anti-Poisoning Guard, Batch Sheet Writes, `omitImgEcho`, Instant Multi-Tab `storage` Sync และ Resume Sync
- **On-Demand Assets & Ultra-Compact Codebase (v2.7.0)**: โหลด Leaflet และ `patchnotes.js` แบบ Lazy เฉพาะเมื่อใช้งาน, ใช้ SVG Sprite รวมศูนย์, Stale-While-Revalidate PWA Cache และ O(N) Multi-Year Indexing
- บันทึกคิวนัดหมายงานประจำวัน เลื่อนวัน/เวลา สถานที่ และบุคคลที่นัดพบ
- **ระบบ LINE Flex Message เต็มรูปแบบ (Full Flex Redesign & Zero-Emoji)**:
  - การ์ดยืนยันการเสร็จสิ้นนัดหมาย (`quickComplete`): กรอบและหัวข้อสีเขียวมรกต (`#10b981`) พื้นหลังอ่อน สะอาดตา
  - การ์ดยืนยันการยกเลิกนัดหมาย (`quickCancel`): กรอบและหัวข้อสีแดงสด (`#ef4444`) พื้นหลังอ่อน ระบุผู้ยกเลิก สาเหตุ และเวลาชัดเจน
  - การ์ดแจ้งเตือนระบบและการป้องกันกดซ้ำ (Concurrency Guard Notice Card): หัวข้อสีส้มเตือนภัย (`#d97706`) แจ้งเตือนทันทีหากมีผู้อื่นกดดำเนินการไปแล้ว
  - การ์ดคำสั่งตรวจสอบคิวงาน (Queue Digest Card): สรุปรายการงานวันนี้ พรุ่งนี้ สัปดาห์นี้ ทั้งหมด ในรูปแบบการ์ด Bubble สไตล์ SaaS พร้อมปุ่มเปิดดูบนเว็บแอป
  - การ์ดสรุปสถิติประจำปี (Yearly Dashboard Card): แดชบอร์ดสรุปยอดงาน อัตราสำเร็จ และการยกเลิก
  - การ์ดเมนูช่วยเหลือและปุ่มลัด (Interactive Quick Help Card): แสดงคำสั่งพร้อมปุ่มกดด่วน (Interactive Message Action) ให้สมาชิกแตะส่งคำสั่งได้ทันที
  - ข้อความตอบกลับทั้งหมดส่งผ่าน LINE Free Reply Token ฟรี 100% ไม่เสียโควตาข้อความรายเดือน
- **ปุ่มกด "เสร็จสิ้น" และ "ยกเลิก" บนการ์ด LINE Flex Message โดยตรง**: สมาชิกในกลุ่ม LINE สามารถกดเสร็จสิ้นหรือยกเลิกนัดหมายได้ทันทีใน 1 คลิก พร้อมระบุชื่อคนกดผ่านโปรไฟล์ LINE (User Attribution)
- **ระบบ Optimistic UI ตอบสนองทันที (< 20ms)**: บันทึกนัดใหม่, แก้ไข, เปลี่ยนสถานะ และลบ จะอัปเดตหน้าจอและปิดหน้าต่างทันที ไม่ต้องรอเซิร์ฟเวอร์ พร้อมระบบ Snapshot Rollback คืนค่าอัตโนมัติหากมีข้อผิดพลาด
- **ระบบ Single-Roundtrip Auth**: เข้าสู่ระบบและสมัครสมาชิกในคำขอรอบเดียว ดึงข้อมูลตารางงานเริ่มต้นกลับมาทันที ลดเวลาการเข้าใช้งานลงกว่า 50%
- หน้าเข้าสู่ระบบแบบเต็มจอก่อนเข้าใช้งาน (Full-Screen Auth Gate) ป้องกันการเข้าถึงตารางงานก่อนยืนยันตัวตน
- ระบบสมัครสมาชิกใหม่ด้วยตนเอง (Self-Registration) ได้รับสิทธิ์ระดับ `STAFF` และเข้าใช้งานได้ทันที พร้อมเข้ารหัสรหัสผ่าน SHA-256
- ระบบติดตามผู้ใช้งานรายบุคคล (User Attribution): บันทึกชัดเจนว่าใครเป็นผู้สร้างนัดหมาย (`createdBy`), ใครเป็นผู้กดยืนยันเสร็จสิ้น (`statusChangedBy`), และใครเป็นผู้กดยกเลิกนัดหมาย
- ระบบล็อกชื่อผู้สร้างนัดหมายเดิม (Immutability): ป้องกันการเขียนทับชื่อผู้สร้างเมื่อมีสมาชิกคนอื่นเข้ามาแก้ไขหรือเปลี่ยนสถานะ
- หน้าต่างยืนยันการยกเลิกนัดหมายพร้อมบันทึกสาเหตุ และแจ้งเตือนชื่อผู้ยกเลิกพร้อมสาเหตุเข้ากลุ่ม LINE ทันที
- ระบบตรวจสอบเวลานัดหมายชนกัน (Time-Slot Conflict Warning): เตือนทันทีเมื่อเลือกวันและเวลาที่ตรงกับนัดหมายอื่น
- ตัวกรองงานตามผู้สร้างนัดหมาย (เฉพาะงานของฉัน หรือเลือกดูตามชื่อสมาชิก)
- สรุปผลงานและสถิติรายบุคคล (User Performance) ในแท็บภาพรวมรายปี
- การแจ้งเตือนผ่าน LINE อัตโนมัติ: การ์ด Flex Message (Zero-Emoji), ระบบ Smart Auto-Trigger ตั้งเวลาปลุกเตือนตามเวลานัดหมายจริง, สรุปงานรอบเช้า (Daily Digest เวลา 08:00 น.) และเตือนก่อนเวลานัดหมาย (Hourly Reminder)
- สอบถามและสร้างนัดหมายผ่านแชทกลุ่ม/แชทเดี่ยว LINE แบบโต้ตอบได้ทันที (ใช้ Reply API ฟรี ไม่กระทบโควตาข้อความ Push รายเดือน)
- รองรับการใช้งานพร้อมกันหลายคนผ่านฐานข้อมูล Google Sheets ป้องกันข้อมูลชนกันด้วย Optimistic Concurrency

## โครงสร้างโปรเจกต์
- `index.html` - หน้าเว็บแอปพลิเคชันพร้อม SVG Sprite และ Lazy Asset Loading (Web UI v2.8.0)
- `style.css` - สไตล์การแสดงผลแบบ Modern SaaS ธีม Executive Indigo-Slate, Traffic-Light Semantics, PWA Standalone & A4 Print Report (v2.8.0)
- `app.js` - ตัวควบคุมหน้าเว็บ, Delta Sync, Multi-Tab Storage Sync, O(1) Index, PWA & Web Push Engine, Duplicate/Copy/ICS, CSV/Print Report Engine และ Optimistic UI (v2.8.0)
- `logic.js` - ฟังก์ชันคำนวณวันเวลา (Asia/Bangkok), ตรวจสอบความถูกต้อง, ระบบแจ้งเตือน, SHA-256 Hash, Timed Suspension, ตรวจสอบคิวชนกัน และสรุปสถิติ O(N) (v2.8.0)
- `manifest.json` / `sw.js` / `icon.svg` - ชุดไฟล์มาตรฐาน PWA Standalone (Stale-While-Revalidate + Web Push & Notification Click Handlers)
- `patchnotes.js` / `PATCHNOTES.md` - บันทึกประวัติการพัฒนาและฟีเจอร์แต่ละเวอร์ชัน
- `tests.js` / `tests.html` / `tests_perf_sync.js` - ชุดทดสอบอัตโนมัติ (ครอบคลุม API Contract, DOM Audit, Zero-Emoji, Delta Sync, CacheService Chunking, Multi-Tab Sync, PWA/Web Push, Flex Audit, Timed Suspension, LINE OTP Reset และ Benchmark)
- `SETUP_GUIDE.md` - คู่มือการติดตั้งระบบ LINE Messaging API และ Google Sheets
- `gas/Code.gs` - โค้ดฝั่งเซิร์ฟเวอร์ Google Apps Script พร้อม Delta Sync, Cross-Request CacheService, LINE OTP Password Reset และ Timed Suspension/Hard Delete (v2.8.0)
- `gas/appsscript.json` - ค่าคอนฟิกโปรเจกต์ Apps Script (Asia/Bangkok, V8 Runtime)

## ประวัติการปรับปรุงระบบ (Patch Notes)
ดูรายละเอียดการพัฒนาทั้งหมดในแต่ละเวอร์ชันได้ที่ [PATCHNOTES.md](file:///c:/Calendar/PATCHNOTES.md) หรือคลิกป้ายเวอร์ชัน `v2.8.0` บนแถบด้านบนของหน้าเว็บแอปพลิเคชัน
