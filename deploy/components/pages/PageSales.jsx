"use client"
import { useState, useMemo } from "react"
import {
  Search, Plus, Minus, Trash2, Loader2, ShoppingCart, Receipt, X, Store,
} from "lucide-react"
import { fmt, fmtB, today } from "../shared/helpers"
import { MENU_CATEGORIES, SALES_CHANNELS } from "../shared/constants"
import { SectionTitle, Tabs, EmptyState, Toast, IconBtn } from "../shared/ui-kit"

export default function PageSales({
  menuItems = [], sales = [],
  onRecordSale, onDeleteSale,
}) {
  const [tab, setTab] = useState("new")
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const tabs = [
    { key: "new", label: "ขายใหม่" },
    { key: "history", label: "ประวัติการขาย" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="บันทึกขาย"
        subtitle="คีย์ออเดอร์ → บันทึก ระบบตัดสต็อกวัตถุดิบตามสูตรอัตโนมัติ"
      />
      <Toast toast={toast} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "new" && (
        <NewSaleTab menuItems={menuItems} onRecordSale={onRecordSale} showToast={showToast} />
      )}
      {tab === "history" && (
        <HistoryTab sales={sales} onDeleteSale={onDeleteSale} showToast={showToast} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 1 — ขายใหม่ (เลือกเมนู → ตะกร้า → บันทึก)
// ────────────────────────────────────────────────
function NewSaleTab({ menuItems, onRecordSale, showToast }) {
  const [search, setSearch] = useState("")
  const [catSel, setCatSel] = useState("all")
  const [cart, setCart] = useState({}) // { menu_item_id: { menu, quantity, unit_price } }
  const [channel, setChannel] = useState("dine_in")
  const [billNo, setBillNo] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const menus = menuItems
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => catSel === "all" || m.category === catSel)

  const cartItems = Object.values(cart)
  const total = cartItems.reduce((s, c) => s + c.quantity * c.unit_price, 0)
  const count = cartItems.reduce((s, c) => s + c.quantity, 0)

  const addToCart = (menu) => {
    setCart((c) => {
      const cur = c[menu.id]
      return {
        ...c,
        [menu.id]: cur
          ? { ...cur, quantity: cur.quantity + 1 }
          : { menu, quantity: 1, unit_price: parseFloat(menu.price) || 0 },
      }
    })
  }
  const setQty = (id, q) => {
    setCart((c) => {
      if (q <= 0) {
        const { [id]: _, ...rest } = c
        return rest
      }
      return { ...c, [id]: { ...c[id], quantity: q } }
    })
  }
  const setPrice = (id, p) => {
    setCart((c) => ({ ...c, [id]: { ...c[id], unit_price: parseFloat(p) || 0 } }))
  }
  const clearCart = () => setCart({})

  const submit = async () => {
    if (cartItems.length === 0) {
      showToast("ยังไม่มีรายการในตะกร้า", "error")
      return
    }
    setSaving(true)
    try {
      await onRecordSale({
        channel,
        billNo: billNo || null,
        note: note || null,
        source: "manual",
        items: cartItems.map((c) => ({
          menu_item_id: c.menu.id,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
      })
      showToast(`บันทึกการขายสำเร็จ — ${count} รายการ · ${fmtB(total)}`)
      clearCart()
      setBillNo("")
      setNote("")
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-5">
      {/* ───── เลือกเมนู ───── */}
      <div className="km-card p-4 md:p-5">
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเมนู..."
            className="km-input pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setCatSel("all")} className={`km-chip ${catSel === "all" ? "km-chip-active" : ""}`}>
            ทั้งหมด
          </button>
          {Object.entries(MENU_CATEGORIES).map(([k, label]) => (
            <button key={k} onClick={() => setCatSel(k)} className={`km-chip ${catSel === k ? "km-chip-active" : ""}`}>
              {label.replace(/ \(.*\)/, "")}
            </button>
          ))}
        </div>
        {menus.length === 0 ? (
          <EmptyState message="ไม่พบเมนู" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {menus.map((m) => {
              const inCart = cart[m.id]?.quantity || 0
              return (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className={`relative text-left rounded-xl border p-3 transition-colors ${
                    inCart
                      ? "bg-km-accent/10 border-km-accent"
                      : "bg-km-surface border-km-border-subtle hover:border-km-accent-soft"
                  }`}
                >
                  {inCart > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-km-accent text-white text-[11px] font-bold flex items-center justify-center">
                      {inCart}
                    </span>
                  )}
                  <p className="text-sm font-medium text-km-text leading-snug pr-4">{m.name}</p>
                  <p className="text-km-accent-hi km-mono font-bold mt-1">{fmtB(m.price)}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ───── ตะกร้า ───── */}
      <div className="km-card p-4 md:p-5 lg:sticky lg:top-6 lg:self-start flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-km-text flex items-center gap-2">
            <ShoppingCart size={17} /> ตะกร้า
            {count > 0 && (
              <span className="text-[11px] bg-km-accent text-white rounded-full px-2 py-0.5">{count}</span>
            )}
          </h3>
          {cartItems.length > 0 && (
            <button onClick={clearCart} className="text-[12px] text-km-text-muted hover:text-km-danger">
              ล้างตะกร้า
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <p className="text-sm text-km-text-muted py-8 text-center">แตะเมนูทางซ้ายเพื่อเพิ่มลงตะกร้า</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
            {cartItems.map((c) => (
              <div key={c.menu.id} className="rounded-xl bg-km-surface border border-km-border-subtle p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-km-text flex-1">{c.menu.name}</p>
                  <button onClick={() => setQty(c.menu.id, 0)}>
                    <IconBtn variant="danger" title="ลบ"><Trash2 size={11} /></IconBtn>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQty(c.menu.id, c.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-km-card border border-km-border-strong flex items-center justify-center text-km-text-secondary"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="km-mono font-bold w-6 text-center text-km-text">{c.quantity}</span>
                    <button
                      onClick={() => setQty(c.menu.id, c.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-km-card border border-km-border-strong flex items-center justify-center text-km-text-secondary"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={c.unit_price}
                      onChange={(e) => setPrice(c.menu.id, e.target.value)}
                      className="km-input km-mono w-20 py-1 text-sm text-right"
                    />
                    <span className="text-[11px] text-km-text-muted">฿/ชิ้น</span>
                  </div>
                </div>
                <p className="text-right km-mono text-[12px] text-km-text-secondary mt-1">
                  รวม {fmtB(c.quantity * c.unit_price)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* channel + bill + note */}
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(SALES_CHANNELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setChannel(k)}
              className={`km-chip justify-center ${channel === k ? "km-chip-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            placeholder="เลขบิล (ไม่บังคับ)"
            className="km-input py-1.5 text-sm"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="หมายเหตุ"
            className="km-input py-1.5 text-sm"
          />
        </div>

        {/* total + submit */}
        <div className="flex items-center justify-between pt-2 border-t border-km-border-subtle">
          <span className="text-sm text-km-text-secondary">ยอดรวม</span>
          <span className="km-mono text-xl font-bold text-km-text">{fmtB(total)}</span>
        </div>
        <button
          onClick={submit}
          disabled={saving || cartItems.length === 0}
          className="km-btn km-btn-primary w-full text-base py-3"
        >
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Receipt size={17} />}
          {saving ? "กำลังบันทึก..." : "บันทึกการขาย"}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// Tab 2 — ประวัติการขาย
// ────────────────────────────────────────────────
function HistoryTab({ sales, onDeleteSale, showToast }) {
  const [range, setRange] = useState("all")
  const [day, setDay] = useState(today())
  const [delId, setDelId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const rows = useMemo(() => {
    const sorted = [...sales].sort((a, b) => (b.sold_at || "").localeCompare(a.sold_at || ""))
    if (range === "day") return sorted.filter((s) => (s.sold_at || "").slice(0, 10) === day)
    return sorted
  }, [sales, range, day])

  const totalRevenue = rows.reduce((a, s) => a + (parseFloat(s.total) || 0), 0)

  const del = async (id) => {
    setDeleting(true)
    try {
      await onDeleteSale(id)
      showToast("ลบรายการขายสำเร็จ (สต็อกที่ตัดไปถูกคืน)")
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
          <h3 className="font-semibold text-km-text">ประวัติการขาย</h3>
          <p className="text-xs text-km-text-muted mt-0.5">
            {rows.length} บิล · ยอดรวม{" "}
            <span className="km-mono text-km-text-secondary">{fmtB(totalRevenue)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {[
            { v: "all", l: "ทั้งหมด" },
            { v: "day", l: "รายวัน" },
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
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="ยังไม่มีประวัติการขาย" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((s) => (
            <SaleCard
              key={s.id}
              sale={s}
              confirming={delId === s.id}
              deleting={deleting}
              onAskDelete={() => setDelId(s.id)}
              onCancelDelete={() => setDelId(null)}
              onConfirmDelete={() => del(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SaleCard({ sale: s, confirming, deleting, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const items = s.sale_items || []
  const dt = (s.sold_at || "").replace("T", " ").slice(0, 16)
  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="km-pill">
              <Store size={11} /> {SALES_CHANNELS[s.channel] || s.channel}
            </span>
            {s.source === "pos" && (
              <span className="km-badge km-badge-market">POS</span>
            )}
            {s.bill_no && <span className="text-[12px] text-km-text-muted km-mono">บิล {s.bill_no}</span>}
          </div>
          <p className="text-[11px] text-km-text-muted mt-1">{dt}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="km-mono font-bold text-km-text">{fmtB(s.total)}</p>
          {!confirming && (
            <button onClick={onAskDelete} className="mt-1">
              <IconBtn variant="danger" title="ลบ"><Trash2 size={12} /></IconBtn>
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-km-border-subtle flex flex-col gap-0.5">
        {items.map((it) => (
          <div key={it.id} className="flex justify-between text-[13px]">
            <span className="text-km-text-secondary">
              {it.menu_items?.name || "—"} <span className="text-km-text-muted">×{it.quantity}</span>
            </span>
            <span className="km-mono text-km-text-secondary">{fmtB(it.line_total)}</span>
          </div>
        ))}
      </div>

      {s.note && <p className="text-[11px] text-km-text-muted italic mt-1.5">"{s.note}"</p>}

      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-km-danger/20 flex items-center justify-between">
          <span className="text-[12px] text-km-danger font-medium">ลบบิลนี้? (สต็อกที่ตัดไปจะถูกคืน)</span>
          <div className="flex gap-2">
            <button onClick={onCancelDelete} className="km-btn km-btn-ghost text-xs px-3 min-h-0 py-1.5">
              ยกเลิก
            </button>
            <button onClick={onConfirmDelete} disabled={deleting} className="km-btn km-btn-danger text-xs px-3 min-h-0 py-1.5">
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} ลบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
