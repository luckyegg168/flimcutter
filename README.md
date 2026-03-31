# FlimCutter 🎬

桌面影片編輯工具 — Desktop video editor powered by **Tauri v2 + React + TypeScript**.

## Features

- **影片剪輯** Trim, Split, Merge
- **格式轉換** Convert, Compress
- **影片效果** Speed, Rotate, Watermark, Volume, GIF
- **音訊提取** Extract Audio (mp3/aac/ogg)
- **截圖** Screenshot at any timestamp
- **下載器** YouTube / social media downloader via yt-dlp
- **字幕生成** Whisper ASR integration (SRT/VTT output)
- **場景偵測** Scene detection
- i18n: **繁體中文** / English

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri v2 |
| Frontend | React 18 + TypeScript + Vite 6 |
| UI | Ant Design 5 (dark) + Tailwind CSS 3 |
| State | Zustand 5 |
| i18n | react-i18next |
| Video player | video.js 8 |
| Video processing | FFmpeg (sidecar) |
| Downloader | yt-dlp (sidecar) |

## Prerequisites

- Node.js ≥ 18
- Rust stable (x86_64-pc-windows-msvc)
- **Visual Studio 2022** with "Desktop development with C++" workload
  - [Required for Tauri Rust compilation]
- WebView2 (pre-installed on Windows 11)

## Setup

```bash
# Install Node.js deps
npm install

# Download sidecars (first time only)
# Place in src-tauri/binaries/
# - ffmpeg-x86_64-pc-windows-msvc.exe  (from https://github.com/BtbN/FFmpeg-Builds)
# - yt-dlp-x86_64-pc-windows-msvc.exe  (from https://github.com/yt-dlp/yt-dlp)
```

## Development

```bash
# Frontend only (Vite dev server)
npm run dev

# Full Tauri development (opens app window)
npm run tauri dev
```

## Build

```bash
# Frontend build check
npm run build

# Full Tauri app (creates installer in src-tauri/target/release/bundle/)
npm run tauri build
```

## Project Structure

```
src/
├── components/
│   ├── Editor/          # 12 editor panels (Trim, Split, Merge, etc.)
│   ├── Download/        # yt-dlp downloader UI
│   ├── Settings/        # App settings + ASR config
│   ├── VideoPlayer/     # video.js wrapper
│   ├── Timeline/        # Timeline scrubber
│   └── Layout/          # Main app layout
├── services/            # TypeScript service layer (ffmpeg/asr/downloader)
├── stores/              # Zustand stores (video/download/settings)
├── i18n/                # zh-TW / en-US locales
└── types/               # Shared TypeScript types

src-tauri/
├── src/
│   ├── commands/        # Tauri command handlers (ffmpeg/asr/download/file)
│   ├── models/          # Rust data types
│   └── services/        # Rust service layer
└── binaries/            # FFmpeg + yt-dlp sidecars (git-ignored)
```

## License

MIT
