# -*- coding: utf-8 -*-
"""
extract_seed.py — อ่าน ร้านขนมแม่.xlsx → สร้าง SQL seed สำหรับ Supabase

ผลลัพธ์:
  deploy/supabase/seed_ingredients.sql     — master list วัตถุดิบ (ingredients)
  deploy/supabase/seed_opening_stock.sql   — ยอดสต็อกตั้งต้น (stock_in + stock_transfers)

วิธีรัน:  py deploy/scripts/extract_seed.py
"""
import openpyxl, os, sys, datetime

XLSX = r"C:\Projects\ขนมแม่\ขนมแม่(ภัณฑ์ทวี545)\ร้านขนมแม่.xlsx"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "supabase")
SHEET = "สต๊อกของขนมแม่ทั้งหมด"
OPENING_LOT = "OPENING-2026-05"

PACKAGING_KW = ["ถ้วย", "ฝา", "ช้อน", "ซ้อม", "ส้อม", "ถุง", "หลอด", "กระดาษ", "แก้ว", "หนังยาง"]

def sql_str(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''").strip() + "'"

def num(v):
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def norm(name):
    """normalize ชื่อสำหรับ dedup — ตัดช่องว่างทั้งหมด"""
    return "".join(str(name).split()).lower()

def is_packaging(name):
    return any(kw in name for kw in PACKAGING_KW)


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))

    # column groups: (name_idx, qty_idx, min_idx, reorder_idx, unit_idx, price_idx)
    # min/reorder = None ถ้ากลุ่มนั้นไม่มี
    GROUPS = [
        # Group A — คลังที่บ้าน · ส่วนผสมขนมไทย + ของแช่แข็ง · HQ
        dict(name="A", cols=(1, 2, 3, 4, 5, 6), loc="home", src="HQ",
             default_cat="thai_mix", frozen_kw="ของแช่แข็ง"),
        # Group B — คลังที่บ้าน · สินสมบูรณ์ · SSB
        dict(name="B", cols=(9, 10, 11, 12, 13, 14), loc="home", src="SSB",
             default_cat="ssb", frozen_kw=None),
        # Group C — หน้าร้าน · ส่วนผสมขนมไทย + ของแช่แข็ง · HQ
        dict(name="C", cols=(18, 19, None, None, 20, 21), loc="shop", src="HQ",
             default_cat="thai_mix", frozen_kw="ของแช่แข็ง"),
        # Group D — หน้าร้าน · วัตถุดิบอื่นๆ + บรรจุภัณฑ์ · MARKET
        dict(name="D", cols=(24, 25, None, None, 26, 27), loc="shop", src="MARKET",
             default_cat="market", frozen_kw=None, pkg_kw="บบรจุภัณฑ์อื่นๆ"),
    ]

    SKIP_NAMES = {"ชื่อสินค้า", "รวมยอด", "รายการ", "ชื่อสินค้า "}

    ingredients = {}   # norm_name -> dict
    order = []         # norm_name list (first-seen order)

    for g in GROUPS:
        ni, qi, mi, ri, ui, pi = g["cols"]
        cat = g["default_cat"]
        for r in rows:
            if ni >= len(r):
                continue
            # section header detection — header อยู่ในคอลัมน์ลำดับ (ni-1) หรือคอลัมน์ชื่อ (ni)
            # ต้องเช็คก่อน name-empty เพราะ header row มีคอลัมน์ชื่อว่าง
            hdr_cells = [str(r[c]).strip() for c in (ni - 1, ni)
                         if 0 <= c < len(r) and r[c] is not None]
            if g.get("frozen_kw") and g["frozen_kw"] in hdr_cells:
                cat = "frozen"
                continue
            if g.get("pkg_kw") and g["pkg_kw"] in hdr_cells:
                cat = "packaging"
                continue
            name = r[ni]
            if name is None or str(name).strip() == "":
                continue
            name = str(name).strip()
            if name in SKIP_NAMES:
                continue
            unit = r[ui] if ui < len(r) else None
            qty = num(r[qi]) if qi < len(r) else None
            # item ต้องมีหน่วย — กันแถว sub-label / placeholder
            if unit is None or str(unit).strip() == "":
                continue
            unit = str(unit).strip()
            price = num(r[pi]) if pi < len(r) else None
            mn = num(r[mi]) if (mi is not None and mi < len(r)) else None
            ro = num(r[ri]) if (ri is not None and ri < len(r)) else None

            this_cat = cat
            if g["src"] == "SSB" and is_packaging(name):
                this_cat = "packaging"

            # source override: ของแช่แข็ง ARO/Makro ในกลุ่มหน้าร้าน จริง ๆ ซื้อจากตลาด
            this_src = g["src"]
            if "ARO" in name or "makro" in name.lower() or "แช่แช็ง" in name or "แช่แข็ง" in name:
                this_src = "MARKET"

            key = norm(name)
            if key not in ingredients:
                ingredients[key] = dict(
                    name=name, category=this_cat, source=this_src, unit=unit,
                    avg_cost=price or 0, min_stock=mn or 0, reorder_qty=ro or 0,
                    is_perishable=this_cat in ("thai_mix", "frozen"),
                    home_qty=0.0, shop_qty=0.0,
                )
                order.append(key)
            ing = ingredients[key]
            # เติม attribute ที่ยังว่าง (กลุ่ม A/B มี min/reorder, C/D ไม่มี)
            if not ing["avg_cost"] and price:
                ing["avg_cost"] = price
            if not ing["min_stock"] and mn:
                ing["min_stock"] = mn
            if not ing["reorder_qty"] and ro:
                ing["reorder_qty"] = ro
            # สะสมจำนวนตาม location
            if qty:
                if g["loc"] == "home":
                    ing["home_qty"] += qty
                else:
                    ing["shop_qty"] += qty

    # assign ingredient_id
    for idx, key in enumerate(order, start=1):
        ingredients[key]["ingredient_id"] = f"ING-{idx:04d}"

    os.makedirs(OUT_DIR, exist_ok=True)

    # ── seed_ingredients.sql ──
    with open(os.path.join(OUT_DIR, "seed_ingredients.sql"), "w", encoding="utf-8") as f:
        f.write("-- seed_ingredients.sql — master list วัตถุดิบ (auto-generated จาก ร้านขนมแม่.xlsx)\n")
        f.write(f"-- generated: {datetime.date.today()}  ·  {len(order)} รายการ\n")
        f.write("-- รันหลัง schema.sql\n\n")
        f.write("insert into ingredients (ingredient_id, name, category, source, unit, "
                "avg_cost, min_stock, reorder_qty, is_perishable) values\n")
        lines = []
        for key in order:
            d = ingredients[key]
            lines.append(
                f"  ({sql_str(d['ingredient_id'])}, {sql_str(d['name'])}, "
                f"{sql_str(d['category'])}, {sql_str(d['source'])}, {sql_str(d['unit'])}, "
                f"{d['avg_cost']:.2f}, {d['min_stock']:.2f}, {d['reorder_qty']:.2f}, "
                f"{'true' if d['is_perishable'] else 'false'})"
            )
        f.write(",\n".join(lines))
        f.write("\non conflict (ingredient_id) do nothing;\n")

    # ── seed_opening_stock.sql ──
    with open(os.path.join(OUT_DIR, "seed_opening_stock.sql"), "w", encoding="utf-8") as f:
        f.write("-- seed_opening_stock.sql — ยอดสต็อกตั้งต้น (auto-generated จาก ร้านขนมแม่.xlsx)\n")
        f.write(f"-- generated: {datetime.date.today()}\n")
        f.write("-- รันหลัง seed_ingredients.sql\n")
        f.write("-- หลักการ: stock_in รับเข้าคลัง = home_qty + shop_qty, "
                "แล้ว transfer ส่วน shop_qty ไปหน้าร้าน\n\n")

        si_lines, tr_lines = [], []
        for key in order:
            d = ingredients[key]
            iid = d["ingredient_id"]
            total_in = d["home_qty"] + d["shop_qty"]
            if total_in > 0:
                cost = d["avg_cost"]
                si_lines.append(
                    f"  ({sql_str(iid)}, {sql_str(d['source'])}, {sql_str(OPENING_LOT)}, "
                    f"{sql_str(d['unit'])}, {total_in:.2f}, {cost:.2f}, {total_in*cost:.2f}, "
                    f"'ยอดยกมาตั้งต้น')"
                )
            if d["shop_qty"] > 0:
                tr_lines.append(
                    f"  ({sql_str(iid)}, {sql_str(OPENING_LOT)}, {sql_str(d['unit'])}, "
                    f"{d['shop_qty']:.2f}, 'โอนยอดยกมาไปหน้าร้าน')"
                )

        if si_lines:
            f.write("insert into stock_in (ingredient_id, source, lot_number, unit, "
                    "quantity, unit_cost, total_cost, note) values\n")
            f.write(",\n".join(si_lines))
            f.write(";\n\n")
        if tr_lines:
            f.write("insert into stock_transfers (ingredient_id, lot_number, unit, "
                    "quantity, note) values\n")
            f.write(",\n".join(tr_lines))
            f.write(";\n")

    # ── summary ──
    by_cat = {}
    for key in order:
        d = ingredients[key]
        by_cat.setdefault(d["category"], 0)
        by_cat[d["category"]] += 1
    print(f"OK — {len(order)} ingredients")
    for c, n in sorted(by_cat.items()):
        print(f"  {c:12s} {n}")
    print(f"wrote: {os.path.normpath(os.path.join(OUT_DIR, 'seed_ingredients.sql'))}")
    print(f"wrote: {os.path.normpath(os.path.join(OUT_DIR, 'seed_opening_stock.sql'))}")


if __name__ == "__main__":
    main()
