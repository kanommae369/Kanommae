"use client"
import { useState, useMemo } from "react"
import { TrendingUp, Receipt, Coins, Package2, BarChart3 } from "lucide-react"
import { fmt, fmtB, toBkkDate, getLastNDays, fmtDayLabel } from "../shared/helpers"
import { SALES_CHANNELS } from "../shared/constants"
import { SectionTitle, EmptyState } from "../shared/ui-kit"
import KpiCard from "../shared/KpiCard"

const RANGES = [
  { key: 7, label: "7 วัน" },
  { key: 14, label: "14 วัน" },
  { key: 30, label: "30 วัน" },
]

export default function PageAnalytics({ sales = [] }) {
  const [range, setRange] = useState(30)

  const data = useMemo(() => {
    const days = getLastNDays(range)
    const inRange = new Set(days)
    const rows = sales.filter((s) => inRange.has(toBkkDate(s.sold_at)))

    let revenue = 0, qty = 0
    const byCat = {}, byChannel = {}, byDay = Object.fromEntries(days.map((d) => [d, 0])), byMenu = {}
    for (const s of rows) {
      const amt = Number(s.total) || 0
      revenue += amt
      byDay[toBkkDate(s.sold_at)] += amt
      byChannel[s.channel] = (byChannel[s.channel] || 0) + amt
      for (const it of s.sale_items || []) {
        const q = Number(it.quantity) || 0
        const rev = Number(it.line_total) || 0
        qty += q
        const cat = it.menu_items?.category || "อื่นๆ"
        byCat[cat] = (byCat[cat] || 0) + rev
        const name = it.menu_items?.name || `เมนู #${it.menu_item_id}`
        const m = (byMenu[name] ||= { name, qty: 0, rev: 0 })
        m.qty += q; m.rev += rev
      }
    }
    const bills = rows.length
    const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])
    return {
      revenue, qty, bills,
      avg: bills ? revenue / bills : 0,
      byCat: sortDesc(byCat),
      byChannel: sortDesc(byChannel),
      byDay: days.map((d) => ({ date: d, value: byDay[d] })),
      dayMax: Math.max(1, ...days.map((d) => byDay[d])),
      topMenus: Object.values(byMenu).sort((a, b) => b.rev - a.rev).slice(0, 10),
    }
  }, [sales, range])

  const empty = data.revenue === 0

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle
        title="วิเคราะห์ยอดขาย"
        subtitle="สรุปยอดขายตามหมวด · ช่องทาง · แนวโน้ม · เมนูทำเงิน"
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} className={`km-chip ${range === r.key ? "km-chip-active" : ""}`}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Coins} color="green" label="ยอดขายรวม" value={fmtB(data.revenue)} />
        <KpiCard icon={Receipt} color="blue" label="จำนวนบิล" value={fmt(data.bills)} />
        <KpiCard icon={TrendingUp} color="purple" label="เฉลี่ย/บิล" value={fmtB(data.avg)} />
        <KpiCard icon={Package2} color="amber" label="จำนวนชิ้นรวม" value={fmt(data.qty)} />
      </div>

      {empty ? (
        <div className="km-card p-5"><EmptyState message="ยังไม่มียอดขายในช่วงนี้" /></div>
      ) : (
        <>
          {/* แนวโน้มรายวัน */}
          <div className="km-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-km-accent-hi" />
              <h3 className="font-semibold text-km-text">แนวโน้มยอดขายรายวัน</h3>
            </div>
            <div className="flex items-end gap-1 h-40">
              {data.byDay.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${fmtDayLabel(d.date)} · ${fmtB(d.value)}`}>
                  <div className="w-full flex items-end h-32">
                    <div className="w-full rounded-t bg-km-accent/70 group-hover:bg-km-accent transition-colors" style={{ height: `${(d.value / data.dayMax) * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-km-text-muted leading-none">{new Date(d.date + "T00:00:00").getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarList title="ยอดขายตามหมวด" rows={data.byCat} total={data.revenue} />
            <BarList title="ยอดขายตามช่องทาง" rows={data.byChannel} total={data.revenue} labelMap={SALES_CHANNELS} />
          </div>

          {/* เมนูทำเงิน */}
          <div className="km-card p-5">
            <h3 className="font-semibold text-km-text mb-3">เมนูทำเงินสูงสุด</h3>
            <div className="flex flex-col gap-2">
              {data.topMenus.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i < 3 ? "bg-km-accent text-white" : "bg-km-surface text-km-text-muted"}`}>{i + 1}</span>
                  <span className="flex-1 text-sm text-km-text truncate">{m.name}</span>
                  <span className="text-xs text-km-text-muted">{fmt(m.qty)} ชิ้น</span>
                  <span className="text-sm font-semibold text-km-text w-24 text-right">{fmtB(m.rev)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// แถบสัดส่วน (bar list)
function BarList({ title, rows, total, labelMap }) {
  return (
    <div className="km-card p-5">
      <h3 className="font-semibold text-km-text mb-3">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState message="ไม่มีข้อมูล" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(([key, value]) => {
            const pct = total ? (value / total) * 100 : 0
            return (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-km-text-secondary truncate">{labelMap?.[key] || key}</span>
                  <span className="text-km-text font-medium">{fmtB(value)} <span className="text-km-text-muted text-xs">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-km-surface overflow-hidden">
                  <div className="h-full rounded-full bg-km-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
