// ขนมแม่ — Design Tokens (Light · Navy & Pastel)
//
// ใช้ได้ 2 ทาง:
// 1. import ใน React:  import { tokens, kmColors } from "../shared/design-tokens"
// 2. require ใน Tailwind config (CommonJS): const { kmColors } = require("./components/shared/design-tokens")

// ─────────────────────────────────────────────
// Raw tokens (structured) — ใช้ใน runtime React
// ─────────────────────────────────────────────
const tokens = {
  bg: {
    page:     "#FFFFFF",  // พื้นหลังหลัก ขาวสะอาด
    surface:  "#FBF7F0",  // ครีมอ่อน — พื้นรอง
    card:     "#FFFFFF",  // การ์ด
    elevated: "#F4EEE3",  // ครีมเข้มขึ้น — ชั้นยกขึ้น/hover
    input:    "#FFFFFF",
    sidebar:  "#1E2A5E",  // navy — แถบเมนูซ้าย (จากโลโก้)
    sidebarActive: "#2E3D75",
  },
  accent: {
    sky:      "#6FA8DC",  // ฟ้าพาสเทล — accent หลัก
    skyHi:    "#5B97CE",  // hover เข้มขึ้น
    skySoft:  "#A9CCEA",
    skyDim:   "#C7D7E8",
    pink:     "#E8A0BF",  // ชมพูพาสเทล — accent รอง
    pinkSoft: "#F3CFDD",
  },
  text: {
    primary:    "#2A2E43",
    secondary:  "#6B7280",
    muted:      "#9AA1AE",
    disabled:   "#C4C9D2",
    onAccent:   "#FFFFFF",  // ตัวอักษรบนปุ่มฟ้า/ชมพู
    onSidebar:  "#E8EBF5",  // ตัวอักษรบน sidebar navy
    onSidebarMuted: "#9BA3C4",
  },
  semantic: {
    success: "#4CAF7D",
    warning: "#E0A82E",
    danger:  "#E26D6D",
    info:    "#6FA8DC",
  },
  border: {
    subtle: "#ECE7DD",
    strong: "#D8D2C4",
    focus:  "#6FA8DC",
  },
  // หมวดวัตถุดิบ (ingredient categories)
  category: {
    thai_mix:  { main: "#6FA8DC", bg: "rgba(111,168,220,0.12)" },
    frozen:    { main: "#7FB5C9", bg: "rgba(127,181,201,0.12)" },
    ssb:       { main: "#7DBF9A", bg: "rgba(125,191,154,0.12)" },
    market:    { main: "#E0A82E", bg: "rgba(224,168,46,0.12)" },
    packaging: { main: "#C99A6B", bg: "rgba(201,154,107,0.12)" },
  },
  chart: ["#6FA8DC", "#E8A0BF", "#7DBF9A", "#E0A82E", "#B58FD0", "#7FB5C9"],
}

// ─────────────────────────────────────────────
// Flat palette — สำหรับ Tailwind config (classes เช่น bg-km-card, text-km-accent)
// ─────────────────────────────────────────────
const kmColors = {
  // Backgrounds
  bg:               tokens.bg.page,
  surface:          tokens.bg.surface,
  card:             tokens.bg.card,
  elevated:         tokens.bg.elevated,
  input:            tokens.bg.input,
  sidebar:          tokens.bg.sidebar,
  "sidebar-active": tokens.bg.sidebarActive,

  // Accent
  accent:         tokens.accent.sky,
  "accent-hi":    tokens.accent.skyHi,
  "accent-soft":  tokens.accent.skySoft,
  "accent-dim":   tokens.accent.skyDim,
  accent2:        tokens.accent.pink,
  "accent2-soft": tokens.accent.pinkSoft,

  // Text
  text:                    tokens.text.primary,
  "text-secondary":        tokens.text.secondary,
  "text-muted":            tokens.text.muted,
  "text-disabled":         tokens.text.disabled,
  "text-on-accent":        tokens.text.onAccent,
  "text-on-sidebar":       tokens.text.onSidebar,
  "text-on-sidebar-muted": tokens.text.onSidebarMuted,

  // Border
  "border-subtle": tokens.border.subtle,
  "border-strong": tokens.border.strong,

  // Semantic
  success: tokens.semantic.success,
  warning: tokens.semantic.warning,
  danger:  tokens.semantic.danger,
  info:    tokens.semantic.info,

  // Ingredient categories
  "cat-thai":   tokens.category.thai_mix.main,
  "cat-frozen": tokens.category.frozen.main,
  "cat-ssb":    tokens.category.ssb.main,
  "cat-market": tokens.category.market.main,
  "cat-pkg":    tokens.category.packaging.main,
}

module.exports = { tokens, kmColors }
