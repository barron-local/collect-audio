// 100% Server-backed Device Quota Service via Supabase
import { supabase, isSupabaseConfigured } from './supabase';

const DEVICE_ID_KEY = 'voice_client_device_id';
export const MAX_GENDER_CHANGES_PER_DAY = 3;

// Clean up legacy localstorage keys if any remain
try {
  localStorage.removeItem('voice_gender_changes_meta');
  localStorage.removeItem('voice_collector_topics');
  localStorage.removeItem('voice_collector_records');
} catch {}

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

// 2. Fetch server-verified assigned gender and today's gender change count
export async function syncDeviceGenderProfile(): Promise<{ assignedGender: 'male' | 'female' | ''; changeCount: number }> {
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();
  let serverGender: 'male' | 'female' | '' = '';
  let serverCount = 0;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('device_gender_limits')
        .select('assigned_gender, change_count')
        .eq('device_id', deviceId)
        .eq('change_date', cycleDate)
        .maybeSingle();

      if (!error && data) {
        if (data.assigned_gender === 'male' || data.assigned_gender === 'female') {
          serverGender = data.assigned_gender;
          localStorage.setItem('voice_user_gender', serverGender);
        }
        serverCount = data.change_count || 0;
        return { assignedGender: serverGender, changeCount: serverCount };
      }
    } catch (err) {
      console.warn('Supabase device profile sync fallback:', err);
    }
  }

  // Fallback to local gender state only
  const localSaved = (localStorage.getItem('voice_user_gender') as 'male' | 'female') || '';
  return { assignedGender: localSaved, changeCount: 0 };
}

// 3. Fetch today's gender change count (Syncs Supabase & Local fallback)
export async function getGenderChangeCount(): Promise<number> {
  const profile = await syncDeviceGenderProfile();
  return profile.changeCount;
}

// 4. Update gender assignment and increment quota on Supabase
export async function saveAssignedGender(gender: 'male' | 'female', isChange: boolean): Promise<number> {
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();
  const currentCount = await getGenderChangeCount();
  const newCount = isChange ? currentCount + 1 : currentCount;

  // 1. Update Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('device_gender_limits')
        .upsert({
          device_id: deviceId,
          change_date: cycleDate,
          change_count: newCount,
          assigned_gender: gender,
          last_updated: new Date().toISOString()
        }, { onConflict: 'device_id,change_date' });

      if (error) {
        console.warn('[Supabase] Warning updating assigned_gender:', error.message);
      }
    } catch (e) {
      console.warn('Failed to upsert to device_gender_limits:', e);
    }
  }

  // 2. Set active gender locally
  localStorage.setItem('voice_user_gender', gender);
  return newCount;
}
