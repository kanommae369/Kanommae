"use client"
import { useState, useMemo } from "react"
import {
  Search, Plus, Pencil, Trash2, Loader2, X, Check, PackageX,
} from "lucide-react"
import { fmt, fmtB } from "../shared/helpers"
import { INGREDIENT_CATEGORIES, INGREDIENT_SOURCES } from "../shared/constants"
import { SectionTitle, CategoryBadge, EmptyState, Toast, IconBtn } from "../shared/ui-kit"

const CAT_KEYS = Object.keys(INGREDIENT_CATEGORIES)
const COMMON_UNITS = ["ถุง", "แพ็ค", "กล่อง", "ก้อน", "ถ้วย", "ขวด", "แถว", "ห่อ", "อัน", "กก", "ลัง"]

// auto-gen ingredient_id ตัวถัดไป จาก ING-#### ที่มีอยู่
function nextIngredientId(ingredients) {
  let max = 0
  for (const i of ingredients) {
    const m = /^ING-(\d+)$/.exec(i.ingredient_id || "")
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `ING-${String(max + 1).padStart(4, "0")}`
}

const emptyForm = {
  name: "", category: "thai_mix", source: "HQ", unit: "ถุง",
  avg_cost: "", min_stock: "", reorder_qty: "",
  is_perishable: false, shelf_life_days: "",
}

export default function PageIngredients({
  ingredients = [], onAddIngredient, onUpdateIngredient, onDeactivateIngredient,
}) {
  const [search, setSearch] = useState("")
  const [catSel, setCatSel] = useState("all")
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const rows = ingredients
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => catSel === "all" || i.category === catSel)

  const countByCat = useMemo(() => {
    const c = {}
    for (const i of ingredients) c[i.category] = (c[i.category] || 0) + 1
    return c
  }, [ingredients])

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="วัตถุดิบ"
        subtitle={`จัดการรายการวัตถุดิบทั้งหมด ${ingredients.length} รายการ`}
        actions={
          <button onClick={() => { setAdding((v) => !v); setEditId(null) }} className="km-btn km-btn-primary">
            {adding ? <X size={16} /> : <Plus size={16} />}
            {adding ? "ปิดฟอร์ม" : "เพิ่มวัตถุดิบ"}
          </button>
        }
      />
      <Toast toast={toast} />

      {/* ฟอร์มเพิ่ม */}
      {adding && (
        <IngredientForm
          title="เพิ่มวัตถุดิบใหม่"
          initial={emptyForm}
          onSubmit={async (data) => {
            await onAddIngredient({ ingredient_id: nextIngredientId(ingredients), ...data, is_active: true })
            showToast(`เพิ่ม "${data.name}" สำเร็จ`)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* ค้นหา + กรอง */}
      <div className="km-card p-4 md:p-5">
        <div className="flex flex-wrap gap-2.5 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาวัตถุดิบ..."
              className="km-input pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCatSel("all")} className={`km-chip ${catSel === "all" ? "km-chip-active" : ""}`}>
              ทั้งหมด {ingredients.length}
            </button>
            {CAT_KEYS.map((k) => (
              <button key={k} onClick={() => setCatSel(k)} className={`km-chip ${catSel === k ? "km-chip-active" : ""}`}>
                {INGREDIENT_CATEGORIES[k].label} {countByCat[k] || 0}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState message="ไม่พบวัตถุดิบ" />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((ing) => (
              <IngredientRow
                key={ing.ingredient_id}
                ingredient={ing}
                editing={editId === ing.ingredient_id}
                onEdit={() => { setEditId(ing.ingredient_id); setAdding(false) }}
                onCancelEdit={() => setEditId(null)}
                onSave={async (data) => {
                  await onUpdateIngredient(ing.ingredient_id, data)
                  showToast(`บันทึก "${data.name}" สำเร็จ`)
                  setEditId(null)
                }}
                onDeactivate={async () => {
                  await onDeactivateIngredient(ing.ingredient_id)
                  showToast(`ปิดใช้งาน "${ing.name}" แล้ว`)
                }}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// แถววัตถุดิบ — โหมดดู / โหมดแก้ไข (inline)
// ────────────────────────────────────────────────
function IngredientRow({ ingredient: ing, editing, onEdit, onCancelEdit, onSave, onDeactivate, showToast }) {
  const [confirming, setConfirming] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  if (editing) {
    return (
      <IngredientForm
        title={`แก้ไข — ${ing.name}`}
        initial={{
          name: ing.name,
          category: ing.category,
          source: ing.source,
          unit: ing.unit,
          avg_cost: String(ing.avg_cost ?? ""),
          min_stock: String(ing.min_stock ?? ""),
          reorder_qty: String(ing.reorder_qty ?? ""),
          is_perishable: !!ing.is_perishable,
          shelf_life_days: String(ing.shelf_life_days ?? ""),
        }}
        idLabel={ing.ingredient_id}
        onSubmit={onSave}
        onCancel={onCancelEdit}
        compact
      />
    )
  }

  const doDeactivate = async () => {
    setDeactivating(true)
    try {
      await onDeactivate()
    } catch (err) {
      showToast("ปิดใช้งานไม่สำเร็จ: " + err.message, "error")
    } finally {
      setDeactivating(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-km-text">{ing.name}</p>
            <CategoryBadge category={ing.category} />
            {ing.is_perishable && (
              <span className="text-[10px] text-km-warning border border-km-warning/30 bg-km-warning/10 rounded px-1.5 py-0.5">
                ของสด
              </span>
            )}
          </div>
          <p className="text-[11px] text-km-text-muted mt-1 km-mono">{ing.ingredient_id}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-km-text-secondary">
            <span>{INGREDIENT_SOURCES[ing.source] || ing.source}</span>
            <span>หน่วย {ing.unit}</span>
            <span>ทุนเฉลี่ย <b className="km-mono">{fmtB(ing.avg_cost)}</b></span>
            <span>ขั้นต่ำ <b className="km-mono">{fmt(ing.min_stock)}</b></span>
            <span>สั่งเพิ่ม <b className="km-mono">{fmt(ing.reorder_qty)}</b></span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {!confirming && (
            <>
              <button onClick={onEdit}>
                <IconBtn variant="info" title="แก้ไข"><Pencil size={12} /></IconBtn>
              </button>
              <button onClick={() => setConfirming(true)}>
                <IconBtn variant="danger" title="ปิดใช้งาน"><Trash2 size={12} /></IconBtn>
              </button>
            </>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-km-danger/20 flex items-center justify-between">
          <span className="text-[12px] text-km-danger font-medium flex items-center gap-1">
            <PackageX size={13} /> ปิดใช้งานวัตถุดิบนี้?
          </span>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="km-btn km-btn-ghost text-xs px-3 min-h-0 py-1.5">
              ยกเลิก
            </button>
            <button onClick={doDeactivate} disabled={deactivating} className="km-btn km-btn-danger text-xs px-3 min-h-0 py-1.5">
              {deactivating ? <Loader2 size={11} className="animate-spin" /> : <PackageX size={11} />} ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// ฟอร์มเพิ่ม/แก้ไขวัตถุดิบ
// ────────────────────────────────────────────────
function IngredientForm({ title, initial, idLabel, onSubmit, onCancel, compact }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const label = "block text-[11px] font-medium uppercase tracking-wide text-km-text-muted mb-1.5"

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        category: form.category,
        source: form.source,
        unit: form.unit.trim() || "ถุง",
        avg_cost: parseFloat(form.avg_cost) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        reorder_qty: parseFloat(form.reorder_qty) || 0,
        is_perishable: !!form.is_perishable,
        shelf_life_days: form.is_perishable && form.shelf_life_days
          ? parseInt(form.shelf_life_days, 10)
          : null,
      })
    } catch (err) {
      alert("บันทึกไม่สำเร็จ: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const wrap = compact
    ? "rounded-xl bg-km-accent/5 border border-km-accent p-3.5"
    : "km-card p-4 md:p-5"

  return (
    <form onSubmit={submit} className={`${wrap} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-km-text">{title}</h3>
        {idLabel && <span className="text-[11px] km-mono text-km-text-muted">{idLabel}</span>}
      </div>

      <div>
        <label className={label}>ชื่อวัตถุดิบ <span className="text-km-danger">*</span></label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="km-input"
          placeholder="เช่น กล้วยบวชชี"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={label}>หมวด</label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="km-input">
            {CAT_KEYS.map((k) => (
              <option key={k} value={k}>{INGREDIENT_CATEGORIES[k].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>แหล่งซื้อ</label>
          <select value={form.source} onChange={(e) => set("source", e.target.value)} className="km-input">
            {Object.entries(INGREDIENT_SOURCES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={label}>หน่วย</label>
          <input
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            className="km-input"
            list="km-units"
            placeholder="ถุง"
          />
          <datalist id="km-units">
            {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </div>
        <div>
          <label className={label}>ทุนเฉลี่ย/หน่วย (บาท)</label>
          <input
            type="number" min="0" step="0.01"
            value={form.avg_cost}
            onChange={(e) => set("avg_cost", e.target.value)}
            className="km-input km-mono"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={label}>สต็อกขั้นต่ำ</label>
          <input
            type="number" min="0" step="0.01"
            value={form.min_stock}
            onChange={(e) => set("min_stock", e.target.value)}
            className="km-input km-mono"
            placeholder="0"
          />
        </div>
        <div>
          <label className={label}>จำนวนสั่งเพิ่ม</label>
          <input
            type="number" min="0" step="0.01"
            value={form.reorder_qty}
            onChange={(e) => set("reorder_qty", e.target.value)}
            className="km-input km-mono"
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="km-perishable"
          checked={form.is_perishable}
          onChange={(e) => set("is_perishable", e.target.checked)}
          className="w-4 h-4 accent-km-accent"
        />
        <label htmlFor="km-perishable" className="text-sm text-km-text-secondary">
          เป็นของสด (มีวันหมดอายุ)
        </label>
      </div>

      {form.is_perishable && (
        <div>
          <label className={label}>อายุเก็บได้ (วัน) — ไม่บังคับ</label>
          <input
            type="number" min="0"
            value={form.shelf_life_days}
            onChange={(e) => set("shelf_life_days", e.target.value)}
            className="km-input km-mono w-40"
            placeholder="เช่น 7"
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !form.name.trim()} className="km-btn km-btn-primary flex-1">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={onCancel} className="km-btn km-btn-ghost">
          ยกเลิก
        </button>
      </div>
    </form>
  )
}
