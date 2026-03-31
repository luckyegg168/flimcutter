# FlimCutter - 桌面影片剪輯應用程式

## 目標
建立一個功能完整的繁體中文桌面影片剪輯 APP，支援從 YouTube 等網站下載影片，並提供剪輯、分析、語音辨識、字幕產生等功能。

---

## 技術選型

| 層級 | 技術 | 理由 |
|------|------|------|
| 桌面框架 | **Tauri v2** | 輕量、Rust 後端效能佳、Sidecar 支援外部二進位檔 |
| 前端框架 | **React 18 + TypeScript** | 生態成熟、型別安全 |
| 建置工具 | **Vite** | 快速 HMR、Tauri 官方推薦 |
| UI 元件庫 | **Ant Design 5** | 原生 zh-TW、深色主題、元件豐富 |
| 狀態管理 | **Zustand** | 輕量簡潔、適合中型應用 |
| i18n | **react-i18next** + Ant Design ConfigProvider | JSON 翻譯檔、易維護 |
| 影片播放 | **video.js** | 成熟穩定、支援自訂時間軸 |
| 影片處理 | **FFmpeg** (sidecar binary) | 業界標準、功能最全 |
| 影片下載 | **yt-dlp** (sidecar binary) | YouTube/Bilibili 等 1000+ 網站支援 |
| 語音辨識 | **Qwen3-ASR** via API URL | OpenAI-compatible endpoint、30+ 語言 |
| CSS | **Tailwind CSS** + Ant Design tokens | 快速排版、與 antd 主題整合 |

---

## 專案目錄結構

```
flimcutter/
├── src/                          # React 前端
│   ├── assets/                   # 靜態資源
│   ├── components/               # UI 元件
│   │   ├── Layout/               # 主版面配置
│   │   ├── VideoPlayer/          # 影片播放器
│   │   ├── Timeline/             # 時間軸編輯器
│   │   ├── Download/             # 下載面板
│   │   ├── Editor/               # 剪輯工具面板
│   │   ├── Export/               # 匯出設定
│   │   └── Settings/             # 設定頁面
│   ├── hooks/                    # 自訂 React Hooks
│   ├── stores/                   # Zustand stores
│   │   ├── videoStore.ts         # 影片狀態
│   │   ├── projectStore.ts       # 專案狀態
│   │   ├── downloadStore.ts      # 下載佇列
│   │   └── settingsStore.ts      # 設定（含 ASR API URL）
│   ├── services/                 # 前端服務層（呼叫 Tauri commands）
│   │   ├── ffmpeg.ts             # FFmpeg 操作封裝
│   │   ├── downloader.ts         # 下載操作封裝
│   │   └── asr.ts                # 語音辨識操作封裝
│   ├── i18n/                     # 國際化
│   │   ├── index.ts              # i18next 初始化
│   │   └── locales/
│   │       └── zh-TW.json        # 繁體中文翻譯
│   ├── types/                    # TypeScript 型別定義
│   ├── utils/                    # 工具函式
│   ├── App.tsx                   # 主應用程式
│   └── main.tsx                  # 進入點
├── src-tauri/                    # Rust 後端
│   ├── src/
│   │   ├── main.rs               # Tauri 進入點
│   │   ├── lib.rs                # 模組匯出
│   │   ├── commands/             # Tauri commands
│   │   │   ├── mod.rs
│   │   │   ├── ffmpeg.rs         # FFmpeg 操作指令
│   │   │   ├── download.rs       # yt-dlp 下載指令
│   │   │   ├── asr.rs            # Qwen3-ASR API 呼叫
│   │   │   ├── file.rs           # 檔案系統操作
│   │   │   └── project.rs        # 專案管理
│   │   ├── services/             # 後端服務
│   │   │   ├── mod.rs
│   │   │   ├── ffmpeg_service.rs # FFmpeg 流程管理與進度追蹤
│   │   │   ├── download_service.rs # yt-dlp 流程管理
│   │   │   └── asr_service.rs    # ASR HTTP 客戶端
│   │   └── models/               # 資料模型
│   │       ├── mod.rs
│   │       ├── video.rs          # 影片元資料
│   │       ├── project.rs        # 專案結構
│   │       └── task.rs           # 任務佇列
│   ├── binaries/                 # Sidecar 二進位檔
│   │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   │   └── yt-dlp-x86_64-pc-windows-msvc.exe
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── task_plan.md                  # 本文件
```

---

## 功能清單與優先級

### P0 - 核心（Phase 1-2 必完成）
- [ ] 專案架構與基礎建設
- [ ] FFmpeg / yt-dlp sidecar 整合
- [ ] 影片下載（URL 輸入 → 格式選擇 → 下載）
- [ ] 影片播放器（播放/暫停/拖曳）
- [ ] zh-TW 完整在地化

