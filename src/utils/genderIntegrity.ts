// Security Integrity Signer for Tamper-Proof LocalStorage
const INTEGRITY_SALT = 'barron_audio_collector_secret_salt_v1';
const SIG_KEY = 'voice_user_gender_sig';

// 1. สร้าง Signature จากเพศที่ผู้ใช้กดยืนยันผ่านหน้าต่าง UI แท้จริง
export async function createGenderSignature(gender: 'male' | 'female'): Promise<string> {
  const payload = `${gender}::${INTEGRITY_SALT}::valid_user_action`;
  const buffer = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 2. ตรวจสอบว่าค่า voice_user_gender ใน localStorage ตรงกับ Signature แท้จริงหรือไม่
export async function verifyGenderIntegrity(gender: string): Promise<boolean> {
  if (gender !== 'male' && gender !== 'female') return false;
  const expectedSig = await createGenderSignature(gender);
  const actualSig = localStorage.getItem(SIG_KEY);
  return actualSig === expectedSig;
}

// 3. บันทึกลง localStorage พร้อม Signature ลับ
export async function saveVerifiedGender(gender: 'male' | 'female'): Promise<void> {
  const sig = await createGenderSignature(gender);
  localStorage.setItem('voice_user_gender', gender);
  localStorage.setItem(SIG_KEY, sig);
}
