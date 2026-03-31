import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VideoInfo, VideoFormat } from '../types';

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  return await invoke<VideoInfo>('get_video_info', { url });
}

export async function startDownload(
  taskId: string,
  url: string,
  formatId: string,
  outputDir: string,
  onProgress: (progress: number, speed: string, eta: string) => void,
  onComplete: (outputPath: string) => void,
  onError: (error: string) => void
): Promise<() => void> {
  // Listen for progress events
  const unlisten = await listen<{
    task_id: string;
    progress: number;
    speed: string;
    eta: string;
    output_path?: string;
    error?: string;
    completed: boolean;
  }>('download_progress', (event) => {
    if (event.payload.task_id !== taskId) return;
    const { progress, speed, eta, completed, error, output_path } = event.payload;
    if (error) {
      onError(error);
    } else if (completed && output_path) {
      onComplete(output_path);
    } else {
      onProgress(progress, speed, eta);
    }
  });

  // Start download
  await invoke('start_download', {
    taskId,
    url,
    formatId,
    outputDir,
  });

  return unlisten;
}

export async function cancelDownload(taskId: string): Promise<void> {
  await invoke('cancel_download', { taskId });
}

export function getFormatDescription(format: VideoFormat): string {
  const parts: string[] = [];
  if (format.resolution) parts.push(format.resolution);
  if (format.fps) parts.push(`${format.fps}fps`);
  if (format.vcodec && format.vcodec !== 'none') parts.push(format.vcodec);
  if (format.filesize) {
    const mb = format.filesize / 1024 / 1024;
    parts.push(`~${mb.toFixed(1)}MB`);
  }
  return parts.join(' · ');
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
