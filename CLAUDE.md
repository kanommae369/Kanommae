# CLAUDE.md — ขนมแม่ (ระบบจัดการสต็อก)

ระบบจัดการสต็อกวัตถุดิบ · สูตรขนม · ยอดขาย สำหรับร้านขนมหวานไทย "ขนมแม่"
สาขาภัณฑ์ทวี545 — clone + adapt มาจากโปรเจกต์ DivisionX Card

## Quick Start

```bash
cd deploy
cp .env.example .env.local        # กรอกค่าจาก Supabase project ใหม่
npm install
npm run dev                       # http://localhost:3000
```

ติดตั้งฐานข้อมูล (Supabase SQL Editor — รันตามลำดับ):
1. `supabase/schema.sql` — สร้าง table + view + function + RLS
2. `supabase/seed_ingredients.sql` — วัตถุดิบ 95 รายการ
3. `supabase/seed_opening_stock.sql` — ยอดสต็อกตั้งต้น
4. `supabase/seed_menu.sql` — เมนูขาย
5. `supabase/seed_recipes.sql` — สูตรขนม (BOM)

## สถาปัตยกรรม

```
┌──────────────────────────────────────────────┐
│   Next.js 14 (Vercel)  ·  React 18 · Tailwind │
│   deploy/components/KanomMaeApp.jsx           │
└────────────────────┬─────────────────────────┘
                     │  lib/supabase.js
                     ▼
┌──────────────────────────────────────────────┐
│            Supabase (PostgreSQL)              │
│  branches · ingredients · menu_items ·        │
│  recipes(BOM) · stock_in · stock_transfers ·  │
│  stock_out · sales · sale_items · claims ·    │
│  profiles · login_history                     │
└──────────────────────────────────────────────┘
```

ไม่มี VMS / scraper / GitHub Actions sync แบบ DivisionX — ร้านขนมแม่เป็นหน้าร้าน
มีพนักงานตัก ยอดขายบันทึก manual (หรือต่อ POS ภายหลัง)

## ต่างจาก DivisionX Card อย่างไร

| DivisionX Card | ขนมแม่ |
|---|---|
| `machines` (ตู้ขายอัตโนมัติ) | `branches` (สาขา — ตอนนี้สาขาเดียว) |
| `skus` (สินค้าสำเร็จ = ซอง) | `ingredients` (วัตถุดิบ) + `menu_items` (เมนูขาย) |
| ขาย SKU ตรง ๆ | `recipes` — 1 เมนู ประกอบจากวัตถุดิบหลายชิ้น (BOM) |
| VMS sync ยอดขาย/สต็อก | บันทึก `sales` manual → `record_sale()` ตัดสต็อกตามสูตร |
| supplier เดียว | `ingredients.source` = HQ / SSB / MARKET |
| ไม่มีวันหมดอายุ | `stock_in.expiry_date` + `is_perishable` |
| main stock → admin sub-stock | `stock_transfers` — คลังที่บ้าน → หน้าร้าน |

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|------|--------|
| `deploy/components/KanomMaeApp.jsx` | Component หลัก (ตอนนี้เป็น scaffold shell) |
| `deploy/lib/supabase.js` | Supabase client + query function ทั้งหมด |
| `deploy/supabase/schema.sql` | Schema + view + function + RLS |
| `deploy/supabase/seed_*.sql` | ข้อมูลตั้งต้น (auto-gen จาก Excel/PDF) |
| `deploy/scripts/extract_seed.py` | สคริปต์แปลง `ร้านขนมแม่.xlsx` → seed SQL |
| `deploy/components/shared/constants.js` | หมวด/แหล่ง/ช่องทาง/หน่วย |
| `deploy/components/shared/design-tokens.js` | Dark navy + neon cyan theme (จาก DivisionX) |

## โมเดลสต็อก 2 ชั้น

```
รับของเข้า          โอน              ใช้/ขาย/เสีย
stock_in    ──►  stock_transfers ──►  stock_out
(คลังที่บ้าน)      (→ หน้าร้าน)        (หน้าร้าน)
```

View `v_stock_balance` คำนวณ:
- `home_balance` = รับเข้า − โอนไปร้าน − ตัด(home)
- `shop_balance` = โอนไปร้าน − ตัด(shop)
- `reorder` เตือนเมื่อ balance ≤ `min_stock`

## ระบบต้นทุน (Moving Average — เหมือน DivisionX)

- `ingredients.avg_cost` = ต้นทุนเฉลี่ยเคลื่อนที่ ต่อวัตถุดิบ
- อัปเดตเมื่อรับของเข้า · เรียก `recalc_ingredient_avg_cost()` หลังแก้ไข/ลบ stock_in
- ต้นทุนต่อเมนู = Σ(`recipe.qty_stock` × `ingredient.avg_cost`) → view `v_menu_cost`