### P1 - 重要（Phase 3 完成）
- [ ] 影片裁切（設定起止時間）
- [ ] 影片分割（多段切割）
- [ ] 影片合併
- [ ] 音訊提取（MP3/WAV/FLAC）
- [ ] 影片格式轉換
- [ ] 處理進度條
- [ ] 時間軸編輯器

### P2 - 進階（Phase 4 完成）
- [ ] Qwen3-ASR 語音辨識 → 自動字幕
- [ ] 字幕提取（內嵌字幕）
- [ ] 場景偵測（智慧分割點建議）
- [ ] 影片壓縮
- [ ] 影片截圖 / GIF 製作
- [ ] 影片浮水印
- [ ] 影片速度調整
- [ ] 影片旋轉/翻轉
- [ ] 音量調整 / 淡入淡出

### P3 - 附加（Phase 5 完成）
- [ ] 批次下載
- [ ] 批次格式轉換
- [ ] 下載歷史記錄
- [ ] 深色/淺色主題切換
- [ ] 拖放檔案匯入
- [ ] 鍵盤快捷鍵

---

## 階段規劃

### Phase 1: 專案架構與基礎建設 `status: not_started`

**目標**: 建立可執行的 Tauri v2 骨架，FFmpeg/yt-dlp 可呼叫，UI 框架就緒

**步驟**:
1. `npm create tauri-app@latest` 初始化（React + TypeScript + Vite）
2. 安裝前端依賴：antd, zustand, react-i18next, video.js, tailwindcss
3. 設定 Tailwind CSS + Ant Design 主題
4. 設定 i18n（react-i18next + zh-TW.json + Ant Design ConfigProvider zh_TW）
5. 建立主版面 Layout（側邊欄 + 主區域 + 底部狀態列）
6. Rust 端安裝依賴：serde, serde_json, reqwest, tokio, tauri-plugin-shell
7. 下載 FFmpeg / yt-dlp Windows binary 放入 `src-tauri/binaries/`
8. 設定 `tauri.conf.json` 的 `bundle.externalBin`
9. 建立 Rust command 測試 FFmpeg 版本：`ffmpeg -version`
10. 建立 Rust command 測試 yt-dlp 版本：`yt-dlp --version`

**驗收標準**:
- `npm run tauri dev` 可啟動應用程式
- 畫面顯示繁體中文 UI
- Rust 後端可成功呼叫 FFmpeg 和 yt-dlp 並回傳版本號

---

### Phase 2: 影片下載功能 `status: not_started`

**目標**: 可輸入 URL 下載影片，顯示進度

**步驟**:
1. 建立下載頁面 UI（URL 輸入框 + 解析按鈕 + 格式選擇 + 下載按鈕）
2. Rust command: `download::get_video_info` — 呼叫 `yt-dlp -J {url}` 取得影片資訊
3. 前端顯示影片資訊（標題、縮圖、可用格式/畫質）
4. Rust command: `download::start_download` — 呼叫 yt-dlp 下載，解析 stdout 進度
5. 前端下載進度條（百分比、速度、剩餘時間）
6. 下載佇列管理（多個下載任務）
7. 下載完成通知

**yt-dlp 指令參考**:
```
yt-dlp -J {url}                              # 取得 JSON 資訊
yt-dlp -f {format_id} -o {output} --newline --progress {url}   # 下載並輸出進度
```

**驗收標準**:
- 貼上 YouTube URL → 顯示影片資訊 → 選格式 → 下載成功
- 進度條正確顯示百分比
- 多個下載可同時進行

---

### Phase 3: 影片播放與剪輯核心 `status: not_started`

**目標**: 內建播放器 + 時間軸 + 基礎剪輯功能

**步驟**:
1. 整合 video.js 播放器元件（支援本機檔案播放）
2. 建立時間軸 UI（Canvas / SVG 繪製，可拖曳起止標記）
3. 影片縮圖列生成（FFmpeg 每 N 秒截一張）
4. Rust command: `ffmpeg::trim` — 裁切影片
5. Rust command: `ffmpeg::split` — 分割影片
6. Rust command: `ffmpeg::merge` — 合併影片（concat demuxer）
7. Rust command: `ffmpeg::extract_audio` — 音訊提取
8. Rust command: `ffmpeg::convert` — 格式轉換
9. 所有 FFmpeg 操作支援 `-progress pipe:1` 進度追蹤
10. 匯出設定面板（格式、品質、解析度）

