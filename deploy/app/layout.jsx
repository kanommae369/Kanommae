import "./globals.css"
import PWARegister from "../components/PWARegister"

export const metadata = {
  title: "ขนมแม่ — ระบบจัดการสต็อก",
  description: "ระบบจัดการสต็อกวัตถุดิบ สูตรขนม และยอดขาย ร้านขนมแม่",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ขนมแม่",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1E2A5E",
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="km-theme">
        {children}
        <PWARegister />
      </body>
    </html>
  )
}
