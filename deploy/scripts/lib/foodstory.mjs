// lib/foodstory.mjs — ตัวเชื่อม owner.foodstory.co (shared)
// auth แบบ MVP: session cookie + CSRF token จาก .env.local (copy จาก DevTools)
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = "https://owner.foodstory.co"

// โหลด .env.local แบบง่าย (ไม่พึ่ง dependency) — เรียกครั้งเดียวตอน import
export function loadEnv() {
  try {
    const txt = readFileSync(join(HERE, "..", "..", ".env.local"), "utf8")
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch { /* ไม่มีไฟล์ก็ข้าม */ }
}
loadEnv()

function headers() {
  const COOKIE = process.env.FOODSTORY_COOKIE
  const CSRF = process.env.FOODSTORY_CSRF
  if (!COOKIE || !CSRF) {
    throw new Error("ขาด FOODSTORY_COOKIE / FOODSTORY_CSRF ใน .env.local (copy จาก DevTools)")
  }
  return {
    "Cookie": COOKIE,
    "X-CSRF-Token": CSRF,
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Origin": BASE,
    "Referer": `${BASE}/th/salebyproductdaily`,
    "User-Agent": "Mozilla/5.0 (kanommae-sync)",
  }
}

async function post(path, bodyObj) {
  const body = new URLSearchParams(bodyObj).toString()
  const res = await fetch(BASE + path, { method: "POST", headers: headers(), body })
  const text = await res.text()
  return { status: res.status, text, ctype: res.headers.get("content-type") || "" }
}

function dataTablesBody() {
  const cols = [
    "show_dt", "product_code", "product_name", "menu_group_name", "category",
    "avg_price", "sales_volumn", "gross_sales", "discount", "discounted_price", "branch_name",
  ]
  const b = {
    draw: "1", start: "0", length: "5000", "search[value]": "", "search[regex]": "false",
    "order[0][column]": "0", "order[0][dir]": "asc",
  }
  cols.forEach((c, i) => {
    b[`columns[${i}][data]`] = c
    b[`columns[${i}][name]`] = c
    b[`columns[${i}][searchable]`] = "true"
    b[`columns[${i}][orderable]`] = "true"
    b[`columns[${i}][search][value]`] = ""
    b[`columns[${i}][search][regex]`] = "false"
  })
  return b
}

// ดึงยอดขายรายสินค้าต่อวัน ของเดือนที่ระบุ → คืน array ของ row (ตาม schema ของ FoodStory)
export async function fetchMonthlySales({ year, month } = {}) {
  year = String(year || process.env.FOODSTORY_YEAR || new Date().getFullYear())
  month = String(month || process.env.FOODSTORY_MONTH || new Date().getMonth() + 1)

  const t = await post("/api/setTimeLenght", { year })
  const mo = await post("/api/setMonthLenght", { month })
  if ([401, 419, 302].includes(t.status) || [401, 419, 302].includes(mo.status)) {
    throw new Error(`auth ไม่ผ่าน (setTime ${t.status}/setMonth ${mo.status}) — cookie/csrf หมดอายุ → copy ใหม่`)
  }

  const r = await post("/salebyproductdaily/getdata", dataTablesBody())
  if (!r.ctype.includes("json")) {
    throw new Error(`getdata ไม่คืน JSON (status ${r.status}, ${r.ctype}) — น่าจะถูกเด้ง login`)
  }
  const data = JSON.parse(r.text)
  return { year, month, rows: data.data || [], total: data.recordsTotal }
}

// map หมวด FoodStory → category ของ menu_items (best-effort)
export function mapCategory(fsCategory = "", name = "") {
  const s = (fsCategory + " " + name)
  if (s.includes("น้ำแข็งใส")) return "namkhaengsai"
  if (s.includes("ไอศกรีม") && (s.includes("ถ้วย") || s.includes("สกู๊ป"))) return "icecream_cup"
  if (s.includes("ไอศกรีม")) return "icecream"
  if (s.includes("บัวลอย")) return "signature"
  if (s.toLowerCase().includes("signature")) return "signature"
  if (s.includes("ปังปิ้ง") || s.includes("ขนมปัง")) return "khanompang"
  if (s.includes("โซดา")) return "drink"
  return "khanomthai"
}

export { BASE }
