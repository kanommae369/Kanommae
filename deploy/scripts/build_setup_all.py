# -*- coding: utf-8 -*-
"""รวม schema + seed ทุกไฟล์เป็น setup_all.sql ไฟล์เดียว (ตามลำดับรันที่ถูกต้อง)
ใช้: py deploy/scripts/build_setup_all.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.normpath(os.path.join(HERE, "..", "supabase"))

# ลำดับสำคัญ: schema ก่อน, ingredients ก่อน seed ที่อ้าง FK วัตถุดิบ,
# production_recipes ท้ายสุด (ต้องมีทั้ง table + ingredients ครบก่อน)
ORDER = [
    "schema.sql",
    "seed_ingredients.sql",
    "seed_opening_stock.sql",
    "seed_menu.sql",
    "seed_recipes.sql",
    "seed_production_recipes.sql",
]

HEADER = (
    "-- ============================================================\n"
    "-- ขนมแม่ — Setup ทั้งหมดในไฟล์เดียว\n"
    "-- วิธีใช้: Supabase → SQL Editor → New query → paste ทั้งหมด → Run\n"
    "-- (auto-generated โดย scripts/build_setup_all.py — อย่าแก้ไฟล์นี้ตรง ๆ)\n"
    "-- ============================================================\n\n"
)


def banner(name: str) -> str:
    line = "═" * 58
    return (
        f"\n-- ╔{line}\n"
        f"-- ║  {name}\n"
        f"-- ╚{line}\n"
    )


def main() -> None:
    out = [HEADER]
    for name in ORDER:
        path = os.path.join(SQL_DIR, name)
        with open(path, encoding="utf-8") as f:
            out.append(banner(name))
            out.append(f.read().rstrip() + "\n")
    dest = os.path.join(SQL_DIR, "setup_all.sql")
    with open(dest, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print(f"wrote {dest}  ({len(ORDER)} files)")


if __name__ == "__main__":
    main()
