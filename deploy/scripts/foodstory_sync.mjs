// foodstory_sync.mjs — sync เมนู + ยอดขายจาก FoodStory เข้า Supabase
// ใช้: cd deploy && node scripts/foodstory_sync.mjs [--dry]
//   --dry = ดึง+แสดงสิ่งที่จะทำ แต่ไม่เขียน DB
//
// ทำ 2 อย่าง (idempotent ทั้งคู่ — รันซ้ำปลอดภัย):
//   1) upsert menu_items จากสินค้าที่ขาย (menu_id='FS-<id>', pos_code=<id>, ราคาจริง)
//   2) record_sale ต่อวัน/สาขา (source='pos', pos_ref='fs-<branch>-<date>')
import { fetchMonthlySales, mapCategory } from "./lib/foodstory.mjs"

const DRY = process.argv.includes("--dry")
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SB_URL || !SB_KEY) { console.error("✗ ขาด NEXT_PUBLIC_SUPABASE_URL / KEY ใน .env.local"); process.exit(1) }

// ── Supabase REST helper ──
async function sb(path, { method = "GET", body, prefer } = {}) {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" }
  if (prefer) h.Prefer = prefer
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// ชื่อสินค้า: ตัด prefix รหัสซ้ำ เช่น "B6 เต้าส่วน..." → "เต้าส่วน..." (ถ้า name ขึ้นต้นด้วย code)
function cleanName(name, code) {
  if (code && name.startsWith(code + " ")) return name.slice(code.length + 1).trim()
  return name.trim()
}

async function main() {
  const { year, month, rows, total } = await fetchMonthlySales()
  console.log(`→ FoodStory ${year}-${month}: ${rows.length} แถว (recordsTotal=${total})${DRY ? "  [DRY RUN]" : ""}`)
  if (!rows.length) { console.log("ไม่มีข้อมูล — จบ"); return }

  // ── 1) เตรียม + upsert menu_items ──
  const byMenu = new Map()
  for (const r of rows) {
    if (!byMenu.has(r.menu_id)) {
      byMenu.set(r.menu_id, {
        menu_id: `FS-${r.menu_id}`,
        name: cleanName(r.product_name, r.product_code),
        category: (r.category || "").trim() || "อื่นๆ",  // ใช้หมวดดิบของ FoodStory ตรง ๆ
        price: Number(r.avg_price) || 0,
        pos_code: String(r.menu_id),
        is_active: true,
      })
    }
  }
  const menuRows = [...byMenu.values()]
  console.log(`\n[1] เมนู: ${menuRows.length} รายการ (distinct menu_id)`)
  if (DRY) {
    const byCat = {}
    for (const m of menuRows) (byCat[m.category] ||= []).push(m)
    for (const cat of Object.keys(byCat).sort()) {
      console.log(`\n  [${cat}] (${byCat[cat].length})`)
      for (const m of byCat[cat]) console.log(`     ${String(m.price).padStart(6)} ฿  ${m.name}  (${m.menu_id})`)
    }
  } else {
    await sb("menu_items?on_conflict=menu_id", {
      method: "POST", body: menuRows, prefer: "resolution=merge-duplicates,return=minimal",
    })
    console.log("    ✓ upsert menu_items แล้ว")
  }

  // map FS menu_id → menu_items.id (ของจริงใน DB)
  let idByPos = {}
  if (!DRY) {
    const ids = menuRows.map((m) => m.menu_id).join(",")
    const got = await sb(`menu_items?select=id,menu_id,pos_code&menu_id=in.(${ids})`)
    for (const m of got) idByPos[m.pos_code] = m.id
  }

  // ── 2) record_sale ต่อ (วัน, สาขา) ──
  const groups = new Map() // key: date|branch
  for (const r of rows) {
    const key = `${r.show_dt}|${r.branch_id}`
    if (!groups.has(key)) groups.set(key, { date: r.show_dt, branch_id: r.branch_id, branch_name: r.branch_name, items: [] })
    groups.get(key).items.push(r)
  }
  console.log(`\n[2] ยอดขาย: ${groups.size} (วัน×สาขา)`)

  let okSales = 0, totalQty = 0, totalAmt = 0
  for (const g of groups.values()) {
    const items = g.items.map((r) => ({
      menu_item_id: DRY ? `FS-${r.menu_id}` : idByPos[String(r.menu_id)],
      _name: cleanName(r.product_name, r.product_code),
      quantity: Math.round(Number(r.sales_volumn) || 0),
      unit_price: Number(r.avg_price) || 0,
    })).filter((it) => it.menu_item_id && it.quantity > 0)
    const qty = items.reduce((s, it) => s + it.quantity, 0)
    const amt = g.items.reduce((s, r) => s + (Number(r.gross_sales) || 0), 0)
    totalQty += qty; totalAmt += amt
    const posRef = `fs-${g.branch_id}-${g.date}`

    if (DRY) {
      console.log(`\n    ── ${g.date} · ${g.branch_name} · ${items.length} เมนู · ${qty} ชิ้น · ${amt.toLocaleString()} บาท (pos_ref=${posRef})`)
      console.table(items.map((it) => ({ สินค้า: it._name, จำนวน: it.quantity, ราคา: it.unit_price, รวม: it.quantity * it.unit_price })))
      continue
    }
    items.forEach((it) => delete it._name)
    const saleId = await sb("rpc/record_sale", {
      method: "POST",
      body: {
        p_channel: "dine_in", p_bill_no: null, p_items: items,
        p_sold_at: `${g.date}T12:00:00+07:00`,
        p_note: `FoodStory sync · ${g.branch_name}`, p_source: "pos", p_pos_ref: posRef,
      },
    })
    okSales++
    console.log(`    ✓ ${g.date} ${g.branch_name}: sale_id=${saleId} · ${qty} ชิ้น · ${amt.toLocaleString()} บาท`)
  }

  // ── log ──
  if (!DRY) {
    await sb("pos_sync_log", {
      method: "POST",
      body: {
        direction: "inbound", kind: "sale", status: "ok", ref: `${year}-${month}`,
        message: `sync ${okSales} วัน · ${totalQty} ชิ้น · ${totalAmt} บาท`,
        payload: { year, month, menu: menuRows.length, sales: okSales },
      },
      prefer: "return=minimal",
    })
  }
  console.log(`\n${DRY ? "[DRY] " : "✓ "}รวม: ${totalQty} ชิ้น · ${totalAmt.toLocaleString()} บาท`)
  if (!DRY) console.log("⚠ หมายเหตุ: pos_ref idempotent ต่อวัน — ถ้า sync วันที่ยังขายไม่จบ ยอดจะ freeze (sync ใหม่ไม่อัปเดต)")
}

main().catch((e) => { console.error("✗", e.message); process.exit(1) })
