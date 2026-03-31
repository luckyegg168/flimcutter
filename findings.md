# FlimCutter - 研究發現

## 技術選型決策

### 桌面框架：Tauri v2
- Rust 後端，效能佳，安裝包小
- Sidecar 模式可捆綁 FFmpeg / yt-dlp 二進位檔
- 前端使用 Web 技術，開發效率高

### 前端：React + TypeScript + Vite
- 生態系成熟，元件豐富
- TypeScript 提供型別安全

### UI 元件庫：Ant Design 5
- 原生 zh-TW i18n 支援完善
- 元件豐富（Table、Modal、Slider、Progress、Upload 等）
- 深色/淺色主題切換內建支援
- 適合複雜桌面應用

### 狀態管理：Zustand
- 輕量、簡單、效能好
- 適合中型應用

### 影片播放器：video.js
- 最成熟的 Web 影片播放器
- 支援自訂控制列、時間軸互動
- 廣泛的編解碼器支援

### i18n：react-i18next
- 搭配 Ant Design 的 ConfigProvider locale
- JSON 翻譯檔，易於維護

---

## Qwen3 ASR 整合方案

### 選定方式：透過 API URL 呼叫（vLLM OpenAI-compatible）
- 使用者在設定頁面填入 API URL（例如 `http://localhost:8000/v1`）
- 透過 OpenAI SDK 格式呼叫 `POST /v1/audio/transcriptions`
- Rust 後端使用 `reqwest` multipart/form-data 上傳音訊
- 支援 30 種語言 + 22 種中文方言
- 模型：`Qwen/Qwen3-ASR-0.6B` 或 `Qwen/Qwen3-ASR-1.7B`

### 功能延伸
- 語音轉文字 → 自動產生字幕（SRT/VTT）
- 多語言辨識 → 自動偵測語言
- 音訊需先由 FFmpeg 提取為 WAV 16kHz mono 再送 API

---

## Tauri v2 Sidecar 模式

### 目錄結構
```
src-tauri/
├── binaries/
│   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   └── yt-dlp-x86_64-pc-windows-msvc.exe
```

### 重點
- `tauri.conf.json` 的 `bundle.externalBin` 設定 sidecar
- 命名規則：`{name}-{target_triple}[.exe]`
- 用 `Command::sidecar()` 呼叫
- 透過 stdout 解析 `-progress pipe:1` 取得進度

---

## FFmpeg 指令參考

### 裁切
```
ffmpeg -i input -ss START -to END -c:v copy -c:a copy output
```

### 合併（concat demuxer，同編碼最快）
```
ffmpeg -f concat -safe 0 -i list.txt -c:v copy -c:a copy output
```

### 分割
```
ffmpeg -i input -f segment -segment_time 60 -c:v copy -c:a copy out_%03d.mp4
```

### 音訊提取
```
ffmpeg -i input -vn -acodec pcm_s16le -ar 44100 out.wav      # WAV
ffmpeg -i input -vn -c:a libmp3lame -b:a 320k out.mp3         # MP3
ffmpeg -i input -vn -c:a flac out.flac                         # FLAC
```

### 格式轉換
```
ffmpeg -i input -c:v libx264 -crf 23 -c:a aac -b:a 128k out.mp4    # H.264
ffmpeg -i input -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus out.webm # VP9
```

### 壓縮（CRF 值越低品質越高）
```
ffmpeg -i input -c:v libx264 -crf 28 -preset medium out.mp4
```
- CRF: 18=近無損, 23=預設, 28=中等, 35=低品質
- preset: ultrafast / fast / medium / slow / veryslow

### 浮水印
```
ffmpeg -i input -i watermark.png -filter_complex "overlay=W-w-10:H-h-10" out.mp4
```

### 速度調整
```
ffmpeg -i input -filter:v "setpts=0.5*PTS" -filter:a "atempo=2.0" out.mp4  # 2x
ffmpeg -i input -filter:v "setpts=2.0*PTS" -filter:a "atempo=0.5" out.mp4  # 0.5x
```

### 旋轉/翻轉
```
ffmpeg -i input -filter:v "transpose=1" out.mp4    # 順時針90°
ffmpeg -i input -filter:v "hflip" out.mp4           # 水平翻轉
ffmpeg -i input -filter:v "vflip" out.mp4           # 垂直翻轉
```

### 淡入淡出
```
ffmpeg -i input -filter:v "fade=t=in:st=0:d=2,fade=t=out:st=58:d=2" out.mp4
ffmpeg -i input -filter:a "afade=t=in:st=0:d=2,afade=t=out:st=58:d=2" out.mp4
```

### 場景偵測
```
ffmpeg -i input -filter:v "select='gt(scene,0.4)',showinfo" -f null - 2>&1 | grep showinfo
```
- threshold: 0.3=敏感, 0.4=正常, 0.7=嚴格

### 截圖 / GIF
```
ffmpeg -i input -ss 5 -vframes 1 screenshot.jpg
ffmpeg -i input -vf "fps=10,scale=640:-1:flags=lanczos" -loop 0 out.gif
```

### 字幕提取
```
ffmpeg -i input -map 0:s:0 out.srt
ffmpeg -i input -map 0:s:0 out.ass
ffmpeg -i input -map 0:s:0 out.vtt
```

### 進度追蹤
```
ffmpeg -i input -progress pipe:1 ... output
```
- 輸出 key=value：`frame`, `fps`, `time`, `speed`, `progress=continue|end`
- 進度百分比 = current_time / total_duration * 100

---

## 注意事項
- vLLM ASR 服務需使用者自行部署或提供遠端 URL
- 音訊送 ASR 前需 FFmpeg 轉換為 WAV 16kHz mono
- FFmpeg copy 模式（不重編碼）速度最快，但裁切點可能不精確（需對齊 keyframe）
- 精確裁切需重編碼：移除 `-c:v copy`，改用 `-c:v libx264`
- yt-dlp 更新頻繁，建議支援使用者自行更新 binary
