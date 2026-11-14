import { supabase, isSupabaseConfigured, BUCKET_NAME } from './supabase';
import type { Topic, AudioRecord } from '../types';

const LOCAL_TOPICS_KEY = 'voice_collector_topics';
const LOCAL_RECORDS_KEY = 'voice_collector_records';

const defaultTopics: Topic[] = [
  {
    id: 'topic-1',
    title: 'ประโยคทดสอบพื้นฐาน 1',
    description: 'ประโยคภาษาไทยสำหรับการฝึกโมเดลเสียงสังเคราะห์และการรู้จำเสียงพูด',
    textToRead: 'สวัสดีครับ ยินดีต้อนรับเข้าสู่ระบบบันทึกเสียงเพื่อพัฒนาโมเดลปัญญาประดิษฐ์',
    targetGender: 'all',
    createdAt: new Date().toISOString()
  },
  {
    id: 'topic-2',
    title: 'ประโยคคำถามและบริการ',
    description: 'ประโยคสอบถามข้อมูลทั่วไป',
    textToRead: 'วันนี้สภาพอากาศเป็นอย่างไรบ้าง และมีโปรโมชั่นอะไรน่าสนใจบ้างครับ',
    targetGender: 'female',
    createdAt: new Date().toISOString()
  }
];

function getLocalTopics(): Topic[] {
  const data = localStorage.getItem(LOCAL_TOPICS_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(defaultTopics));
    return defaultTopics;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultTopics;
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

// 1. Get all topics with counts (Using 'topics' table only)
export async function getTopics(): Promise<Topic[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: topics, error: topicErr } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (topicErr) {
      console.warn('[Supabase] Warning fetching topics:', topicErr.message);
      return getLocalTopics();
    }

    const { data: recs } = await supabase
      .from('audio_records')
      .select('*');

    return (topics || []).map((item: any) => {
      const topicRecords = (recs || []).filter(
        (r: any) => r.topic_id === item.id || r.campaign_id === item.id
      );
      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        textToRead: item.text_to_read,
        targetGender: (item.target_gender as 'all' | 'male' | 'female') || 'all',
        createdAt: item.created_at,
        recordingCount: topicRecords.length,
        maleCount: topicRecords.filter((r: any) => r.gender === 'male').length,
        femaleCount: topicRecords.filter((r: any) => r.gender === 'female').length
      };
    });
  }

  // Fallback to local storage
  const topics = getLocalTopics();
  const recs = getLocalRecords();
  return topics.map(t => {
    const topicRecords = recs.filter(r => r.topicId === t.id);
    return {
      ...t,
      targetGender: t.targetGender || 'all',
      recordingCount: topicRecords.length,
      maleCount: topicRecords.filter(r => r.gender === 'male').length,
      femaleCount: topicRecords.filter(r => r.gender === 'female').length
    };
  });
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
      const local = getLocalTopics().find(t => t.id === topicId);
      if (local) return local;
      throw new Error('ไม่พบประกาศ');
    }

    // Query audio_records for this topic
    let recs: any[] = [];
    const { data: recsByTopic, error: recTopicErr } = await supabase
      .from('audio_records')
      .select('*')
      .eq('topic_id', topicId)
      .order('recorded_at', { ascending: false });

    if (!recTopicErr && recsByTopic) {
      recs = recsByTopic;
    } else {
      // Fallback query by campaign_id if topic_id column does not exist yet
      const { data: recsByCamp } = await supabase
        .from('audio_records')
        .select('*')
        .eq('campaign_id', topicId)
        .order('recorded_at', { ascending: false });
      if (recsByCamp) recs = recsByCamp;
    }

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

  const topics = getLocalTopics();
  const topic = topics.find(t => t.id === topicId);
  if (!topic) throw new Error('ไม่พบประกาศ');

  const recs = getLocalRecords().filter(r => r.topicId === topicId);
  return {
    ...topic,
    targetGender: topic.targetGender || 'all',
    records: recs
  };
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

  const topics = getLocalTopics();
  topics.unshift(newTopic);
  localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(topics));
  return newTopic;
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

  const topics = getLocalTopics();
  const index = topics.findIndex(t => t.id === id);
  if (index !== -1) {
    topics[index] = {
      ...topics[index],
      title: title.trim(),
      description: (description || '').trim(),
      textToRead: textToRead.trim(),
      targetGender
    };
    localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(topics));
  }
}

// 5. Delete topic
export async function deleteTopic(topicId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    // Delete associated files from storage
    let recs: any[] = [];
    const { data: recsTopic } = await supabase
      .from('audio_records')
      .select('filename')
      .eq('topic_id', topicId);

    if (recsTopic && recsTopic.length > 0) {
      recs = recsTopic;
    } else {
      const { data: recsCamp } = await supabase
        .from('audio_records')
        .select('filename')
        .eq('campaign_id', topicId);
      if (recsCamp) recs = recsCamp;
    }

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

  const topics = getLocalTopics().filter(t => t.id !== topicId);
  const recs = getLocalRecords().filter(r => r.topicId !== topicId);
  localStorage.setItem(LOCAL_TOPICS_KEY, JSON.stringify(topics));
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(recs));
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
  const recId = 'rec-' + Date.now();
  const cleanSpeaker = speakerName.trim() || 'ไม่ระบุชื่อ';

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

  const arrayBuffer = await mp3Blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  const dataUrl = `data:audio/mp3;base64,${base64}`;

  const record: AudioRecord = {
    id: recId,
    topicId,
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

// Backwards-compatible aliases
export const getCampaigns = getTopics;
export const getCampaignDetails = getTopicDetails;
export const createCampaign = createTopic;
export const updateCampaign = updateTopic;
export const deleteCampaign = deleteTopic;
