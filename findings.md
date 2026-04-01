# FlimCutter — Bug Findings & Fix Plan

> Generated for Agent review. All bugs below are confirmed from runtime errors or code inspection.
> The codebase is Tauri v2 + React + TypeScript + Rust.

---

## Root Cause Summary

Two systematic issues explain nearly every runtime error:

### 1. Tauri v2 Command Argument Naming Convention (CRITICAL)

Tauri v2 automatically converts **Rust snake_case parameter names → camelCase** for the JS `invoke()` API.

| Rust param | JS invoke key must be |
|---|---|
| `task_id` | `taskId` |
| `split_points` | `splitPoints` |
| `output_dir` | `outputDir` |
| `video_codec` | `videoCodec` |
| `audio_codec` | `audioCodec` |
| `input` | `input` (single word, unchanged) |
| `output` | `output` (single word, unchanged) |

**Current broken state** in `src/services/ffmpeg.ts`:
- `trimVideo` sends `{ inputPath, outputPath, startTime, endTime, task_id }` → Rust expects `{ input, output, start, end, taskId }`
- `splitVideo` sends `{ inputPath, outputDir, splitPoints }` → should be `{ input, outputDir, splitPoints, taskId }`
- `mergeVideos` sends `{ inputPaths, outputPath }` → should be `{ inputs, output, taskId }`
- `extractAudio` sends `{ inputPath, outputPath, format, bitrate }` → should be `{ input, output, format, taskId }` (no bitrate in Rust)
- `convertVideo` sends `{ inputPath, outputPath, videoCodec, audioCodec, crf }` → should be `{ input, output, videoCodec, audioCodec, crf, taskId }`
- `compressVideo` sends `{ inputPath, outputPath, crf, preset, resolution }` → should be `{ input, output, crf, preset, resolution, taskId }`
- `takeScreenshot` sends `{ inputPath, outputPath, time }` → should be `{ input, output, timestamp }`
- `makeGif` sends `{ inputPath, outputPath, startTime, endTime, fps, width }` → should be `{ input, output, start, end, fps, width, taskId }`
- `adjustSpeed` sends `{ inputPath, outputPath, speed }` → should be `{ input, output, speed, taskId }`
- `rotateVideo` sends `{ inputPath, outputPath, rotation: string }` → should be `{ input, output, rotation: number (90|180|270), flip: string|null, taskId }`
- `adjustVolume` sends `{ inputPath, outputPath, volume }` → should be `{ input, output, volume, taskId }`
- `detectScenes` sends `{ inputPath, threshold }` → should be `{ input, threshold }`
- `getVideoInfo` fixed: sends `{ path: inputPath }` ✓

**The `runFfmpegOperation` helper** currently appends `task_id` (snake_case).
**Fix**: append `taskId` (camelCase) to match Tauri v2 convention.

**Progress event listener** currently listens for `task_id` field.
**Fix**: listen for `taskId` field (after adding `rename_all = "camelCase"` to `FfmpegProgress`).

### 2. Rust Model Serialization — Missing `#[serde(rename_all = "camelCase")]`

`VideoMetadata` serializes field names in **snake_case**, but TypeScript `VideoFile` interface uses **camelCase**.

Mismatches:
| Rust field | Serialized as | TS VideoFile expects |
|---|---|---|
| `filename` | `filename` | `name` |
| `file_size` | `file_size` | `size` |
| `video_codec` | `video_codec` | `codec` |

Fix: Add `#[serde(rename_all = "camelCase")]` to `VideoMetadata` AND rename fields to align with TS interface.

`FfmpegProgress` also missing `#[serde(rename_all = "camelCase")]`:
- `task_id` serializes as `"task_id"` but after fix should be `"taskId"`
- `current_time` → `"currentTime"`, `total_time` → `"totalTime"`

---

## Per-File Fix Checklist

### `src/services/ffmpeg.ts` — rewrite invoke calls

```typescript
// runFfmpegOperation helper
const taskId = `${command}_${Date.now()}`;
// listen for taskId (camelCase, after FfmpegProgress gets rename_all)
listen<{ taskId: string; progress: number }>('ffmpeg_progress', (e) => {
  if (e.payload.taskId === taskId) onProgress(e.payload.progress);
});
// invoke with taskId
return await invoke<string>(command, { ...args, taskId });

// trimVideo
invoke('trim_video', { input, output, start, end, taskId })

// splitVideo
invoke('split_video', { input, splitPoints, outputDir, taskId })

// mergeVideos
invoke('merge_videos', { inputs, output, taskId })

// extractAudio  (no bitrate param in Rust)
invoke('extract_audio', { input, output, format, taskId })

// convertVideo
invoke('convert_video', { input, output, videoCodec, audioCodec, crf, taskId })

// compressVideo
invoke('compress_video', { input, output, crf, preset, resolution, taskId })

// takeScreenshot  (no taskId)
invoke('take_screenshot', { input, output, timestamp })

// makeGif
invoke('make_gif', { input, output, start, end, fps, width, taskId })

// adjustSpeed
invoke('adjust_speed', { input, output, speed, taskId })

// rotateVideo — rotation must be number (90|180|270), flip is separate string|null
invoke('rotate_video', { input, output, rotation: rotationNumber, flip: flipString ?? null, taskId })

// adjustVolume
invoke('adjust_volume', { input, output, volume, taskId })

// detectScenes (no taskId)
invoke('detect_scenes', { input, threshold })
```

