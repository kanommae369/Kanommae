"use client"
import { useState, useMemo, useEffect } from "react"
import {
  Search, Plus, Trash2, Loader2, ChevronLeft, BookOpen, AlertTriangle, Check,
} from "lucide-react"
import { fmt, fmtB } from "../shared/helpers"
import { MENU_CATEGORIES } from "../shared/constants"
import { SectionTitle, EmptyState, Toast, IconBtn } from "../shared/ui-kit"

export default function PageRecipes({
  menuItems = [], recipes = [], ingredients = [],
  onSetRecipeLine, onDeleteRecipeLine,
}) {
  const [selectedId, setSelectedId] = useState(menuItems[0]?.id || null)
  const [search, setSearch] = useState("")
  const [catSel, setCatSel] = useState("all")
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // recipe lines จัดกลุ่มตามเมนู
  const recipesByMenu = useMemo(() => {
    const m = {}
    for (const r of recipes) {
      ;(m[r.menu_item_id] ||= []).push(r)
    }
    return m
  }, [recipes])

  // ต้นทุนต่อเมนู (คำนวณสดจาก qty_stock × avg_cost)
  const costOf = (menuId) =>
    (recipesByMenu[menuId] || []).reduce(
      (sum, r) => sum + (parseFloat(r.qty_stock) || 0) * (parseFloat(r.ingredients?.avg_cost) || 0),
      0
    )

  const filteredMenus = menuItems
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => catSel === "all" || m.category === catSel)

  const selectedMenu = menuItems.find((m) => m.id === selectedId)
  const selectedLines = recipesByMenu[selectedId] || []

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="สูตรขนม (BOM)"
        subtitle="กำหนดวัตถุดิบในแต่ละเมนู — ระบบใช้คิดต้นทุนและตัดสต็อกตอนขาย"
      />
      <Toast toast={toast} />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 md:gap-5">
        {/* ───── เมนูลิสต์ ───── */}
        <div className={`km-card p-3 md:p-4 ${selectedMenu ? "hidden lg:block" : ""}`}>
          <div className="relative mb-2.5">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเมนู..."
              className="km-input pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            <button onClick={() => setCatSel("all")} className={`km-chip ${catSel === "all" ? "km-chip-active" : ""}`}>
              ทั้งหมด
            </button>
            {Object.entries(MENU_CATEGORIES).map(([k, label]) => (
              <button key={k} onClick={() => setCatSel(k)} className={`km-chip ${catSel === k ? "km-chip-active" : ""}`}>
                {label.replace(/ \(.*\)/, "")}
              </button>
            ))}
          </div>
          {filteredMenus.length === 0 ? (
            <EmptyState message="ไม่พบเมนู" />
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredMenus.map((m) => {
                const lines = recipesByMenu[m.id] || []
                const hasZero = lines.some((r) => (parseFloat(r.qty_stock) || 0) === 0)
                const on = m.id === selectedId
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`text-left rounded-xl px-3 py-2.5 border transition-colors ${
                      on
                        ? "bg-km-accent/10 border-km-accent"
                        : "bg-km-surface border-km-border-subtle hover:border-km-accent-soft"
                    }`}
                  >
                    <p className="text-sm font-medium text-km-text">{m.name}</p>
                    <p className="text-[11px] text-km-text-muted mt-0.5 flex items-center gap-1.5">
                      <span>{lines.length} วัตถุดิบ</span>
                      {lines.length === 0 && <span className="text-km-text-disabled">· ยังไม่มีสูตร</span>}
                      {hasZero && lines.length > 0 && (
                        <span className="text-km-warning flex items-center gap-0.5">
                          <AlertTriangle size={10} /> qty ยังไม่ครบ
                        </span>
                      )}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ───── ตัวแก้สูตร ───── */}
        <div className={selectedMenu ? "" : "hidden lg:block"}>
          {!selectedMenu ? (
            <div className="km-card p-6">
              <EmptyState message="เลือกเมนูจากรายการเพื่อแก้สูตร" />
            </div>
          ) : (
            <RecipeEditor
              menu={selectedMenu}
              lines={selectedLines}
              ingredients={ingredients}
              cost={costOf(selectedId)}
              onSetRecipeLine={onSetRecipeLine}
              onDeleteRecipeLine={onDeleteRecipeLine}
              onBack={() => setSelectedId(null)}
              showToast={showToast}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// ตัวแก้สูตรของเมนูที่เลือก
// ────────────────────────────────────────────────
function RecipeEditor({ menu, lines, ingredients, cost, onSetRecipeLine, onDeleteRecipeLine, onBack, showToast }) {
  const price = parseFloat(menu.price) || 0
  const margin = price - cost
  const usedIds = new Set(lines.map((l) => l.ingredient_id))
  const available = ingredients.filter((i) => !usedIds.has(i.ingredient_id))

  return (
    <div className="km-card p-4 md:p-5 flex flex-col gap-4">
      {/* header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="lg:hidden p-1 -ml-1 text-km-text-muted">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen size={18} className="text-km-accent-hi" />
            <h3 className="font-bold text-km-text text-lg">{menu.name}</h3>
          </div>
          <p className="text-xs text-km-text-muted mt-0.5">
            {MENU_CATEGORIES[menu.category] || menu.category} · รหัส {menu.menu_id}
          </p>
        </div>
      </div>

      {/* สรุปต้นทุน/กำไร */}
      <div className="grid grid-cols-3 gap-2.5">
        <SummaryBox label="ต้นทุนรวม" value={fmtB(cost)} tone="muted" />
        <SummaryBox label="ราคาขาย" value={fmtB(price)} tone="accent" />
        <SummaryBox
          label="กำไร"
          value={fmtB(margin)}
          tone={margin < 0 ? "danger" : "success"}
        />
      </div>

      {/* รายการวัตถุดิบในสูตร */}
      <div>
        <h4 className="text-sm font-semibold text-km-text mb-2">วัตถุดิบในสูตร</h4>
        {lines.length === 0 ? (
          <p className="text-sm text-km-text-muted py-4 text-center">
            ยังไม่มีวัตถุดิบในสูตรนี้ — เพิ่มด้านล่าง
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((line) => (
              <RecipeLineRow
                key={line.id}
                line={line}
                onSave={onSetRecipeLine}
                onDelete={onDeleteRecipeLine}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>

      {/* เพิ่มวัตถุดิบ */}
      <AddLineForm
        menuId={menu.id}
        available={available}
        onSave={onSetRecipeLine}
        showToast={showToast}
      />
    </div>
  )
}

function SummaryBox({ label, value, tone }) {
  const toneCls = {
    muted: "text-km-text-secondary",
    accent: "text-km-accent-hi",
    success: "text-km-success",
    danger: "text-km-danger",
  }[tone]
  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle px-3 py-2.5 text-center">
      <p className="text-[11px] text-km-text-muted">{label}</p>
      <p className={`km-mono font-bold mt-0.5 ${toneCls}`}>{value}</p>
    </div>
  )
}

// แถววัตถุดิบ 1 บรรทัด — แก้ qty_stock / qty_display / note · save on blur
function RecipeLineRow({ line, onSave, onDelete, showToast }) {
  const [qtyStock, setQtyStock] = useState(String(line.qty_stock ?? ""))
  const [qtyDisplay, setQtyDisplay] = useState(line.qty_display || "")
  const [note, setNote] = useState(line.note || "")
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setQtyStock(String(line.qty_stock ?? ""))
    setQtyDisplay(line.qty_display || "")
    setNote(line.note || "")
  }, [line.id, line.qty_stock, line.qty_display, line.note])

  const ing = line.ingredients || {}
  const lineCost = (parseFloat(qtyStock) || 0) * (parseFloat(ing.avg_cost) || 0)

  const dirty =
    String(line.qty_stock ?? "") !== qtyStock ||
    (line.qty_display || "") !== qtyDisplay ||
    (line.note || "") !== note

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await onSave({
        id: line.id,
        menu_item_id: line.menu_item_id,
        ingredient_id: line.ingredient_id,
        qty_stock: parseFloat(qtyStock) || 0,
        qty_display: qtyDisplay || null,
        note: note || null,
      })
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    try {
      await onDelete(line.id)
      showToast("ลบวัตถุดิบออกจากสูตรแล้ว")
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error")
    }
  }

  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-km-text">
          {ing.name || line.ingredient_id}
          <span className="text-km-text-muted font-normal"> ({ing.unit || "หน่วย"})</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 size={13} className="animate-spin text-km-text-muted" />}
          {justSaved && <Check size={14} className="text-km-success" />}
          {confirming ? (
            <div className="flex gap-1.5">
              <button onClick={() => setConfirming(false)} className="text-[11px] text-km-text-muted">
                ยกเลิก
              </button>
              <button onClick={del} className="text-[11px] font-semibold text-km-danger">
                ลบ
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}>
              <IconBtn variant="danger" title="ลบออกจากสูตร"><Trash2 size={12} /></IconBtn>
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] uppercase text-km-text-muted">qty (หน่วยสต็อก)</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={qtyStock}
            onChange={(e) => setQtyStock(e.target.value)}
            onBlur={save}
            className="km-input km-mono py-1.5 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-km-text-muted">ปริมาณตัก (อ้างอิง)</label>
          <input
            value={qtyDisplay}
            onChange={(e) => setQtyDisplay(e.target.value)}
            onBlur={save}
            className="km-input py-1.5 text-sm"
            placeholder="เช่น 5 ลูก, 2 กระบวย"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] uppercase text-km-text-muted">หมายเหตุ</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={save}
            className="km-input py-1.5 text-sm"
            placeholder="ไม่บังคับ"
          />
        </div>
      </div>
      <div className="flex justify-between mt-2 text-[11px]">
        <span className="text-km-text-muted">
          ต้นทุน/หน่วย {fmtB(ing.avg_cost || 0)}
        </span>
        <span className="km-mono font-semibold text-km-text-secondary">
          ต้นทุนในสูตร {fmtB(lineCost)}
        </span>
      </div>
      {(parseFloat(qtyStock) || 0) === 0 && (
        <p className="text-[11px] text-km-warning mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> qty = 0 — ระบบจะไม่ตัดสต็อกรายการนี้ตอนขาย
        </p>
      )}
    </div>
  )
}

// ฟอร์มเพิ่มวัตถุดิบเข้าสูตร
function AddLineForm({ menuId, available, onSave, showToast }) {
  const [ingredientId, setIngredientId] = useState("")
  const [qtyStock, setQtyStock] = useState("")
  const [qtyDisplay, setQtyDisplay] = useState("")
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!ingredientId) {
      showToast("เลือกวัตถุดิบก่อน", "error")
      return
    }
    setSaving(true)
    try {
      await onSave({
        menu_item_id: menuId,
        ingredient_id: ingredientId,
        qty_stock: parseFloat(qtyStock) || 0,
        qty_display: qtyDisplay || null,
        note: null,
      })
      showToast("เพิ่มวัตถุดิบเข้าสูตรแล้ว")
      setIngredientId("")
      setQtyStock("")
      setQtyDisplay("")
    } catch (err) {
      showToast("เพิ่มไม่สำเร็จ: " + err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-km-border-strong p-3 bg-km-surface/50">
      <h4 className="text-sm font-semibold text-km-text mb-2">เพิ่มวัตถุดิบ</h4>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
        <div>
          <label className="text-[10px] uppercase text-km-text-muted">วัตถุดิบ</label>
          <select
            value={ingredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            className="km-input py-1.5 text-sm"
          >
            <option value="">— เลือก —</option>
            {available.map((i) => (
              <option key={i.ingredient_id} value={i.ingredient_id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-24">
          <label className="text-[10px] uppercase text-km-text-muted">qty สต็อก</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={qtyStock}
            onChange={(e) => setQtyStock(e.target.value)}
            className="km-input km-mono py-1.5 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-km-text-muted">ปริมาณตัก</label>
          <input
            value={qtyDisplay}
            onChange={(e) => setQtyDisplay(e.target.value)}
            className="km-input py-1.5 text-sm"
            placeholder="เช่น 2 กระบวย"
          />
        </div>
        <button onClick={add} disabled={saving} className="km-btn km-btn-primary text-sm py-2">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          เพิ่ม
        </button>
      </div>
    </div>
  )
}
