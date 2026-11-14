-- ==============================================================================
-- สคริปต์สำหรับสร้างฐานข้อมูล Voice Collector ใน Supabase (ใช้ชื่อ topics แทน campaigns)
-- ==============================================================================

-- 1. สร้างตาราง topics (สำหรับเก็บหัวข้อ/ประโยคที่ต้องการให้อัดเสียง)
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  text_to_read TEXT NOT NULL,
  target_gender TEXT DEFAULT 'all' CHECK (target_gender IN ('all', 'male', 'female')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. สร้างตาราง audio_records (สำหรับเก็บบันทึกเสียงของผู้ใช้งาน)
CREATE TABLE IF NOT EXISTS audio_records (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  speaker_name TEXT DEFAULT 'ไม่ระบุชื่อ',
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  duration_seconds NUMERIC DEFAULT 0,
  filename TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. เพิ่ม Index เพื่อให้ค้นหาได้รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_audio_records_topic_id ON audio_records(topic_id);
CREATE INDEX IF NOT EXISTS idx_audio_records_gender ON audio_records(gender);

-- 4. ตั้งค่า Storage Bucket ใน Supabase Storage
-- ไปที่ Supabase Dashboard -> Storage -> สร้าง Bucket ชื่อ: audio-recordings (ตั้งเป็น Public bucket)

-- ==============================================================================
-- *สำหรับผู้ที่เคยสร้างตาราง campaigns เดิมไว้แล้ว และต้องการเปลี่ยนชื่อมาเป็น topics*
-- ให้รันคำสั่ง Migration ด้านล่างนี้:
-- ==============================================================================
-- ALTER TABLE IF EXISTS campaigns RENAME TO topics;
-- ALTER TABLE IF EXISTS audio_records RENAME COLUMN campaign_id TO topic_id;
-- ==============================================================================
