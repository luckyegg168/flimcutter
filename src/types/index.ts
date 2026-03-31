// Video metadata types
export interface VideoInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration: number;        // seconds
  uploader?: string;
  uploadDate?: string;
  viewCount?: number;
  description?: string;
  formats: VideoFormat[];
  webpageUrl: string;
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  quality?: string;
  resolution?: string;
  fps?: number;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  formatNote?: string;
  tbr?: number;
  abr?: number;
  vbr?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface VideoFile {
  path: string;
  name: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  bitrate?: number;
}

// Download types
export type DownloadStatus = 'pending' | 'analyzing' | 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface DownloadTask {
  id: string;
  url: string;
  videoInfo?: VideoInfo;
  selectedFormat?: VideoFormat;
  outputDir: string;
  outputPath?: string;
  status: DownloadStatus;
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
  createdAt: Date;
}

// Project types
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  videoFiles: VideoFile[];
  clips: Clip[];
  outputSettings: OutputSettings;
}

export interface Clip {
  id: string;
  videoPath: string;
  startTime: number;
  endTime: number;
  label?: string;
}

export interface OutputSettings {
  format: VideoOutputFormat;
  codec: VideoCodec;
  crf: number;
  audioCodec: AudioCodec;
  audioBitrate: string;
  resolution?: string;
}

export type VideoOutputFormat = 'mp4' | 'mkv' | 'webm' | 'mov' | 'avi';
export type VideoCodec = 'copy' | 'libx264' | 'libx265' | 'libvpx-vp9' | 'libaom-av1';
export type AudioCodec = 'copy' | 'aac' | 'libmp3lame' | 'libopus' | 'flac';

// FFmpeg operation types
export type FFmpegOperationType =
  | 'trim'
  | 'split'
  | 'merge'
  | 'extract_audio'
  | 'convert'
  | 'compress'
  | 'screenshot'
  | 'gif'
  | 'watermark'
  | 'speed'
  | 'rotate'
  | 'volume'
  | 'scene_detect'
  | 'extract_subtitle';

export type OperationStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface FFmpegOperation {
  id: string;
  type: FFmpegOperationType;
  inputPath: string;
  outputPath?: string;
  status: OperationStatus;
  progress: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ASR types
export interface AsrResult {
  text: string;
  segments?: AsrSegment[];
  language?: string;
}

export interface AsrSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

// Settings types
export interface Settings {
  defaultOutputDir: string;
  theme: 'dark' | 'light' | 'system';
  language: string;
  asrApiUrl: string;
  asrModel: string;
  ffmpegPath: string;
  ytdlpPath: string;
}
