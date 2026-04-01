import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VideoFile } from '../types';

export interface WatermarkOptions {
  inputPath: string;
  outputPath: string;
  watermarkPath: string;
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';
  opacity: number;
}

type ProgressCallback = (progress: number) => void;

async function runFfmpegOperation(
  command: string,
  args: Record<string, unknown>,
  onProgress?: ProgressCallback
): Promise<string> {
  const taskId = `${command}_${Date.now()}`;

  let unlisten: (() => void) | null = null;
  if (onProgress) {
    unlisten = await listen<{ taskId: string; progress: number }>(
      'ffmpeg_progress',
      (event) => {
        if (event.payload.taskId === taskId) {
          onProgress(event.payload.progress);
        }
      }
    );
  }

  try {
    return await invoke<string>(command, { ...args, taskId });
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
  return runFfmpegOperation('trim_video', {
    input: inputPath,
    output: outputPath,
    start: startTime,
    end: endTime,
  }, onProgress);
}

export async function splitVideo(
  inputPath: string,
  splitPoints: number[],
  outputDir: string
): Promise<string[]> {
  const taskId = `split_video_${Date.now()}`;
  return invoke<string[]>('split_video', {
    input: inputPath,
    splitPoints,
    outputDir,
    taskId,
  });
}

export async function mergeVideos(
  inputPaths: string[],
  outputPath: string,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('merge_videos', {
    inputs: inputPaths,
    output: outputPath,
  }, onProgress);
}

export async function extractAudio(
  inputPath: string,
  outputPath: string,
  format: string,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('extract_audio', {
    input: inputPath,
    output: outputPath,
    format,
  }, onProgress);
}

export async function convertVideo(
  inputPath: string,
  outputPath: string,
  opts: { videoCodec: string; audioCodec: string; crf: number },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('convert_video', {
    input: inputPath,
    output: outputPath,
    videoCodec: opts.videoCodec,
    audioCodec: opts.audioCodec,
    crf: opts.crf,
  }, onProgress);
}

export async function compressVideo(
  inputPath: string,
  outputPath: string,
  opts: { crf?: number; preset?: string; resolution?: string },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('compress_video', {
    input: inputPath,
    output: outputPath,
    crf: opts.crf ?? 28,
    preset: opts.preset ?? 'medium',
    resolution: opts.resolution ?? null,
  }, onProgress);
}

export async function takeScreenshot(
  inputPath: string,
  outputPath: string,
  time: number
): Promise<string> {
  return invoke<string>('take_screenshot', {
    input: inputPath,
    output: outputPath,
    timestamp: time,
  });
}

export async function makeGif(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  fps: number,
  width: number,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('make_gif', {
    input: inputPath,
    output: outputPath,
    start: startTime,
    end: endTime,
    fps,
    width,
  }, onProgress);
}

export async function adjustSpeed(
  inputPath: string,
  outputPath: string,
  speed: number,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('adjust_speed', {
    input: inputPath,
    output: outputPath,
    speed,
  }, onProgress);
}

export async function rotateVideo(
  inputPath: string,
  outputPath: string,
  rotation: 90 | 180 | 270,
  flip?: 'hflip' | 'vflip',
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('rotate_video', {
    input: inputPath,
    output: outputPath,
    rotation,
    flip: flip ?? null,
  }, onProgress);
}

export async function adjustVolume(
  inputPath: string,
  outputPath: string,
  volume: number,
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('adjust_volume', {
    input: inputPath,
    output: outputPath,
    volume,
  }, onProgress);
}

export async function detectScenes(
  inputPath: string,
  threshold: number
): Promise<number[]> {
  return invoke<number[]>('detect_scenes', {
    input: inputPath,
    threshold,
  });
}

export async function getVideoInfo(inputPath: string): Promise<VideoFile> {
  return invoke<VideoFile>('get_video_metadata', { path: inputPath });
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

export async function watermarkVideo(
  inputPath: string,
  outputPath: string,
  opts: {
    text: string;
    position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';
    fontSize: number;
    color: string;
    opacity: number;
    fontPath?: string;
  },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('watermark_video', {
    input: inputPath,
    output: outputPath,
    text: opts.text,
    position: opts.position,
    fontSize: opts.fontSize,
    color: opts.color,
    opacity: opts.opacity,
    fontPath: opts.fontPath ?? null,
  }, onProgress);
}

export async function imageWatermark(
  inputPath: string,
  outputPath: string,
  opts: {
    image: string;
    position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';
    opacity: number;
    scale: number;
  },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('image_watermark', {
    input: inputPath,
    output: outputPath,
    image: opts.image,
    position: opts.position,
    opacity: opts.opacity,
    scale: opts.scale,
  }, onProgress);
}

export async function previewFrameEffect(
  inputPath: string,
  timestamp: number,
  vfFilter: string,
): Promise<string> {
  return invoke<string>('preview_frame_effect', {
    input: inputPath,
    timestamp,
    vfFilter,
    taskId: `preview_${Date.now()}`,
  });
}

export async function addBorder(
  inputPath: string,
  outputPath: string,
  opts: { top: number; bottom: number; left: number; right: number; color: string },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('add_border', {
    input: inputPath,
    output: outputPath,
    top: opts.top,
    bottom: opts.bottom,
    left: opts.left,
    right: opts.right,
    color: opts.color.replace('#', ''),
  }, onProgress);
}

export async function addImageBorder(
  inputPath: string,
  outputPath: string,
  opts: { frame: string },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('image_border', {
    input: inputPath,
    output: outputPath,
    frame: opts.frame,
  }, onProgress);
}

export async function floatingImage(
  inputPath: string,
  outputPath: string,
  opts: {
    image: string;
    motion: 'bounce_h' | 'bounce_v' | 'diagonal' | 'circular';
    speed: number;
    scale: number;
    opacity: number;
    radius: number;
  },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('floating_image', {
    input: inputPath,
    output: outputPath,
    image: opts.image,
    motion: opts.motion,
    speed: opts.speed,
    scale: opts.scale,
    opacity: opts.opacity,
    radius: opts.radius,
  }, onProgress);
}

export async function mergeWithTransitions(
  inputPaths: string[],
  outputPath: string,
  opts: { transition: string; duration: number },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('merge_with_transitions', {
    inputs: inputPaths,
    output: outputPath,
    transition: opts.transition,
    duration: opts.duration,
  }, onProgress);
}

export async function cropVideo(
  inputPath: string,
  outputPath: string,
  opts: { width: number; height: number; x: number; y: number },
  onProgress?: ProgressCallback
): Promise<string> {
  return runFfmpegOperation('crop_video', {
    input: inputPath,
    output: outputPath,
    width: opts.width,
    height: opts.height,
    x: opts.x,
    y: opts.y,
  }, onProgress);
}
