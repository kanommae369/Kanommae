// foodstory_setcookie.mjs — รีเฟรช cookie/csrf ของ FoodStory เข้า .env.local ให้ง่าย
// ใช้: 1) ใน DevTools → คลิกขวา request getdata → Copy → Copy as cURL (bash)
//      2) วางลงไฟล์ deploy/foodstory.curl.txt
//      3) cd deploy && node scripts/foodstory_setcookie.mjs
//         → แกะ Cookie + X-CSRF-Token ใส่ .env.local แล้วลบไฟล์ .curl ทิ้ง (กัน secret ค้าง)
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const DEPLOY = join(HERE, "..")
const CURL_PATH = process.argv[2] ? process.argv[2] : join(DEPLOY, "foodstory.curl.txt")
const ENV_PATH = join(DEPLOY, ".env.local")

if (!existsSync(CURL_PATH)) {
  console.error(`✗ ไม่เจอไฟล์ ${CURL_PATH}`)
  console.error("  วาง 'Copy as cURL' ลงไฟล์ deploy/foodstory.curl.txt ก่อน")
  process.exit(1)
}

const raw = readFileSync(CURL_PATH, "utf8")

// แกะ header จาก cURL — รองรับทั้ง -H 'Name: val' (bash) และ -H "Name: val" (cmd)
function header(name) {
  const re = new RegExp(`-H \\$?['"]${name}:\\s*([^'"]*)['"]`, "i")
  const m = raw.match(re)
  return m ? m[1].trim() : null
}
const cookie = header("cookie") || (raw.match(/-b \$?['"]([^'"]*)['"]/) || [])[1]
const csrf = header("x-csrf-token")

if (!cookie || !csrf) {
  console.error("✗ แกะ Cookie / X-CSRF-Token ไม่เจอในไฟล์ cURL")
  console.error("  cookie:", !!cookie, "csrf:", !!csrf)
  process.exit(1)
}
if (!cookie.includes("laravel_session")) {
  console.warn("⚠ ไม่เจอ laravel_session ใน cookie — อาจ copy ผิด request (ต้องเป็น getdata)")
}

// เขียนทับเฉพาะ FOODSTORY_COOKIE/CSRF คงบรรทัดอื่นไว้
let lines = existsSync(ENV_PATH)
  ? readFileSync(ENV_PATH, "utf8").split("\n").filter((l) => !/^\s*FOODSTORY_(COOKIE|CSRF)\s*=/.test(l))
  : []
while (lines.length && lines[lines.length - 1].trim() === "") lines.pop()
lines.push(`FOODSTORY_COOKIE=${cookie}`)
lines.push(`FOODSTORY_CSRF=${csrf}`)
writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf8")

// ลบไฟล์ cURL ทิ้ง (มี session — ไม่เก็บค้าง)
try { unlinkSync(CURL_PATH) } catch { /* ไม่เป็นไร */ }

console.log(`✓ อัปเดต FOODSTORY_COOKIE (${cookie.length} ตัว) + CSRF ใน .env.local แล้ว`)
console.log("✓ ลบไฟล์ cURL ทิ้งแล้ว · ลองรัน: node scripts/foodstory_sync.mjs --dry")
