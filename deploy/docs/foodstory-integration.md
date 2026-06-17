# เชื่อมระบบขนมแม่ ↔ FoodStory (owner.foodstory.co)

สถานะ: **MVP ใช้งานได้** — sync เมนู+ยอดขายเข้า Supabase สำเร็จ (2026-06-14)

## วิธีใช้ (sync)

```bash
cd deploy
# 1) ใส่ FOODSTORY_COOKIE + FOODSTORY_CSRF ใน .env.local (copy จาก DevTools → getdata → Headers)
node scripts/foodstory_fetch.mjs      # ดูข้อมูลเฉย ๆ (ไม่เขียน DB)
node scripts/foodstory_sync.mjs --dry # พรีวิวสิ่งที่จะเขียน
node scripts/foodstory_sync.mjs       # เขียนจริง (upsert เมนู + record_sale + log)
```
- ช่วงเดือน: `--current` (เดือนนี้) · `--from=YYYY-MM --to=YYYY-MM` (ย้อนหลัง) · default = `FOODSTORY_YEAR/MONTH`
- idempotent: รันซ้ำไม่บันทึกยอดซ้ำ (pos_ref=`fs-<branch>-<date>`)

## เปิดตัดสต็อกอัตโนมัติ (BOM ชั้น 2)

`scripts/foodstory_link_recipes.mjs` pre-build ลิงก์ **เมนูเดี่ยว FoodStory → ถุงพรีมิกซ์** ไว้แล้ว
(17 ลิงก์, qty_stock=0 · ignore-duplicates รันซ้ำไม่ทับ · ข้ามคอมโบ/ไอศกรีม)
→ เจ้าของร้านเข้าหน้า **"สูตรขนม"** กรอก `qty_stock` ต่อเมนู (1 ถ้วย = กี่ถุง · เช่น 0.1 = 1 ถุงตัก 10 ถ้วย)
→ พอ qty_stock > 0 → `record_sale` ตัดสต็อกหน้าร้านอัตโนมัติทันที (เมนูคอมโบผูกหลายถุงเองในหน้าสูตร)

## รีเฟรช cookie (เมื่อหมดอายุ ~1-2 วัน)

⚠ login มี **reCAPTCHA** → auto-login เต็มรูปแบบทำไม่ได้ ต้อง login เอง (แก้ captcha) เป็นระยะ
แล้วใช้ helper อัปเดต cookie ให้ไว:
```bash
# DevTools → คลิกขวา request getdata → Copy → Copy as cURL (bash) → วางลงไฟล์ deploy/foodstory.curl.txt
cd deploy && node scripts/foodstory_setcookie.mjs   # แกะใส่ .env.local + ลบไฟล์ curl ทิ้งให้
```

## ตั้งเวลา sync อัตโนมัติ (Windows Task Scheduler)

`scripts/foodstory-sync.cmd` รัน sync เดือนปัจจุบัน + เขียน log ที่ `deploy/logs/foodstory-sync.log`
ลงตารางรันทุกวัน 21:00 (รันครั้งเดียวเพื่อสร้าง task):
```cmd
schtasks /create /tn "KanomMae FoodStory Sync" /tr "C:\Projects\ขนมแม่\deploy\scripts\foodstory-sync.cmd" /sc daily /st 21:00
```
- ตราบใดที่ cookie ยังไม่หมดอายุ → sync เองทุกวัน · พอ log ขึ้น "auth ไม่ผ่าน/เด้ง login" = ถึงเวลา refresh cookie
- ลบ task: `schtasks /delete /tn "KanomMae FoodStory Sync" /f`
- 🎯 ทางหายปวดหัวระยะยาว: ขอ **partner API จาก LINE MAN Wongnai** (ไม่มี captcha/session หมดอายุ)

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

## ผลการถอด API จาก HAR (Discovery เสร็จ — 2026-06-14)

พอร์ทัลเป็น **Laravel + jQuery DataTables (server-side)** — ไม่ใช่ REST/v1 ตามที่เดา
auth ของ data endpoint = **session cookie + CSRF token** (ไม่ใช่ OAuth2 bearer; OAuth2 ใช้แค่ตอน login เข้าพอร์ทัล)

### Endpoints (host: `https://owner.foodstory.co`)

| # | method | path | body | หน้าที่ |
|---|--------|------|------|--------|
| 1 | POST | `/api/setTimeLenght` | `year=2026` | ตั้งปีของรายงาน (เก็บใน session) |
| 2 | POST | `/api/setMonthLenght` | `month=6` | ตั้งเดือนของรายงาน (เก็บใน session) |
| 3 | POST | `/salebyproductdaily/getdata` | DataTables (draw/start/length/columns) | **ดึงยอดขายรายสินค้าต่อวัน** ของเดือนที่ตั้งไว้ |

→ ช่วงวันที่เป็น **stateful**: ยิง 1+2 ตั้งเดือนก่อน แล้ว 3 คืนข้อมูลทั้งเดือนนั้น

### Headers ที่จำเป็น(data endpoint)

- `Cookie: <session>` — laravel session (httpOnly · Chrome ตัดออกจาก HAR · ต้อง copy เองจาก DevTools)
- `X-CSRF-Token: <token>` — เห็นใน request header
- `X-Requested-With: XMLHttpRequest`
- `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`

### โครง response (JSON — DataTables)

```
{ draw, recordsTotal, recordsFiltered, data: [ row... ] }
```
row สำคัญ: `show_dt`(วันที่) · `menu_id`(รหัส FS คงที่) · `product_name` · `product_code`(B6,C2..) ·
`category` · `sales_volumn`(จำนวนขาย) · `gross_sales` · `avg_price` · `discount` · `discounted_price` ·
`branch_id` · `branch_name` · `cost`(=0 เพราะ FS ไม่ได้ใส่ต้นทุน — เราคิดเองจาก avg_cost)

### หมายเหตุสำคัญ

- **เป็นยอด aggregate ต่อวัน/ต่อสินค้า** (ไม่ใช่รายบิล) → 1 วัน = หลายแถว (แถวละสินค้า)
- **branch_name ในบัญชีนี้ = "สาขาตลาดกัลปพฤกษ์"** (≠ "ภัณฑ์ทวี545" ใน seed) ⚠ ต้องยืนยันว่าใช้สาขาไหน
- map สินค้า: ใช้ `menu_id` (คงที่) → เก็บใน `menu_items.pos_code` · เริ่มแรกต้อง build mapping ครั้งเดียว

## แผน MVP (auth แบบ manual cookie ก่อน)

1. ผู้ใช้ copy `Cookie` + `X-CSRF-Token` จาก DevTools (request getdata → tab Headers) → ใส่ `.env.local`
2. สคริปต์ `scripts/foodstory_fetch.mjs` ยิง setTime/setMonth + getdata → ดึงข้อมูลจริงมาตรวจ
3. (เฟสถัดไป) map menu_id → menu_items + เรียก `record_sale(source='pos', pos_ref='fs-<branch>-<date>')` idempotent
4. (ถ้าจำเป็น) ค่อยลงทุนทำ auto-login แทน copy cookie มือ
