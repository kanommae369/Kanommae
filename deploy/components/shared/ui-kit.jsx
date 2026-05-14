"use client"
// ขนมแม่ — Shared UI components (km- theme)
import { CheckCircle2, X, AlertTriangle, Inbox } from "lucide-react"
import { INGREDIENT_CATEGORIES } from "./constants"

// หัวข้อหน้า + subtitle + actions
export function SectionTitle({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-km-text">{title}</h2>
        {subtitle && <p className="text-sm text-km-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// แท็บบาร์
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-km-border-subtle overflow-x-auto km-noscroll">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`km-tab whitespace-nowrap ${active === t.key ? "km-tab-active" : ""}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// badge หมวดวัตถุดิบ
const CAT_CLASS = {
  thai_mix: "km-badge-thai",
  frozen: "km-badge-frozen",
  ssb: "km-badge-ssb",
  market: "km-badge-market",
  packaging: "km-badge-pkg",
}
export function CategoryBadge({ category }) {
  const cat = INGREDIENT_CATEGORIES[category]
  return (
    <span className={`km-badge ${CAT_CLASS[category] || "km-badge-thai"}`}>
      {cat?.label || category}
    </span>
  )
}

// pill สถานะสต็อก
export function StatusPill({ color, children }) {
  const c = {
    success: "bg-km-success/12 text-km-success border-km-success/30",
    warning: "bg-km-warning/12 text-km-warning border-km-warning/35",
    danger: "bg-km-danger/12 text-km-danger border-km-danger/30",
  }[color]
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c}`}>
      {children}
    </span>
  )
}

// table header cell
export function Th({ children, align = "left", className = "" }) {
  return (
    <th
      className={`px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-km-text-muted whitespace-nowrap ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}

// ปุ่มไอคอนเล็ก
export function IconBtn({ children, onClick, title, variant = "info" }) {
  const v = {
    info: "bg-km-accent/12 text-km-accent-hi hover:bg-km-accent/20",
    danger: "bg-km-danger/12 text-km-danger hover:bg-km-danger/20",
  }[variant]
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${v}`}
    >
      {children}
    </button>
  )
}

// สถานะว่าง
export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-km-text-muted">
      <Inbox size={32} className="opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// toast แจ้งเตือน (มุมขวาบน — บนมือถือเต็มความกว้าง)
export function Toast({ toast }) {
  if (!toast) return null
  const isError = toast.type === "error"
  return (
    <div
      className={`fixed top-16 md:top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-km-elevated bg-km-card border text-sm ${
        isError ? "border-km-danger/40 text-km-danger" : "border-km-success/40 text-km-success"
      }`}
    >
      {isError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <span className="text-km-text">{toast.msg}</span>
    </div>
  )
}
