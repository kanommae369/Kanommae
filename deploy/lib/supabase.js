import { createClient } from "@supabase/supabase-js"

// fallback placeholder กัน createClient throw ตอน build (ยังไม่มี .env.local)
// runtime จริงต้องตั้งค่าใน .env.local — query จะ fail แบบ graceful ถ้าไม่ได้ตั้ง
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Auth ──────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// Lookup email จาก username (ผ่าน server-side endpoint ที่ใช้ service_role)
async function lookupEmailByUsername(username) {
  const res = await fetch("/api/auth/lookup-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) throw new Error("not_found")
  const { email } = await res.json()
  if (!email) throw new Error("not_found")
  return email
}

export async function signInWithUsername(username, password) {
  const email = await lookupEmailByUsername(username)
  return signIn(email, password)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("display_name")
  if (error) throw error
  return data
}

// ── Login History ─────────────────────────────────────────────
export async function logLoginEvent(userId, email, displayName, action = "login") {
  const { error } = await supabase.from("login_history").insert([{
    user_id:      userId,
    email:        email,
    display_name: displayName || null,
    action:       action,
    user_agent:   typeof navigator !== "undefined" ? navigator.userAgent : null,
  }])
  if (error) console.error("Failed to log login event:", error)
}

export async function getLoginHistory(limit = 50) {
  const { data, error } = await supabase
    .from("login_history").select("*")
    .order("created_at", { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

// ── Branches ──────────────────────────────────────────────────
export async function getBranches() {
  const { data, error } = await supabase.from("branches").select("*").order("branch_id")
  if (error) throw error
  return data
}

// ── Ingredients (วัตถุดิบ) ─────────────────────────────────────
export async function getIngredients() {
  const { data, error } = await supabase
    .from("ingredients").select("*").eq("is_active", true).order("ingredient_id")
  if (error) throw error
  return data
}

export async function addIngredient(record) {
  const { data, error } = await supabase
    .from("ingredients").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function updateIngredient(ingredientId, updates) {
  const { data, error } = await supabase
    .from("ingredients").update(updates).eq("ingredient_id", ingredientId).select().single()
  if (error) throw error
  return data
}

export async function deactivateIngredient(ingredientId) {
  const { error } = await supabase
    .from("ingredients").update({ is_active: false }).eq("ingredient_id", ingredientId)
  if (error) throw error
}

// คำนวณ avg_cost ใหม่ (moving average) — เรียกหลังแก้ไข/ลบ stock_in
export async function recalcAvgCost(ingredientId) {
  const { error } = await supabase.rpc("recalc_ingredient_avg_cost", {
    p_ingredient_id: ingredientId,
  })
  if (error) throw error
}

// ── Stock Balance (view: แยกคลังที่บ้าน / หน้าร้าน) ───────────
export async function getStockBalance() {
  const { data, error } = await supabase
    .from("v_stock_balance").select("*").order("ingredient_id")
  if (error) throw error
  return data
}

// ── Stock In (รับวัตถุดิบเข้าคลัง) ────────────────────────────
export async function getStockIn() {
  const { data, error } = await supabase
    .from("stock_in").select("*").order("received_at", { ascending: false })
  if (error) throw error
  return data
}

export async function addStockIn(record) {
  const { data, error } = await supabase.from("stock_in").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function updateStockIn(id, record) {
  const { data, error } = await supabase
    .from("stock_in").update(record).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteStockIn(id) {
  const { error } = await supabase.from("stock_in").delete().eq("id", id)
  if (error) throw error
}

// ── Stock Transfers (โอนคลังที่บ้าน → หน้าร้าน) ───────────────
export async function getStockTransfers() {
  const { data, error } = await supabase
    .from("stock_transfers").select("*").order("transferred_at", { ascending: false })
  if (error) throw error
  return data
}

export async function addStockTransfer(record) {
  const { data, error } = await supabase
    .from("stock_transfers").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function deleteStockTransfer(id) {
  const { error } = await supabase.from("stock_transfers").delete().eq("id", id)
  if (error) throw error
}

// ── Stock Out (ตัดสต็อก: ใช้ผลิต / ของเสีย / หมดอายุ / เคลม) ──
export async function getStockOut() {
  const { data, error } = await supabase
    .from("stock_out").select("*").order("withdrawn_at", { ascending: false })
  if (error) throw error
  return data
}

export async function addStockOut(record) {
  const { data, error } = await supabase.from("stock_out").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function deleteStockOut(id) {
  const { error } = await supabase.from("stock_out").delete().eq("id", id)
  if (error) throw error
}

// ── Menu Items + Recipes (BOM) ────────────────────────────────
export async function getMenuItems() {
  const { data, error } = await supabase
    .from("menu_items").select("*").eq("is_active", true).order("menu_id")
  if (error) throw error
  return data
}

export async function addMenuItem(record) {
  const { data, error } = await supabase.from("menu_items").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function updateMenuItem(id, updates) {
  const { data, error } = await supabase
    .from("menu_items").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

// recipe ทั้งหมด (BOM ทุกเมนู) — join ชื่อวัตถุดิบมาด้วย
export async function getRecipes() {
  const { data, error } = await supabase
    .from("recipes")
    .select("*, ingredients(name, unit, avg_cost)")
    .order("menu_item_id")
  if (error) throw error
  return data
}

export async function getRecipeByMenu(menuItemId) {
  const { data, error } = await supabase
    .from("recipes")
    .select("*, ingredients(name, unit, avg_cost)")
    .eq("menu_item_id", menuItemId)
  if (error) throw error
  return data
}

export async function setRecipeLine(record) {
  // upsert ตาม (menu_item_id, ingredient_id)
  const { data, error } = await supabase
    .from("recipes").upsert([record], { onConflict: "menu_item_id,ingredient_id" })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteRecipeLine(id) {
  const { error } = await supabase.from("recipes").delete().eq("id", id)
  if (error) throw error
}

// ต้นทุน + กำไรต่อเมนู (view รวมจาก recipe × avg_cost)
export async function getMenuCost() {
  const { data, error } = await supabase.from("v_menu_cost").select("*").order("menu_id")
  if (error) throw error
  return data
}

// ── Sales (บันทึกขาย — ตัดสต็อกตามสูตรอัตโนมัติ) ──────────────
// items: [{ menu_item_id, quantity, unit_price }, ...]
// source: 'manual' | 'pos' | 'web' · posRef: เลขอ้างอิงจาก POS (กันบันทึกซ้ำ)
export async function recordSale({ channel, billNo, items, soldAt, note, source, posRef }) {
  const { data, error } = await supabase.rpc("record_sale", {
    p_channel: channel,
    p_bill_no: billNo || null,
    p_items:   items,
    p_sold_at: soldAt || new Date().toISOString(),
    p_note:    note || null,
    p_source:  source || "manual",
    p_pos_ref: posRef || null,
  })
  if (error) throw error
  return data // sale_id
}

export async function getSales(days = 30) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await supabase
    .from("sales")
    .select("*, sale_items(*, menu_items(name, category))")
    .gte("sold_at", from.toISOString())
    .order("sold_at", { ascending: false })
  if (error) throw error
  return data
}

export async function deleteSale(id) {
  // ลบ sale → ON DELETE CASCADE จะลบ sale_items ให้
  // หมายเหตุ: stock_out ที่ผูก from_sale_id ต้องลบแยก
  await supabase.from("stock_out").delete().eq("from_sale_id", id)
  const { error } = await supabase.from("sales").delete().eq("id", id)
  if (error) throw error
}

export async function getDailySales(days = 7) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const { data, error } = await supabase
    .from("v_daily_sales").select("*")
    .gte("sale_date", from.toISOString().slice(0, 10))
    .order("sale_date", { ascending: false })
  if (error) throw error
  return data
}

// ── Claims (เคลม / คืนเงิน) ────────────────────────────────────
export async function getClaims() {
  const { data, error } = await supabase
    .from("claims").select("*, menu_items(name)").order("claimed_at", { ascending: false })
  if (error) throw error
  return data
}

export async function addClaim(record) {
  const { data, error } = await supabase.from("claims").insert([record]).select().single()
  if (error) throw error
  return data
}

export async function updateClaim(id, updates) {
  const { data, error } = await supabase
    .from("claims").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteClaim(id) {
  await supabase.from("stock_out").delete().eq("from_claim_id", id)
  const { error } = await supabase.from("claims").delete().eq("id", id)
  if (error) throw error
}

// ── POS Sync Log (บันทึกการเชื่อมต่อ POS — Ocha) ──────────────
export async function getPosSyncLog(limit = 100) {
  const { data, error } = await supabase
    .from("pos_sync_log").select("*")
    .order("created_at", { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function addPosSyncLog(record) {
  const { data, error } = await supabase
    .from("pos_sync_log").insert([record]).select().single()
  if (error) throw error
  return data
}
