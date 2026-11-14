import React, { useState, useRef, useEffect } from 'react';
import type { Campaign, AudioRecord } from '../types';
import { convertWebmBlobToMp3 } from '../utils/audioConverter';
import { uploadRecording, getCampaignDetails } from '../utils/dataService';
import { ArrowLeft, Mic, Square, RotateCcw, Upload, Lock, FileAudio, AlertCircle } from 'lucide-react';

interface Props {
  campaign: Campaign;
  gender: 'male' | 'female';
  onBack: () => void;
  onRecordingSuccess?: () => void;
}

export const UserRecorder: React.FC<Props> = ({ 
  campaign, 
  gender, 
  onBack, 
  onRecordingSuccess 
}) => {
  const [speakerName, setSpeakerName] = useState(
    () => localStorage.getItem('voice_speaker_name') || ''
  );
  
  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedMp3Blob, setRecordedMp3Blob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Community records inside this folder
  const [records, setRecords] = useState<AudioRecord[]>(campaign.records || []);

  const target = campaign.targetGender || 'all';
  const isGenderAllowed = target === 'all' || target === gender;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const fetchRecords = async () => {
    try {
      const details = await getCampaignDetails(campaign.id);
      setRecords(details.records || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 2000);
    return () => clearInterval(interval);
  }, [campaign.id]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      stopAudioStreams();
      clearInterval(timerIntervalRef.current);
    };
  }, [recordedAudioUrl]);

  const MAX_RECORDING_SECONDS = 60; // จำกัดเวลาอัดสูงสุด 60 วินาที ป้องกันไฟล์ขยะและ spam

  const stopAudioStreams = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setMicVolume(0);
  };

  const startRecording = async () => {
    if (!isGenderAllowed) return;

    setErrorMessage(null);
    setUploadSuccess(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      audioStreamRef.current = stream;

      // Audio Context & Analyser for Real-time Visualizer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          // คำนวณค่าเฉลี่ย volume 0 - 100
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(100, Math.round((avg / 128) * 100));
          setMicVolume(normalized);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization not available:', audioCtxErr);
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsConverting(true);
        try {
          const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const mp3Blob = await convertWebmBlobToMp3(rawBlob);
          setRecordedMp3Blob(mp3Blob);
          const url = URL.createObjectURL(mp3Blob);
          setRecordedAudioUrl(url);
        } catch (err: any) {
          console.error('Audio conversion error:', err);
          setErrorMessage('แปลงไฟล์เป็น MP3 ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } finally {
          setIsConverting(false);
        }

        stopAudioStreams();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingSeconds(elapsed);

        // ตัดการบันทึกอัตโนมัติเมื่อถึงขีดจำกัดสูงสุด 60 วินาที
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 500);

    } catch (err: any) {
      console.error('Microphone access denied:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('กรุณาอนุญาตการเข้าถึงไมโครโฟนในเบราว์เซอร์เพื่อเริ่มบันทึกเสียง');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('ไม่พบอุปกรณ์ไมโครโฟนบนอุปกรณ์ของคุณ กรุณาเชื่อมต่อไมโครโฟน');
      } else {
        setErrorMessage('ไม่สามารถเข้าถึงไมโครโฟนได้: ' + (err.message || 'เกิดข้อผิดพลาด'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const resetRecording = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedMp3Blob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setUploadSuccess(false);
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!recordedMp3Blob || !isGenderAllowed) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const sanitizedName = speakerName.trim().slice(0, 50);
      localStorage.setItem('voice_speaker_name', sanitizedName);
      await uploadRecording({
        mp3Blob: recordedMp3Blob,
        topicId: campaign.id,
        speakerName: sanitizedName,
        gender,
        durationSeconds: Math.max(1, recordingSeconds)
      });

      setUploadSuccess(true);
      resetRecording();
      fetchRecords();
      if (onRecordingSuccess) {
        onRecordingSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352f] transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>

      {/* Header */}
      <div className="pb-6 mb-8 border-b border-[#e9e9e7]">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-bold text-[#37352f] tracking-tight">
            {campaign.title}
          </h1>
          {target === 'male' && (
            <span className="text-[11px] text-[#787774] px-2 py-0.5 rounded bg-[#f7f6f3] border border-[#e9e9e7]">
              รับเฉพาะเพศชาย
            </span>
          )}
          {target === 'female' && (
            <span className="text-[11px] text-[#787774] px-2 py-0.5 rounded bg-[#f7f6f3] border border-[#e9e9e7]">
              รับเฉพาะเพศหญิง
            </span>
          )}
        </div>
        {campaign.description && (
          <p className="text-sm text-[#787774] leading-relaxed">
            {campaign.description}
          </p>
        )}
      </div>

      {/* Notion-style Microphone Permission Warning / Error Notice */}
      {errorMessage && (
        <div className="mb-6 p-3.5 bg-[#fdf5f5] border border-[#f7d7d7] rounded text-xs text-[#eb5757] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">การเข้าถึงไมโครโฟน</span>
            {errorMessage}
          </div>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="text-[#eb5757] hover:text-[#c53b3b] cursor-pointer text-xs"
          >
            ปิด
          </button>
        </div>
      )}

      <div className="space-y-8">
        {/* Speaker Name Input */}
        <div>
          <label className="block text-xs font-medium text-[#787774] uppercase tracking-wider mb-2">
            ชื่อผู้พูด
          </label>
          <input
            type="text"
            disabled={!isGenderAllowed}
            placeholder="ระบุชื่อของคุณ (ไม่บังคับ)"
            value={speakerName}
            maxLength={50}
            onChange={(e) => setSpeakerName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f] disabled:bg-[#f7f6f3] disabled:text-[#787774]"
          />
        </div>

        {/* Notion Quote Block for Script */}
        <div>
          <label className="block text-xs font-medium text-[#787774] uppercase tracking-wider mb-2">
            ประโยคที่ต้องพูด
          </label>
          <div className="border-l-3 border-[#37352f] pl-4 py-2.5 my-2 bg-[#f7f6f3] rounded-r">
            <p className="text-base text-[#37352f] font-normal leading-relaxed">
              {campaign.textToRead}
            </p>
          </div>
        </div>

        {/* Audio Recorder Controls */}
        <div className="pt-4 border-t border-[#e9e9e7]">
          <div className="flex flex-col items-center justify-center p-6 border border-[#e9e9e7] rounded-lg bg-white">
            
            {/* Status & Timer */}
            <div className="flex flex-col items-center gap-1 mb-4">
              <div className="text-3xl font-mono text-[#37352f] font-semibold tracking-tight">
                {formatTime(recordingSeconds)}
              </div>

              {isRecording ? (
                <div className="flex flex-col items-center gap-2 mt-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#eb5757] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#eb5757] animate-pulse" />
                    <span>กำลังบันทึกเสียง</span>
                  </div>

                  {/* Minimalist Notion Audio Visualizer Waveform */}
                  <div className="flex items-center gap-1 h-5 px-3 py-1 bg-[#f7f6f3] border border-[#e9e9e7] rounded-full">
                    {[18, 42, 65, 88, 55, 30, 70, 45].map((factor, idx) => {
                      const level = Math.max(15, Math.min(100, (micVolume * (factor / 50))));
                      return (
                        <div
                          key={idx}
                          className="w-1 bg-[#37352f] rounded-full transition-all duration-75"
                          style={{ height: `${Math.max(4, Math.round((level / 100) * 16))}px` }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {!isGenderAllowed ? (
              <div className="flex flex-col items-center text-center py-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#787774] bg-[#f7f6f3] border border-[#e9e9e7] rounded mb-3">
                  <Lock className="w-3.5 h-3.5" />
                  รายการนี้รับเฉพาะเสียง{target === 'female' ? 'เพศหญิง' : 'เพศชาย'}
                </div>
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#eae9e5] text-[#9b9a97] rounded text-sm font-medium cursor-not-allowed"
                >
                  <Mic className="w-4 h-4" /> ไม่สามารถอัดเสียงได้
                </button>
              </div>
            ) : !recordedMp3Blob ? (
              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={isConverting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#37352f] hover:bg-[#201f1d] text-white rounded text-sm font-medium transition cursor-pointer disabled:opacity-40"
                  >
                    <Mic className="w-4 h-4" /> เริ่มบันทึกเสียง
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#eb5757] hover:bg-[#d84a4a] text-white rounded text-sm font-medium transition cursor-pointer shadow-sm"
                  >
                    <Square className="w-4 h-4 fill-current" /> หยุดบันทึก
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full space-y-4">
                <audio controls src={recordedAudioUrl || ''} className="w-full h-9" />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={resetRecording}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#787774] hover:text-[#37352f] border border-[#e9e9e7] hover:bg-[#f7f6f3] rounded transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> บันทึกใหม่
                  </button>

                  <button
                    onClick={handleUpload}
                    disabled={isUploading || uploadSuccess}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs bg-[#2383e2] hover:bg-[#1d6fc2] text-white font-medium rounded transition cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? 'กำลังส่งข้อมูล...' : uploadSuccess ? 'ส่งสำเร็จแล้ว' : (
                      <>
                        <Upload className="w-3.5 h-3.5" /> ส่งไฟล์เสียง (.mp3)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isConverting && (
              <p className="text-xs text-[#787774] mt-3">กำลังประมวลผลไฟล์ MP3...</p>
            )}

            {uploadSuccess && (
              <p className="text-xs text-[#2b784c] mt-3">บันทึกเสียงเข้าสู่โฟลเดอร์เรียบร้อยแล้ว</p>
            )}
          </div>
        </div>

        {/* Folder Content: Audio Files List in this Folder */}
        <div className="pt-6 border-t border-[#e9e9e7]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#37352f] uppercase tracking-wider">
              ไฟล์เสียงในโฟลเดอร์นี้ ({records.length})
            </span>
          </div>

          <div className="border border-[#e9e9e7] rounded-lg divide-y divide-[#e9e9e7] bg-white overflow-hidden">
            {records.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#787774]">
                ยังไม่มีไฟล์เสียงในโฟลเดอร์นี้
              </div>
            ) : (
              records.map((rec) => (
                <div key={rec.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fbfbfa] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileAudio className="w-4 h-4 text-[#787774] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#37352f] text-xs truncate">
                          {rec.speakerName || 'ไม่ระบุชื่อ'}
                        </span>
                        <span className="text-[11px] text-[#787774] font-normal">
                          ({rec.gender === 'female' ? 'หญิง' : 'ชาย'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#9b9a97] mt-0.5">
                        <span className="font-mono text-[#787774]">{rec.durationSeconds} วินาที</span>
                        <span className="text-[#d3d2cf]">|</span>
                        <span>{new Date(rec.recordedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Controls Only (Downloads reserved for Admin) */}
                  <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                    <audio 
                      controls 
                      controlsList="nodownload noplaybackrate"
                      src={rec.fileUrl || ''} 
                      className="h-8 w-full sm:w-64 max-w-full" 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
