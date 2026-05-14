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
