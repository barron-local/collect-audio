export interface Campaign {
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

export interface AudioRecord {
  id: string;
  campaignId: string;
  speakerName: string;
  gender: 'male' | 'female' | 'other';
  durationSeconds: number;
  filename: string;
  fileUrl?: string;
  fileSize: number;
  recordedAt: string;
}
