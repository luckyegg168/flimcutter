import { invoke } from '@tauri-apps/api/core';
import { AsrResult, AsrSegment } from '../types';

export async function transcribeVideo(
  inputPath: string,
  opts: { apiUrl: string; model: string; language?: string; task?: string }
): Promise<AsrResult> {
  return invoke<AsrResult>('transcribe_audio', {
    inputPath,
    apiUrl: opts.apiUrl,
    model: opts.model,
    language: opts.language ?? null,
  });
}

export async function testAsrConnection(apiUrl: string): Promise<boolean> {
  return invoke<boolean>('test_asr_connection', { apiUrl });
}

export function generateSrt(segments: AsrSegment[]): string {
  return segments
    .map((seg, idx) => {
      const start = secondsToSrtTime(seg.start);
      const end = secondsToSrtTime(seg.end);
      return `${idx + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

export function generateVtt(segments: AsrSegment[]): string {
  const lines = ['WEBVTT', ''];
  segments.forEach((seg, idx) => {
    const start = secondsToVttTime(seg.start);
    const end = secondsToVttTime(seg.end);
    lines.push(`${idx + 1}`);
    lines.push(`${start} --> ${end}`);
    lines.push(seg.text.trim());
    lines.push('');
  });
  return lines.join('\n');
}

function secondsToSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function secondsToVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
