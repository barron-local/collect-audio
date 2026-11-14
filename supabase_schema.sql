-- ==============================================================================
-- คำสั่งแก้ไขปัญหา RLS และชื่อตาราง (รันใน Supabase SQL Editor ได้ทันที)
-- ==============================================================================

-- 1. เปลี่ยนชื่อตาราง campaigns เป็น topics (ถ้ามี)
ALTER TABLE IF EXISTS campaigns RENAME TO topics;

-- 2. สร้างตาราง topics ถ้ายังไม่มี
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  text_to_read TEXT NOT NULL,
  target_gender TEXT DEFAULT 'all' CHECK (target_gender IN ('all', 'male', 'female')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มคอลัมน์ target_gender
ALTER TABLE topics ADD COLUMN IF NOT EXISTS target_gender TEXT DEFAULT 'all';

-- 3. จัดการคอลัมน์ใน audio_records ให้เป็น topic_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'audio_records' AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE audio_records RENAME COLUMN campaign_id TO topic_id;
  END IF;
END $$;

-- สร้างตาราง audio_records ถ้ายังไม่มี
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

-- 4. แก้ปัญหา RLS ในตาราง topics และ audio_records (อนุญาตให้อ่านและเขียนได้)
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE audio_records DISABLE ROW LEVEL SECURITY;

-- 5. แก้ปัญหา Storage RLS (อนุญาตให้อัปโหลดไฟล์และดาวน์โหลดจาก audio-recordings bucket ได้อย่างอิสระ)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-recordings', 'audio-recordings', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- สร้าง Policy ให้ Storage Bucket สามารถ Upload / Read ได้โดยไม่มี RLS บล็อก
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow All Uploads" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'audio-recordings');

CREATE POLICY "Allow All Uploads" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'audio-recordings');

CREATE POLICY "Allow All Deletes" ON storage.objects 
FOR DELETE USING (bucket_id = 'audio-recordings');
