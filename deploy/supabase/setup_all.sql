-- ============================================================
-- ขนมแม่ — Setup ทั้งหมดในไฟล์เดียว
-- วิธีใช้: Supabase → SQL Editor → New query → paste ทั้งหมด → Run
-- (รวม schema + seed 4 ไฟล์ ตามลำดับที่ถูกต้อง)
-- ============================================================


-- ╔══════════════════════════════════════════════════════════
-- ║  schema.sql
-- ╚══════════════════════════════════════════════════════════
-- ================================================================
-- ขนมแม่ — Supabase Schema (v1)
-- ระบบจัดการสต็อกวัตถุดิบ · สูตรขนม (recipe/BOM) · ยอดขาย · เคลม
-- วิธีใช้: Copy ทั้งหมด → วางใน Supabase SQL Editor → Run
--          จากนั้นรัน seed_ingredients.sql และ seed_opening_stock.sql ต่อ
-- ================================================================

-- ── 1. BRANCHES ───────────────────────────────────────────────
-- ตอนนี้ใช้สาขาเดียว (ภัณฑ์ทวี545) แต่เตรียม table ไว้รองรับหลายสาขา
create table if not exists branches (
  id        serial primary key,
  branch_id text unique not null,
  name      text not null,
  location  text,
  status    text not null default 'active'
);

