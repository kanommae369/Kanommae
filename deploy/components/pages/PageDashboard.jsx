"use client"
import { useMemo } from "react"
import {
  TrendingUp, ShoppingCart, Boxes, AlertTriangle, Trophy, CalendarDays, Store,
} from "lucide-react"
import { fmt, fmtB, today, toBkkDate, getLastNDays, fmtDayLabel, needsReorder } from "../shared/helpers"
import KpiCard from "../shared/KpiCard"
import { SectionTitle, EmptyState, StatusPill } from "../shared/ui-kit"

export default function PageDashboard({
  sales = [], stockBalance = [], menuItems = [], ingredients = [],
}) {
  const stats = useMemo(() => {
    const td = today()
    const month = td.slice(0, 7)
    let todaySales = 0, todayBills = 0, monthSales = 0, total30 = 0, posBills = 0
    for (const s of sales) {
      const d = toBkkDate(s.sold_at)
      const amt = Number(s.total) || 0
      total30 += amt
      if (s.source === "pos") posBills++
      if (d === td) { todaySales += amt; todayBills++ }
      if (d.startsWith(month)) monthSales += amt
    }
    // มูลค่าสต็อกคงเหลือ = Σ(คงเหลือรวม × ต้นทุนเฉลี่ย)
    const stockValue = stockBalance.reduce(
      (s, b) => s + Math.max(0, Number(b.total_balance) || 0) * (Number(b.avg_cost) || 0), 0,
    )
    const reorder = stockBalance.filter((b) => needsReorder(b.total_balance, b.min_stock))
    return { todaySales, todayBills, monthSales, total30, posBills, stockValue, reorder }
  }, [sales, stockBalance])

  // ยอดขายรายวัน 14 วันล่าสุด
  const daily = useMemo(() => {
    const days = getLastNDays(14)
    const map = Object.fromEntries(days.map((d) => [d, 0]))
    for (const s of sales) {
      const d = toBkkDate(s.sold_at)
      if (d in map) map[d] += Number(s.total) || 0
    }
    const arr = days.map((d) => ({ date: d, value: map[d] }))
    const max = Math.max(1, ...arr.map((x) => x.value))
    return { arr, max }
  }, [sales])

  // เมนูขายดี (รวมจาก sale_items)
  const topMenus = useMemo(() => {
    const agg = {}
    for (const s of sales) {
      for (const it of s.sale_items || []) {
        const name = it.menu_items?.name || `เมนู #${it.menu_item_id}`
        const a = (agg[name] ||= { name, qty: 0, revenue: 0 })
        a.qty += Number(it.quantity) || 0
        a.revenue += Number(it.line_total) || 0
      }
    }
    return Object.values(agg).sort((a, b) => b.qty - a.qty).slice(0, 8)
  }, [sales])

  const activeIngredients = ingredients.filter((i) => i.is_active !== false).length

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="ภาพรวม" subtitle="สรุปยอดขาย · สต็อก · เมนูขายดี" />

      {/* ── KPI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShoppingCart} color="blue" label="ยอดขายวันนี้"
          value={fmtB(stats.todaySales)} sub={`${fmt(stats.todayBills)} บิล`} />
        <KpiCard icon={TrendingUp} color="green" label="ยอดขาย 30 วัน"
          value={fmtB(stats.total30)} sub={`${fmt(sales.length)} บิล · ${fmt(stats.posBills)} จาก POS`} />
        <KpiCard icon={Boxes} color="purple" label="มูลค่าสต็อกคงเหลือ"
          value={fmtB(stats.stockValue)} sub={`${fmt(activeIngredients)} วัตถุดิบ`} />
        <KpiCard icon={AlertTriangle} color={stats.reorder.length ? "red" : "green"} label="ต้องสั่งเพิ่ม"
          value={fmt(stats.reorder.length)} sub="รายการต่ำกว่าขั้นต่ำ" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── ยอดขายรายวัน ── */}
        <div className="km-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-km-accent-hi" />
            <h3 className="font-semibold text-km-text">ยอดขายรายวัน (14 วัน)</h3>
          </div>
          {stats.total30 === 0 ? (
            <EmptyState message="ยังไม่มียอดขายในช่วงนี้" />
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {daily.arr.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${fmtDayLabel(d.date)} · ${fmtB(d.value)}`}>
                  <div className="w-full flex items-end h-32">
                    <div
                      className="w-full rounded-t bg-km-accent/70 group-hover:bg-km-accent transition-colors"
                      style={{ height: `${(d.value / daily.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-km-text-muted leading-none">{new Date(d.date + "T00:00:00").getDate()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── เมนูขายดี ── */}
        <div className="km-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-km-accent-hi" />
            <h3 className="font-semibold text-km-text">เมนูขายดี (30 วัน)</h3>
          </div>
          {topMenus.length === 0 ? (
            <EmptyState message="ยังไม่มีข้อมูลการขาย" />
          ) : (
            <ul className="flex flex-col gap-2">
              {topMenus.map((m, i) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i < 3 ? "bg-km-accent text-white" : "bg-km-surface text-km-text-muted"}`}>{i + 1}</span>
                  <span className="flex-1 text-sm text-km-text truncate">{m.name}</span>
                  <span className="text-sm font-semibold text-km-text">{fmt(m.qty)} ชิ้น</span>
                  <span className="text-xs text-km-text-muted w-20 text-right">{fmtB(m.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── สต็อกต้องสั่งเพิ่ม ── */}
      <div className="km-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Store size={18} className="text-km-accent-hi" />
          <h3 className="font-semibold text-km-text">วัตถุดิบที่ต้องสั่งเพิ่ม</h3>
        </div>
        {stats.reorder.length === 0 ? (
          <EmptyState message="สต็อกเพียงพอทุกรายการ 👍" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.reorder.map((b) => (
              <div key={b.ingredient_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-km-surface">
                <span className="text-sm text-km-text truncate">{b.name}</span>
                <StatusPill color={Number(b.total_balance) <= 0 ? "danger" : "warning"}>
                  {fmt(b.total_balance)}/{fmt(b.min_stock)} {b.unit}
                </StatusPill>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
