// foodstory_fetch.mjs — ทดสอบดึงยอดขายจาก owner.foodstory.co (อ่านอย่างเดียว ไม่เขียน DB)
// ใช้: cd deploy && node scripts/foodstory_fetch.mjs
import { fetchMonthlySales } from "./lib/foodstory.mjs"

const { year, month, rows, total } = await fetchMonthlySales()
console.log(`✓ ${year}-${month}: ${rows.length} แถว (recordsTotal=${total})\n`)

let qty = 0, sales = 0
for (const r of rows) { qty += Number(r.sales_volumn) || 0; sales += Number(r.gross_sales) || 0 }
console.table(rows.slice(0, 15).map((r) => ({
  วันที่: r.show_dt, menu_id: r.menu_id, code: r.product_code,
  สินค้า: r.product_name, จำนวน: r.sales_volumn, ยอดขาย: r.gross_sales, สาขา: r.branch_name,
})))
if (rows.length > 15) console.log(`  ... อีก ${rows.length - 15} แถว`)
console.log(`\nรวม: ${qty} ชิ้น · ${sales.toLocaleString()} บาท`)