-- ── 2. INGREDIENTS (วัตถุดิบ / ส่วนผสม — แทน skus ของ DivisionX) ─
-- category : thai_mix | frozen | ssb | market | packaging
-- source   : HQ (สำนักงานใหญ่) | SSB (สินสมบูรณ์) | MARKET (ตลาด)
-- avg_cost : ต้นทุนเฉลี่ยเคลื่อนที่ (moving average) — อัปเดตเมื่อรับของเข้า
create table if not exists ingredients (
  id             serial primary key,
  ingredient_id  text unique not null,
  name           text not null,
  category       text not null default 'thai_mix',
  source         text not null default 'HQ',
  unit           text not null default 'ถุง',
  avg_cost       numeric(10,2) not null default 0,
  min_stock      numeric(10,2) not null default 0,
  reorder_qty    numeric(10,2) not null default 0,
  is_perishable  boolean not null default false,
  shelf_life_days int,
  pos_code       text,                      -- รหัสฝั่ง POS — ใช้ตอน sync สต็อกคงเหลือกลับเข้า POS
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ── 3. MENU_ITEMS (เมนูขายหน้าร้าน) ───────────────────────────
-- category: signature | icecream | namkhaengsai | khanomthai
--           pingping | khanompang | drink | icecream_cup
create table if not exists menu_items (
  id         serial primary key,
  menu_id    text unique not null,
  name       text not null,
  category   text not null default 'khanomthai',
  price      numeric(10,2) not null default 0,
  pos_code   text,                          -- รหัสสินค้าฝั่ง POS (Ocha) — ใช้ map ยอดขายเข้า/ส่งเมนูออก
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── 4. RECIPES (BOM — เมนู 1 อย่าง ประกอบจากวัตถุดิบหลายชิ้น) ──
-- qty_stock   : ปริมาณในหน่วยสต็อกของวัตถุดิบ (ใช้ตัดสต็อก + คิดต้นทุน)
-- qty_display : ข้อความอ้างอิงให้พนักงาน เช่น "5 ลูก", "2 กระบวย"
create table if not exists recipes (
  id            serial primary key,
  menu_item_id  int  not null references menu_items(id) on delete cascade,
  ingredient_id text not null references ingredients(ingredient_id),
  qty_stock     numeric(12,4) not null default 0,
  qty_display   text,
  note          text,
  unique (menu_item_id, ingredient_id)
);

-- ── 5. STOCK IN (รับวัตถุดิบเข้าคลังที่บ้าน) ──────────────────
create table if not exists stock_in (
  id            serial primary key,
  ingredient_id text not null references ingredients(ingredient_id),
  source        text not null default 'HQ',
  lot_number    text,
  unit          text not null default 'ถุง',
  quantity      numeric(12,2) not null check (quantity > 0),
  unit_cost     numeric(10,2) not null default 0,
  total_cost    numeric(12,2) not null default 0,
  expiry_date   date,
  received_at   timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);

-- ── 6. STOCK TRANSFERS (โอนจากคลังที่บ้าน → หน้าร้าน) ─────────
create table if not exists stock_transfers (
  id             serial primary key,
  ingredient_id  text not null references ingredients(ingredient_id),
  lot_number     text,
  unit           text not null default 'ถุง',
  quantity       numeric(12,2) not null check (quantity > 0),
  transferred_at timestamptz not null default now(),
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);

-- ── 7. STOCK OUT (ตัดสต็อก: ใช้ผลิต / ของเสีย / หมดอายุ / เคลม) ─
-- location : home | shop   — ตัดจากคลังไหน
-- reason   : used | waste | expired | claim
create table if not exists stock_out (
  id            serial primary key,
  ingredient_id text not null references ingredients(ingredient_id),
  location      text not null default 'shop',
  unit          text not null default 'ถุง',
  quantity      numeric(12,2) not null check (quantity > 0),
  reason        text not null default 'used',
  from_claim_id int,
  from_sale_id  int,
  withdrawn_at  timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);

-- ── 8. SALES + SALE ITEMS (บันทึกขาย — manual / POS) ──────────
-- channel : dine_in | takeaway | delivery
-- source  : manual (คีย์ในเว็บ) | pos (ดึงจาก POS Ocha) | web
-- pos_ref : เลขอ้างอิงธุรกรรมจาก POS — ใช้กันบันทึกซ้ำ (idempotency)
create table if not exists sales (
  id         serial primary key,
  bill_no    text,
  channel    text not null default 'dine_in',
  source     text not null default 'manual',
  pos_ref    text,
  total      numeric(12,2) not null default 0,
  sold_at    timestamptz not null default now(),
  note       text,
  created_at timestamptz not null default now()
);
-- กันยอดขายจาก POS เข้าซ้ำ (pos_ref ต้องไม่ซ้ำ เมื่อมีค่า)
create unique index if not exists uq_sales_pos_ref on sales(pos_ref) where pos_ref is not null;

create table if not exists sale_items (
  id           serial primary key,
  sale_id      int not null references sales(id) on delete cascade,
  menu_item_id int not null references menu_items(id),
  quantity     int not null default 1 check (quantity > 0),
  unit_price   numeric(10,2) not null default 0,
  line_total   numeric(12,2) not null default 0
);

-- ── 9. CLAIMS (เคลม / คืนเงิน) ─────────────────────────────────
-- status : returned (คืนสต็อก) | damaged (ชำรุด) | lost (สูญหาย)
create table if not exists claims (
  id            serial primary key,
  claimed_at    date not null default current_date,
  channel       text,
  menu_item_id  int references menu_items(id),
  quantity      int not null default 1,
  refund_amount numeric(10,2) not null default 0,
  reason        text,
  status        text not null default 'returned',
  confirmed     boolean not null default false,
  note          text,
  created_at    timestamptz not null default now()
);

-- ── 10. PROFILES + LOGIN HISTORY (auth + role) ────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  email        text,
  display_name text,
  role         text not null default 'user',
  created_at   timestamptz not null default now()
);

create table if not exists login_history (
  id           serial primary key,
  user_id      uuid,
  email        text,
  display_name text,
  action       text not null default 'login',
  user_agent   text,
  created_at   timestamptz not null default now()
);

-- ── 11. POS SYNC LOG (บันทึกการเชื่อมต่อ POS — Ocha) ──────────
-- direction : inbound (POS→เรา: ยอดขาย) | outbound (เรา→POS: เมนู/ราคา/สต็อก)
-- kind      : sale | menu | price | stock
-- status    : ok | error | skipped (เช่น ขายซ้ำ pos_ref เดิม)
-- payload   : ข้อมูลดิบที่รับ/ส่ง — ไว้ตรวจสอบย้อนหลัง
create table if not exists pos_sync_log (
  id         serial primary key,
  direction  text not null,
  kind       text not null,
  status     text not null default 'ok',
  ref        text,                          -- pos_ref / menu_id / ingredient_id ที่เกี่ยวข้อง
  message    text,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_pos_sync_log_created on pos_sync_log(created_at desc);

-- ── INDEX ─────────────────────────────────────────────────────
create index if not exists idx_ingredients_category on ingredients(category);
create index if not exists idx_recipes_menu         on recipes(menu_item_id);
create index if not exists idx_recipes_ingredient   on recipes(ingredient_id);
create index if not exists idx_stock_in_ingredient  on stock_in(ingredient_id);
create index if not exists idx_stock_in_expiry      on stock_in(expiry_date);
create index if not exists idx_transfers_ingredient on stock_transfers(ingredient_id);
create index if not exists idx_stock_out_ingredient on stock_out(ingredient_id);
create index if not exists idx_sale_items_sale      on sale_items(sale_id);
create index if not exists idx_sale_items_menu      on sale_items(menu_item_id);
create index if not exists idx_sales_sold_at        on sales(sold_at desc);

-- ── VIEW: ยอดคงเหลือสต็อก แยกคลังที่บ้าน / หน้าร้าน ───────────
-- home_balance = รับเข้า − โอนไปร้าน − ตัด(home)
-- shop_balance = โอนไปร้าน − ตัด(shop)
create or replace view v_stock_balance as
select
  i.ingredient_id,
  i.name,
  i.category,
  i.source,
  i.unit,
  i.avg_cost,
  i.min_stock,
  i.reorder_qty,
  i.is_perishable,
  coalesce(si.qty, 0)                                              as total_in,
  coalesce(tr.qty, 0)                                              as total_transferred,
  coalesce(so_home.qty, 0)                                         as out_home,
  coalesce(so_shop.qty, 0)                                         as out_shop,
  coalesce(si.qty, 0) - coalesce(tr.qty, 0) - coalesce(so_home.qty, 0) as home_balance,
  coalesce(tr.qty, 0) - coalesce(so_shop.qty, 0)                    as shop_balance,
  coalesce(si.qty, 0) - coalesce(so_home.qty, 0) - coalesce(so_shop.qty, 0) as total_balance
from ingredients i
left join (select ingredient_id, sum(quantity) qty from stock_in        group by ingredient_id) si      on si.ingredient_id      = i.ingredient_id
left join (select ingredient_id, sum(quantity) qty from stock_transfers group by ingredient_id) tr      on tr.ingredient_id      = i.ingredient_id
left join (select ingredient_id, sum(quantity) qty from stock_out where location = 'home' group by ingredient_id) so_home on so_home.ingredient_id = i.ingredient_id
left join (select ingredient_id, sum(quantity) qty from stock_out where location = 'shop' group by ingredient_id) so_shop on so_shop.ingredient_id = i.ingredient_id
where i.is_active = true;

-- ── VIEW: ต้นทุนต่อเมนู (รวมจาก recipe × avg_cost) ────────────
create or replace view v_menu_cost as
select
  m.id            as menu_item_id,
  m.menu_id,
  m.name,
  m.category,
  m.price,
  coalesce(sum(r.qty_stock * i.avg_cost), 0) as cost,
  m.price - coalesce(sum(r.qty_stock * i.avg_cost), 0) as margin
from menu_items m
left join recipes r     on r.menu_item_id  = m.id
left join ingredients i on i.ingredient_id = r.ingredient_id
where m.is_active = true
group by m.id, m.menu_id, m.name, m.category, m.price;

-- ── VIEW: ยอดขายรายวัน ────────────────────────────────────────
create or replace view v_daily_sales as
select
  date(s.sold_at at time zone 'Asia/Bangkok') as sale_date,
  s.channel,
  si.menu_item_id,
  sum(si.quantity)   as total_qty,
  sum(si.line_total) as total_revenue
from sales s
join sale_items si on si.sale_id = s.id
group by date(s.sold_at at time zone 'Asia/Bangkok'), s.channel, si.menu_item_id;

-- ── FUNCTION: คำนวณ avg_cost ใหม่ (moving average จาก stock_in) ─
create or replace function recalc_ingredient_avg_cost(p_ingredient_id text)
returns void language plpgsql as $$
declare
  v_qty  numeric;
  v_cost numeric;
begin
  select sum(quantity), sum(total_cost)
    into v_qty, v_cost
  from stock_in
  where ingredient_id = p_ingredient_id;

  update ingredients
     set avg_cost = case when coalesce(v_qty,0) > 0
                         then round(v_cost / v_qty, 2)
                         else avg_cost end
   where ingredient_id = p_ingredient_id;
end $$;

-- ── FUNCTION: บันทึกการขาย + ตัดสต็อกวัตถุดิบตามสูตร (atomic) ──
-- p_items: jsonb array เช่น
--   [{"menu_item_id":1,"quantity":2,"unit_price":55}, ...]
create or replace function record_sale(
  p_channel text,
  p_bill_no text,
  p_items   jsonb,
  p_sold_at timestamptz default now(),
  p_note    text default null,
  p_source  text default 'manual',
  p_pos_ref text default null
) returns int language plpgsql as $$
declare
  v_sale_id int;
  v_total   numeric := 0;
  v_item    jsonb;
  v_line    numeric;
begin
  -- idempotency: ถ้ายอดขายจาก POS (pos_ref) เข้ามาแล้ว → คืน id เดิม ไม่ตัดสต็อกซ้ำ
  if p_pos_ref is not null then
    select id into v_sale_id from sales where pos_ref = p_pos_ref;
    if found then
      return v_sale_id;
    end if;
  end if;

  insert into sales (bill_no, channel, source, pos_ref, total, sold_at, note)
  values (p_bill_no, p_channel, coalesce(p_source,'manual'), p_pos_ref, 0, p_sold_at, p_note)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line := (v_item->>'quantity')::int * (v_item->>'unit_price')::numeric;
    v_total := v_total + v_line;

    insert into sale_items (sale_id, menu_item_id, quantity, unit_price, line_total)
    values (v_sale_id,
            (v_item->>'menu_item_id')::int,
            (v_item->>'quantity')::int,
            (v_item->>'unit_price')::numeric,
            v_line);

    -- ตัดสต็อกวัตถุดิบหน้าร้านตามสูตร
    insert into stock_out (ingredient_id, location, unit, quantity, reason, from_sale_id, note)
    select r.ingredient_id, 'shop', i.unit,
           r.qty_stock * (v_item->>'quantity')::int,
           'used', v_sale_id,
           'ตัดตามสูตร: ' || m.name
    from recipes r
    join ingredients i on i.ingredient_id = r.ingredient_id
    join menu_items  m on m.id = r.menu_item_id
    where r.menu_item_id = (v_item->>'menu_item_id')::int
      and r.qty_stock > 0;
  end loop;

  update sales set total = v_total where id = v_sale_id;
  return v_sale_id;
end $$;

-- ── RLS Policies ─────────────────────────────────────────────
alter table branches        enable row level security;
alter table ingredients     enable row level security;
alter table menu_items      enable row level security;
alter table recipes         enable row level security;
alter table stock_in        enable row level security;
alter table stock_transfers enable row level security;
alter table stock_out       enable row level security;
alter table sales           enable row level security;
alter table sale_items      enable row level security;
alter table claims          enable row level security;
alter table login_history   enable row level security;
alter table pos_sync_log    enable row level security;

-- Phase A: อนุญาต anon อ่าน-เขียนได้ทุก table (เหมือน DivisionX ช่วงแรก)
-- หลัง go-live ค่อยรัดเป็น role-based เหมือน DivisionX RLS Phase B-D
create policy "allow_all_branches"   on branches        for all to anon using (true) with check (true);
create policy "allow_all_ingredients" on ingredients    for all to anon using (true) with check (true);
create policy "allow_all_menu_items" on menu_items      for all to anon using (true) with check (true);
create policy "allow_all_recipes"    on recipes         for all to anon using (true) with check (true);
create policy "allow_all_stock_in"   on stock_in        for all to anon using (true) with check (true);
create policy "allow_all_transfers"  on stock_transfers for all to anon using (true) with check (true);
create policy "allow_all_stock_out"  on stock_out       for all to anon using (true) with check (true);
create policy "allow_all_sales"      on sales           for all to anon using (true) with check (true);
create policy "allow_all_sale_items" on sale_items      for all to anon using (true) with check (true);
create policy "allow_all_claims"     on claims          for all to anon using (true) with check (true);
create policy "allow_all_login_hist" on login_history   for all to anon using (true) with check (true);
create policy "allow_all_pos_log"    on pos_sync_log    for all to anon using (true) with check (true);

-- profiles: อ่านได้ทุกคน · เขียนเฉพาะ authenticated
alter table profiles enable row level security;
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_write"  on profiles for all to authenticated using (true) with check (true);

-- ── SEED: สาขา ────────────────────────────────────────────────
insert into branches (branch_id, name, location, status) values
  ('phantawee545', 'ขนมแม่ — สาขาภัณฑ์ทวี545', 'ภัณฑ์ทวี545', 'active')
on conflict (branch_id) do nothing;


-- ╔══════════════════════════════════════════════════════════
-- ║  seed_ingredients.sql
-- ╚══════════════════════════════════════════════════════════
-- seed_ingredients.sql — master list วัตถุดิบ (auto-generated จาก ร้านขนมแม่.xlsx)
-- generated: 2026-05-14  ·  95 รายการ
-- รันหลัง schema.sql

insert into ingredients (ingredient_id, name, category, source, unit, avg_cost, min_stock, reorder_qty, is_perishable) values
  ('ING-0001', 'ข้าวเหนียวเปียกลำไย', 'thai_mix', 'HQ', 'ถุง', 25.00, 10.00, 30.00, true),
  ('ING-0002', 'เต้าส่วนมะพร้าวอ่อน', 'thai_mix', 'HQ', 'ถุง', 25.00, 10.00, 30.00, true),
  ('ING-0003', 'สาคูอัญชันมะพร้าวอ่อน', 'thai_mix', 'HQ', 'ถุง', 30.00, 10.00, 30.00, true),
  ('ING-0004', 'ข้้าวเหนียวเปียกดำ', 'thai_mix', 'HQ', 'ถุง', 20.00, 10.00, 30.00, true),
  ('ING-0005', 'ครองแครงมะพร้าวอ่อน', 'thai_mix', 'HQ', 'ถุง', 20.00, 10.00, 30.00, true),
  ('ING-0006', 'กล้วยขวชชี', 'thai_mix', 'HQ', 'ถุง', 20.00, 10.00, 30.00, true),
  ('ING-0007', 'บัวลอยอัญชัน 0.5 กก', 'thai_mix', 'HQ', 'ถุง', 15.00, 10.00, 40.00, true),
  ('ING-0008', 'บัวลอยอัญชัน 1 กก', 'thai_mix', 'HQ', 'ถุง', 20.00, 30.00, 120.00, true),
  ('ING-0009', 'กะทิเสริมขนมไทย', 'thai_mix', 'HQ', 'ถุง', 10.00, 50.00, 200.00, true),
  ('ING-0010', 'กะทิิเค็มปกติ', 'thai_mix', 'HQ', 'ถุง', 10.00, 20.00, 100.00, true),
  ('ING-0011', 'กะทิิเค็มเสริม', 'thai_mix', 'HQ', 'ถุง', 5.00, 10.00, 30.00, true),
  ('ING-0012', 'ซอสกะทิอัญชัน', 'thai_mix', 'HQ', 'ถุง', 15.00, 10.00, 30.00, true),
  ('ING-0013', 'น้ำตาลทราย', 'thai_mix', 'HQ', 'ถุง', 35.00, 10.00, 30.00, true),
  ('ING-0014', 'ข้าวเหนียวดำมูน', 'thai_mix', 'HQ', 'ถุง', 20.00, 10.00, 30.00, true),
  ('ING-0015', 'ข้าวเหนียวดำมูน(ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 10.00, 10.00, 30.00, true),
  ('ING-0016', 'ข้าวเหนียวเปียกลำไย (ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 13.00, 10.00, 30.00, true),
  ('ING-0017', 'ส่วนผสมข้าวเหนียวมูนขาว', 'thai_mix', 'HQ', 'ถุง', 20.00, 10.00, 30.00, true),
  ('ING-0018', 'ส่วนผสม ข้าวเกนียวมูนขาว (ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 10.00, 10.00, 30.00, true),
  ('ING-0019', 'เต้าส่วนมะพร้าวอ่อน (ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 13.00, 10.00, 30.00, true),
  ('ING-0020', 'สาคูอัญชันมะพร้าวอ่อน(ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 16.00, 10.00, 30.00, true),
  ('ING-0021', 'ข้าวเหนียวถั่วดำ (ครึ่งสูตร)', 'thai_mix', 'HQ', 'ถุง', 26.00, 10.00, 30.00, true),
  ('ING-0022', 'บัวลอยมีไส้ (1ถุง 100 ลูก )', 'frozen', 'HQ', 'แพ็ค', 330.00, 15.00, 50.00, true),
  ('ING-0023', 'บัวลอยอัญชันลูกเล็ก ( 1 ถุง 500 กรัม  )', 'frozen', 'HQ', 'แพ็ค', 55.00, 30.00, 100.00, true),
  ('ING-0024', 'บัวลอยพาสเทล', 'frozen', 'HQ', 'แพ็ค', 120.00, 20.00, 50.00, true),
  ('ING-0025', 'ฟักทองเชื่อม ( 1 ถุง 500 กรัม)', 'frozen', 'HQ', 'แพ็ค', 55.00, 5.00, 15.00, true),
  ('ING-0026', 'มันเชื่อม (1 ถุง 500 กรัม )', 'frozen', 'HQ', 'แพ็ค', 55.00, 5.00, 15.00, true),
  ('ING-0027', 'น้ำเชื่อม 1 กก', 'frozen', 'HQ', 'ถุง', 80.00, 0.00, 0.00, true),
  ('ING-0028', 'กะทิน้ำตาลเคี้ยว (1kg.)', 'frozen', 'HQ', 'ถุง', 90.00, 5.00, 5.00, true),
  ('ING-0029', 'ไส้มะพร้าวโรยหน้า 500 กรัม', 'frozen', 'HQ', 'ถุง', 120.00, 1.00, 2.00, true),
  ('ING-0030', 'ไอคกรีมกะทิอัญชั้น 1 กล่อง 3 กก.', 'frozen', 'HQ', 'ก้อน', 370.00, 8.00, 12.00, true),
  ('ING-0031', 'ไอคกรีมรวมมิตร 1 กล่อง 3 กก.', 'frozen', 'HQ', 'ก้อน', 400.00, 2.00, 6.00, true),
  ('ING-0032', 'ไอศกรีมถ้วย รสกะทิอัญชัน', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0033', 'ไอศกรีมถ้วย รสกะทิรวมมิตร', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0034', 'ไอศกรีมถ้วย รสกะทิชาไทย', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0035', 'ไอศกรีมถ้วย รสกะทิเผือก', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0036', 'ไอศกรีมถ้วย รสกะทิมะม่วง', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0037', 'ไอศกรีมถ้วย รสกะทิน้ำตาลโดนด', 'frozen', 'HQ', 'ถ้วย', 30.00, 5.00, 10.00, true),
  ('ING-0038', 'ข้าวเหนียวขาว - ไร่ทิพย์', 'ssb', 'SSB', 'ถุง', 42.00, 10.00, 30.00, false),
  ('ING-0039', 'ข้าวเหนียวดำ - ไร่ทิพย์', 'ssb', 'SSB', 'ถุง', 37.00, 5.00, 10.00, false),
  ('ING-0040', 'สาคู เม็ดเล็กสีขาว - ตราปลาไทย', 'ssb', 'SSB', 'ถุง', 24.00, 10.00, 30.00, false),
  ('ING-0041', 'ถั่วดำ เม็ดเล็ก ถุงสีม่วง - ไร่ทิทืพย์', 'packaging', 'SSB', 'ถุง', 56.00, 10.00, 30.00, false),
  ('ING-0042', 'ถั่ั่วเขียวเราะเปลือก - ไร่ทิพย์', 'ssb', 'SSB', 'ถุง', 39.00, 10.00, 30.00, false),
  ('ING-0043', 'แป้งมัน - ตราค้างคาวแดง 1 กก.', 'ssb', 'SSB', 'ถุง', 29.00, 5.00, 10.00, false),
  ('ING-0044', 'แป้้งข้าวเจ้า - ตราช้างสามเศียร 1 กก.', 'ssb', 'SSB', 'ถุง', 35.00, 5.00, 10.00, false),
  ('ING-0045', 'งาขาว  - ไร่ทิพย์', 'ssb', 'SSB', 'ถุง', 58.00, 2.00, 6.00, false),
  ('ING-0046', 'ลูกเดือย  - ไร่ทิพย์', 'ssb', 'SSB', 'ถุง', 39.00, 1.00, 3.00, false),
  ('ING-0047', 'ลูกชิดเชื่อม 1 กก', 'ssb', 'SSB', 'ถุง', 86.00, 2.00, 5.00, false),
  ('ING-0048', 'น้ำตาลทรายขาว 1 กก', 'ssb', 'SSB', 'ถุง', 29.00, 1.00, 3.00, false),
  ('ING-0049', 'เกลือปรุงทิพย์ 1 กก', 'ssb', 'SSB', 'ถุง', 16.00, 1.00, 3.00, false),
  ('ING-0050', 'ถ้วยขนมแม่ 100 กรัม 50 ใบ *20', 'packaging', 'SSB', 'แถว', 143.00, 5.00, 10.00, false),
  ('ING-0051', 'ถ้วยขนมแม่ 150 กรัม 50 ใบ *20', 'packaging', 'SSB', 'แถว', 140.00, 10.00, 20.00, false),
  ('ING-0052', 'ถ้วยกระดาษ 520cc 50 ใบ *20', 'packaging', 'SSB', 'แถว', 153.00, 2.00, 5.00, false),
  ('ING-0053', 'แก้ว 16 ออนซ์ 50ใบ *20', 'packaging', 'SSB', 'แถว', 173.00, 2.00, 5.00, false),
  ('ING-0054', 'ถ้วยกระดาษ ปากกว้าง 500ml 50ใบ', 'packaging', 'SSB', 'แถว', 190.00, 2.00, 5.00, false),
  ('ING-0055', 'ฝาปิดถ้วยขนม (ดอกไม้ ปาก 95 ไม่เจาะรู) 50ใบ *40', 'packaging', 'SSB', 'แถว', 48.00, 15.00, 30.00, false),
  ('ING-0056', 'ฝาโดมปิดถ้วยขนม (โดม ปาก 95 ไม่เจาะรู ) 50ใบ', 'packaging', 'SSB', 'แถว', 0.00, 2.00, 3.00, false),
  ('ING-0057', 'ฝากแก้วขนมพิเศษ (ฮาฟ ปาก 98 ไม่เจาะรู ) 50ใบ *20', 'packaging', 'SSB', 'แถว', 39.00, 2.00, 5.00, false),
  ('ING-0058', 'ฝาแก้วเครื่องดื่ม (ฝายกดื่ม ปาก98) 50 ใบ *20', 'packaging', 'SSB', 'แถว', 35.00, 2.00, 5.00, false),
  ('ING-0059', 'ฝาปิดถ้้วยกระดาษปากกว้าง500ml 50 ใบ', 'packaging', 'SSB', 'แถว', 75.00, 2.00, 5.00, false),
  ('ING-0060', 'ช้อนพลาสติก สีดำ 100 คัน', 'packaging', 'SSB', 'ห่อ', 35.00, 5.00, 30.00, false),
  ('ING-0061', 'ซ้อมพลาสติก สีดำ 100 คัน', 'packaging', 'SSB', 'ห่อ', 35.00, 1.00, 1.00, false),
  ('ING-0062', 'ถุงหิ้วพลาสติกใสขนาด 6x14', 'packaging', 'SSB', 'ห่อ', 44.00, 2.00, 10.00, false),
  ('ING-0063', 'ถุงหิ้วพลาสติกใสขนาด 7x15', 'packaging', 'SSB', 'ห่อ', 44.00, 2.00, 10.00, false),
  ('ING-0064', 'ถุงหิ้วพลาสติกใส่น้ำแข็งใสขนาด 5x8', 'packaging', 'SSB', 'ห่อ', 44.00, 2.00, 10.00, false),
  ('ING-0065', 'ถุงหิ้วพลาสติกใส่น้ำแข็งใสขนาด 6x9', 'packaging', 'SSB', 'ห่อ', 44.00, 2.00, 10.00, false),
  ('ING-0066', 'ถุงซิปใส่กะทิ ขนาด 8x12 1 กก', 'packaging', 'SSB', 'ห่อ', 135.00, 2.00, 5.00, false),
  ('ING-0067', 'หลอดเครื่องดื่ม', 'packaging', 'SSB', 'ห่อ', 20.00, 1.00, 1.00, false),
  ('ING-0068', 'ไซรัป เชฟไอซ์ สตรอเบอร์รี่ 500 ml', 'ssb', 'SSB', 'ขวด', 95.00, 1.00, 1.00, false),
  ('ING-0069', 'ไซรัป เชฟไอซ์ ลิ้นจี่ 500 ml', 'ssb', 'SSB', 'ขวด', 95.00, 1.00, 1.00, false),
  ('ING-0070', 'ไซรัป เชฟไอซ์ กีวี่ 500 ml', 'ssb', 'SSB', 'ขวด', 95.00, 1.00, 1.00, false),
  ('ING-0071', 'ฟักทองแกงบวช', 'thai_mix', 'HQ', 'ถุง', 35.00, 0.00, 0.00, true),
  ('ING-0072', 'ข้าวเหนียวถั่วดำ', 'thai_mix', 'HQ', 'ถุง', 50.00, 0.00, 0.00, true),
  ('ING-0073', 'ข้าวโพดหวาน ARO', 'frozen', 'MARKET', 'ถุง', 73.00, 0.00, 0.00, true),
  ('ING-0074', 'ลำไย ARO', 'frozen', 'MARKET', 'ถุง', 179.00, 0.00, 0.00, true),
  ('ING-0075', 'ขนมปัง ARO-Makro สไลค์ 1.5 เซน', 'frozen', 'MARKET', 'ถุง', 40.00, 0.00, 0.00, true),
  ('ING-0076', 'สตอเบอร์รี่แช่แช็ง 1 กก', 'frozen', 'MARKET', 'ถุง', 65.00, 0.00, 0.00, true),
  ('ING-0077', 'กีวี่แช่แช็ง 1 กก', 'frozen', 'MARKET', 'ถุง', 75.00, 0.00, 0.00, true),
  ('ING-0078', 'ลิ้นจี่แช่แช็ง 1 กก', 'frozen', 'MARKET', 'ถุง', 89.00, 0.00, 0.00, true),
  ('ING-0079', 'กะทิกล่อง อร่อยดี', 'market', 'MARKET', 'กล่อง', 80.00, 0.00, 0.00, false),
  ('ING-0080', 'วุ้นมะพร้าวคนไทย 1กก', 'market', 'MARKET', 'ถุง', 48.00, 0.00, 0.00, false),
  ('ING-0081', 'วุ้ั้นลูกตาล ตรากุหลาบ 1 กก', 'market', 'MARKET', 'ถุง', 50.00, 0.00, 0.00, false),
  ('ING-0082', 'ดอกอัญชั่นแห้ง', 'market', 'MARKET', 'ถุง', 35.00, 0.00, 0.00, false),
  ('ING-0083', 'สิงห์ โซดา 6ขวด 1แพ็ก', 'market', 'MARKET', 'ขวด', 8.00, 0.00, 0.00, false),
  ('ING-0084', 'ถ้วยขนมแม่ 100 กรัม 50 ใบ', 'packaging', 'MARKET', 'แถว', 143.00, 0.00, 0.00, false),
  ('ING-0085', 'ถ้วยขนมแม่ 150 กรัม 50 ใบ', 'packaging', 'MARKET', 'แถว', 140.00, 0.00, 0.00, false),
  ('ING-0086', 'ถ้วยกระดาษ 520cc 50 ใบ', 'packaging', 'MARKET', 'แถว', 153.00, 0.00, 0.00, false),
  ('ING-0087', 'แก้ว 16 ออนซ์ 50ใบ', 'packaging', 'MARKET', 'แถว', 173.00, 0.00, 0.00, false),
  ('ING-0088', 'ฝาปิดถ้วยขนม (ดอกไม้ ปาก 95 ไม่เจาะรู) 50ใบ', 'packaging', 'MARKET', 'แถว', 48.00, 0.00, 0.00, false),
  ('ING-0089', 'ฝาแก้วขนมพิเศษ (ฮาฟ ปาก 98 ไม่เจาะรู ) 50ใบ', 'packaging', 'MARKET', 'แถว', 39.00, 0.00, 0.00, false),
  ('ING-0090', 'ฝาแก้วเครื่องดื่ม (ฝายกดื่ม ปาก98) 50 ใบ', 'packaging', 'MARKET', 'แถว', 35.00, 0.00, 0.00, false),
  ('ING-0091', 'ฝาแก้วเครื่องดื่ม (ฝายกดื่ม ปาก95) 50 ใบ', 'packaging', 'MARKET', 'แถว', 35.00, 0.00, 0.00, false),
  ('ING-0092', 'ชื่้อนพลาสติก สีดำ 100 คัน', 'packaging', 'MARKET', 'ห่อ', 35.00, 0.00, 0.00, false),
  ('ING-0093', 'กระดาษความร้อน 80x80 มม', 'packaging', 'MARKET', 'อัน', 135.00, 0.00, 0.00, false),
  ('ING-0094', 'กระดาษเช็ดปาก 20x30 ซม 500 แผ่น', 'packaging', 'MARKET', 'ห่อ', 58.00, 0.00, 0.00, false),
  ('ING-0095', 'หนังยาง', 'packaging', 'MARKET', 'ถุง', 0.00, 0.00, 0.00, false)
on conflict (ingredient_id) do nothing;


-- ╔══════════════════════════════════════════════════════════
-- ║  seed_opening_stock.sql
-- ╚══════════════════════════════════════════════════════════
-- seed_opening_stock.sql — ยอดสต็อกตั้งต้น (auto-generated จาก ร้านขนมแม่.xlsx)
-- generated: 2026-05-14
-- รันหลัง seed_ingredients.sql
-- หลักการ: stock_in รับเข้าคลัง = home_qty + shop_qty, แล้ว transfer ส่วน shop_qty ไปหน้าร้าน

insert into stock_in (ingredient_id, source, lot_number, unit, quantity, unit_cost, total_cost, note) values
  ('ING-0001', 'HQ', 'OPENING-2026-05', 'ถุง', 42.00, 25.00, 1050.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0002', 'HQ', 'OPENING-2026-05', 'ถุง', 33.00, 25.00, 825.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0003', 'HQ', 'OPENING-2026-05', 'ถุง', 31.00, 30.00, 930.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0004', 'HQ', 'OPENING-2026-05', 'ถุง', 43.00, 20.00, 860.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0005', 'HQ', 'OPENING-2026-05', 'ถุง', 46.00, 20.00, 920.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0006', 'HQ', 'OPENING-2026-05', 'ถุง', 29.00, 20.00, 580.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0007', 'HQ', 'OPENING-2026-05', 'ถุง', 51.00, 15.00, 765.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0008', 'HQ', 'OPENING-2026-05', 'ถุง', 111.00, 20.00, 2220.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0009', 'HQ', 'OPENING-2026-05', 'ถุง', 157.00, 10.00, 1570.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0010', 'HQ', 'OPENING-2026-05', 'ถุง', 229.00, 10.00, 2290.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0011', 'HQ', 'OPENING-2026-05', 'ถุง', 41.00, 5.00, 205.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0012', 'HQ', 'OPENING-2026-05', 'ถุง', 39.00, 15.00, 585.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0013', 'HQ', 'OPENING-2026-05', 'ถุง', 50.00, 35.00, 1750.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0014', 'HQ', 'OPENING-2026-05', 'ถุง', 30.00, 20.00, 600.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0015', 'HQ', 'OPENING-2026-05', 'ถุง', 40.00, 10.00, 400.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0016', 'HQ', 'OPENING-2026-05', 'ถุง', 34.00, 13.00, 442.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0019', 'HQ', 'OPENING-2026-05', 'ถุง', 15.00, 13.00, 195.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0020', 'HQ', 'OPENING-2026-05', 'ถุง', 15.00, 16.00, 240.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0021', 'HQ', 'OPENING-2026-05', 'ถุง', 27.00, 26.00, 702.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0022', 'HQ', 'OPENING-2026-05', 'แพ็ค', 22.50, 330.00, 7425.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0023', 'HQ', 'OPENING-2026-05', 'แพ็ค', 85.00, 55.00, 4675.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0024', 'HQ', 'OPENING-2026-05', 'แพ็ค', 18.00, 120.00, 2160.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0025', 'HQ', 'OPENING-2026-05', 'แพ็ค', 24.00, 55.00, 1320.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0026', 'HQ', 'OPENING-2026-05', 'แพ็ค', 20.00, 55.00, 1100.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0027', 'HQ', 'OPENING-2026-05', 'ถุง', 17.00, 80.00, 1360.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0028', 'HQ', 'OPENING-2026-05', 'ถุง', 19.00, 90.00, 1710.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0029', 'HQ', 'OPENING-2026-05', 'ถุง', 5.00, 120.00, 600.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0030', 'HQ', 'OPENING-2026-05', 'ก้อน', 2.00, 370.00, 740.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0031', 'HQ', 'OPENING-2026-05', 'ก้อน', 10.00, 400.00, 4000.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0032', 'HQ', 'OPENING-2026-05', 'ถ้วย', 21.00, 30.00, 630.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0033', 'HQ', 'OPENING-2026-05', 'ถ้วย', 22.00, 30.00, 660.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0034', 'HQ', 'OPENING-2026-05', 'ถ้วย', 10.00, 30.00, 300.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0035', 'HQ', 'OPENING-2026-05', 'ถ้วย', 17.00, 30.00, 510.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0036', 'HQ', 'OPENING-2026-05', 'ถ้วย', 28.00, 30.00, 840.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0037', 'HQ', 'OPENING-2026-05', 'ถ้วย', 25.00, 30.00, 750.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0038', 'SSB', 'OPENING-2026-05', 'ถุง', 3.00, 42.00, 126.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0039', 'SSB', 'OPENING-2026-05', 'ถุง', 29.00, 37.00, 1073.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0040', 'SSB', 'OPENING-2026-05', 'ถุง', 10.00, 24.00, 240.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0041', 'SSB', 'OPENING-2026-05', 'ถุง', 19.00, 56.00, 1064.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0042', 'SSB', 'OPENING-2026-05', 'ถุง', 11.00, 39.00, 429.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0043', 'SSB', 'OPENING-2026-05', 'ถุง', 17.00, 29.00, 493.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0044', 'SSB', 'OPENING-2026-05', 'ถุง', 16.00, 35.00, 560.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0045', 'SSB', 'OPENING-2026-05', 'ถุง', 2.00, 58.00, 116.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0046', 'SSB', 'OPENING-2026-05', 'ถุง', 3.00, 39.00, 117.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0047', 'SSB', 'OPENING-2026-05', 'ถุง', 8.00, 86.00, 688.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0048', 'SSB', 'OPENING-2026-05', 'ถุง', 2.00, 29.00, 58.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0050', 'SSB', 'OPENING-2026-05', 'แถว', 40.00, 143.00, 5720.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0051', 'SSB', 'OPENING-2026-05', 'แถว', 40.00, 140.00, 5600.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0052', 'SSB', 'OPENING-2026-05', 'แถว', 5.00, 153.00, 765.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0053', 'SSB', 'OPENING-2026-05', 'แถว', 5.00, 173.00, 865.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0054', 'SSB', 'OPENING-2026-05', 'แถว', 4.00, 190.00, 760.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0055', 'SSB', 'OPENING-2026-05', 'แถว', 120.00, 48.00, 5760.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0056', 'SSB', 'OPENING-2026-05', 'แถว', 4.00, 0.00, 0.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0057', 'SSB', 'OPENING-2026-05', 'แถว', 5.00, 39.00, 195.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0058', 'SSB', 'OPENING-2026-05', 'แถว', 5.00, 35.00, 175.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0059', 'SSB', 'OPENING-2026-05', 'แถว', 4.00, 75.00, 300.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0060', 'SSB', 'OPENING-2026-05', 'ห่อ', 20.00, 35.00, 700.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0061', 'SSB', 'OPENING-2026-05', 'ห่อ', 2.00, 35.00, 70.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0062', 'SSB', 'OPENING-2026-05', 'ห่อ', 17.00, 44.00, 748.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0063', 'SSB', 'OPENING-2026-05', 'ห่อ', 26.00, 44.00, 1144.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0064', 'SSB', 'OPENING-2026-05', 'ห่อ', 25.00, 44.00, 1100.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0065', 'SSB', 'OPENING-2026-05', 'ห่อ', 15.00, 44.00, 660.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0066', 'SSB', 'OPENING-2026-05', 'ห่อ', 18.00, 135.00, 2430.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0067', 'SSB', 'OPENING-2026-05', 'ห่อ', 1.00, 20.00, 20.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0068', 'SSB', 'OPENING-2026-05', 'ขวด', 3.00, 95.00, 285.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0069', 'SSB', 'OPENING-2026-05', 'ขวด', 1.00, 95.00, 95.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0070', 'SSB', 'OPENING-2026-05', 'ขวด', 2.00, 95.00, 190.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0071', 'HQ', 'OPENING-2026-05', 'ถุง', 10.00, 35.00, 350.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0072', 'HQ', 'OPENING-2026-05', 'ถุง', 13.00, 50.00, 650.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0073', 'MARKET', 'OPENING-2026-05', 'ถุง', 6.00, 73.00, 438.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0074', 'MARKET', 'OPENING-2026-05', 'ถุง', 6.50, 179.00, 1163.50, 'ยอดยกมาตั้งต้น'),
  ('ING-0075', 'MARKET', 'OPENING-2026-05', 'ถุง', 2.00, 40.00, 80.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0076', 'MARKET', 'OPENING-2026-05', 'ถุง', 2.00, 65.00, 130.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0077', 'MARKET', 'OPENING-2026-05', 'ถุง', 2.00, 75.00, 150.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0078', 'MARKET', 'OPENING-2026-05', 'ถุง', 1.00, 89.00, 89.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0079', 'MARKET', 'OPENING-2026-05', 'กล่อง', 19.00, 80.00, 1520.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0080', 'MARKET', 'OPENING-2026-05', 'ถุง', 15.00, 48.00, 720.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0081', 'MARKET', 'OPENING-2026-05', 'ถุง', 13.00, 50.00, 650.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0082', 'MARKET', 'OPENING-2026-05', 'ถุง', 7.00, 35.00, 245.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0083', 'MARKET', 'OPENING-2026-05', 'ขวด', 20.00, 8.00, 160.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0084', 'MARKET', 'OPENING-2026-05', 'แถว', 15.00, 143.00, 2145.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0085', 'MARKET', 'OPENING-2026-05', 'แถว', 5.00, 140.00, 700.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0086', 'MARKET', 'OPENING-2026-05', 'แถว', 4.00, 153.00, 612.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0087', 'MARKET', 'OPENING-2026-05', 'แถว', 4.00, 173.00, 692.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0088', 'MARKET', 'OPENING-2026-05', 'แถว', 31.00, 48.00, 1488.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0089', 'MARKET', 'OPENING-2026-05', 'แถว', 4.00, 39.00, 156.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0090', 'MARKET', 'OPENING-2026-05', 'แถว', 4.00, 35.00, 140.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0091', 'MARKET', 'OPENING-2026-05', 'แถว', 3.00, 35.00, 105.00, 'ยอดยกมาตั้งต้น'),
  ('ING-0092', 'MARKET', 'OPENING-2026-05', 'ห่อ', 2.00, 35.00, 70.00, 'ยอดยกมาตั้งต้น');

insert into stock_transfers (ingredient_id, lot_number, unit, quantity, note) values
  ('ING-0001', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0002', 'OPENING-2026-05', 'ถุง', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0003', 'OPENING-2026-05', 'ถุง', 11.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0004', 'OPENING-2026-05', 'ถุง', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0005', 'OPENING-2026-05', 'ถุง', 6.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0006', 'OPENING-2026-05', 'ถุง', 9.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0007', 'OPENING-2026-05', 'ถุง', 21.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0008', 'OPENING-2026-05', 'ถุง', 36.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0009', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0010', 'OPENING-2026-05', 'ถุง', 29.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0011', 'OPENING-2026-05', 'ถุง', 41.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0012', 'OPENING-2026-05', 'ถุง', 19.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0014', 'OPENING-2026-05', 'ถุง', 20.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0015', 'OPENING-2026-05', 'ถุง', 10.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0016', 'OPENING-2026-05', 'ถุง', 14.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0021', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0022', 'OPENING-2026-05', 'แพ็ค', 11.50, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0023', 'OPENING-2026-05', 'แพ็ค', 15.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0024', 'OPENING-2026-05', 'แพ็ค', 8.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0025', 'OPENING-2026-05', 'แพ็ค', 9.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0026', 'OPENING-2026-05', 'แพ็ค', 5.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0027', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0028', 'OPENING-2026-05', 'ถุง', 5.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0029', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0030', 'OPENING-2026-05', 'ก้อน', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0031', 'OPENING-2026-05', 'ก้อน', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0032', 'OPENING-2026-05', 'ถ้วย', 21.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0033', 'OPENING-2026-05', 'ถ้วย', 22.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0034', 'OPENING-2026-05', 'ถ้วย', 10.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0035', 'OPENING-2026-05', 'ถ้วย', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0036', 'OPENING-2026-05', 'ถ้วย', 28.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0037', 'OPENING-2026-05', 'ถ้วย', 15.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0038', 'OPENING-2026-05', 'ถุง', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0039', 'OPENING-2026-05', 'ถุง', 9.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0040', 'OPENING-2026-05', 'ถุง', 10.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0041', 'OPENING-2026-05', 'ถุง', 9.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0042', 'OPENING-2026-05', 'ถุง', 11.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0043', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0044', 'OPENING-2026-05', 'ถุง', 6.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0045', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0046', 'OPENING-2026-05', 'ถุง', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0047', 'OPENING-2026-05', 'ถุง', 8.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0048', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0054', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0059', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0061', 'OPENING-2026-05', 'ห่อ', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0062', 'OPENING-2026-05', 'ห่อ', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0063', 'OPENING-2026-05', 'ห่อ', 16.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0064', 'OPENING-2026-05', 'ห่อ', 8.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0065', 'OPENING-2026-05', 'ห่อ', 5.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0066', 'OPENING-2026-05', 'ห่อ', 6.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0067', 'OPENING-2026-05', 'ห่อ', 1.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0068', 'OPENING-2026-05', 'ขวด', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0069', 'OPENING-2026-05', 'ขวด', 1.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0070', 'OPENING-2026-05', 'ขวด', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0071', 'OPENING-2026-05', 'ถุง', 10.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0072', 'OPENING-2026-05', 'ถุง', 13.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0073', 'OPENING-2026-05', 'ถุง', 6.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0074', 'OPENING-2026-05', 'ถุง', 6.50, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0075', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0076', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0077', 'OPENING-2026-05', 'ถุง', 2.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0078', 'OPENING-2026-05', 'ถุง', 1.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0079', 'OPENING-2026-05', 'กล่อง', 19.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0080', 'OPENING-2026-05', 'ถุง', 15.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0081', 'OPENING-2026-05', 'ถุง', 13.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0082', 'OPENING-2026-05', 'ถุง', 7.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0083', 'OPENING-2026-05', 'ขวด', 20.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0084', 'OPENING-2026-05', 'แถว', 15.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0085', 'OPENING-2026-05', 'แถว', 5.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0086', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0087', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0088', 'OPENING-2026-05', 'แถว', 31.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0089', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0090', 'OPENING-2026-05', 'แถว', 4.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0091', 'OPENING-2026-05', 'แถว', 3.00, 'โอนยอดยกมาไปหน้าร้าน'),
  ('ING-0092', 'OPENING-2026-05', 'ห่อ', 2.00, 'โอนยอดยกมาไปหน้าร้าน');


-- ╔══════════════════════════════════════════════════════════
-- ║  seed_menu.sql
-- ╚══════════════════════════════════════════════════════════
-- seed_menu.sql — เมนูขายหน้าร้าน (จากคู่มือปฏิบัติงาน-ขนมแม่.pdf)
-- รันหลัง schema.sql
-- หมายเหตุ: ราคา (price) อ้างอิงจากรูปเมนูในคู่มือ — ควรให้เจ้าของร้านยืนยันก่อนใช้จริง

insert into menu_items (menu_id, name, category, price) values
  -- Signature — บัวลอยมีไส้ (ไส้มะพร้าว)
  ('MENU-001', 'บัวลอยมีไส้ น้ำกะทิ',                  'signature',    55),
  ('MENU-002', 'บัวลอยมีไส้ น้ำแข็งใส',                'signature',    55),
  ('MENU-003', 'บัวลอยมีไส้ ไอศกรีมกะทิสด',           'signature',    65),
  ('MENU-004', 'บัวลอยมีไส้ + ขนมไทย',                'signature',    60),
  ('MENU-005', 'บัวลอยมีไส้ + ไอศกรีม + ขนมไทย',      'signature',    75),
  -- ขนมไทย (12 เมนู)
  ('MENU-101', 'บัวลอยอัญชัน',                        'khanomthai',   45),
  ('MENU-102', 'ครองแครงมะพร้าวอ่อน',                 'khanomthai',   45),
  ('MENU-103', 'สาคูอัญชันมะพร้าวอ่อน',               'khanomthai',   45),
  ('MENU-104', 'ข้าวเหนียวเปียกลำไย',                 'khanomthai',   45),
  ('MENU-105', 'ข้าวเหนียวเปียกดำมะพร้าวอ่อน',         'khanomthai',   45),
  ('MENU-106', 'เต้าส่วนมะพร้าวอ่อน',                 'khanomthai',   45),
  ('MENU-107', 'ข้าวเหนียวถั่วดำมะพร้าวอ่อน',          'khanomthai',   50),
  ('MENU-108', 'กล้วยบวชชี',                          'khanomthai',   45),
  ('MENU-109', 'ฟักทองแกงบวด',                        'khanomthai',   50),
  ('MENU-110', 'มันแกงบวด',                           'khanomthai',   50),
  ('MENU-111', 'เผือกแกงบวด',                         'khanomthai',   50),
  ('MENU-112', 'รวมมิตรแกงบวด',                       'khanomthai',   55),
  -- ไอศกรีม
  ('MENU-201', 'ไอศกรีมกะทิสดอัญชัน',                 'icecream',     70),
  ('MENU-202', 'ไอศกรีมกะทิรวมมิตร',                  'icecream',     70),
  -- น้ำแข็งใส
  ('MENU-301', 'น้ำแข็งใส ราดกะทิสด',                 'namkhaengsai', 70),
  ('MENU-302', 'น้ำแข็งใส ราดกะทิน้ำตาลเคี่ยว',        'namkhaengsai', 70),
  -- ปังปิ้ง
  ('MENU-401', 'ปังปิ้ง ราดซอสกะทิอัญชัน',            'pingping',     60),
  ('MENU-402', 'ปังปิ้ง ราดซอสกะทิอัญชัน ไอศกรีมรวมมิตร', 'pingping',  80),
  -- ขนมปัง
  ('MENU-501', 'ขนมปัง ไอศกรีมรวมมิตร',               'khanompang',   60),
  -- เครื่องดื่ม (อิตาเลี่ยนโซดา)
  ('MENU-601', 'สตรอว์เบอร์รี่ โซดา',                 'drink',        45),
  ('MENU-602', 'กีวี่ โซดา',                          'drink',        45),
  ('MENU-603', 'ลิ้นจี่ โซดา',                        'drink',        45),
  -- ไอศกรีมแบบถ้วย (6 รสชาติ)
  ('MENU-701', 'ไอศกรีมถ้วย รสกะทิอัญชัน',            'icecream_cup', 39),
  ('MENU-702', 'ไอศกรีมถ้วย รสกะทิรวมมิตร',           'icecream_cup', 39),
  ('MENU-703', 'ไอศกรีมถ้วย รสกะทิชาไทย',             'icecream_cup', 39),
  ('MENU-704', 'ไอศกรีมถ้วย รสกะทิเผือก',             'icecream_cup', 39),
  ('MENU-705', 'ไอศกรีมถ้วย รสกะทิมะม่วง',            'icecream_cup', 39),
  ('MENU-706', 'ไอศกรีมถ้วย รสกะทิน้ำตาลโตนด',        'icecream_cup', 39)
on conflict (menu_id) do nothing;


-- ╔══════════════════════════════════════════════════════════
-- ║  seed_recipes.sql
-- ╚══════════════════════════════════════════════════════════
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
