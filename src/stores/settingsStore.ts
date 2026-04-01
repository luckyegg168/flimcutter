import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Settings } from '../types';

const DEFAULTS: Settings = {
  defaultOutputDir: '',
  theme: 'dark',
  language: 'zh-TW',
  asrApiUrl: 'http://localhost:8000/v1',
  asrModel: 'asr-1.7b',
  ffmpegPath: '',
  ytdlpPath: '',
};

interface SettingsState extends Settings {
  setDefaultOutputDir: (dir: string) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (language: string) => void;
  setAsrApiUrl: (url: string) => void;
  setAsrModel: (model: string) => void;
  setFfmpegPath: (path: string) => void;
  setYtdlpPath: (path: string) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
  ...DEFAULTS,

  setDefaultOutputDir: (dir) => set({ defaultOutputDir: dir }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setAsrApiUrl: (url) => set({ asrApiUrl: url }),
  setAsrModel: (model) => set({ asrModel: model }),
  setFfmpegPath: (path) => set({ ffmpegPath: path }),
  setYtdlpPath: (path) => set({ ytdlpPath: path }),
  updateSettings: (partial) => set((state) => ({ ...state, ...partial })),
  resetSettings: () => set({ ...DEFAULTS }),
}),
    { name: 'flimcutter-settings' }
  )
);
