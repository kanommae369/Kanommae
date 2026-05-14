// ─────────────────────────────────────────────
// ขนมแม่ — Static reference data
// ─────────────────────────────────────────────

// หมวดวัตถุดิบ (ingredients.category)
export const INGREDIENT_CATEGORIES = {
  thai_mix:  { label: "ส่วนผสมขนมไทย", color: "#4FC3F7" },
  frozen:    { label: "ของแช่แข็ง",     color: "#B794F6" },
  ssb:       { label: "สินสมบูรณ์ (SSB)", color: "#68D391" },
  market:    { label: "วัตถุดิบอื่นๆ",   color: "#FFC857" },
  packaging: { label: "บรรจุภัณฑ์",     color: "#FF8A65" },
}

// แหล่งสั่งซื้อ (ingredients.source)
export const INGREDIENT_SOURCES = {
  HQ:     "สำนักงานใหญ่",
  SSB:    "สินสมบูรณ์ (SSB)",
  MARKET: "ตลาด/ทั่วไป",
}

// หมวดเมนูขาย (menu_items.category)
export const MENU_CATEGORIES = {
  signature:    "เมนู Signature (บัวลอยมีไส้)",
  icecream:     "ไอศกรีม",
  namkhaengsai: "น้ำแข็งใส",
  khanomthai:   "ขนมไทย",
  pingping:     "ปังปิ้ง",
  khanompang:   "ขนมปัง",
  drink:        "เครื่องดื่ม",
  icecream_cup: "ไอศกรีมแบบถ้วย",
}

// ช่องทางขาย (sales.channel)
export const SALES_CHANNELS = {
  dine_in:  "ทานที่ร้าน",
  takeaway: "ซื้อกลับบ้าน",
  delivery: "Delivery",
}

// สถานะสินค้าเคลม (claims.status)
export const CLAIM_STATUS = {
  returned: "คืนสต็อก",
  damaged:  "ชำรุด",
  lost:     "สูญหาย",
}

// เหตุผลตัดสต็อก (stock_out.reason)
export const STOCK_OUT_REASONS = {
  used:    "ใช้/เบิกผลิต",
  waste:   "ของเสีย",
  expired: "หมดอายุ",
  claim:   "เคลม",
}

// location ของสต็อก
export const STOCK_LOCATIONS = {
  home: "คลังที่บ้าน",
  shop: "หน้าร้าน",
}

export const CHART_COLORS = ["#00D4FF", "#B794F6", "#68D391", "#FFC857", "#FF4466", "#4FC3F7"]
export const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
