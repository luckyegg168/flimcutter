import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VideoFile } from '../types';

export interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  fastMode: boolean;
}

export interface SplitOptions {
  inputPath: string;
  outputDir: string;
  splitPoints: number[];
}

export interface MergeOptions {
  inputPaths: string[];
  outputPath: string;
}

export interface ExtractAudioOptions {
  inputPath: string;
  outputPath: string;
  format: 'mp3' | 'wav' | 'flac' | 'aac';
  bitrate?: string;
}

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  videoCodec: string;
  audioCodec: string;
  crf: number;
  preset?: string;
  resolution?: string;
}

export interface CompressOptions {
  inputPath: string;
  outputPath: string;
  targetSizeMb: number;
}

export interface GifOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  fps: number;
  width: number;
}

export interface WatermarkOptions {
  inputPath: string;
  outputPath: string;
  watermarkPath: string;
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';
  opacity: number;
}

export interface SpeedOptions {
  inputPath: string;
  outputPath: string;
  speed: number;
}

export interface RotateOptions {
  inputPath: string;
  outputPath: string;
  rotation: 'cw90' | '180' | 'ccw90' | 'hflip' | 'vflip';
}

export interface VolumeOptions {
  inputPath: string;
  outputPath: string;
  volume: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

type ProgressCallback = (progress: number) => void;

async function runFfmpegOperation(
  command: string,
  args: Record<string, unknown>,
  onProgress?: ProgressCallback
): Promise<string> {
  const operationId = `${command}_${Date.now()}`;

  let unlisten: (() => void) | null = null;
  if (onProgress) {
    unlisten = await listen<{ operation_id: string; progress: number }>(
      'ffmpeg_progress',
      (event) => {
        if (event.payload.operation_id === operationId) {
          onProgress(event.payload.progress);
        }
      }
    );
  }

  try {
    const outputPath = await invoke<string>(command, { ...args, operationId });
    return outputPath;
  } finally {
    unlisten?.();
  }
}

export async function trimVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('trim_video', { inputPath, outputPath, startTime, endTime, fastMode: false } as Record<string, unknown>, onProgress);
}

export async function splitVideo(
  inputPath: string,
  splitPoints: number[],
  outputDir: string
): Promise<string[]> {
  return invoke<string[]>('split_video', { inputPath, outputDir, splitPoints } as Record<string, unknown>);
}

export async function mergeVideos(
  inputPaths: string[],
  outputPath: string,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('merge_videos', { inputPaths, outputPath } as Record<string, unknown>, onProgress);
}

export async function extractAudio(
  inputPath: string,
  outputPath: string,
  format: string,
  bitrate?: string
): Promise<string> {
  return runFfmpegOperation('extract_audio', { inputPath, outputPath, format, bitrate } as Record<string, unknown>, undefined);
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  opts: { videoCodec: string; audioCodec: string; crf: number; preset?: string; resolution?: string }
): Promise<string> {
  return runFfmpegOperation('convert_video', { inputPath, outputPath, ...opts } as Record<string, unknown>, undefined);
}

export async function compressVideo(
  inputPath: string,
  outputPath: string,
  opts: { crf?: number; preset?: string; resolution?: string }
): Promise<string> {
  return runFfmpegOperation('compress_video', { inputPath, outputPath, ...opts } as Record<string, unknown>, undefined);
}

export async function takeScreenshot(
  inputPath: string,
  outputPath: string,
  time: number
): Promise<string> {
  return invoke<string>('take_screenshot', { inputPath, outputPath, time });
}

export async function makeGif(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  fps: number,
  width: number
): Promise<string> {
  return runFfmpegOperation('make_gif', { inputPath, outputPath, startTime, endTime, fps, width } as Record<string, unknown>, undefined);
}

export async function addWatermark(
  opts: WatermarkOptions,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('add_watermark', opts as unknown as Record<string, unknown>, onProgress);
}

export async function adjustSpeed(
  inputPath: string,
  outputPath: string,
  speed: number
): Promise<string> {
  return runFfmpegOperation('adjust_speed', { inputPath, outputPath, speed } as Record<string, unknown>, undefined);
}

export async function rotateVideo(
  inputPath: string,
  outputPath: string,
  rotation: 90 | 180 | 270,
  flip?: 'hflip' | 'vflip'
): Promise<string> {
  const rotMap: Record<number, string> = { 90: 'cw90', 180: '180', 270: 'ccw90' };
  const rotStr = flip ?? rotMap[rotation];
  return runFfmpegOperation('rotate_video', { inputPath, outputPath, rotation: rotStr } as Record<string, unknown>, undefined);
}

export async function adjustVolume(
  inputPath: string,
  outputPath: string,
  volume: number
): Promise<string> {
  return runFfmpegOperation('adjust_volume', { inputPath, outputPath, volume } as Record<string, unknown>, undefined);
}

export async function detectScenes(
  inputPath: string,
  threshold: number
): Promise<number[]> {
  return invoke<number[]>('detect_scenes', { inputPath, threshold });
}

export async function extractSubtitles(
  inputPath: string,
  outputPath: string
): Promise<string> {
  return invoke<string>('extract_subtitles', { inputPath, outputPath });
}

export async function getVideoInfo(inputPath: string): Promise<VideoFile> {
  return invoke<VideoFile>('get_video_metadata', { inputPath });
}

export async function getFfmpegVersion(): Promise<string> {
  return invoke<string>('get_ffmpeg_version');
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function parseTimeToSeconds(time: string): number {
  const parts = time.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(time);
}