## Recipe / BOM

`recipes` ผูก `menu_item` ↔ `ingredient`:
- `qty_display` — ปริมาณตามคู่มือ ("5 ลูก", "2 กระบวย") ให้พนักงานอ้างอิง
- `qty_stock` — ปริมาณในหน่วยสต็อก ใช้ `record_sale()` ตัดสต็อกอัตโนมัติ

⚠ **qty_stock หลายรายการยังเป็น 0** — ต้องให้เจ้าของร้านยืนยันอัตราแปลงหน่วยตัก→หน่วยสต็อก
(เช่น กะทิเสริมขนมไทย 1 ถุง ตักได้กี่กระบวย) ระหว่างที่เป็น 0 ระบบบันทึกยอดขายปกติแต่ไม่ตัดสต็อกรายการนั้น

## บันทึกการขาย

`record_sale(channel, bill_no, items, sold_at, note)` — RPC atomic:
1. insert `sales` + `sale_items`
2. ตัดสต็อกหน้าร้านตาม `recipes` (`stock_out.reason = 'used'`, ผูก `from_sale_id`)

`items` = jsonb array: `[{ menu_item_id, quantity, unit_price }, ...]`

## การเชื่อมต่อ POS (Ocha / Wongnai POS)

ออกแบบให้ **POS-agnostic** — schema เตรียม POS-ready ไว้แล้ว:
- `menu_items.pos_code` / `ingredients.pos_code` — map รหัสสินค้าฝั่ง POS
- `sales.source` (`manual` | `pos` | `web`) + `sales.pos_ref` (เลขธุรกรรม POS, unique → กันบันทึกซ้ำ)
- `record_sale()` รับ `p_source` + `p_pos_ref` — ถ้า `pos_ref` ซ้ำจะคืน id เดิม ไม่ตัดสต็อกซ้ำ (idempotent)
- ตาราง `pos_sync_log` — log ทุกการ sync เข้า/ออก + error

ทิศทางที่ต้องการ: POS→เรา (ยอดขาย) · เรา→POS (เมนู/ราคา) · เรา→POS (สต็อกคงเหลือ)

⚠ **Ocha ไม่มี public REST API แบบเปิด** — ต้องเช็คกับ Ocha ว่าให้ partner API หรือไม่
ถ้าไม่ได้ → fallback เป็น import ไฟล์ export (CSV/Excel) แบบที่ DivisionX ทำกับ VMS
adapter จริงทำใน Phase 2 — endpoint ที่วางแผน: `app/api/pos/sale` (รับยอดขาย + API key),
`app/api/pos/menu` (ส่งเมนู), `app/api/pos/stock` (ส่งสต็อก)

## สถานะงาน (Phase)

- ✅ **Phase 1 (scaffold)** — โครงสร้างโปรเจกต์ + schema + seed + lib/supabase.js + shell UI
- ✅ Theme — Light · Navy & Pastel (prefix `km-`) · UI mobile-responsive
- ✅ PWA — manifest + service worker + ไอคอนจากโลโก้จริง (ติดตั้งบนมือถือได้)
- ✅ Schema POS-ready (pos_code, source, pos_ref, pos_sync_log, idempotent record_sale)
- ⬜ **Phase 2** — พอร์ต UI page logic จาก DivisionX (`components/pages/*`):
  Dashboard, จัดการสต็อก, โอนเข้าร้าน, วัตถุดิบ, สูตรขนม, บันทึกขาย, เคลม, วิเคราะห์, ผู้ใช้
- ⬜ POS adapter (Ocha) — ต้องรู้ก่อนว่า Ocha ให้ API หรือต้อง import ไฟล์
- ⬜ ยืนยัน `qty_stock` ในสูตร + เพิ่ม recipe ครบทุกเมนู
- ⬜ Auth: login ด้วย username (พอร์ต `app/api/auth/lookup-email` จาก DivisionX)

## หมายเหตุข้อมูล seed

- `seed_ingredients.sql` / `seed_opening_stock.sql` — auto-gen จาก `ร้านขนมแม่.xlsx`
  รันใหม่ได้ด้วย `py deploy/scripts/extract_seed.py`
- ราคาเมนูใน `seed_menu.sql` อ่านจากรูปเมนูใน PDF — **ควรให้เจ้าของร้านยืนยัน**
- ชื่อวัตถุดิบบางรายการมี typo ติดมาจาก Excel ต้นฉบับ (เช่น "กล้วยขวชชี") — แก้ได้ในหน้าวัตถุดิบ
