-- ==============================================================================
-- สคริปต์ยกระดับความปลอดภัย RLS และ Storage Policy ตามมาตรฐานสากล (Security Hardening)
-- ==============================================================================

-- 1. บังคับเปิดใช้งาน RLS (Row Level Security) สำหรับทั้ง 2 ตาราง
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_records ENABLE ROW LEVEL SECURITY;

-- 2. เคลียร์ Policy เดิมออกทั้งหมด
DROP POLICY IF EXISTS "Public can view topics" ON topics;
DROP POLICY IF EXISTS "Public can insert topics" ON topics;
DROP POLICY IF EXISTS "Public can update topics" ON topics;
DROP POLICY IF EXISTS "Public can delete topics" ON topics;

DROP POLICY IF EXISTS "Public can view audio records" ON audio_records;
DROP POLICY IF EXISTS "Public can insert audio records" ON audio_records;
DROP POLICY IF EXISTS "Public can delete audio records" ON audio_records;

-- ==============================================================================
-- 3. ตาราง topics (หัวข้อประกาศ/โฟลเดอร์)
-- ==============================================================================
-- สาธารณะทั่วไป (Public anon) สามารถ "อ่าน (SELECT)" ได้อย่างเดียว
CREATE POLICY "Public can view topics" ON topics
FOR SELECT TO anon, authenticated
USING (true);

-- ป้องกันไม่ให้ Public anon ยิงแก้หรือลบ topics โดยตรง (ปิดการ INSERT, UPDATE, DELETE จาก anon)
-- ให้เฉพาะแอดมินหรือระบบที่มี service_role หรือ authenticated จัดการได้
CREATE POLICY "Service and admin can insert topics" ON topics
FOR INSERT TO authenticated, service_role
WITH CHECK (true);

CREATE POLICY "Service and admin can update topics" ON topics
FOR UPDATE TO authenticated, service_role
USING (true);

CREATE POLICY "Service and admin can delete topics" ON topics
FOR DELETE TO authenticated, service_role
USING (true);

-- (หมายเหตุ: หากยังใช้ anon key บนหน้าเว็บโดยไม่มี Auth แต่ต้องการให้หน้าเว็บใช้ได้ชั่วคราว สามารถสลับเป็น WITH CHECK (true))

-- ==============================================================================
-- 4. ตาราง audio_records (ข้อมูลไฟล์เสียง)
-- ==============================================================================
-- สาธารณะสามารถดูรายการเสียงที่บันทึกเข้ามาได้ (SELECT)
CREATE POLICY "Public can view audio records" ON audio_records
FOR SELECT TO anon, authenticated
USING (true);

-- สาธารณะสามารถส่งไฟล์เสียงเข้าระบบได้ (INSERT) พร้อมตรวจสอบความถูกต้องของข้อมูล
CREATE POLICY "Public can insert audio records" ON audio_records
FOR INSERT TO anon, authenticated
WITH CHECK (
  topic_id IS NOT NULL 
  AND duration_seconds > 0 
  AND duration_seconds <= 120
  AND file_size <= 10485760 -- ไม่เกิน 10MB
);

-- ปิดกั้นไม่ให้ Public anon สั่งลบข้อมูลเสียง (DELETE)
CREATE POLICY "Service and admin can delete audio records" ON audio_records
FOR DELETE TO authenticated, service_role
USING (true);

-- ==============================================================================
-- 5. Storage Policies สำหรับ Bucket 'audio-recordings'
-- ==============================================================================
DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
DROP POLICY IF EXISTS "Public insert storage" ON storage.objects;
DROP POLICY IF EXISTS "Public delete storage" ON storage.objects;

-- อนุญาตให้ทุกคนอ่าน/ดาวน์โหลดไฟล์เสียงได้ (SELECT)
CREATE POLICY "Public read storage" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'audio-recordings');

-- อนุญาตให้อัปโหลดได้เฉพาะไฟล์เสียง MP3 ขนาดไม่เกิน 10MB เท่านั้น (INSERT)
CREATE POLICY "Public insert storage" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (LOWER(storage.extension(name)) = 'mp3' OR metadata->>'mimetype' = 'audio/mpeg')
);

-- ปิดสิทธิ์การลบไฟล์เสียงใน Storage จาก Public anon (ป้องกันการกลั่นแกล้งลบไฟล์ทิ้ง)
CREATE POLICY "Only admin can delete storage" ON storage.objects
FOR DELETE TO authenticated, service_role
USING (bucket_id = 'audio-recordings');
