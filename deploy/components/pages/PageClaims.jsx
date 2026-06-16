"use client"
import { useState, useMemo } from "react"
import { Plus, X, Check, Loader2, Trash2, Pencil, RotateCcw, BadgeCheck } from "lucide-react"
import { fmt, fmtB, today } from "../shared/helpers"
import { CLAIM_STATUS, SALES_CHANNELS } from "../shared/constants"
import { SectionTitle, EmptyState, Toast, IconBtn, StatusPill } from "../shared/ui-kit"
import KpiCard from "../shared/KpiCard"

const STATUS_KEYS = Object.keys(CLAIM_STATUS)
const STATUS_COLOR = { returned: "success", damaged: "warning", lost: "danger" }

const emptyForm = {
  claimed_at: today(), channel: "dine_in", menu_item_id: "",
  quantity: "1", refund_amount: "", reason: "", status: "returned",
  confirmed: false, note: "",
}

export default function PageClaims({
  claims = [], menuItems = [], onAddClaim, onUpdateClaim, onDeleteClaim,
}) {
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [statusSel, setStatusSel] = useState("all")
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const rows = claims.filter((c) => statusSel === "all" || c.status === statusSel)

  const stats = useMemo(() => {
    let refund = 0, pending = 0
    for (const c of claims) {
      refund += Number(c.refund_amount) || 0
      if (!c.confirmed) pending++
    }
    return { refund, pending }
  }, [claims])

  const countByStatus = useMemo(() => {
    const c = {}
    for (const cl of claims) c[cl.status] = (c[cl.status] || 0) + 1
    return c
  }, [claims])

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="เคลม / คืนเงิน"
        subtitle={`บันทึกของเสีย/คืนเงิน · ทั้งหมด ${claims.length} รายการ`}
        actions={
          <button onClick={() => { setAdding((v) => !v); setEditId(null) }} className="km-btn km-btn-primary">
            {adding ? <X size={16} /> : <Plus size={16} />}
            {adding ? "ปิดฟอร์ม" : "เพิ่มเคลม"}
          </button>
        }
      />
      <Toast toast={toast} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard icon={RotateCcw} color="amber" label="รายการเคลมทั้งหมด" value={fmt(claims.length)} sub="30 วันล่าสุด" />
        <KpiCard icon={Trash2} color="red" label="ยอดคืนเงินรวม" value={fmtB(stats.refund)} />
        <KpiCard icon={BadgeCheck} color="purple" label="ยังไม่ยืนยัน" value={fmt(stats.pending)} sub="รอตรวจสอบ" />
      </div>

      {adding && (
        <ClaimForm
          title="เพิ่มรายการเคลม"
          initial={emptyForm}
          menuItems={menuItems}
          onSubmit={async (data) => {
            await onAddClaim(data)
            showToast("เพิ่มรายการเคลมสำเร็จ")
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="km-card p-4 md:p-5">
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setStatusSel("all")} className={`km-chip ${statusSel === "all" ? "km-chip-active" : ""}`}>
            ทั้งหมด {claims.length}
          </button>
          {STATUS_KEYS.map((k) => (
            <button key={k} onClick={() => setStatusSel(k)} className={`km-chip ${statusSel === k ? "km-chip-active" : ""}`}>
              {CLAIM_STATUS[k]} {countByStatus[k] || 0}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState message="ยังไม่มีรายการเคลม" />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((c) => (
              <ClaimRow
                key={c.id}
                claim={c}
                menuItems={menuItems}
                editing={editId === c.id}
                onEdit={() => { setEditId(c.id); setAdding(false) }}
                onCancelEdit={() => setEditId(null)}
                onSave={async (data) => {
                  await onUpdateClaim(c.id, data)
                  showToast("บันทึกการแก้ไขสำเร็จ")
                  setEditId(null)
                }}
                onToggleConfirm={async () => {
                  await onUpdateClaim(c.id, { confirmed: !c.confirmed })
                  showToast(c.confirmed ? "ยกเลิกการยืนยันแล้ว" : "ยืนยันแล้ว")
                }}
                onDelete={async () => {
                  await onDeleteClaim(c.id)
                  showToast("ลบรายการเคลมแล้ว")
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
function ClaimRow({ claim: c, menuItems, editing, onEdit, onCancelEdit, onSave, onToggleConfirm, onDelete, showToast }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const menuName = c.menu_items?.name || menuItems.find((m) => m.id === c.menu_item_id)?.name

  if (editing) {
    return (
      <ClaimForm
        title="แก้ไขรายการเคลม"
        initial={{
          claimed_at: c.claimed_at || today(),
          channel: c.channel || "dine_in",
          menu_item_id: c.menu_item_id ? String(c.menu_item_id) : "",
          quantity: String(c.quantity ?? "1"),
          refund_amount: String(c.refund_amount ?? ""),
          reason: c.reason || "",
          status: c.status || "returned",
          confirmed: !!c.confirmed,
          note: c.note || "",
        }}
        menuItems={menuItems}
        onSubmit={onSave}
        onCancel={onCancelEdit}
        compact
      />
    )
  }

  const doDelete = async () => {
    setBusy(true)
    try { await onDelete() }
    catch (err) { showToast("ลบไม่สำเร็จ: " + err.message, "error") }
    finally { setBusy(false); setConfirming(false) }
  }

  return (
    <div className="rounded-xl bg-km-surface border border-km-border-subtle p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill color={STATUS_COLOR[c.status]}>{CLAIM_STATUS[c.status] || c.status}</StatusPill>
            {c.confirmed
              ? <span className="text-[10px] text-km-success border border-km-success/30 bg-km-success/10 rounded px-1.5 py-0.5">ยืนยันแล้ว</span>
              : <span className="text-[10px] text-km-text-muted border border-km-border-subtle rounded px-1.5 py-0.5">รอยืนยัน</span>}
            <span className="text-[11px] text-km-text-muted km-mono">{c.claimed_at}</span>
          </div>
          <p className="text-sm font-medium text-km-text mt-1">
            {menuName || "ไม่ระบุเมนู"} × {fmt(c.quantity)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[12px] text-km-text-secondary">
            <span>{SALES_CHANNELS[c.channel] || c.channel}</span>
            <span>คืนเงิน <b className="km-mono">{fmtB(c.refund_amount)}</b></span>
            {c.reason && <span>เหตุ: {c.reason}</span>}
          </div>
          {c.note && <p className="text-[11px] text-km-text-muted mt-1">📝 {c.note}</p>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {!confirming && (
            <>
              <button onClick={onToggleConfirm} title={c.confirmed ? "ยกเลิกยืนยัน" : "ยืนยัน"}>
                <IconBtn variant="info"><BadgeCheck size={12} /></IconBtn>
              </button>
              <button onClick={onEdit}><IconBtn variant="info" title="แก้ไข"><Pencil size={12} /></IconBtn></button>
              <button onClick={() => setConfirming(true)}><IconBtn variant="danger" title="ลบ"><Trash2 size={12} /></IconBtn></button>
            </>
          )}
        </div>
      </div>
      {confirming && (
        <div className="mt-2.5 pt-2.5 border-t border-km-danger/20 flex items-center justify-between">
          <span className="text-[12px] text-km-danger font-medium">ลบรายการเคลมนี้?</span>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="km-btn km-btn-ghost text-xs px-3 min-h-0 py-1.5">ยกเลิก</button>
            <button onClick={doDelete} disabled={busy} className="km-btn km-btn-danger text-xs px-3 min-h-0 py-1.5">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} ลบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────
function ClaimForm({ title, initial, menuItems, onSubmit, onCancel, compact }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const label = "block text-[11px] font-medium uppercase tracking-wide text-km-text-muted mb-1.5"

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        claimed_at: form.claimed_at || today(),
        channel: form.channel,
        menu_item_id: form.menu_item_id ? parseInt(form.menu_item_id, 10) : null,
        quantity: parseInt(form.quantity, 10) || 1,
        refund_amount: parseFloat(form.refund_amount) || 0,
        reason: form.reason.trim() || null,
        status: form.status,
        confirmed: !!form.confirmed,
        note: form.note.trim() || null,
      })
    } catch (err) {
      alert("บันทึกไม่สำเร็จ: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const wrap = compact ? "rounded-xl bg-km-accent/5 border border-km-accent p-3.5" : "km-card p-4 md:p-5"
  const activeMenus = menuItems.filter((m) => m.is_active !== false)

  return (
    <form onSubmit={submit} className={`${wrap} flex flex-col gap-3`}>
      <h3 className="font-semibold text-km-text">{title}</h3>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={label}>วันที่</label>
          <input type="date" value={form.claimed_at} onChange={(e) => set("claimed_at", e.target.value)} className="km-input km-mono" />
        </div>
        <div>
          <label className={label}>ช่องทาง</label>
          <select value={form.channel} onChange={(e) => set("channel", e.target.value)} className="km-input">
            {Object.entries(SALES_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>เมนู (ไม่บังคับ)</label>
        <select value={form.menu_item_id} onChange={(e) => set("menu_item_id", e.target.value)} className="km-input">
          <option value="">— ไม่ระบุเมนู —</option>
          {activeMenus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className={label}>จำนวน</label>
          <input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} className="km-input km-mono" />
        </div>
        <div>
          <label className={label}>คืนเงิน (บาท)</label>
          <input type="number" min="0" step="0.01" value={form.refund_amount} onChange={(e) => set("refund_amount", e.target.value)} className="km-input km-mono" placeholder="0.00" />
        </div>
        <div>
          <label className={label}>สถานะ</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="km-input">
            {STATUS_KEYS.map((k) => <option key={k} value={k}>{CLAIM_STATUS[k]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>เหตุผล</label>
        <input value={form.reason} onChange={(e) => set("reason", e.target.value)} className="km-input" placeholder="เช่น ลูกค้าคืน, ทำหล่น" />
      </div>

      <div>
        <label className={label}>หมายเหตุ (ไม่บังคับ)</label>
        <input value={form.note} onChange={(e) => set("note", e.target.value)} className="km-input" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="km-claim-confirmed" checked={form.confirmed} onChange={(e) => set("confirmed", e.target.checked)} className="w-4 h-4 accent-km-accent" />
        <label htmlFor="km-claim-confirmed" className="text-sm text-km-text-secondary">ยืนยันรายการแล้ว</label>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="km-btn km-btn-primary flex-1">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button type="button" onClick={onCancel} className="km-btn km-btn-ghost">ยกเลิก</button>
      </div>
    </form>
  )
}
