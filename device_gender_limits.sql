-- ==============================================================================
-- อัปเดตตาราง device_gender_limits ให้รองรับคอลัมน์ assigned_gender
-- ป้องกันการแก้ไข voice_user_gender ใน localStorage ตรงๆ
-- ==============================================================================

CREATE TABLE IF NOT EXISTS device_gender_limits (
  device_id TEXT NOT NULL,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  change_count INT NOT NULL DEFAULT 1,
  assigned_gender TEXT NOT NULL DEFAULT 'male',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, change_date)
);

-- เพิ่มคอลัมน์ assigned_gender หากยังไม่มี
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'device_gender_limits' AND column_name = 'assigned_gender'
  ) THEN
    ALTER TABLE device_gender_limits ADD COLUMN assigned_gender TEXT NOT NULL DEFAULT 'male';
  END IF;
END $$;

-- เปิด RLS และอนุญาตให้ client อัปเดตและอ่านโควตาของตนเองได้
ALTER TABLE device_gender_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can select device_gender_limits" ON device_gender_limits;
CREATE POLICY "Public can select device_gender_limits" ON device_gender_limits
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can upsert device_gender_limits" ON device_gender_limits;
CREATE POLICY "Public can upsert device_gender_limits" ON device_gender_limits
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update device_gender_limits" ON device_gender_limits;
CREATE POLICY "Public can update device_gender_limits" ON device_gender_limits
FOR UPDATE TO anon, authenticated
USING (true);
