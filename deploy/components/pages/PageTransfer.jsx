"use client"
import { useState, useMemo } from "react"
import {
  Search, ArrowRightLeft, Loader2, Trash2, Clock, Home, Store,
} from "lucide-react"
import { fmt, today } from "../shared/helpers"
import { INGREDIENT_CATEGORIES } from "../shared/constants"
import { SectionTitle, Tabs, CategoryBadge, EmptyState, Toast, IconBtn, Th } from "../shared/ui-kit"

export default function PageTransfer({
  ingredients = [], stockBalance = [], stockTransfers = [],
  onAddTransfer, onDeleteTransfer,
}) {
  const [tab, setTab] = useState("transfer")
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const tabs = [
    { key: "transfer", label: "โอนเข้าร้าน" },
    { key: "history", label: "ประวัติการโอน" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="โอนเข้าหน้าร้าน"
        subtitle="ย้ายวัตถุดิบจากคลังที่บ้าน → หน้าร้าน เพื่อใช้ขาย"
      />
      <Toast toast={toast} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "transfer" && (
        <TransferTab
          ingredients={ingredients}
          stockBalance={stockBalance}
          stockTransfers={stockTransfers}
          onAddTransfer={onAddTransfer}
          onDeleteTransfer={onDeleteTransfer}
          showToast={showToast}
        />
      )}
      {tab === "history" && (
        <HistoryTab
          ingredients={ingredients}
          stockTransfers={stockTransfers}
          onDeleteTransfer={onDeleteTransfer}
          showToast={showToast}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 1 — โอนเข้าร้าน (form + recent)
// ────────────────────────────────────────────────
function TransferTab({ ingredients, stockBalance, stockTransfers, onAddTransfer, onDeleteTransfer, showToast }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ingredient_id: ingredients[0]?.ingredient_id || "",
    quantity: "",
    lot_number: "",
    transferred_at: today(),
    note: "",
  })

  const balMap = useMemo(
    () => Object.fromEntries(stockBalance.map((r) => [r.ingredient_id, r])),
    [stockBalance]
  )
  const ingMap = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.ingredient_id, i])),
    [ingredients]
  )

  const ing = ingMap[form.ingredient_id]
  const bal = balMap[form.ingredient_id] || {}
  const homeBalance = parseFloat(bal.home_balance) || 0
  const shopBalance = parseFloat(bal.shop_balance) || 0
  const qty = parseFloat(form.quantity) || 0
  const overLimit = qty > homeBalance

  const submit = async (e) => {
    e.preventDefault()
    if (!form.ingredient_id || qty <= 0) {
      showToast("เลือกวัตถุดิบ + ใส่จำนวนที่จะโอน", "error")
      return
    }
    if (overLimit) {
      showToast(`โอนเกินยอดคลังบ้าน (มี ${fmt(homeBalance)} ${ing?.unit})`, "error")
      return
    }
    setSaving(true)
    try {
      await onAddTransfer({
        ingredient_id: form.ingredient_id,
        unit: ing?.unit || "ถุง",
        quantity: qty,
        lot_number: form.lot_number || null,
        transferred_at: form.transferred_at,
        note: form.note || null,
      })
      showToast(`โอนสำเร็จ: ${ing?.name} ${fmt(qty)} ${ing?.unit} → หน้าร้าน`)
      setForm((f) => ({ ...f, quantity: "", lot_number: "", note: "" }))
    } catch (err) {
      showToast("โอนไม่สำเร็จ: " + err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const recent = useMemo(
    () =>
      [...stockTransfers]
        .sort((a, b) => (b.transferred_at || "").localeCompare(a.transferred_at || ""))
        .slice(0, 15),
    [stockTransfers]
  )
  const label = "block text-[11px] font-medium uppercase tracking-wide text-km-text-muted mb-1.5"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
      {/* Form */}
      <form onSubmit={submit} className="km-card p-4 md:p-5 flex flex-col gap-3.5">
        <div>
          <h3 className="font-semibold text-km-text">โอนวัตถุดิบเข้าหน้าร้าน</h3>
          <p className="text-xs text-km-text-muted mt-0.5">เลือกวัตถุดิบจากคลังบ้าน → ระบุจำนวน</p>
        </div>

        <div>
          <label className={label}>วัตถุดิบ <span className="text-km-danger">*</span></label>
          <select
            value={form.ingredient_id}
            onChange={(e) => setForm({ ...form, ingredient_id: e.target.value })}
            className="km-input"
          >
            {ingredients.map((i) => (
              <option key={i.ingredient_id} value={i.ingredient_id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </div>

        {/* ยอดคงเหลือ 2 ฝั่ง */}
        {ing && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-km-surface border border-km-border-subtle px-3 py-2.5">
              <p className="text-[11px] text-km-text-muted flex items-center gap-1">
                <Home size={12} /> คลังบ้าน (โอนได้)
              </p>
              <p className={`km-mono font-bold mt-0.5 ${homeBalance <= 0 ? "text-km-danger" : "text-km-text"}`}>
                {fmt(homeBalance)} {ing.unit}
              </p>
            </div>
            <div className="rounded-xl bg-km-surface border border-km-border-subtle px-3 py-2.5">
              <p className="text-[11px] text-km-text-muted flex items-center gap-1">
                <Store size={12} /> หน้าร้าน (ปัจจุบัน)
              </p>
              <p className="km-mono font-bold mt-0.5 text-km-accent-hi">
                {fmt(shopBalance)} {ing.unit}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={label}>
              จำนวนที่โอน ({ing?.unit || "หน่วย"}) <span className="text-km-danger">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className={`km-input km-mono font-bold ${overLimit ? "border-km-danger" : ""}`}
              placeholder="0"
            />
            {overLimit && (
              <p className="text-[11px] text-km-danger mt-1">เกินยอดคลังบ้าน</p>
            )}
          </div>
          <div>
            <label className={label}>วันที่โอน</label>
            <input
              type="date"
              value={form.transferred_at}
              onChange={(e) => setForm({ ...form, transferred_at: e.target.value })}
              className="km-input"
            />
          </div>
        </div>

        <div>
          <label className={label}>เลขที่ Lot (ไม่บังคับ)</label>
          <input
            value={form.lot_number}
            onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
            className="km-input km-mono"
            placeholder="ระบุถ้าต้องการอ้างอิง Lot"
          />
        </div>

        <div>
          <label className={label}>หมายเหตุ</label>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="km-input"
            placeholder="ไม่บังคับ"
          />
        </div>

        <button
          type="submit"
          disabled={saving || qty <= 0 || overLimit}
          className="km-btn km-btn-primary w-full"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
          {saving ? "กำลังโอน..." : "โอนเข้าหน้าร้าน"}
        </button>
      </form>

      {/* Recent */}
      <div className="km-card p-4 md:p-5">
        <h3 className="font-semibold text-km-text mb-3">โอนล่าสุด</h3>
        {recent.length === 0 ? (
          <EmptyState message="ยังไม่มีประวัติการโอน" />
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[560px] overflow-y-auto pr-1">
            {recent.map((r) => (
              <TransferCard
                key={r.id}
                record={r}
                ingredient={ingMap[r.ingredient_id]}
                onDelete={onDeleteTransfer}
                showToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TransferCard({ record: r, ingredient, onDelete, showToast }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const del = async () => {
    setDeleting(true)
    try {
      await onDelete(r.id)
      showToast("ลบรายการโอนสำเร็จ (ยอดถูกคืนกลับคลังบ้าน)")
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
          <p className="text-sm font-medium text-km-text truncate">
            {ingredient?.name || r.ingredient_id}
          </p>
          <p className="text-[11px] text-km-text-muted flex items-center gap-1 mt-0.5">
            <Clock size={11} /> {(r.transferred_at || "").slice(0, 10)}
            {r.lot_number && <span className="km-mono"> · {r.lot_number}</span>}
          </p>
          {r.note && <p className="text-[11px] text-km-text-muted italic mt-0.5">"{r.note}"</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="km-mono font-bold text-km-accent-hi flex items-center gap-1 justify-end">
            <ArrowRightLeft size={12} /> {fmt(parseFloat(r.quantity))} {r.unit}
          </p>
          {!confirming && (
            <button onClick={() => setConfirming(true)} className="mt-1">
              <IconBtn variant="danger" title="ลบ"><Trash2 size={12} /></IconBtn>
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-km-danger/20 flex items-center justify-between">
          <span className="text-[12px] text-km-danger font-medium">ลบ? (ยอดคืนคลังบ้าน)</span>
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
// Tab 2 — ประวัติการโอน
// ────────────────────────────────────────────────
function HistoryTab({ ingredients, stockTransfers, onDeleteTransfer, showToast }) {
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
    const sorted = [...stockTransfers].sort((a, b) =>
      (b.transferred_at || "").localeCompare(a.transferred_at || "")
    )
    if (range === "day") return sorted.filter((r) => (r.transferred_at || "").slice(0, 10) === day)
    if (range === "month") return sorted.filter((r) => (r.transferred_at || "").slice(0, 7) === month)
    return sorted
  }, [stockTransfers, range, day, month])

  const del = async (id) => {
    setDeleting(true)
    try {
      await onDeleteTransfer(id)
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
          <h3 className="font-semibold text-km-text">ประวัติการโอน</h3>
          <p className="text-xs text-km-text-muted mt-0.5">{rows.length} รายการ</p>
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
                <Th>วัตถุดิบ</Th>
                <Th>หมวด</Th>
                <Th>Lot</Th>
                <Th align="right">จำนวนโอน</Th>
                <Th>หมายเหตุ</Th>
                <Th align="center"></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ing = ingMap[r.ingredient_id]
                return (
                  <tr key={r.id} className="border-b border-km-border-subtle">
                    <td className="px-2.5 py-2 km-mono text-[12px] text-km-text-muted whitespace-nowrap">
                      {(r.transferred_at || "").slice(0, 10)}
                    </td>
                    <td className="px-2.5 py-2 text-km-text">{ing?.name || r.ingredient_id}</td>
                    <td className="px-2.5 py-2">
                      {ing && <CategoryBadge category={ing.category} />}
                    </td>
                    <td className="px-2.5 py-2 km-mono text-[11px] text-km-text-muted">{r.lot_number || "—"}</td>
                    <td className="px-2.5 py-2 text-right km-mono font-semibold text-km-accent-hi whitespace-nowrap">
                      {fmt(parseFloat(r.quantity))} {r.unit}
                    </td>
                    <td className="px-2.5 py-2 text-[12px] text-km-text-muted">{r.note || "—"}</td>
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
