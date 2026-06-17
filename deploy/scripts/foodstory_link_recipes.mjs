// foodstory_link_recipes.mjs — pre-build สูตรตัด (ชั้น 2): เมนู FoodStory → ถุงพรีมิกซ์
// ใช้: cd deploy && node scripts/foodstory_link_recipes.mjs [--dry]
//   จับคู่เฉพาะ "เมนูเดี่ยว" ที่ชื่อตรงกับถุงพรีมิกซ์ชัดเจน → ใส่ recipe (qty_stock=0)
//   เจ้าของร้านค่อยกรอก qty_stock (1 ถ้วย=กี่ถุง) ในหน้า "สูตรขนม" → ระบบตัดสต็อกอัตโนมัติ
//   ignore-duplicates: รันซ้ำไม่ทับ qty_stock ที่กรอกไปแล้ว · ข้ามเมนูคอมโบ (ชื่อมี '+')
import { loadEnv } from "./lib/foodstory.mjs"
loadEnv()

const DRY = process.argv.includes("--dry")
const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const K = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!U || !K) { console.error("✗ ขาด Supabase URL/KEY ใน .env.local"); process.exit(1) }

async function sb(path, { method = "GET", body, prefer } = {}) {
  const h = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" }
  if (prefer) h.Prefer = prefer
  const r = await fetch(`${U}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const t = await r.text()
  if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status}: ${t.slice(0, 300)}`)
  return t ? JSON.parse(t) : null
}

// แผนที่ชื่อเมนูเดี่ยว (FoodStory, ตัด prefix รหัสแล้ว) → ingredient_id ของถุงพรีมิกซ์
// คัดเฉพาะที่ชื่อชัด/ความเสี่ยง map ผิดต่ำ · เมนูคอมโบ/ไอศกรีม/น้ำแข็งใส เว้นให้กรอกเอง
const MAP = {
  "เต้าส่วนมะพร้าวอ่อน": "ING-0002",
  "ครองแครงมะพร้าวอ่อน": "ING-0005",
  "สาคูอัญชันมะพร้าวอ่อน": "ING-0003",
  "ข้าวเหนียวเปียกลำไย": "ING-0001",
  "ข้าวเหนียวดำเปียกมะพร้าวอ่อน": "ING-0004",
  "ข้าวเหนียวถั่วดำมะพร้าวอ่อน": "ING-0072",
  "ข้าวเหนียวถั่วดำ": "ING-0072",
  "กล้วยบวชชี": "ING-0006",
  "บัวลอยอัญชันลูกเล็ก": "ING-0023",
  "บัวลอยมีไส้น้ำกะทิ": "ING-0022",
  "บัวลอยมีไส้น้ำแข็งใส": "ING-0022",
}

async function main() {
  const menus = await sb("menu_items?select=id,menu_id,name&menu_id=like.FS-*")
  console.log(`เมนู FoodStory ใน DB: ${menus.length} รายการ${DRY ? "  [DRY RUN]" : ""}`)

  // ตรวจว่า ingredient_id ปลายทางมีจริง
  const ings = await sb("ingredients?select=ingredient_id,name")
  const ingName = Object.fromEntries(ings.map((i) => [i.ingredient_id, i.name]))

  const links = []
  const skipped = []
  for (const m of menus) {
    const name = (m.name || "").trim()
    if (name.includes("+")) { skipped.push([name, "คอมโบ"]); continue }
    const ingId = MAP[name]
    if (!ingId) { skipped.push([name, "ไม่มีในแผนที่ (กรอกเองในหน้าสูตร)"]); continue }
    if (!ingName[ingId]) { skipped.push([name, `ปลายทาง ${ingId} ไม่มีใน DB`]); continue }
    links.push({
      menu_item_id: m.id,
      ingredient_id: ingId,
      qty_stock: 0,
      qty_display: "เติม: 1 ถ้วย = ? ถุง",
      note: "FoodStory · รอเจ้าของร้านกรอก qty_stock (1 ถุงพรีมิกซ์ ตักได้กี่ถ้วย)",
    })
  }

  console.log(`\n✓ จับคู่ได้ ${links.length} ลิงก์:`)
  for (const l of links) {
    const mn = menus.find((x) => x.id === l.menu_item_id)?.name
    console.log(`   ${mn}  →  ${l.ingredient_id} (${ingName[l.ingredient_id]})`)
  }
  console.log(`\n⏭  ข้าม ${skipped.length} เมนู (คอมโบ/ไม่อยู่ในแผนที่ — กรอกเองในหน้าสูตร)`)

  if (DRY) { console.log("\n[DRY] ไม่เขียน DB"); return }
  if (!links.length) { console.log("ไม่มีอะไรให้เขียน"); return }

  // ignore-duplicates: ถ้ามี recipe (menu_item_id,ingredient_id) อยู่แล้ว → ไม่ทับ (กัน qty_stock หาย)
  await sb("recipes?on_conflict=menu_item_id,ingredient_id", {
    method: "POST", body: links, prefer: "resolution=ignore-duplicates,return=minimal",
  })
  console.log(`\n✓ เขียน ${links.length} recipe links ลง DB แล้ว (qty_stock=0)`)
  console.log("→ เจ้าของร้านเข้าหน้า 'สูตรขนม' กรอก qty_stock ต่อเมนู → ตัดสต็อกอัตโนมัติทันที")
}

main().catch((e) => { console.error("✗", e.message); process.exit(1) })
