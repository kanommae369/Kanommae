"use client"
import { useState, useEffect, useCallback } from "react"
import {
  LayoutDashboard, Package, ArrowRightLeft, ScrollText, BookOpen,
  ShoppingCart, RotateCcw, BarChart3, Users, AlertCircle, Loader2,
  Menu as MenuIcon, X,
} from "lucide-react"
import {
  getIngredients, getStockBalance, getStockIn,
  addStockIn, deleteStockIn, recalcAvgCost,
  addIngredient, updateIngredient, deactivateIngredient,
  getMenuItems, getRecipes, setRecipeLine, deleteRecipeLine,
  getSales, recordSale, deleteSale,
  getStockTransfers, addStockTransfer, deleteStockTransfer,
} from "../lib/supabase"
import PageStock from "./pages/PageStock"
import PageRecipes from "./pages/PageRecipes"
import PageSales from "./pages/PageSales"
import PageTransfer from "./pages/PageTransfer"
import PageIngredients from "./pages/PageIngredients"

// ── โครงหน้าเว็บทั้งหมด ──
// primary: true = แสดงใน bottom nav บนมือถือ
// ready: true = พอร์ต logic แล้ว · false = ยัง scaffold
const PAGES = [
  { id: "dashboard",   label: "ภาพรวม",        icon: LayoutDashboard, primary: true },
  { id: "stock",       label: "จัดการสต็อก",    icon: Package,         primary: true, ready: true },
  { id: "sales",       label: "บันทึกขาย",      icon: ShoppingCart,    primary: true, ready: true },
  { id: "recipes",     label: "สูตรขนม",        icon: BookOpen,        primary: true, ready: true },
  { id: "transfer",    label: "โอนเข้าหน้าร้าน", icon: ArrowRightLeft, ready: true },
  { id: "ingredients", label: "วัตถุดิบ",       icon: ScrollText,     ready: true },
  { id: "claims",      label: "เคลม/คืนเงิน",   icon: RotateCcw },
  { id: "analytics",   label: "วิเคราะห์",       icon: BarChart3 },
  { id: "users",       label: "จัดการผู้ใช้",   icon: Users },
]

