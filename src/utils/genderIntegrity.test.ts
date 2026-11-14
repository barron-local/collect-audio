import { describe, it, expect, beforeEach } from 'vitest';
import { createGenderSignature, verifyGenderIntegrity, saveVerifiedGender, recoverVerifiedGender } from './genderIntegrity';

describe('genderIntegrity - Security & Tamper-Proof Seam', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates reproducible cryptographic signature for valid gender', async () => {
    const sig1 = await createGenderSignature('male');
    const sig2 = await createGenderSignature('male');
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 hex string
  });

  it('rejects tampered gender value in localStorage', async () => {
    // ผู้ใช้เซฟ male อย่างถูกต้อง
    await saveVerifiedGender('male');

    // แต่แอบไปแก้ localStorage ใน DevTools ให้เป็น female โดยไม่มี Signature ใหม่
    localStorage.setItem('voice_user_gender', 'female');

    const isValid = await verifyGenderIntegrity('female');
    expect(isValid).toBe(false);
  });

  it('rejects illegal or malicious gender strings immediately', async () => {
    const isValid = await verifyGenderIntegrity('hacker_payload');
    expect(isValid).toBe(false);
  });

  // RED PHASE: ฟังก์ชันกู้คืนค่าเดิมที่ถูกต้องปลอดภัย (ไม่ใช่การเดาสลับค่า)
  it('safely recovers last verified gender when tampered, without guessing', async () => {
    // ผู้ใช้เซฟ male อย่างถูกต้อง
    await saveVerifiedGender('male');

    // โดนแก้ไขเป็นค่าแปลกปลอมใน LocalStorage
    localStorage.setItem('voice_user_gender', 'hacker');

    // ต้องสามารถคืนค่าเพศเดิม 'male' ที่ verified ไว้จริงได้
    const recovered = await recoverVerifiedGender();
    expect(recovered).toBe('male');
  });
});
