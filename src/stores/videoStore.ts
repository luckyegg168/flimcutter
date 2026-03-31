import { create } from 'zustand';
import { VideoFile, FFmpegOperation, AsrResult } from '../types';

interface VideoState {
  currentFile: VideoFile | null;
  mergeFiles: VideoFile[];
  operations: FFmpegOperation[];
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  isPlaying: boolean;
  asrResult: AsrResult | null;

  setCurrentFile: (file: VideoFile | null) => void;
  setMergeFiles: (files: VideoFile[]) => void;
  addMergeFile: (file: VideoFile) => void;
  removeMergeFile: (path: string) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addOperation: (op: FFmpegOperation) => void;
  updateOperation: (id: string, partial: Partial<FFmpegOperation>) => void;
  clearOperations: () => void;
  setAsrResult: (result: AsrResult | null) => void;
}

let opCounter = 0;

export const useVideoStore = create<VideoState>((set) => ({
  currentFile: null,
  mergeFiles: [],
  operations: [],
  currentTime: 0,
  duration: 0,
  trimStart: 0,
  trimEnd: 0,
  isPlaying: false,
  asrResult: null,

  setCurrentFile: (file) =>
    set({ currentFile: file, currentTime: 0, duration: file?.duration ?? 0,
          trimStart: 0, trimEnd: file?.duration ?? 0 }),
  setMergeFiles: (files) => set({ mergeFiles: files }),
  addMergeFile: (file) =>
    set((state) => ({ mergeFiles: [...state.mergeFiles, file] })),
  removeMergeFile: (path) =>
    set((state) => ({
      mergeFiles: state.mergeFiles.filter((f) => f.path !== path),
    })),

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setTrimStart: (t) => set({ trimStart: t }),
  setTrimEnd: (t) => set({ trimEnd: t }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  addOperation: (op) =>
    set((state) => ({ operations: [...state.operations, op] })),
  updateOperation: (id, partial) =>
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, ...partial } : op
      ),
    })),
  clearOperations: () => set({ operations: [] }),
  setAsrResult: (result) => set({ asrResult: result }),
}));

export function createOperationId() {
  return `op_${Date.now()}_${opCounter++}`;
}
