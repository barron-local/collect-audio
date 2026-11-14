import { supabase, isSupabaseConfigured, BUCKET_NAME } from './supabase';
import type { Campaign, AudioRecord } from '../types';

const LOCAL_CAMPAIGNS_KEY = 'voice_collector_campaigns';
const LOCAL_RECORDS_KEY = 'voice_collector_records';

const defaultCampaigns: Campaign[] = [
  {
    id: 'sample-1',
    title: 'ประโยคทดสอบพื้นฐาน 1',
    description: 'ประโยคภาษาไทยสำหรับการฝึกโมเดลเสียงสังเคราะห์และการรู้จำเสียงพูด',
    textToRead: 'สวัสดีครับ ยินดีต้อนรับเข้าสู่ระบบบันทึกเสียงเพื่อพัฒนาโมเดลปัญญาประดิษฐ์',
    targetGender: 'all',
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-2',
    title: 'ประโยคคำถามและบริการ',
    description: 'ประโยคสอบถามข้อมูลทั่วไป',
    textToRead: 'วันนี้สภาพอากาศเป็นอย่างไรบ้าง และมีโปรโมชั่นอะไรน่าสนใจบ้างครับ',
    targetGender: 'female',
    createdAt: new Date().toISOString()
  }
];

function getLocalCampaigns(): Campaign[] {
  const data = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(defaultCampaigns));
    return defaultCampaigns;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultCampaigns;
  }
}

function getLocalRecords(): AudioRecord[] {
  const data = localStorage.getItem(LOCAL_RECORDS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// 1. Get all campaigns with counts
export async function getCampaigns(): Promise<Campaign[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: camps, error: campErr } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (campErr) throw campErr;

    const { data: recs, error: recErr } = await supabase
      .from('audio_records')
      .select('campaign_id, gender');

    if (recErr) throw recErr;

    return (camps || []).map(camp => {
      const campRecords = (recs || []).filter(r => r.campaign_id === camp.id);
      return {
        id: camp.id,
        title: camp.title,
        description: camp.description || '',
        textToRead: camp.text_to_read,
        targetGender: (camp.target_gender as 'all' | 'male' | 'female') || 'all',
        createdAt: camp.created_at,
        recordingCount: campRecords.length,
        maleCount: campRecords.filter(r => r.gender === 'male').length,
        femaleCount: campRecords.filter(r => r.gender === 'female').length
      };
    });
  }

  const camps = getLocalCampaigns();
  const recs = getLocalRecords();
  return camps.map(camp => {
    const campRecords = recs.filter(r => r.campaignId === camp.id);
    return {
      ...camp,
      targetGender: camp.targetGender || 'all',
      recordingCount: campRecords.length,
      maleCount: campRecords.filter(r => r.gender === 'male').length,
      femaleCount: campRecords.filter(r => r.gender === 'female').length
    };
  });
}

// 2. Get campaign details with recordings
export async function getCampaignDetails(campaignId: string): Promise<Campaign> {
  if (isSupabaseConfigured && supabase) {
    const { data: camp, error: campErr } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campErr || !camp) throw new Error('ไม่พบประกาศ');

    const { data: recs, error: recErr } = await supabase
      .from('audio_records')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('recorded_at', { ascending: false });

    if (recErr) throw recErr;

    return {
      id: camp.id,
      title: camp.title,
      description: camp.description || '',
      textToRead: camp.text_to_read,
      targetGender: (camp.target_gender as 'all' | 'male' | 'female') || 'all',
      createdAt: camp.created_at,
      records: (recs || []).map(r => ({
        id: r.id,
        campaignId: r.campaign_id,
        speakerName: r.speaker_name,
        gender: r.gender,
        durationSeconds: r.duration_seconds,
        filename: r.filename,
        fileUrl: r.file_url,
        fileSize: r.file_size,
        recordedAt: r.recorded_at
      }))
    };
  }

  const camps = getLocalCampaigns();
  const camp = camps.find(c => c.id === campaignId);
  if (!camp) throw new Error('ไม่พบประกาศ');

  const recs = getLocalRecords().filter(r => r.campaignId === campaignId);
  return {
    ...camp,
    targetGender: camp.targetGender || 'all',
    records: recs
  };
}

