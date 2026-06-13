# เชื่อมระบบขนมแม่ ↔ FoodStory (owner.foodstory.co)

สถานะ: **Phase Discovery** — กำลังถอดโครง API จากเบราว์เซอร์ (2026-06-13)

## สิ่งที่รู้แล้ว (ตรวจสอบจริง)

- owner.foodstory.co = เว็บพอร์ทัลเจ้าของร้าน FoodStory · ผลิตภัณฑ์ของ **LINE MAN Wongnai** (© Wongnai Media)
- หลังบ้านเป็น **REST API + OAuth2** · auth host: `fs-owner-auth-api.foodstory.co/v1/oauth2/...`
- ฟีเจอร์ที่ดึงได้: Orders / E-Bill / **Inventory** / **Business Reports**
- **ไม่มี public/partner API ที่สมัครเองได้** → ตัดสินใจ: ใช้ **private API** (OAuth2 เดียวกับพอร์ทัล) ด้วยบัญชีร้านเราเอง
- ความเสี่ยงที่รับไว้: อาจผิด ToS · เปราะ (FoodStory อัปเดตแล้วพัง) → แยกเป็นโมดูล adapter ให้กระทบวงแคบ

## โมเดลที่จะสร้าง (POS-agnostic — schema เตรียมไว้แล้ว)

```
FoodStory API ──(adapter)──► record_sale(source='pos', pos_ref=<txn id>)  [idempotent]
                                   │
                                   ├─ map menu_items.pos_code ↔ FoodStory item id
                                   └─ log → pos_sync_log
```

- `sales.pos_ref` unique → กันบันทึกซ้ำ · `record_sale` คืน id เดิมถ้า pos_ref ซ้ำ
- endpoint ที่วางไว้: `app/api/pos/sale` (รับ/ดึงยอดขาย), `app/api/pos/stock` (กระทบยอดสต็อก)

## ขั้นตอน capture API (ต้องให้เจ้าของร้านทำ — ผมล็อกอินแทนไม่ได้)

1. เปิด Chrome → ล็อกอิน owner.foodstory.co ให้เรียบร้อย **ก่อน** (กันรหัสผ่านหลุดเข้า log)
2. กด `F12` → แท็บ **Network** → ติ๊ก **Preserve log** → กดถังขยะล้าง log
3. เข้าหน้า **รายงานยอดขาย / Bills** เลือกช่วงวันที่ 1 วัน → รอโหลดเสร็จ
4. เข้าหน้า **Inventory / สต็อก** → รอโหลดเสร็จ
5. คลิกขวาในแท็บ Network → **Save all as HAR with content** → เซฟไฟล์
6. วางไฟล์ไว้ที่ `deploy/docs/foodstory.har` (ไฟล์นี้ถูก gitignore แล้ว — ไม่ขึ้น git)

⚠ **HAR มี bearer token ของคุณอยู่ข้างใน** (อายุสั้น หมดอายุเอง) — ถือว่าเป็นความลับ อย่า commit/อย่าแชร์ที่อื่น
ถ้าเผลอ capture ตอนล็อกอิน (มี email/password) → เปลี่ยนรหัสผ่านหลังเสร็จ

## สิ่งที่ผมจะถอดจาก HAR

- auth: endpoint ขอ/ต่ออายุ token (OAuth2 grant แบบไหน, refresh token ไหม)
- sales/bills: endpoint + query params (ช่วงวันที่/สาขา) + โครง JSON ของบิล/รายการ
- inventory: endpoint + โครงข้อมูลสต็อก
- header ที่จำเป็น (Authorization, branch id, ฯลฯ)
