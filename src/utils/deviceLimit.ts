// Device Fingerprint & Server-backed Gender Quota Service
import { supabase, isSupabaseConfigured } from './supabase';

const DEVICE_ID_KEY = 'voice_client_device_id';
const LOCAL_QUOTA_KEY = 'voice_gender_changes_meta';
export const MAX_GENDER_CHANGES_PER_DAY = 3;

// 1. Generate or retrieve permanent device ID (Canvas + Screen + Audio context hash fallback)
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    try {
      const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navInfo = `${navigator.userAgent}::${navigator.language}`;
      const randomSeed = Math.random().toString(36).substring(2, 15);
      const raw = `${screenInfo}::${navInfo}::${randomSeed}::${Date.now()}`;
      
      // Simple hash
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      deviceId = 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    } catch {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 12);
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// Helper to calculate daily cycle date with 06:00 AM reset threshold
// หากเวลาก่อน 06:00 น. จะยังถือว่าเป็นรอบของวันก่อนหน้า
// หากเวลาตั้งแต่ 06:00 น. เป็นต้นไป จะเป็นรอบของวันใหม่
export function getCycleDateString(): string {
  const now = new Date();
  // ลบ 6 ชั่วโมง เพื่อให้เวลา 00:00 - 05:59 ย้อนกลับไปนับเป็นวันเดิม และ 06:00 ขึ้นไปเป็นวันใหม่
  const cycleTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return cycleTime.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 2. Fetch today's gender change count (Syncs Supabase & Local fallback)
export async function getGenderChangeCount(): Promise<number> {
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();

  // Try fetching from Supabase table if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('device_gender_limits')
        .select('change_count')
        .eq('device_id', deviceId)
        .eq('change_date', cycleDate)
        .maybeSingle();

      if (!error && data) {
        // sync back to local storage
        localStorage.setItem(LOCAL_QUOTA_KEY, JSON.stringify({ count: data.change_count, date: cycleDate }));
        return data.change_count || 0;
      }
    } catch (err) {
      console.warn('Supabase device quota fetch fallback to local:', err);
    }
  }

  // Local fallback
  const raw = localStorage.getItem(LOCAL_QUOTA_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date === cycleDate) {
      return parsed.count || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

// 3. Increment gender change count
export async function incrementGenderChangeCount(): Promise<number> {
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();
  const currentCount = await getGenderChangeCount();
  const newCount = currentCount + 1;

  // 1. Update Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('device_gender_limits')
        .upsert({
          device_id: deviceId,
          change_date: cycleDate,
          change_count: newCount,
          last_updated: new Date().toISOString()
        }, { onConflict: 'device_id,change_date' });

      if (error) {
        console.warn('[Supabase] Warning updating device_gender_limits:', error.message);
      }
    } catch (e) {
      console.warn('Failed to upsert to device_gender_limits:', e);
    }
  }

  // 2. Update local storage
  localStorage.setItem(LOCAL_QUOTA_KEY, JSON.stringify({ count: newCount, date: cycleDate }));
  return newCount;
}
