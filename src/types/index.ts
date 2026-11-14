export interface Topic {
  id: string;
  title: string;
  description: string;
  textToRead: string;
  targetGender: 'all' | 'male' | 'female';
  createdAt: string;
  recordingCount?: number;
  maleCount?: number;
  femaleCount?: number;
  records?: AudioRecord[];
}

// Alias for backwards compatibility if needed
export type Campaign = Topic;

export interface AudioRecord {
  id: string;
  topicId: string;
  speakerName: string;
  gender: 'male' | 'female' | 'other';
  durationSeconds: number;
  filename: string;
  fileUrl?: string;
  fileSize: number;
  recordedAt: string;
}
