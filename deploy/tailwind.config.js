/** @type {import('tailwindcss').Config} */
const { kmColors } = require("./components/shared/design-tokens")

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ขนมแม่ Design System — ใช้ผ่าน class `bg-km-*`, `text-km-*`, `border-km-*`
        km: kmColors,
      },
      boxShadow: {
        "km-card":     "0 1px 3px rgba(42,46,67,0.06), 0 1px 2px rgba(42,46,67,0.04)",
        "km-elevated": "0 4px 12px rgba(42,46,67,0.08), 0 2px 4px rgba(42,46,67,0.04)",
        "km-accent":   "0 2px 8px rgba(111,168,220,0.25)",
      },
    },
  },
  plugins: [],
}
