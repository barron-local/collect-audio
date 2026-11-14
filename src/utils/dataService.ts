import { supabase, isSupabaseConfigured, BUCKET_NAME } from './supabase';
import type { Topic, AudioRecord } from '../types';

// 1. Get all topics with counts (Using 'topics' table only)
export async function getTopics(): Promise<Topic[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: topics, error: topicErr } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (topicErr) {
      console.warn('[Supabase] Warning fetching topics:', topicErr.message);
      return [];
    }

    // Query record counts
    const { data: recordsData } = await supabase
      .from('audio_records')
      .select('topic_id');

    const counts: Record<string, number> = {};
    if (recordsData) {
      recordsData.forEach((r: any) => {
        const id = r.topic_id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
    }

    return (topics || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      textToRead: t.text_to_read,
      targetGender: (t.target_gender as 'all' | 'male' | 'female') || 'all',
      createdAt: t.created_at,
      recordingCount: counts[t.id] || 0
    }));
  }

  return [];
}

// 2. Get topic details with recordings
export async function getTopicDetails(topicId: string): Promise<Topic> {
  if (isSupabaseConfigured && supabase) {
    const { data: topic, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', topicId)
      .single();

    if (error || !topic) {
      throw new Error('ไม่พบประกาศ');
    }

    // Query audio_records for this topic (เรียงจากคนที่เพิ่มก่อนไปยังคนเพิ่มหลัง: ascending: true)
    const { data: recsByTopic } = await supabase
      .from('audio_records')
      .select('*')
      .eq('topic_id', topicId)
      .order('recorded_at', { ascending: true });

    const recs = recsByTopic || [];

    return {
      id: topic.id,
      title: topic.title,
      description: topic.description || '',
      textToRead: topic.text_to_read,
      targetGender: (topic.target_gender as 'all' | 'male' | 'female') || 'all',
      createdAt: topic.created_at,
      records: (recs || []).map((r: any) => ({
        id: r.id,
        topicId: r.topic_id || r.campaign_id,
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

  throw new Error('Supabase is not configured');
}

// 3. Create topic
export async function createTopic(
  title: string, 
  description: string, 
  textToRead: string, 
  targetGender: 'all' | 'male' | 'female' = 'all'
): Promise<Topic> {
  const newTopic: Topic = {
    id: 'topic-' + Date.now(),
    title: title.trim(),
    description: (description || '').trim(),
    textToRead: textToRead.trim(),
    targetGender,
    createdAt: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    const payload = {
      id: newTopic.id,
      title: newTopic.title,
      description: newTopic.description,
      text_to_read: newTopic.textToRead,
      target_gender: targetGender,
      created_at: newTopic.createdAt
    };

    const { error } = await supabase.from('topics').insert(payload);
    if (error) {
      console.error('[Supabase] Insert topic error:', error);
      throw new Error(error.message);
    }
    return newTopic;
  }

  throw new Error('Supabase is not configured');
}

// 4. Update topic
export async function updateTopic(
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
    const payload = {
      title: title.trim(),
      description: (description || '').trim(),
      text_to_read: textToRead.trim(),
      target_gender: targetGender
    };

    const { error } = await supabase.from('topics').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }

  throw new Error('Supabase is not configured');
}

// 5. Delete topic
export async function deleteTopic(topicId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    // Delete associated files from storage
    const { data: recsTopic } = await supabase
      .from('audio_records')
      .select('filename')
      .eq('topic_id', topicId);

    const recs = recsTopic || [];

    if (recs && recs.length > 0) {
      const filePaths = recs.map(r => r.filename).filter(Boolean);
      if (filePaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(filePaths);
      }
    }

    const { error } = await supabase.from('topics').delete().eq('id', topicId);
    if (error) throw new Error(error.message);
    return;
  }

  throw new Error('Supabase is not configured');
}

// 6. Upload Audio (.mp3)
export async function uploadRecording(params: {
  mp3Blob: Blob;
  topicId: string;
  speakerName: string;
  gender: 'male' | 'female' | 'other';
  durationSeconds: number;
}): Promise<AudioRecord> {
  const { mp3Blob, topicId, speakerName, gender, durationSeconds } = params;
  
  // ตรวจสอบขนาดไฟล์ ป้องกัน Spam / Denial of Wallet (สูงสุด 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (mp3Blob.size > MAX_FILE_SIZE) {
    throw new Error('ขนาดไฟล์เกินขีดจำกัดสูงสุด (10MB)');
  }

  const recId = 'rec-' + Date.now();
  const cleanSpeaker = speakerName.trim().slice(0, 50) || 'ไม่ระบุชื่อ';

  if (isSupabaseConfigured && supabase) {
    const filePath = `${topicId}/${gender}/${recId}.mp3`;

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

    const recordPayload: any = {
      id: recId,
      topic_id: topicId,
      speaker_name: cleanSpeaker,
      gender,
      duration_seconds: durationSeconds,
      filename: filePath,
      file_url: fileUrl,
      file_size: mp3Blob.size,
      recorded_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase.from('audio_records').insert(recordPayload);
    if (insertError) {
      console.error('[Supabase] Insert audio record error:', insertError);
      throw new Error(insertError.message);
    }

    return {
      id: recId,
      topicId,
      speakerName: cleanSpeaker,
      gender,
      durationSeconds,
      filename: filePath,
      fileUrl,
      fileSize: mp3Blob.size,
      recordedAt: new Date().toISOString()
    };
  }

  throw new Error('Supabase is not configured');
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

  throw new Error('Supabase is not configured');
}

// Backwards-compatible aliases
export const getCampaigns = getTopics;
export const getCampaignDetails = getTopicDetails;
export const createCampaign = createTopic;
export const updateCampaign = updateTopic;
export const deleteCampaign = deleteTopic;