### `src-tauri/src/models/video.rs`

```rust
// VideoMetadata — add serde rename + align field names with TS VideoFile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub path: String,
    pub name: String,     // renamed from: filename
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,    // renamed from: video_codec
    pub bitrate: u64,
    pub size: u64,        // renamed from: file_size
    pub format: String,
}
```

After renaming fields, update the struct construction in `parse_ffmpeg_info` in `src-tauri/src/commands/ffmpeg.rs`:
```rust
Ok(VideoMetadata {
    path: path.to_string(),
    name: filename,
    duration,
    width,
    height,
    fps,
    codec: video_codec,
    bitrate,
    size: file_size,
    format,
})
```

### `src-tauri/src/models/task.rs`

```rust
// FfmpegProgress — add camelCase so JS event listener gets taskId
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegProgress {
    pub task_id: String,      // → "taskId"
    pub progress: f64,
    pub current_time: f64,    // → "currentTime"
    pub total_time: f64,      // → "totalTime"
    pub speed: Option<String>,
    pub fps: Option<f64>,
    pub bitrate: Option<String>,
}
```

### `src/components/Editor/RotatePanel.tsx`

Verify that the `rotateVideo` call passes `rotation` as a **number** (90, 180, or 270), not a string. The Rust command expects `rotation: u32`.

---

## Other Bugs Already Fixed (do not revert)

| Fix | File | Status |
|---|---|---|
| Sidecar name `"yt-dlp"` / `"ffmpeg"` (not `"binaries/..."`) | `commands/download.rs`, `commands/ffmpeg.rs`, `commands/asr.rs` | ✓ Fixed |
| `plugins.shell.scope/sidecar` removed from tauri.conf.json | `tauri.conf.json` | ✓ Fixed |
| `plugins.dialog` / `plugins.fs` removed from tauri.conf.json | `tauri.conf.json` | ✓ Fixed |
| Dev sidecar binaries copied with triple suffix | `build.rs` | ✓ Fixed |
| `VideoFormat` fields `has_video` / `has_audio` added | `models/video.rs`, `commands/download.rs` | ✓ Fixed |
| `VideoFormat` / `VideoInfo` `#[serde(rename_all = "camelCase")]` | `models/video.rs` | ✓ Fixed |
| `DownloadProgress` — JS listener checks `status` not `completed` | `services/downloader.ts` | ✓ Fixed |
| `getVideoInfo` param renamed `inputPath` → `path` | `services/ffmpeg.ts` | ✓ Fixed |
| Video player replaced video.js with native `<video>` element | `VideoPlayer.tsx` | ✓ Fixed |
| Timeline seek syncs to native video element | `VideoPlayer.tsx` | ✓ Fixed |
| File dialog double-open caused by event bubbling | `EditorPage.tsx` | ✓ Fixed |
| `assetProtocol.enable: true` for local video file access | `tauri.conf.json` | ✓ Fixed |
| `ffmpeg -i input` (not `-f null -`) for fast metadata read | `commands/ffmpeg.rs` | ✓ Fixed |
| TrimPanel — added "設為開始" / "設為結束" buttons | `TrimPanel.tsx` | ✓ Fixed |

---

## Key Tauri v2 Conventions (for Agent reference)

1. **`invoke(cmd, args)` key naming**: JS keys must be camelCase; they map to Rust snake_case params automatically.
   - Rust `task_id: String` → JS `{ taskId: '...' }`
   - Rust `split_points: Vec<f64>` → JS `{ splitPoints: [...] }`

2. **Serde serialization for events**: Structs emitted via `app.emit()` use Rust's default field names (snake_case) unless `#[serde(rename_all = "camelCase")]` is added. JS listeners must match the emitted key names.

3. **`tauri.conf.json` `plugins` section**: In Tauri v2, only `shell: { open: bool }` is valid here. Sidecar scope, dialog config, and fs config belong in capability files or are no longer needed.

4. **`externalBin` and `sidecar()` naming**: In `tauri.conf.json`, `externalBin: ["binaries/yt-dlp"]`. In Rust, `sidecar("yt-dlp")` (just the binary name, not the path). Tauri resolves the binary by appending the target triple: `yt-dlp-x86_64-pc-windows-msvc.exe` next to the executable. In dev mode, a copy with the triple suffix must exist in `target/debug/` — `build.rs` handles this.

5. **Asset protocol**: For `convertFileSrc()` to work (local video playback), `app.security.assetProtocol.enable: true` and `scope: ["**"]` must be set in `tauri.conf.json`.
