import JSZip from 'jszip';
import type { Campaign, AudioRecord } from '../types';

export async function exportCampaignZip(
  campaign: Campaign, 
  records: AudioRecord[], 
  genderFilter: 'all' | 'male' | 'female' = 'all'
) {
  const zip = new JSZip();

  const filtered = records.filter(r => {
    if (genderFilter === 'all') return true;
    return r.gender === genderFilter;
  });

  // Metadata JSON
  const metadata = {
    campaign,
    filterGender: genderFilter,
    totalRecords: filtered.length,
    records: filtered.map(r => ({
      id: r.id,
      speakerName: r.speakerName,
      gender: r.gender,
      durationSeconds: r.durationSeconds,
      filename: `${r.gender}/${r.speakerName}_${r.id}.mp3`,
      recordedAt: r.recordedAt
    }))
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Download files and add to zip
  for (const rec of filtered) {
    if (!rec.fileUrl) continue;
    try {
      const response = await fetch(rec.fileUrl);
      const blob = await response.blob();
      const folderName = rec.gender === 'female' ? 'female' : 'male';
      const cleanSpeaker = (rec.speakerName || 'user').replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '_');
      zip.folder(folderName)?.file(`${cleanSpeaker}_${rec.id}.mp3`, blob);
    } catch (err) {
      console.error('Failed to add audio to zip:', rec.id, err);
    }
  }

  // Generate zip file
  const content = await zip.generateAsync({ type: 'blob' });
  const safeTitle = campaign.title.replace(/[^a-zA-Z0-9\u0E00-\u0E7F_-]/g, '_');
  const fileName = `${safeTitle}${genderFilter !== 'all' ? `_${genderFilter}` : ''}_audios.zip`;

  // Trigger browser download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
