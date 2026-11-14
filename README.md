<div align="center">

# Voice Collector

### ระบบรวบรวมและคัดแยกชุดข้อมูลเสียงพูด (.MP3)

<br/>

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   [ ~ ~ ~ ]   P R O J E C T   I N   P R O G R E S S   [ ~ ~ ~ ]   │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=18&duration=2500&pause=800&color=37352F&center=true&vCenter=true&multiline=true&width=560&height=80&lines=%E2%9A%A0%EF%B8%8F+%E0%B9%82%E0%B8%84%E0%B8%A3%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%99%E0%B8%B5%E0%B9%89%E0%B8%AD%E0%B8%A2%E0%B8%B9%E0%B9%88%E0%B8%A3%E0%B8%B0%E0%B8%AB%E0%B8%A lawsuit%E0%B8%B2%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9E%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B8%B2+(Under+Development);%E0%B8%A3%E0%B8%B0%E0%B8%9A%E0%B8%9A%E0%B8%81%E0%B8%B3%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%9E%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B8%B2%E0%B8%9F%E0%B8%B5%E0%B9%80%E0%B8%88%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88%E0%B9%86+%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%95%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%99%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%87" alt="Under Development Animation" />

<br/>

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%" />

</div>

<br/>

## 📌 ภาพรวมระบบ (Overview)

เว็บแอปพลิเคชันสำหรับสร้างหัวข้อประโยคคำ เพื่อให้ผู้ใช้งานเข้ามาร่วมบันทึกเสียงอ่านและจัดเก็บเป็นไฟล์ `.mp3` คุณภาพสูง พร้อมฟังก์ชันคัดแยกกลุ่มเสียงตามเพศ (ชาย / หญิง) ดีไซน์สไตล์มินิมอลแบบ **Notion** ใช้งานง่าย สะอาดตา

```
[ ผู้ดูแลระบบ (Admin) ] ──> สร้างหัวข้อประโยค ──> กำหนดเพศเป้าหมาย ──> ดาวน์โหลด ZIP (.mp3)
                                ▲
                                │
[ ผู้ใช้งาน (User) ]   ──> เลือกเพศ ──> อ่านประโยค ──> บันทึกเสียง MP3 ──> ส่งไฟล์เข้าโฟลเดอร์
```

---

## ✨ ฟีเจอร์หลัก (Features)

- **ระบบอัดเสียง & แปลงเป็น MP3 ในตัว (Client-side MP3 Encoder)**: แปลงคลื่นเสียงจากไมโครโฟนเป็นไฟล์ MP3 128kbps โดยตรงผ่านเบราว์เซอร์
- **เลือกเพศผู้พูดตั้งแต่เริ่มต้น**: มี Modal ให้ผู้ใช้เลือกเพศชาย หรือหญิง พร้อมไอคอนสัญลักษณ์ สามารถแก้ไขได้ตลอดเวลา
- **ระบบโฟลเดอร์หัวข้อ (Topic Folders)**: แต่ละประโยคเปรียบเสมือนโฟลเดอร์ ผู้ใช้สามารถกดเข้าไปดูรายการไฟล์เสียงของผู้อื่น และลองฟังเสียงตัวอย่างได้
- **เงื่อนไขเพศเป้าหมาย**: กำหนดได้ว่าหัวข้อนี้รับเสียงจากเพศใด (ทั้ง 2 เพศ / เฉพาะเพศชาย / เฉพาะเพศหญิง) หากเพศไม่ตรงจะเข้าดูได้แต่ไม่สามารถกดอัดเสียงได้
- **Real-time Synchronization**: อัปเดตรายการและจำนวนไฟล์ใหม่ทุก 1 วินาทีแบบเรียลไทม์
- **เส้นทางลับแอดมิน (`/admin`)**: ไม่มีปุ่มกดจากหน้าแรก ต้องพิมพ์ URL เอง และล็อกรหัสความปลอดภัยด้วย PIN 4 หลัก
- **เชื่อมต่อ Supabase โดยตรง (No Backend Server)**: บันทึกข้อมูลลงตาราง `topics`, `audio_records` และเก็บไฟล์ลง Supabase Storage Bucket โดยไม่ต้องรันเซิร์ฟเวอร์แยก

---

## 🚀 การติดตั้งและเปิดใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies

```bash
bun install
# หรือ
npm install
```

### 2. ตั้งค่าไฟล์ `.env`

คัดลอกไฟล์ `.env.example` ไปเป็น `.env` แล้วระบุค่า Supabase และรหัส Admin PIN:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_STORAGE_BUCKET=audio-recordings
VITE_ADMIN_PIN=1234
```

### 3. รันโปรเจกต์

```bash
bun run dev
# หรือ
npm run dev
```

เปิดเว็บเบราว์เซอร์ไปที่: `http://localhost:5173/`  
สำหรับหน้าแอดมิน: `http://localhost:5173/admin`

---

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (Notion-inspired minimal design)
- **Audio Processing**: `@breezystack/lamejs` + Web Audio API
- **Database & Storage**: Supabase Database + Supabase Storage
- **Exporting**: JSZip (บีบอัดไฟล์ MP3 ดาวน์โหลดเป็น ZIP บนเบราว์เซอร์)

<br/>

<div align="center">
  <sub>Voice Collector Project • Actively Maintained & Developed</sub>
</div>
