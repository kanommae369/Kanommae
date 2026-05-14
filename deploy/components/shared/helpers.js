import { THAI_MONTHS } from "./constants"

export const fmt  = (n) => (n ?? 0).toLocaleString("th-TH")
export const fmtB = (n) =>
  `฿${(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const today = () => new Date().toISOString().slice(0, 10)

// แปลง ISO timestamp (UTC) → "YYYY-MM-DD" ตามเวลาไทย (Asia/Bangkok = UTC+7)
// กันวันเลื่อนเที่ยงคืน BKK
export const toBkkDate = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000)
  return bkk.toISOString().slice(0, 10)
}

export function getLastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

export function fmtDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00")
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

// จำนวนวันจนถึงวันหมดอายุ (ติดลบ = หมดอายุแล้ว) — ใช้กับ stock_in.expiry_date
export function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null
  const exp = new Date(expiryDate + "T00:00:00")
  const now = new Date(today() + "T00:00:00")
  return Math.round((exp - now) / 86400000)
}

// true เมื่อยอดคงเหลือ <= สต็อกขั้นต่ำ → ต้องสั่งเพิ่ม
export const needsReorder = (balance, minStock) =>
  minStock != null && balance != null && balance <= minStock