// 3. Create campaign
export async function createCampaign(
  title: string, 
  description: string, 
  textToRead: string, 
  targetGender: 'all' | 'male' | 'female' = 'all'
): Promise<Campaign> {
  const newCamp: Campaign = {
    id: 'camp-' + Date.now(),
    title: title.trim(),
    description: (description || '').trim(),
    textToRead: textToRead.trim(),
    targetGender,
    createdAt: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('campaigns').insert({
      id: newCamp.id,
      title: newCamp.title,
      description: newCamp.description,
      text_to_read: newCamp.textToRead,
      target_gender: targetGender,
      created_at: newCamp.createdAt
    });
    if (error) {
      const { error: retryError } = await supabase.from('campaigns').insert({
        id: newCamp.id,
        title: newCamp.title,
        description: newCamp.description,
        text_to_read: newCamp.textToRead,
        created_at: newCamp.createdAt
      });
      if (retryError) throw retryError;
    }
    return newCamp;
  }

  const camps = getLocalCampaigns();
  camps.unshift(newCamp);
  localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(camps));
  return newCamp;
}

// 4. Update campaign
export async function updateCampaign(
  id: string,
  updates: {
    title: string;
    description: string;
    textToRead: string;
    targetGender: 'all' | 'male' | 'female';
  }
): Promise<void> {
  const { title, description, textToRead, targetGender } = updates;

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('campaigns')
      .update({
        title: title.trim(),
        description: (description || '').trim(),
        text_to_read: textToRead.trim(),
        target_gender: targetGender
      })
      .eq('id', id);

    if (error) {
      // Fallback if target_gender not yet altered
      const { error: retryError } = await supabase
        .from('campaigns')
        .update({
          title: title.trim(),
          description: (description || '').trim(),
          text_to_read: textToRead.trim()
        })
        .eq('id', id);
      if (retryError) throw retryError;
    }
    return;
  }

  const camps = getLocalCampaigns();
  const index = camps.findIndex(c => c.id === id);
  if (index !== -1) {
    camps[index] = {
      ...camps[index],
      title: title.trim(),
      description: (description || '').trim(),
      textToRead: textToRead.trim(),
      targetGender
    };
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(camps));
  }
}

// 5. Delete campaign
export async function deleteCampaign(campaignId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { data: recs } = await supabase
      .from('audio_records')
      .select('filename')
      .eq('campaign_id', campaignId);

    if (recs && recs.length > 0) {
      const filePaths = recs.map(r => r.filename).filter(Boolean);
      if (filePaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(filePaths);
      }
    }

    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) throw error;
    return;
  }

  const camps = getLocalCampaigns().filter(c => c.id !== campaignId);
  const recs = getLocalRecords().filter(r => r.campaignId !== campaignId);
  localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(camps));
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(recs));
}

// 6. Upload Audio (.mp3)
export async function uploadRecording(params: {
  mp3Blob: Blob;
  campaignId: string;
  speakerName: string;
  gender: 'male' | 'female' | 'other';
  durationSeconds: number;
}): Promise<AudioRecord> {
  const { mp3Blob, campaignId, speakerName, gender, durationSeconds } = params;
  const recId = 'rec-' + Date.now();
  const cleanSpeaker = speakerName.trim() || 'ไม่ระบุชื่อ';

  if (isSupabaseConfigured && supabase) {
    const filePath = `${campaignId}/${gender}/${recId}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, mp3Blob, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error('อัปโหลดไฟล์ไปที่ Supabase Storage ไม่สำเร็จ: ' + uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const fileUrl = urlData?.publicUrl || '';

    const { error: insertError } = await supabase.from('audio_records').insert({
      id: recId,
      campaign_id: campaignId,
      speaker_name: cleanSpeaker,
      gender,
      duration_seconds: durationSeconds,
      filename: filePath,
      file_url: fileUrl,
      file_size: mp3Blob.size,
      recorded_at: new Date().toISOString()
    });

    if (insertError) throw insertError;

    return {
      id: recId,
      campaignId,
      speakerName: cleanSpeaker,
      gender,
      durationSeconds,
      filename: filePath,
      fileUrl,
      fileSize: mp3Blob.size,
      recordedAt: new Date().toISOString()
    };
  }

  const arrayBuffer = await mp3Blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  const dataUrl = `data:audio/mp3;base64,${base64}`;

  const record: AudioRecord = {
    id: recId,
    campaignId,
    speakerName: cleanSpeaker,
    gender,
    durationSeconds,
    filename: `audio-${recId}.mp3`,
    fileUrl: dataUrl,
    fileSize: mp3Blob.size,
    recordedAt: new Date().toISOString()
  };

  const recs = getLocalRecords();
  recs.unshift(record);
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(recs));
  return record;
}

// 7. Delete single recording
export async function deleteRecording(recordId: string, filename?: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    if (filename) {
      await supabase.storage.from(BUCKET_NAME).remove([filename]);
    }
    const { error } = await supabase.from('audio_records').delete().eq('id', recordId);
    if (error) throw error;
    return;
  }

  const recs = getLocalRecords().filter(r => r.id !== recordId);
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(recs));
}