export default function KanomMaeApp() {
  const [active, setActive] = useState("stock")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    ingredients: [], stockBalance: [], stockIn: [], menuItems: [], recipes: [], sales: [], stockTransfers: [],
  })

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ingredients, stockBalance, stockIn, menuItems, recipes, sales, stockTransfers] =
        await Promise.all([
          getIngredients(), getStockBalance(), getStockIn(), getMenuItems(),
          getRecipes(), getSales(30), getStockTransfers(),
        ])
      setData({ ingredients, stockBalance, stockIn, menuItems, recipes, sales, stockTransfers })
    } catch (err) {
      setError(err.message || "โหลดข้อมูลไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── callbacks: stock ──
  const handleAddStockIn = async (record) => {
    await addStockIn(record)
    await recalcAvgCost(record.ingredient_id)
    await loadAll()
  }
  const handleDeleteStockIn = async (id) => {
    const rec = data.stockIn.find((r) => r.id === id)
    await deleteStockIn(id)
    if (rec) await recalcAvgCost(rec.ingredient_id)
    await loadAll()
  }

  // ── callbacks: recipes (BOM) ──
  const handleSetRecipeLine = async (record) => {
    await setRecipeLine(record)
    await loadAll()
  }
  const handleDeleteRecipeLine = async (id) => {
    await deleteRecipeLine(id)
    await loadAll()
  }

  // ── callbacks: sales ──
  const handleRecordSale = async (payload) => {
    await recordSale(payload)
    await loadAll()
  }
  const handleDeleteSale = async (id) => {
    await deleteSale(id)
    await loadAll()
  }

  // ── callbacks: transfers ──
  const handleAddTransfer = async (record) => {
    await addStockTransfer(record)
    await loadAll()
  }
  const handleDeleteTransfer = async (id) => {
    await deleteStockTransfer(id)
    await loadAll()
  }

  // ── callbacks: ingredients ──
  const handleAddIngredient = async (record) => {
    await addIngredient(record)
    await loadAll()
  }
  const handleUpdateIngredient = async (id, updates) => {
    await updateIngredient(id, updates)
    await loadAll()
  }
  const handleDeactivateIngredient = async (id) => {
    await deactivateIngredient(id)
    await loadAll()
  }

  const go = (id) => { setActive(id); setDrawerOpen(false) }
  const activePage = PAGES.find((p) => p.id === active)

  const renderPage = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-km-text-muted py-20 justify-center">
          <Loader2 size={20} className="animate-spin" /> กำลังโหลดข้อมูล...
        </div>
      )
    }
    if (error) {
      return (
        <div className="km-card p-5 max-w-xl border-km-danger/40">
          <div className="flex items-center gap-2 text-km-danger font-semibold mb-2">
            <AlertCircle size={18} /> เชื่อมต่อฐานข้อมูลไม่สำเร็จ
          </div>
          <p className="text-sm text-km-text-muted">{error}</p>
          <p className="text-xs text-km-text-muted mt-2">
            ตรวจ <code>.env.local</code> และว่ารัน <code>setup_all.sql</code> ใน Supabase แล้ว
          </p>
          <button onClick={loadAll} className="km-btn km-btn-secondary mt-3">ลองใหม่</button>
        </div>
      )
    }
    if (active === "stock") {
      return (
        <PageStock
          ingredients={data.ingredients}
          stockBalance={data.stockBalance}
          stockIn={data.stockIn}
          onAddStockIn={handleAddStockIn}
          onDeleteStockIn={handleDeleteStockIn}
        />
      )
    }
    if (active === "recipes") {
      return (
        <PageRecipes
          menuItems={data.menuItems}
          recipes={data.recipes}
          ingredients={data.ingredients}
          onSetRecipeLine={handleSetRecipeLine}
          onDeleteRecipeLine={handleDeleteRecipeLine}
        />
      )
    }
    if (active === "sales") {
      return (
        <PageSales
          menuItems={data.menuItems}
          sales={data.sales}
          onRecordSale={handleRecordSale}
          onDeleteSale={handleDeleteSale}
        />
      )
    }
    if (active === "transfer") {
      return (
        <PageTransfer
          ingredients={data.ingredients}
          stockBalance={data.stockBalance}
          stockTransfers={data.stockTransfers}
          onAddTransfer={handleAddTransfer}
          onDeleteTransfer={handleDeleteTransfer}
        />
      )
    }
    if (active === "ingredients") {
      return (
        <PageIngredients
          ingredients={data.ingredients}
          onAddIngredient={handleAddIngredient}
          onUpdateIngredient={handleUpdateIngredient}
          onDeactivateIngredient={handleDeactivateIngredient}
        />
      )
    }
    // หน้าอื่น — ยัง scaffold
    return (
      <div className="km-card p-6 max-w-xl">
        <h3 className="font-semibold text-km-text mb-1">{activePage?.label}</h3>
        <p className="text-sm text-km-text-muted">
          หน้านี้ยังอยู่ขั้น scaffold — รอพอร์ต UI logic จาก DivisionX (Phase 2)
        </p>
        <p className="text-xs text-km-text-muted mt-3">
          ฐานข้อมูลพร้อมแล้ว: วัตถุดิบ {data.ingredients.length} · สต็อก {data.stockBalance.length} รายการ
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-km-surface">
      {/* ───────── Desktop sidebar ───────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-km-sidebar flex-col z-30">
        <div className="px-5 py-5 border-b border-white/10">
          <h1 className="text-lg font-bold text-white">ขนมแม่</h1>
          <p className="text-xs text-km-text-on-sidebar-muted mt-0.5">
            ระบบจัดการสต็อก · ภัณฑ์ทวี545
          </p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {PAGES.map((p) => {
            const Icon = p.icon
            const on = active === p.id
            return (
              <button
                key={p.id}
                onClick={() => go(p.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  on
                    ? "bg-km-sidebar-active text-white border-r-2 border-km-accent"
                    : "text-km-text-on-sidebar hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{p.label}</span>
                {p.ready && <span className="w-1.5 h-1.5 rounded-full bg-km-accent" />}
              </button>
            )
          })}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-xs text-km-text-on-sidebar-muted">
          v1.0 · Phase 2
        </div>
      </aside>

      {/* ───────── Mobile top bar ───────── */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-km-sidebar flex items-center justify-between px-4 z-30 km-safe-top">
        <div>
          <h1 className="text-base font-bold text-white leading-tight">ขนมแม่</h1>
          <p className="text-[10px] text-km-text-on-sidebar-muted leading-tight">ภัณฑ์ทวี545</p>
        </div>
        <span className="text-sm text-white/90">{activePage?.label}</span>
      </header>

      {/* ───────── Main content ───────── */}
      <main className="md:ml-60 pt-14 md:pt-0 pb-24 md:pb-0 px-4 md:px-8 py-5 md:py-8">
        {renderPage()}
      </main>

      {/* ───────── Mobile bottom nav ───────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-km-card border-t border-km-border-subtle flex z-30 km-safe-bottom">
        {PAGES.filter((p) => p.primary).map((p) => {
          const Icon = p.icon
          const on = active === p.id
          return (
            <button
              key={p.id}
              onClick={() => go(p.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${
                on ? "text-km-accent-hi" : "text-km-text-muted"
              }`}
            >
              <Icon size={21} />
              <span className="text-[10px] font-medium">{p.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 text-km-text-muted"
        >
          <MenuIcon size={21} />
          <span className="text-[10px] font-medium">เมนู</span>
        </button>
      </nav>

      {/* ───────── Mobile full-menu drawer ───────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-km-card rounded-t-2xl p-4 km-safe-bottom">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-km-text">เมนูทั้งหมด</h3>
              <button onClick={() => setDrawerOpen(false)} className="text-km-text-muted p-1">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PAGES.map((p) => {
                const Icon = p.icon
                const on = active === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => go(p.id)}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl border transition-colors ${
                      on
                        ? "bg-km-accent text-white border-km-accent"
                        : "bg-km-surface text-km-text-secondary border-km-border-subtle"
                    }`}
                  >
                    <Icon size={22} />
                    <span className="text-[11px] font-medium text-center px-1">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
