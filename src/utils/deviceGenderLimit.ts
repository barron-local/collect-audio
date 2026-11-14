// Server-backed Device Gender Limit Service via Supabase
import { supabase, isSupabaseConfigured } from './supabase';

const DEVICE_ID_KEY = 'voice_client_device_id';
export const MAX_GENDER_CHANGES_PER_DAY = 3;

// 1. Generate permanent device fingerprint
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    try {
      const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navInfo = `${navigator.userAgent}::${navigator.language}`;
      const raw = `${screenInfo}::${navInfo}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      deviceId = 'dev_' + Math.abs(hash).toString(36);
    } catch {
      deviceId = 'dev_client';
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// 2. Cycle date offset at 06:00 AM
export function getCycleDateString(): string {
  const now = new Date();
  const cycleTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return cycleTime.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 3. Query current change count from Supabase
export async function fetchServerGenderChangeCount(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();

  try {
    const { data, error } = await supabase
      .from('device_gender_limits')
      .select('change_count')
      .eq('device_id', deviceId)
      .eq('change_date', cycleDate)
      .maybeSingle();

    if (!error && data) {
      return data.change_count || 0;
    }
  } catch (err) {
    console.warn('Failed to query device_gender_limits count:', err);
  }
  return 0;
}

// 4. Record new change count in Supabase
export async function incrementServerGenderChangeCount(): Promise<number> {
  const currentCount = await fetchServerGenderChangeCount();
  const newCount = currentCount + 1;
  const cycleDate = getCycleDateString();
  const deviceId = getOrCreateDeviceId();

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('device_gender_limits')
        .upsert({
          device_id: deviceId,
          change_date: cycleDate,
          change_count: newCount
        }, { onConflict: 'device_id,change_date' });
    } catch (err) {
      console.warn('Failed to upsert device_gender_limits count:', err);
    }
  }

  return newCount;
}
