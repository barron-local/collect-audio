import { Mp3Encoder } from '@breezystack/lamejs';

export async function audioBufferToMp3(audioBuffer: AudioBuffer): Promise<Blob> {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const mp3encoder = new Mp3Encoder(1, sampleRate, 128); // 1 channel mono 128kbps
  const mp3Data: Uint8Array[] = [];

  // Get raw PCM samples from channel 0
  const channelData = audioBuffer.getChannelData(0);
  
  // If stereo, average channels to mono
  let samples: Float32Array;
  if (channels > 1) {
    const channelData2 = audioBuffer.getChannelData(1);
    samples = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      samples[i] = (channelData[i] + channelData2[i]) / 2;
    }
  } else {
    samples = channelData;
  }

  // Convert Float32Array [-1.0, 1.0] to Int16Array [-32768, 32767]
  const sampleBlockSize = 1152;
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Encode chunks
  for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
    const chunk = int16Samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  return new Blob(mp3Data as any, { type: 'audio/mp3' });
}

export async function convertWebmBlobToMp3(webmBlob: Blob): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await webmBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const mp3Blob = await audioBufferToMp3(audioBuffer);
  await audioContext.close();
  return mp3Blob;
}
