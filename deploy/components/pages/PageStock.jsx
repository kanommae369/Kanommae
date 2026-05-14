"use client"
import { useState, useMemo } from "react"
import {
  Search, PlusCircle, Trash2, Loader2, Clock, PackagePlus, AlertTriangle,
} from "lucide-react"
import { fmt, fmtB, today, needsReorder, daysUntilExpiry } from "../shared/helpers"
import { INGREDIENT_CATEGORIES, INGREDIENT_SOURCES } from "../shared/constants"
import { SectionTitle, Tabs, CategoryBadge, StatusPill, Th, IconBtn, EmptyState, Toast } from "../shared/ui-kit"

function genLot() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "")
  const hm = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")
  return `LOT-${ymd}-${hm}`
}

const CAT_KEYS = Object.keys(INGREDIENT_CATEGORIES)

export default function PageStock({
  ingredients = [], stockBalance = [], stockIn = [],
  onAddStockIn, onDeleteStockIn,
}) {
  const [tab, setTab] = useState("balance")
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const tabs = [
    { key: "balance", label: "สต็อกคงเหลือ" },
    { key: "addin", label: "รับสินค้าเข้า" },
    { key: "history", label: "ประวัติการรับ" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="จัดการสต็อก"
        subtitle="ตรวจสต็อกคงเหลือ · รับวัตถุดิบเข้าคลัง · ดูประวัติการรับ"
      />
      <Toast toast={toast} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "balance" && <BalanceTab ingredients={ingredients} stockBalance={stockBalance} />}
      {tab === "addin" && (
        <AddInTab
          ingredients={ingredients}
          stockIn={stockIn}
          onAddStockIn={onAddStockIn}
          onDeleteStockIn={onDeleteStockIn}
          showToast={showToast}
        />
      )}
      {tab === "history" && (
        <HistoryTab
          ingredients={ingredients}
          stockIn={stockIn}
          onDeleteStockIn={onDeleteStockIn}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 1 — สต็อกคงเหลือ (home / shop balance + reorder alert)
// ────────────────────────────────────────────────
function BalanceTab({ ingredients, stockBalance }) {
  const [search, setSearch] = useState("")
  const [catSel, setCatSel] = useState("all")

  const balMap = useMemo(
    () => Object.fromEntries(stockBalance.map((r) => [r.ingredient_id, r])),
    [stockBalance]
  )

  const rows = ingredients
    .filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter((i) => catSel === "all" || i.category === catSel)

  const reorderCount = rows.filter((i) => {
    const b = balMap[i.ingredient_id]
    return b && needsReorder(parseFloat(b.total_balance), parseFloat(i.min_stock))
  }).length

  return (
    <div className="km-card p-4 md:p-5">
      <div className="flex flex-wrap gap-2.5 mb-4">
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
            ทั้งหมด
          </button>
          {CAT_KEYS.map((k) => (
            <button key={k} onClick={() => setCatSel(k)} className={`km-chip ${catSel === k ? "km-chip-active" : ""}`}>
              {INGREDIENT_CATEGORIES[k].label}
            </button>
          ))}
        </div>
      </div>

      {reorderCount > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-km-warning/10 border border-km-warning/30 text-sm text-km-text">
          <AlertTriangle size={16} className="text-km-warning shrink-0" />
          มี <b>{reorderCount}</b> รายการถึงจุดต้องสั่งเพิ่ม
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState message="ไม่พบวัตถุดิบ" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-km-border-strong">
                <Th>วัตถุดิบ</Th>
                <Th>หมวด</Th>
                <Th align="center">หน่วย</Th>
                <Th align="right">คลังบ้าน</Th>
                <Th align="right">หน้าร้าน</Th>
                <Th align="right">รวม</Th>
                <Th align="center">สถานะ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const b = balMap[i.ingredient_id] || {}
                const home = parseFloat(b.home_balance) || 0
                const shop = parseFloat(b.shop_balance) || 0
                const total = parseFloat(b.total_balance) || 0
                const min = parseFloat(i.min_stock) || 0
                const reorder = needsReorder(total, min)
                const empty = total <= 0
                return (
                  <tr key={i.ingredient_id} className="border-b border-km-border-subtle">
                    <td className="px-2.5 py-2.5">
                      <p className="text-km-text font-medium">{i.name}</p>
                      <p className="text-[11px] text-km-text-muted">
                        {INGREDIENT_SOURCES[i.source] || i.source}
                        {min > 0 && ` · ขั้นต่ำ ${fmt(min)}`}
                      </p>
                    </td>
                    <td className="px-2.5 py-2.5"><CategoryBadge category={i.category} /></td>
                    <td className="px-2.5 py-2.5 text-center text-km-text-secondary">{i.unit}</td>
                    <td className="px-2.5 py-2.5 text-right km-mono text-km-text-secondary">{fmt(home)}</td>
                    <td className="px-2.5 py-2.5 text-right km-mono text-km-accent-hi font-semibold">{fmt(shop)}</td>
                    <td className={`px-2.5 py-2.5 text-right km-mono font-bold ${empty ? "text-km-danger" : reorder ? "text-km-warning" : "text-km-text"}`}>
                      {fmt(total)}
                    </td>
                    <td className="px-2.5 py-2.5 text-center">
                      {empty ? (
                        <StatusPill color="danger">หมด</StatusPill>
                      ) : reorder ? (
                        <StatusPill color="warning">ต้องสั่งเพิ่ม</StatusPill>
                      ) : (
                        <StatusPill color="success">ปกติ</StatusPill>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 2 — รับสินค้าเข้า (form + recent list)
// ────────────────────────────────────────────────
function AddInTab({ ingredients, stockIn, onAddStockIn, onDeleteStockIn, showToast }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ingredient_id: ingredients[0]?.ingredient_id || "",
    source: ingredients[0]?.source || "HQ",
    lot_number: genLot(),
    received_at: today(),
    quantity: "",
    unit_cost: "",
    expiry_date: "",
    note: "",
  })

  const ing = ingredients.find((i) => i.ingredient_id === form.ingredient_id)
  const qty = parseFloat(form.quantity) || 0
  const unitCost = parseFloat(form.unit_cost) || 0
  const totalCost = qty * unitCost

  const pickIngredient = (id) => {
    const next = ingredients.find((i) => i.ingredient_id === id)
    setForm((f) => ({
      ...f,
      ingredient_id: id,
      source: next?.source || f.source,
      unit_cost: next?.avg_cost ? String(next.avg_cost) : "",
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.ingredient_id || qty <= 0 || unitCost < 0) {
      showToast("กรอกวัตถุดิบ + จำนวน + ราคาต้นทุนให้ครบ", "error")
      return
    }
    setSaving(true)
    try {
      await onAddStockIn({
        ingredient_id: form.ingredient_id,
        source: form.source,
        lot_number: form.lot_number || null,
        unit: ing?.unit || "ถุง",
        quantity: qty,
        unit_cost: unitCost,
        total_cost: totalCost,
        expiry_date: form.expiry_date || null,
        received_at: form.received_at,
        note: form.note || null,
      })
      showToast(`รับเข้าสำเร็จ: ${ing?.name} ${fmt(qty)} ${ing?.unit}`)
      setForm((f) => ({
        ...f,
        lot_number: genLot(),
        quantity: "",
        unit_cost: ing?.avg_cost ? String(ing.avg_cost) : "",
        expiry_date: "",
        note: "",
      }))
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const recent = useMemo(
    () => [...stockIn].sort((a, b) => (b.received_at || "").localeCompare(a.received_at || "")).slice(0, 15),
    [stockIn]
  )
  const ingMap = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.ingredient_id, i])),
    [ingredients]
  )
  const label = "block text-[11px] font-medium uppercase tracking-wide text-km-text-muted mb-1.5"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
      {/* Form */}
      <form onSubmit={submit} className="km-card p-4 md:p-5 flex flex-col gap-3.5">
        <div>
          <h3 className="font-semibold text-km-text">บันทึกรับวัตถุดิบเข้าคลัง</h3>
          <p className="text-xs text-km-text-muted mt-0.5">รับเข้า "คลังที่บ้าน" — โอนเข้าหน้าร้านที่หน้าโอน</p>
        </div>

        <div>
          <label className={label}>วัตถุดิบ <span className="text-km-danger">*</span></label>
          <select
            value={form.ingredient_id}
            onChange={(e) => pickIngredient(e.target.value)}
            className="km-input"
          >
            {ingredients.map((i) => (
              <option key={i.ingredient_id} value={i.ingredient_id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={label}>แหล่งซื้อ</label>
            <select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="km-input"
            >
              {Object.entries(INGREDIENT_SOURCES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>วันที่รับ</label>
            <input
              type="date"
              value={form.received_at}
              onChange={(e) => setForm({ ...form, received_at: e.target.value })}
              className="km-input"
            />
          </div>
        </div>

        <div>
          <label className={label}>เลขที่ Lot</label>
          <input
            value={form.lot_number}
            onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
            className="km-input km-mono"
            placeholder="LOT-YYYYMMDD-HHMM"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={label}>
              จำนวน ({ing?.unit || "หน่วย"}) <span className="text-km-danger">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="km-input km-mono font-bold"
              placeholder="0"
            />
          </div>
          <div>
            <label className={label}>
              ราคาต้นทุน/{ing?.unit || "หน่วย"} (บาท) <span className="text-km-danger">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              className="km-input km-mono"
              placeholder="0.00"
            />
          </div>
        </div>

        {ing?.is_perishable && (
          <div>
            <label className={label}>วันหมดอายุ (ของสด — ไม่บังคับ)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className="km-input"
            />
          </div>
        )}

        {qty > 0 && unitCost > 0 && (
          <div className="rounded-xl bg-km-accent/8 border border-km-accent-soft px-3.5 py-3 flex justify-between text-sm">
            <span className="text-km-text-secondary">มูลค่ารวม Lot นี้</span>
            <span className="km-mono font-bold text-km-accent-hi">{fmtB(totalCost)}</span>
          </div>
        )}

        <div>
          <label className={label}>หมายเหตุ</label>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="km-input"
            placeholder="ไม่บังคับ"
          />
        </div>

        <button type="submit" disabled={saving} className="km-btn km-btn-primary w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <PackagePlus size={16} />}
          {saving ? "กำลังบันทึก..." : "บันทึกรับเข้าคลัง"}
        </button>
      </form>

      {/* Recent list */}
      <div className="km-card p-4 md:p-5">
        <h3 className="font-semibold text-km-text mb-3">รับเข้าล่าสุด</h3>
        {recent.length === 0 ? (
          <EmptyState message="ยังไม่มีประวัติการรับ" />
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[560px] overflow-y-auto pr-1">
            {recent.map((r) => (
              <StockInCard
                key={r.id}
                record={r}
                ingredient={ingMap[r.ingredient_id]}
                onDelete={onDeleteStockIn}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StockInCard({ record: r, ingredient, onDelete, showToast }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const expDays = daysUntilExpiry(r.expiry_date)

  const del = async () => {
    setDeleting(true)
    try {
      await onDelete(r.id)
      showToast("ลบรายการรับเข้าสำเร็จ")
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error")
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-km-text font-medium text-sm truncate">
            {ingredient?.name || r.ingredient_id}
          </p>
          <p className="text-[11px] text-km-text-muted flex items-center gap-1 mt-0.5">
            <Clock size={11} /> {(r.received_at || "").slice(0, 10)}
            {r.lot_number && <span className="km-mono"> · {r.lot_number}</span>}
          </p>
          {expDays != null && (
            <p className={`text-[11px] mt-0.5 ${expDays < 0 ? "text-km-danger" : expDays <= 3 ? "text-km-warning" : "text-km-text-muted"}`}>
              {expDays < 0 ? `หมดอายุแล้ว ${-expDays} วัน` : `หมดอายุใน ${expDays} วัน`}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="km-mono font-bold text-km-accent-hi">
            +{fmt(parseFloat(r.quantity))} {r.unit}
          </p>
          <p className="text-[11px] text-km-text-muted km-mono">{fmtB(r.total_cost)}</p>
          {!confirming && (
            <button onClick={() => setConfirming(true)} className="mt-1">
              <IconBtn variant="danger" title="ลบ"><Trash2 size={12} /></IconBtn>
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-km-danger/20 flex items-center justify-between">
          <span className="text-[12px] text-km-danger font-medium">ยืนยันลบ?</span>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="km-btn km-btn-ghost text-xs px-3 min-h-0 py-1.5">
              ยกเลิก
            </button>
            <button onClick={del} disabled={deleting} className="km-btn km-btn-danger text-xs px-3 min-h-0 py-1.5">
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} ลบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 3 — ประวัติการรับ (table + date filter)
// ────────────────────────────────────────────────
function HistoryTab({ ingredients, stockIn, onDeleteStockIn, showToast }) {
  const [range, setRange] = useState("all")
  const [day, setDay] = useState(today())
  const [month, setMonth] = useState(today().slice(0, 7))
  const [delId, setDelId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const ingMap = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.ingredient_id, i])),
    [ingredients]
  )

  const rows = useMemo(() => {
    const sorted = [...stockIn].sort((a, b) =>
      (b.received_at || "").localeCompare(a.received_at || "")
    )
    if (range === "day") return sorted.filter((r) => (r.received_at || "").slice(0, 10) === day)
    if (range === "month") return sorted.filter((r) => (r.received_at || "").slice(0, 7) === month)
    return sorted
  }, [stockIn, range, day, month])

  const totalValue = rows.reduce((a, r) => a + (parseFloat(r.total_cost) || 0), 0)

  const del = async (id) => {
    setDeleting(true)
    try {
      await onDeleteStockIn(id)
      showToast("ลบรายการสำเร็จ")
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error")
    } finally {
      setDeleting(false)
      setDelId(null)
    }
  }

  return (
    <div className="km-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-km-text">ประวัติการรับวัตถุดิบ</h3>
          <p className="text-xs text-km-text-muted mt-0.5">
            {rows.length} รายการ · มูลค่ารวม{" "}
            <span className="km-mono text-km-text-secondary">{fmtB(totalValue)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {[
            { v: "all", l: "ทั้งหมด" },
            { v: "day", l: "รายวัน" },
            { v: "month", l: "รายเดือน" },
          ].map((t) => (
            <button
              key={t.v}
              onClick={() => setRange(t.v)}
              className={`km-chip ${range === t.v ? "km-chip-active" : ""}`}
            >
              {t.l}
            </button>
          ))}
          {range === "day" && (
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="km-input w-auto text-xs py-1.5" />
          )}
          {range === "month" && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="km-input w-auto text-xs py-1.5" />
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="ไม่มีประวัติในช่วงที่เลือก" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-km-border-strong">
                <Th>วันที่</Th>
                <Th>Lot</Th>
                <Th>วัตถุดิบ</Th>
                <Th>แหล่ง</Th>
                <Th align="right">จำนวน</Th>
                <Th align="right">ต้นทุน/หน่วย</Th>
                <Th align="right">มูลค่า</Th>
                <Th>หมดอายุ</Th>
                <Th align="center"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ing = ingMap[r.ingredient_id]
                const expDays = daysUntilExpiry(r.expiry_date)
                return (
                  <tr key={r.id} className="border-b border-km-border-subtle">
                    <td className="px-2.5 py-2 km-mono text-[12px] text-km-text-muted whitespace-nowrap">
                      {(r.received_at || "").slice(0, 10)}
                    </td>
                    <td className="px-2.5 py-2 km-mono text-[11px] text-km-accent-hi">{r.lot_number || "—"}</td>
                    <td className="px-2.5 py-2 text-km-text">{ing?.name || r.ingredient_id}</td>
                    <td className="px-2.5 py-2 text-[12px] text-km-text-secondary">
                      {INGREDIENT_SOURCES[r.source] || r.source}
                    </td>
                    <td className="px-2.5 py-2 text-right km-mono font-semibold text-km-accent-hi whitespace-nowrap">
                      +{fmt(parseFloat(r.quantity))} {r.unit}
                    </td>
                    <td className="px-2.5 py-2 text-right km-mono text-km-text-secondary">{fmtB(r.unit_cost)}</td>
                    <td className="px-2.5 py-2 text-right km-mono font-bold text-km-text">{fmtB(r.total_cost)}</td>
                    <td className="px-2.5 py-2 text-[12px]">
                      {r.expiry_date ? (
                        <span className={expDays < 0 ? "text-km-danger" : expDays <= 3 ? "text-km-warning" : "text-km-text-muted"}>
                          {r.expiry_date}
                        </span>
                      ) : (
                        <span className="text-km-text-disabled">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {delId === r.id ? (
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => setDelId(null)} className="text-[11px] text-km-text-muted px-1.5">
                            ยกเลิก
                          </button>
                          <button
                            onClick={() => del(r.id)}
                            disabled={deleting}
                            className="text-[11px] font-semibold text-km-danger px-1.5"
                          >
                            {deleting ? "..." : "ลบ"}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDelId(r.id)}>
                          <IconBtn variant="danger" title="ลบ"><Trash2 size={12} /></IconBtn>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
