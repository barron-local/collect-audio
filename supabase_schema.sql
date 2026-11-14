-- รันคำสั่ง SQL ด้านล่างนี้ใน Supabase SQL Editor ของคุณ

-- 1. สร้างตาราง campaigns (สำหรับเก็บประกาศ/โฟลเดอร์ประโยค)
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  text_to_read TEXT NOT NULL,
  target_gender TEXT DEFAULT 'all' CHECK (target_gender IN ('all', 'male', 'female')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- หากสร้างตาราง campaigns ไว้แล้ว ให้รันคำสั่งเพิ่มคอลัมน์ target_gender นี้:
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_gender TEXT DEFAULT 'all';

-- 2. สร้างตาราง audio_records (สำหรับเก็บบันทึกเสียงผู้ใช้)
CREATE TABLE IF NOT EXISTS audio_records (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  speaker_name TEXT DEFAULT 'ไม่ระบุชื่อ',
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  duration_seconds NUMERIC DEFAULT 0,
  filename TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เพิ่ม Index เพื่อให้ query ข้อมูลได้รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_audio_records_campaign_id ON audio_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audio_records_gender ON audio_records(gender);

-- 4. ตั้งค่า Storage Bucket ใน Supabase Storage
-- ไปที่ Supabase Dashboard -> Storage -> กด New Bucket
-- ตั้งชื่อ Bucket: audio-recordings
-- กำหนดให้เป็น Public bucket
