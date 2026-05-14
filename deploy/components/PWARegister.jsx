"use client"
import { useEffect } from "react"

// ลงทะเบียน service worker — ทำให้แอปติดตั้งบนมือถือได้ ("Add to Home Screen")
export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return // dev ไม่ต้อง register กัน cache ค้าง
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW register failed:", err))
  }, [])
  return null
}
