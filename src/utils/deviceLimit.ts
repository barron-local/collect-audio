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

// 2. Fetch today's gender change count (Syncs Supabase & Local fallback)
export async function getGenderChangeCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const deviceId = getOrCreateDeviceId();

  // Try fetching from Supabase table if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('device_gender_limits')
        .select('change_count')
        .eq('device_id', deviceId)
        .eq('change_date', today)
        .maybeSingle();

      if (!error && data) {
        // sync back to local storage
        localStorage.setItem(LOCAL_QUOTA_KEY, JSON.stringify({ count: data.change_count, date: today }));
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
    if (parsed.date === today) {
      return parsed.count || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

// 3. Increment gender change count
export async function incrementGenderChangeCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
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
          change_date: today,
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
  localStorage.setItem(LOCAL_QUOTA_KEY, JSON.stringify({ count: newCount, date: today }));
  return newCount;
}
