-- seed_recipes.sql — สูตรขนม (BOM) จากคู่มือ "วิธีการตักขนม" (PDF หน้า 33-35)
-- รันหลัง seed_ingredients.sql + seed_menu.sql
--
-- ▶ qty_display : ปริมาณตามคู่มือ — ใช้เป็นข้อมูลอ้างอิงให้พนักงาน
-- ▶ qty_stock   : ปริมาณในหน่วยสต็อก ใช้ "ตัดสต็อกอัตโนมัติ" ตอนบันทึกขาย (record_sale)
--
-- ⚠ qty_stock ที่ยังเป็น 0 = ต้องให้เจ้าของร้านยืนยัน "อัตราแปลงหน่วยตัก → หน่วยสต็อก"
--   เช่น กะทิเสริมขนมไทย 1 ถุง ตักได้กี่กระบวย, ไอศกรีม 1 ก้อน (3กก.) ได้กี่ลูก
--   ระหว่างที่ qty_stock = 0 ระบบจะไม่ตัดสต็อกรายการนั้น (แต่ยังบันทึกยอดขายปกติ)
--
-- ใช้ join แบบ LIKE — แถวที่หาวัตถุดิบ/เมนูไม่เจอจะถูกข้ามไปเอง (ไม่ error)

insert into recipes (menu_item_id, ingredient_id, qty_stock, qty_display, note)
select m.id, i.ingredient_id, x.qty_stock, x.qty_display, x.note
from (values
  -- MENU-001 บัวลอยมีไส้ น้ำกะทิ
  ('MENU-001', 'บัวลอยมีไส้%',        0.0500, '5 ลูก',      '1 ถุง = 100 ลูก'),
  ('MENU-001', 'กะทิเสริมขนมไทย%',    0.0,    '2 กระบวย',   'TODO: qty_stock — กระบวย/ถุง'),
  -- MENU-002 บัวลอยมีไส้ น้ำแข็งใส
  ('MENU-002', 'บัวลอยมีไส้%',        0.0500, '5 ลูก',      '1 ถุง = 100 ลูก'),
  ('MENU-002', 'น้ำเชื่อม%',          0.0,    '1 กระบวย',   'TODO: qty_stock — กระบวย/ถุง'),
  -- MENU-003 บัวลอยมีไส้ ไอศกรีมกะทิสด
  ('MENU-003', 'บัวลอยมีไส้%',        0.0500, '5 ลูก',      '1 ถุง = 100 ลูก'),
  -- MENU-109 ฟักทองแกงบวด
  ('MENU-109', 'ฟักทองเชื่อม%',       0.0,    '1 ท้อปปิ้ง', 'TODO: qty_stock — ท้อปปิ้ง/แพ็ค'),
  ('MENU-109', 'กะทิเสริมขนมไทย%',    0.0,    '2 กระบวย',   'TODO: qty_stock — กระบวย/ถุง'),
  -- MENU-110 มันแกงบวด
  ('MENU-110', 'มันเชื่อม%',          0.0,    '1 ท้อปปิ้ง', 'TODO: qty_stock — ท้อปปิ้ง/แพ็ค'),
  ('MENU-110', 'กะทิเสริมขนมไทย%',    0.0,    '2 กระบวย',   'TODO: qty_stock — กระบวย/ถุง'),
  -- MENU-401 ปังปิ้ง ราดซอสกะทิอัญชัน
  ('MENU-401', 'ขนมปัง ARO%',         0.0,    '1 แผ่น',     'TODO: qty_stock — แผ่น/ถุง'),
  ('MENU-401', 'ซอสกะทิอัญชัน%',      0.0,    '1 กระบวย',   'TODO: qty_stock — กระบวย/ถุง')
) as x(menu_id, ing_pattern, qty_stock, qty_display, note)
join menu_items  m on m.menu_id = x.menu_id
join ingredients i on i.name like x.ing_pattern
on conflict (menu_item_id, ingredient_id) do nothing;
