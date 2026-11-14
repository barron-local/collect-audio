-- ==============================================================================
-- ตาราง device_gender_limits สำหรับบันทึกโควตาการเปลี่ยนเพศต่อวันของแต่ละเครื่อง
-- ป้องกันการเคลียร์ localStorage ในเบราว์เซอร์
-- ==============================================================================

CREATE TABLE IF NOT EXISTS device_gender_limits (
  device_id TEXT NOT NULL,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  change_count INT NOT NULL DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, change_date)
);

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
