# คู่มือการติดตั้งและตั้งค่าระบบแจ้งเตือนนัดคิวทำงาน (SETUP_GUIDE.md)

เอกสารนี้อธิบายขั้นตอนการเชื่อมโยง **หน้าเว็บแอป (`C:\Calendar`)**, **Google Sheets + Google Apps Script (`gas/Code.gs`)**, และ **LINE Official Account (LINE Messaging API)** สำหรับทีมขนาด 2-3 คน

---

## ขั้นตอนที่ 1: เตรียมบัญชี LINE Official Account (LINE OA)

1. เข้าไปที่ [LINE Official Account Manager](https://manager.line.biz/) และสร้างบัญชีใหม่สำหรับใช้งานระบบนัดคิวนี้โดยเฉพาะ (ไม่ควรใช้ร่วมกับบัญชีที่มีระบบอื่นผูก Webhook อยู่แล้ว เพราะ 1 บัญชีตั้งได้เพียง 1 Webhook URL และใช้โควตา 300 ข้อความ/เดือนร่วมกัน)
2. ไปที่เมนู **ตั้งค่า (Settings) -> การตอบกลับ (Response settings)**:
   * **ข้อความทักทายเพื่อนใหม่ (Greeting message):** ตั้งเป็น **ปิด (Disabled)**
   * **ข้อความตอบกลับอัตโนมัติ (Auto-response):** ตั้งเป็น **ปิด (Disabled)**
   * **Webhook:** ตั้งเป็น **เปิด (Enabled)**
3. ไปที่เมนู **Messaging API** แล้วกดเปิดใช้งาน (Enable Messaging API) จากนั้นเข้าไปที่ [LINE Developers Console](https://developers.line.biz/console/):
   * ในแท็บ **Messaging API** เลื่อนลงมาที่หัวข้อ **Channel access token (long-lived)** แล้วกด **Issue** เพื่อคัดลอก Token เก็บไว้

---

## ขั้นตอนที่ 2: สร้าง Google Sheets และวางโค้ด Google Apps Script

1. สร้างไฟล์ Google Sheets ใหม่บน Google Drive ของเจ้าของระบบ
2. ไปที่เมนู **Extensions (ส่วนขยาย) -> Apps Script**
3. คลิกที่ไอคอน **ฟันเฟือง (Project Settings)** ด้านซ้าย:
   * ติ๊กถูกที่ช่อง **Show "appsscript.json" manifest file in editor**
4. กลับมาที่หน้า **Editor (`< >`)**:
   * เปิดไฟล์ `appsscript.json` แล้วนำเนื้อหาจากไฟล์ `C:\Calendar\gas\appsscript.json` ไปวางทับ (เพื่อบังคับเขตเวลา `Asia/Bangkok`)
   * เปิดไฟล์ `Code.gs` แล้วนำเนื้อหาทั้งหมดจากไฟล์ `C:\Calendar\gas\Code.gs` ไปวางทับ กดบันทึก (Ctrl+S)
5. เลือกฟังก์ชัน `setupDatabase` จากแถบด้านบนแล้วกด **Run** (ระบบจะขอสิทธิ์เข้าถึง Google Sheets ให้กดอนุญาต) ระบบจะสร้างแผ่นงานทั้ง 5 แผ่น (`Users`, `Appointments`, `RescheduleLogs`, `NotificationLogs`, `SystemMeta`) พร้อมตั้งฟอร์แมตคอลัมน์เป็น **Plain Text (`@`)** และสร้างบัญชีเริ่มต้น (`admin` / `somchai` / `wipada`) ให้อัตโนมัติ

---

## ขั้นตอนที่ 3: ตั้งค่าความลับใน Script Properties (ห้ามใส่ในชีต)

1. ในหน้า Apps Script คลิกที่ไอคอน **ฟันเฟือง (Project Settings)** ด้านซ้าย
2. เลื่อนลงมาล่างสุดที่หัวข้อ **Script Properties** แล้วกด **Add script property** เพื่อเพิ่มตัวแปรดังนี้:
   * `LINE_CHANNEL_ACCESS_TOKEN` : ใส่ Channel Access Token ที่ได้จากขั้นตอนที่ 1
   * `API_PASSCODE` : ตั้งรหัสผ่านสำหรับทีม 2-3 คน (เช่น `TEAM-CAL-2026`) ใช้สำหรับกรอกในหน้าเว็บแอปเพื่อยืนยันตัวตน
   * `WEBHOOK_SECRET_KEY` : ตั้งรหัสลับสำหรับแนบท้ายลิงก์ Webhook (เช่น `WHSEC998877`)
   * `LINE_TARGET_ID` : ใส่ `groupId` ของกลุ่มแชททีม (ดูวิธีหา `groupId` ในขั้นตอนที่ 5)
   * `ALLOWED_GROUP_IDS` : ใส่ `groupId` ของกลุ่มแชททีมที่อนุญาตให้พิมพ์คำสั่ง `คิว ...` (คั่นด้วยเครื่องหมายจุลภาค `,` หากมีหลายกลุ่ม)
   * `ALLOWED_USER_IDS` : (ทางเลือก) ใส่ `userId` ของสมาชิกในทีมหากต้องการให้ทักแชทส่วนตัวกับบอทได้ด้วย
3. กด **Save script properties**

---

## ขั้นตอนที่ 4: การ Deploy Web App และการอัปเดตเวอร์ชันโดยไม่ให้ URL เปลี่ยน

1. ในหน้า Apps Script กดปุ่ม **Deploy (มุมขวาบน) -> New deployment**
2. คลิกไอคอนฟันเฟืองเลือกประเภทเป็น **Web app**:
   * **Description:** `Calendar API v2.0`
   * **Execute as:** `Me` (บัญชีเจ้าของสคริปต์)
   * **Who has access:** `Anyone`
3. กด **Deploy** แล้วคัดลอก **Web app URL** (`https://script.google.com/macros/s/.../exec`) เก็บไว้

> **ข้อควรระวังเมื่อแก้ไขโค้ดในอนาคต:**
> ห้ามกด *New deployment* ซ้ำ เพราะจะได้ URL ใหม่และทำให้ Webhook กับหน้าเว็บหลุดการเชื่อมต่อ ให้ไปที่ **Deploy -> Manage deployments -> คลิกไอคอนดินสอ (Edit) -> เลือก Version เป็น "New version" -> กด Deploy** เสมอ เพื่อให้ URL เดิมทำงานต่อเนื่อง

---

## ขั้นตอนที่ 5: ผูก Webhook กับ LINE และดึงค่า `groupId` ของกลุ่มทีมงาน

1. นำ **Web app URL** ที่ได้จากขั้นตอนที่ 4 มาต่อท้ายด้วย `?webhookKey=รหัสที่ตั้งไว้` เช่น:
   `https://script.google.com/macros/s/AKfycb.../exec?webhookKey=WHSEC998877`
2. นำ URL นี้ไปวางในช่อง **Webhook URL** ใน LINE Developers Console แล้วกด **Update** และเปิดสวิตช์ **Use webhook** (รวมถึงเปิด *Allow bot to join group chats* ในตั้งค่าบัญชี)
3. เชิญบอทเข้าสู่กลุ่ม LINE ของทีม (สมาชิก 2-3 คน)
4. เปิดดูแผ่นงาน **`NotificationLogs`** ใน Google Sheets จะพบบันทึกแถว `WEBHOOK_JOIN_DISCOVERY` ซึ่งแสดงค่า `groupId` (ขึ้นต้นด้วยตัว `C...`)
5. คัดลอกค่า `C...` นั้นไปใส่ใน **Script Properties** ที่ช่อง `LINE_TARGET_ID` และ `ALLOWED_GROUP_IDS`

---

## ขั้นตอนที่ 6: เปิดใช้งานตัวตั้งเวลาแจ้งเตือนอัตโนมัติ (Trigger ทุก 15 นาที)

1. ในหน้า Apps Script Editor เลือกฟังก์ชัน `installTriggerEvery15Minutes` จากแถบด้านบน แล้วกด **Run**
2. ตรวจสอบที่เมนู **Triggers (รูปนาฬิกาด้านซ้าย)** จะเห็นฟังก์ชัน `runNotificationEngine` ทำงานแบบ Time-driven ทุกๆ 15 นาที
3. แนะนำให้คลิกจุดสามจุดท้าย Trigger เพื่อตั้งค่า **Failure notification settings** เป็น *Notify me immediately* เพื่อให้ส่งอีเมลแจ้งเจ้าของสคริปต์ทันทีหากเกิดข้อผิดพลาด

---

## ขั้นตอนที่ 7: การเปิดใช้งานหน้าเว็บแอปบนคอมพิวเตอร์และมือถือ

1. เปิดไฟล์ `C:\Calendar\index.html` บนเบราว์เซอร์ (หรืออัปโหลดโฟลเดอร์ขึ้น Static Host เช่น GitHub Pages / Cloudflare Pages เพื่อให้เปิดผ่านลิงก์ HTTPS บนมือถือได้จากทุกที่)
2. ไปที่แท็บ **[ตั้งค่าการเชื่อมต่อและโควตา LINE]** บนหน้าเว็บแอป:
   * กรอก **GAS Web App URL** และ **API Passcode** ของทีม
   * เลือกชื่อผู้ใช้งานของคุณ แล้วกด **บันทึกและซิงก์ข้อมูล**
   * สามารถกดปุ่ม **[ทดสอบตรวจสอบข้อความ (ไม่เสียโควตา)]** เพื่อทดสอบการเชื่อมต่อกับ LINE API ผ่าน `/v2/bot/message/validate/push` ได้ทันที

