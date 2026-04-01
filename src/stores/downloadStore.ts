import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DownloadTask, VideoInfo, VideoFormat } from '../types';

interface DownloadState {
  tasks: DownloadTask[];
  activeTaskId: string | null;
  addTask: (url: string, outputDir: string) => string;
  updateTask: (id: string, partial: Partial<DownloadTask>) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  setActiveTask: (id: string | null) => void;
  setVideoInfo: (id: string, info: VideoInfo) => void;
  setFormat: (id: string, format: VideoFormat) => void;
}

let taskCounter = 0;

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set) => ({
  tasks: [],
  activeTaskId: null,

  addTask: (url, outputDir) => {
    const id = `task_${Date.now()}_${taskCounter++}`;
    const task: DownloadTask = {
      id,
      url,
      outputDir,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    set((state) => ({ tasks: [...state.tasks, task] }));
    return id;
  },

  updateTask: (id, partial) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  clearCompleted: () =>
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'failed'
      ),
    })),

  setActiveTask: (id) => set({ activeTaskId: id }),

  setVideoInfo: (id, info) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, videoInfo: info } : t
      ),
    })),

  setFormat: (id, format) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, selectedFormat: format } : t
      ),
    })),
}),
    {
      name: 'flimcutter-download-history',
      // 只持久化已完成/失敗的任務作為歷史記錄；進行中的任務不需要恢復
      partialize: (state) => ({
        tasks: state.tasks.filter(
          (t) => t.status === 'completed' || t.status === 'failed'
        ),
      }),
    }
  )
);