**FFmpeg 進度追蹤**:
- Rust 端 spawn FFmpeg process，讀取 stdout
- 解析 `time=HH:MM:SS.ms`，除以總時長得百分比
- 透過 Tauri event 即時推送進度到前端

**驗收標準**:
- 可播放本機影片
- 時間軸可標記起止點，裁切輸出正確
- 進度條即時顯示

---

### Phase 4: 進階編輯與 ASR `status: not_started`

**目標**: 完成所有進階編輯功能 + Qwen3-ASR 語音辨識

**步驟**:

**ASR 整合**:
1. 設定頁面：ASR API URL 輸入框 + 模型選擇 + 連線測試按鈕
2. Rust service: `asr_service.rs` — reqwest multipart POST 到 `{api_url}/v1/audio/transcriptions`
3. 流程：影片 → FFmpeg 提取 WAV (16kHz mono) → 上傳 ASR API → 回傳文字
4. 前端：語音辨識結果顯示 + 匯出為 SRT/VTT 字幕檔

**ASR API 呼叫格式** (Rust reqwest):
```rust
let form = reqwest::multipart::Form::new()
    .file("file", audio_path).await?
    .text("model", model_name);
let resp = client.post(format!("{}/v1/audio/transcriptions", api_url))
    .multipart(form)
    .send().await?;
```

**編輯功能**:
5. 字幕提取（FFmpeg -map 0:s:0）
6. 場景偵測（FFmpeg select scene filter → 回傳時間點列表）
7. 影片壓縮面板（CRF / preset / 解析度選擇）
8. 截圖功能（指定時間點擷取畫面）
9. GIF 製作（設定起止時間 + fps + 寬度）
10. 浮水印（選擇圖片 + 位置 + 透明度）
11. 速度調整（0.25x ~ 4x，setpts + atempo）
12. 旋轉/翻轉（transpose / hflip / vflip）
13. 音量調整 / 淡入淡出（afade filter）

**驗收標準**:
- ASR API URL 填入後可成功辨識語音並產生字幕
- 所有編輯功能可正確輸出結果
- 場景偵測可列出分割點

---

### Phase 5: 批次處理與體驗優化 `status: not_started`

**目標**: 批次操作、主題切換、拖放支援、鍵盤快捷鍵

**步驟**:
1. 批次下載（多 URL 輸入、佇列管理）
2. 批次格式轉換（選擇多個檔案 → 統一轉換設定）
3. 下載/處理歷史記錄（本機 JSON 儲存）
4. 深色/淺色主題（Ant Design theme token 切換）
5. 拖放檔案匯入（Tauri drag-drop event）
6. 鍵盤快捷鍵（Space=播放暫停, J/K/L=快退/暫停/快進 等）
7. 效能最佳化（大檔案處理、記憶體管理）

**驗收標準**:
- 批次操作流暢
- 主題切換即時生效
- 拖放檔案可直接開啟編輯

---

## 關鍵技術決策

### 1. FFmpeg copy 模式 vs 重編碼
- **快速裁切**（不精確）：`-c:v copy -c:a copy`，毫秒完成但起止點對齊 keyframe
- **精確裁切**（較慢）：省略 copy，重新編碼，起止點精確到影格
- **UI 設計**：提供「快速模式」和「精確模式」切換

### 2. 進度追蹤架構
```
FFmpeg process → stdout (-progress pipe:1)
    → Rust 解析 time= 欄位
    → 計算百分比 (current_time / total_duration)
    → Tauri event emit 到前端
    → React 更新 Progress 元件
```

### 3. ASR 工作流程
```
影片檔 → FFmpeg 提取音訊 (WAV 16kHz mono)
    → Rust reqwest multipart POST → Qwen3-ASR API
    → 回傳辨識文字
    → 前端顯示/編輯
    → 匯出 SRT/VTT 字幕
```

### 4. Sidecar Binary 管理
- 首次啟動檢查 FFmpeg/yt-dlp 是否存在
- 顯示版本資訊於設定頁面
- 未來可支援使用者自行指定 binary 路徑

---

## 風險與對策

| 風險 | 影響 | 對策 |
|------|------|------|
| FFmpeg binary 體積大（~100MB） | 安裝包過大 | 使用精簡版 FFmpeg build |
| yt-dlp 網站支援失效 | 無法下載 | 支援使用者自行更新 yt-dlp binary |
| ASR API 不可用 | 語音辨識功能失效 | 優雅降級，顯示連線錯誤提示 |
| 大檔案處理記憶體不足 | APP 崩潰 | FFmpeg streaming 處理，避免載入整個檔案 |
| 跨平台 binary 相容性 | 特定平台無法執行 | 先專注 Windows，後續擴展 |

---

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
