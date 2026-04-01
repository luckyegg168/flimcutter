use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::{Deserialize, Serialize};

use crate::models::video::VideoMetadata;
use crate::models::task::FfmpegProgress;

#[derive(Debug, Serialize, Deserialize)]
pub struct TrimOptions {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConvertOptions {
    pub video_codec: String,
    pub audio_codec: String,
    pub crf: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompressOptions {
    pub crf: u32,
    pub preset: String,
    pub resolution: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GifOptions {
    pub start: f64,
    pub end: f64,
    pub fps: u32,
    pub width: u32,
}

fn parse_duration_secs(duration_str: &str) -> f64 {
    let parts: Vec<&str> = duration_str.split(':').collect();
    match parts.len() {
        3 => {
            let h: f64 = parts[0].parse().unwrap_or(0.0);
            let m: f64 = parts[1].parse().unwrap_or(0.0);
            let s: f64 = parts[2].parse().unwrap_or(0.0);
            h * 3600.0 + m * 60.0 + s
        }
        2 => {
            let m: f64 = parts[0].parse().unwrap_or(0.0);
            let s: f64 = parts[1].parse().unwrap_or(0.0);
            m * 60.0 + s
        }
        _ => duration_str.parse().unwrap_or(0.0),
    }
}

fn secs_to_ts(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = secs % 60.0;
    format!("{:02}:{:02}:{:06.3}", h, m, s)
}

async fn run_ffprobe(
    app: &AppHandle,
    input: &str,
) -> Result<HashMap<String, String>, String> {
    let args = vec![
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        input,
    ];
    let _ = args; // suppress warning

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", input])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                output.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Stderr(line) => {
                output.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    let mut info = HashMap::new();
    info.insert("raw".to_string(), output);
    Ok(info)
}

async fn get_metadata_internal(app: &AppHandle, input: &str) -> Result<VideoMetadata, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", input])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stderr_output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                stderr_output.push_str(&String::from_utf8_lossy(&line));
                stderr_output.push('\n');
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    parse_ffmpeg_info(&stderr_output, input)
}

fn parse_ffmpeg_info(stderr: &str, path: &str) -> Result<VideoMetadata, String> {
    use std::path::Path;

    let filename = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let mut duration = 0.0f64;
    if let Some(caps) = regex::Regex::new(r"Duration: (\d{2}:\d{2}:\d{2}\.\d+)")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        duration = parse_duration_secs(&caps[1]);
    }

    let mut width = 0u32;
    let mut height = 0u32;
    let mut fps = 0.0f64;
    let mut video_codec = String::new();
    let mut bitrate = 0u64;

    if let Some(caps) = regex::Regex::new(r"Stream #\S+ Video: (\w+)")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        video_codec = caps[1].to_string();
    }

    if let Some(caps) = regex::Regex::new(r"(\d{3,5})x(\d{3,5})")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        width = caps[1].parse().unwrap_or(0);
        height = caps[2].parse().unwrap_or(0);
    }

    if let Some(caps) = regex::Regex::new(r"(\d+(?:\.\d+)?) fps")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        fps = caps[1].parse().unwrap_or(0.0);
    }

    if let Some(caps) = regex::Regex::new(r"bitrate: (\d+) kb/s")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        bitrate = caps[1].parse::<u64>().unwrap_or(0) * 1000;
    }

    let mut audio_codec = String::new();
    if let Some(caps) = regex::Regex::new(r"Stream #\S+ Audio: (\w+)")
        .ok()
        .and_then(|re| re.captures(stderr))
    {
        audio_codec = caps[1].to_string();
    }

    let format = std::path::Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    Ok(VideoMetadata {
        path: path.to_string(),
        name: filename,
        duration,
        width,
        height,
        fps,
        codec: video_codec,
        audio_codec,
        bitrate,
        size: file_size,
        format,
    })
}

fn emit_progress(app: &AppHandle, task_id: &str, progress: f64, current: f64, total: f64) {
    let p = FfmpegProgress {
        task_id: task_id.to_string(),
        progress,
        current_time: current,
        total_time: total,
        speed: None,
        fps: None,
        bitrate: None,
    };
    let _ = app.emit("ffmpeg_progress", p);
}

async fn run_ffmpeg_with_progress(
    app: &AppHandle,
    args: Vec<String>,
    task_id: &str,
    total_duration: f64,
) -> Result<(), String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut last_error = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line);
                if let Some(caps) = regex::Regex::new(r"time=(\d{2}:\d{2}:\d{2}\.\d+)")
                    .ok()
                    .and_then(|re| re.captures(&line_str))
                {
                    let current = parse_duration_secs(&caps[1]);
                    let progress = if total_duration > 0.0 {
                        (current / total_duration * 100.0).min(100.0)
                    } else {
                        0.0
                    };
                    emit_progress(app, task_id, progress, current, total_duration);
                }
                last_error = line_str.to_string();
            }
            CommandEvent::Terminated(status) => {
                if status.code.unwrap_or(-1) != 0 {
                    return Err(format!("FFmpeg error: {}", last_error));
                }
                emit_progress(app, task_id, 100.0, total_duration, total_duration);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_video_metadata(app: AppHandle, path: String) -> Result<VideoMetadata, String> {
    get_metadata_internal(&app, &path).await
}

#[tauri::command]
pub async fn get_ffmpeg_version(app: AppHandle) -> Result<String, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-version"])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let s = String::from_utf8_lossy(&line);
                if output.is_empty() {
                    output = s.lines().next().unwrap_or("").to_string();
                }
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    if output.is_empty() {
        Err("Could not get FFmpeg version".to_string())
    } else {
        Ok(output)
    }
}

#[tauri::command]
pub async fn trim_video(
    app: AppHandle,
    input: String,
    output: String,
    start: f64,
    end: f64,
    task_id: String,
) -> Result<String, String> {
    let duration = end - start;
    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-ss".to_string(), secs_to_ts(start),
        "-t".to_string(), secs_to_ts(duration),
        "-c".to_string(), "copy".to_string(),
        "-progress".to_string(), "pipe:2".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn split_video(
    app: AppHandle,
    input: String,
    split_points: Vec<f64>,
    output_dir: String,
    task_id: String,
) -> Result<Vec<String>, String> {
    use std::path::Path;

    let meta = get_metadata_internal(&app, &input).await?;
    let stem = Path::new(&input)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or("output".to_string());
    let ext = Path::new(&input)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or("mp4".to_string());

    let mut points = split_points.clone();
    points.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let mut segments: Vec<(f64, f64)> = Vec::new();
    let mut prev = 0.0f64;
    for &p in &points {
        if p > prev && p < meta.duration {
            segments.push((prev, p));
            prev = p;
        }
    }
    segments.push((prev, meta.duration));

    let mut outputs = Vec::new();
    for (i, (start, end)) in segments.iter().enumerate() {
        let out_path = format!("{}\\{}_{:03}.{}", output_dir, stem, i + 1, ext);
        let duration = end - start;
        let args = vec![
            "-y".to_string(),
            "-i".to_string(), input.clone(),
            "-ss".to_string(), secs_to_ts(*start),
            "-t".to_string(), secs_to_ts(duration),
            "-c".to_string(), "copy".to_string(),
            out_path.clone(),
        ];
        run_ffmpeg_with_progress(&app, args, &task_id, duration).await?;
        outputs.push(out_path);
    }

    Ok(outputs)
}

#[tauri::command]
pub async fn merge_videos(
    app: AppHandle,
    inputs: Vec<String>,
    output: String,
    task_id: String,
) -> Result<String, String> {
    use std::io::Write;

    let tmp = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
    {
        let mut f = tmp.as_file();
        for p in &inputs {
            let escaped = p.replace('\\', "/").replace('\'', "'\\''");
            writeln!(f, "file '{}'", escaped).map_err(|e| e.to_string())?;
        }
    }

    let total_duration: f64 = {
        let mut total = 0.0;
        for inp in &inputs {
            if let Ok(meta) = get_metadata_internal(&app, inp).await {
                total += meta.duration;
            }
        }
        total
    };

    let list_path = tmp.path().to_string_lossy().to_string();
    let args = vec![
        "-y".to_string(),
        "-f".to_string(), "concat".to_string(),
        "-safe".to_string(), "0".to_string(),
        "-i".to_string(), list_path,
        "-c".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, total_duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn extract_audio(
    app: AppHandle,
    input: String,
    output: String,
    format: String,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-vn".to_string(),
    ];

    match format.as_str() {
        "mp3" => {
            args.extend_from_slice(&["-codec:a".to_string(), "libmp3lame".to_string(), "-q:a".to_string(), "2".to_string()]);
        }
        "aac" | "m4a" => {
            args.extend_from_slice(&["-codec:a".to_string(), "aac".to_string(), "-b:a".to_string(), "192k".to_string()]);
        }
        "flac" => {
            args.extend_from_slice(&["-codec:a".to_string(), "flac".to_string()]);
        }
        "wav" => {
            args.extend_from_slice(&["-codec:a".to_string(), "pcm_s16le".to_string()]);
        }
        "ogg" => {
            args.extend_from_slice(&["-codec:a".to_string(), "libvorbis".to_string(), "-q:a".to_string(), "5".to_string()]);
        }
        _ => {
            args.extend_from_slice(&["-codec:a".to_string(), "copy".to_string()]);
        }
    }

    args.push(output.clone());
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn convert_video(
    app: AppHandle,
    input: String,
    output: String,
    video_codec: String,
    audio_codec: String,
    crf: Option<u32>,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
    ];

    if video_codec == "copy" {
        args.extend_from_slice(&["-c:v".to_string(), "copy".to_string()]);
    } else {
        args.extend_from_slice(&["-c:v".to_string(), video_codec.clone()]);
        if let Some(c) = crf {
            args.extend_from_slice(&["-crf".to_string(), c.to_string()]);
        }
        if video_codec.contains("h264") || video_codec == "libx264" {
            args.extend_from_slice(&["-preset".to_string(), "medium".to_string()]);
        }
    }

    if audio_codec == "copy" {
        args.extend_from_slice(&["-c:a".to_string(), "copy".to_string()]);
    } else {
        args.extend_from_slice(&["-c:a".to_string(), audio_codec]);
    }

    args.push(output.clone());
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn compress_video(
    app: AppHandle,
    input: String,
    output: String,
    crf: u32,
    preset: String,
    resolution: Option<String>,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-c:v".to_string(), "libx264".to_string(),
        "-crf".to_string(), crf.to_string(),
        "-preset".to_string(), preset,
        "-c:a".to_string(), "aac".to_string(),
        "-b:a".to_string(), "128k".to_string(),
    ];

    if let Some(res) = resolution {
        if res != "original" {
            let scale = match res.as_str() {
                "1080p" => "scale=-2:1080",
                "720p" => "scale=-2:720",
                "480p" => "scale=-2:480",
                "360p" => "scale=-2:360",
                _ => "",
            };
            if !scale.is_empty() {
                args.extend_from_slice(&["-vf".to_string(), scale.to_string()]);
            }
        }
    }

    args.push(output.clone());
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn take_screenshot(
    app: AppHandle,
    input: String,
    output: String,
    timestamp: f64,
) -> Result<String, String> {
    let args = vec![
        "-y".to_string(),
        "-ss".to_string(), secs_to_ts(timestamp),
        "-i".to_string(), input,
        "-frames:v".to_string(), "1".to_string(),
        "-q:v".to_string(), "2".to_string(),
        output.clone(),
    ];

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut last_err = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                last_err = String::from_utf8_lossy(&line).to_string();
            }
            CommandEvent::Terminated(status) => {
                if status.code.unwrap_or(-1) != 0 {
                    return Err(format!("Screenshot failed: {}", last_err));
                }
                break;
            }
            _ => {}
        }
    }

    Ok(output)
}

#[tauri::command]
pub async fn make_gif(
    app: AppHandle,
    input: String,
    output: String,
    start: f64,
    end: f64,
    fps: u32,
    width: u32,
    task_id: String,
) -> Result<String, String> {
    let duration = end - start;
    let palette_file = format!("{}.palette.png", output);

    let palettegen_args = vec![
        "-y".to_string(),
        "-ss".to_string(), secs_to_ts(start),
        "-t".to_string(), secs_to_ts(duration),
        "-i".to_string(), input.clone(),
        "-vf".to_string(), format!("fps={},scale={}:-1:flags=lanczos,palettegen", fps, width),
        palette_file.clone(),
    ];

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(&palettegen_args)
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(_) = event { break; }
    }

    let encode_args = vec![
        "-y".to_string(),
        "-ss".to_string(), secs_to_ts(start),
        "-t".to_string(), secs_to_ts(duration),
        "-i".to_string(), input,
        "-i".to_string(), palette_file.clone(),
        "-lavfi".to_string(), format!("fps={},scale={}:-1:flags=lanczos[x];[x][1:v]paletteuse", fps, width),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, encode_args, &task_id, duration).await?;

    let _ = std::fs::remove_file(&palette_file);

    Ok(output)
}

#[tauri::command]
pub async fn adjust_speed(
    app: AppHandle,
    input: String,
    output: String,
    speed: f64,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let new_duration = meta.duration / speed;

    let audio_filter = build_atempo_chain(speed);
    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-filter_complex".to_string(),
        format!("[0:v]setpts={:.4}*PTS[v];[0:a]{}[a]", 1.0 / speed, audio_filter),
        "-map".to_string(), "[v]".to_string(),
        "-map".to_string(), "[a]".to_string(),
        "-c:v".to_string(), "libx264".to_string(),
        "-c:a".to_string(), "aac".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, new_duration).await?;
    Ok(output)
}

fn build_atempo_chain(speed: f64) -> String {
    if speed >= 0.5 && speed <= 2.0 {
        format!("atempo={:.4}", speed)
    } else if speed < 0.5 {
        format!("atempo=0.5,atempo={:.4}", speed / 0.5)
    } else {
        let mut chain = String::new();
        let mut remaining = speed;
        let mut first = true;
        while remaining > 2.0 {
            if !first { chain.push(','); }
            chain.push_str("atempo=2.0");
            remaining /= 2.0;
            first = false;
        }
        if remaining > 1.0 {
            if !first { chain.push(','); }
            chain.push_str(&format!("atempo={:.4}", remaining));
        }
        chain
    }
}

#[tauri::command]
pub async fn rotate_video(
    app: AppHandle,
    input: String,
    output: String,
    rotation: u32,
    flip: Option<String>,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;

    let mut vf_parts: Vec<String> = Vec::new();

    match rotation {
        90 => vf_parts.push("transpose=1".to_string()),
        180 => vf_parts.push("transpose=2,transpose=2".to_string()),
        270 => vf_parts.push("transpose=2".to_string()),
        _ => {}
    }

    if let Some(f) = flip {
        match f.as_str() {
            "hflip" => vf_parts.push("hflip".to_string()),
            "vflip" => vf_parts.push("vflip".to_string()),
            _ => {}
        }
    }

    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-c:a".to_string(), "copy".to_string(),
    ];

    if !vf_parts.is_empty() {
        args.extend_from_slice(&["-vf".to_string(), vf_parts.join(",")]);
        args.extend_from_slice(&["-c:v".to_string(), "libx264".to_string()]);
    } else {
        args.extend_from_slice(&["-c:v".to_string(), "copy".to_string()]);
    }

    args.push(output.clone());
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn adjust_volume(
    app: AppHandle,
    input: String,
    output: String,
    volume: f64,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-af".to_string(), format!("volume={:.2}", volume),
        "-c:v".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn detect_scenes(
    app: AppHandle,
    input: String,
    threshold: f64,
) -> Result<Vec<f64>, String> {
    let args = vec![
        "-i".to_string(), input,
        "-filter:v".to_string(), format!("select='gt(scene,{})',showinfo", threshold),
        "-vsync".to_string(), "vfr".to_string(),
        "-f".to_string(), "null".to_string(),
        "-".to_string(),
    ];

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut timestamps: Vec<f64> = Vec::new();
    let re = regex::Regex::new(r"pts_time:([\d.]+)").map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                let s = String::from_utf8_lossy(&line);
                if let Some(caps) = re.captures(&s) {
                    let ts: f64 = caps[1].parse().unwrap_or(0.0);
                    timestamps.push(ts);
                }
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    timestamps.dedup_by(|a, b| (*a - *b).abs() < 0.1);
    Ok(timestamps)
}

#[tauri::command]
pub async fn watermark_video(
    app: AppHandle,
    input: String,
    output: String,
    text: String,
    position: String,
    font_size: u32,
    color: String,
    opacity: f64,
    font_path: Option<String>,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;

    let escaped = text
        .replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'");

    let x_expr = match position.as_str() {
        "topleft" | "bottomleft" => "20".to_string(),
        "topright" | "bottomright" => "(w-text_w-20)".to_string(),
        _ => "(w-text_w)/2".to_string(),
    };
    let y_expr = match position.as_str() {
        "topleft" | "topright" => "20".to_string(),
        "bottomleft" | "bottomright" => "(h-text_h-20)".to_string(),
        _ => "(h-text_h)/2".to_string(),
    };

    let alpha = opacity.clamp(0.0, 1.0);

    let font_file = font_path
        .filter(|p| !p.is_empty() && std::path::Path::new(p).exists())
        .or_else(|| {
            let candidates = [
                "C:/Windows/Fonts/msjh.ttc",
                "C:/Windows/Fonts/msjhbd.ttc",
                "C:/Windows/Fonts/mingliu.ttc",
                "C:/Windows/Fonts/kaiu.ttf",
                "C:/Windows/Fonts/simsun.ttc",
                "C:/Windows/Fonts/msyh.ttc",
            ];
            candidates.iter()
                .find(|p| std::path::Path::new(p).exists())
                .map(|s| s.to_string())
        });

    let fontfile_clause = match font_file {
        Some(ref p) => format!("fontfile='{}':", p.replace('\\', "/").replace(':', "\\:")),
        None => String::new(),
    };

    let drawtext = format!(
        "drawtext={}text='{}':fontsize={}:fontcolor={}@{:.2}:x={}:y={}",
        fontfile_clause, escaped, font_size, color, alpha, x_expr, y_expr
    );

    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-vf".to_string(), drawtext,
        "-codec:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn image_watermark(
    app: AppHandle,
    input: String,
    output: String,
    image: String,
    position: String,
    opacity: f64,
    scale: u32,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let alpha = opacity.clamp(0.0, 1.0);
    let scale_factor = (scale as f64 / 100.0).clamp(0.1, 4.0);

    let overlay_expr = match position.as_str() {
        "topleft"     => "20:20",
        "topright"    => "W-w-20:20",
        "bottomleft"  => "20:H-h-20",
        "bottomright" => "W-w-20:H-h-20",
        _             => "(W-w)/2:(H-h)/2",
    };

    let filter = format!(
        "[1:v]scale=iw*{:.2}:ih*{:.2},format=rgba,colorchannelmixer=aa={:.2}[wm];[0:v][wm]overlay={}",
        scale_factor, scale_factor, alpha, overlay_expr
    );

    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-i".to_string(), image,
        "-filter_complex".to_string(), filter,
        "-codec:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

#[tauri::command]
pub async fn crop_video(
    app: AppHandle,
    input: String,
    output: String,
    width: u32,
    height: u32,
    x: u32,
    y: u32,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;

    let vf = format!("crop={}:{}:{}:{}", width, height, x, y);

    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-vf".to_string(), vf,
        "-codec:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

// ─── Feature: Effect Preview ─────────────────────────────────────────────────

#[tauri::command]
pub async fn preview_frame_effect(
    app: AppHandle,
    input: String,
    timestamp: f64,
    vf_filter: String,
    task_id: String,
) -> Result<String, String> {
    let _ = task_id;

    let tmp = tempfile::Builder::new()
        .suffix(".png")
        .tempfile()
        .map_err(|e| e.to_string())?;
    let tmp_path = tmp.path().to_string_lossy().to_string();

    let mut args = vec![
        "-y".to_string(),
        "-ss".to_string(), secs_to_ts(timestamp),
        "-i".to_string(), input,
    ];

    if !vf_filter.is_empty() {
        args.extend_from_slice(&["-vf".to_string(), vf_filter]);
    }

    args.extend_from_slice(&[
        "-vframes".to_string(), "1".to_string(),
        "-q:v".to_string(), "2".to_string(),
        tmp_path.clone(),
    ]);

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut last_err = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                last_err = String::from_utf8_lossy(&line).to_string();
            }
            CommandEvent::Terminated(status) => {
                if status.code.unwrap_or(-1) != 0 {
                    return Err(format!("預覽失敗: {}", last_err));
                }
                break;
            }
            _ => {}
        }
    }

    let png_bytes = std::fs::read(&tmp_path)
        .map_err(|e| format!("讀取預覽圖片失敗: {}", e))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}

// ─── Feature: Add Border ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn add_border(
    app: AppHandle,
    input: String,
    output: String,
    top: u32,
    bottom: u32,
    left: u32,
    right: u32,
    color: String,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let vf = format!(
        "pad=iw+{}:ih+{}:{}:{}:0x{}",
        left + right, top + bottom, left, top, color
    );
    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-vf".to_string(), vf,
        "-c:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

// ─── Feature: Image Border (frame overlay) ───────────────────────────────────

#[tauri::command]
pub async fn image_border(
    app: AppHandle,
    input: String,
    output: String,
    frame: String,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let w = meta.width;
    let h = meta.height;
    // Scale frame PNG to video dimensions, then overlay on video.
    // The frame PNG should have a transparent center so the video shows through.
    let filter = format!(
        "[1:v]scale={w}:{h},format=rgba[frame];[0:v][frame]overlay=0:0[out]"
    );
    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-i".to_string(), frame,
        "-filter_complex".to_string(), filter,
        "-map".to_string(), "[out]".to_string(),
        "-map".to_string(), "0:a?".to_string(),
        "-c:v".to_string(), "libx264".to_string(),
        "-c:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

// ─── Feature: Floating Image ─────────────────────────────────────────────────

#[tauri::command]
pub async fn floating_image(
    app: AppHandle,
    input: String,
    output: String,
    image: String,
    motion: String,
    speed: f64,
    scale: u32,
    opacity: f64,
    radius: u32,
    task_id: String,
) -> Result<String, String> {
    let meta = get_metadata_internal(&app, &input).await?;
    let alpha = opacity.clamp(0.0, 1.0);
    let scale_factor = (scale as f64 / 100.0).clamp(0.05, 1.0);
    let spd = speed.max(0.1);

    let (x_expr, y_expr) = match motion.as_str() {
        "bounce_h" => (
            format!("if(lt(mod(t*{spd:.2},2*(W-w)),W-w),mod(t*{spd:.2},W-w),2*(W-w)-mod(t*{spd:.2},W-w))"),
            "(H-h)/2".to_string(),
        ),
        "bounce_v" => (
            "(W-w)/2".to_string(),
            format!("if(lt(mod(t*{spd:.2},2*(H-h)),H-h),mod(t*{spd:.2},H-h),2*(H-h)-mod(t*{spd:.2},H-h))"),
        ),
        "diagonal" => (
            format!("if(lt(mod(t*{spd:.2},2*(W-w)),W-w),mod(t*{spd:.2},W-w),2*(W-w)-mod(t*{spd:.2},W-w))"),
            format!("if(lt(mod(t*{spd:.2},2*(H-h)),H-h),mod(t*{spd:.2},H-h),2*(H-h)-mod(t*{spd:.2},H-h))"),
        ),
        _ => {
            let r = radius as f64;
            (
                format!("(W-w)/2+{r:.0}*cos(t*{spd:.2})"),
                format!("(H-h)/2+{r:.0}*sin(t*{spd:.2})"),
            )
        }
    };

    let filter = format!(
        "[1:v]scale=iw*{sf:.3}:ih*{sf:.3},format=rgba,colorchannelmixer=aa={alpha:.2}[logo];[0:v][logo]overlay=x='{x}':y='{y}'[out]",
        sf = scale_factor,
        alpha = alpha,
        x = x_expr,
        y = y_expr,
    );

    let args = vec![
        "-y".to_string(),
        "-i".to_string(), input,
        "-i".to_string(), image,
        "-filter_complex".to_string(), filter,
        "-map".to_string(), "[out]".to_string(),
        "-map".to_string(), "0:a?".to_string(),
        "-c:v".to_string(), "libx264".to_string(),
        "-c:a".to_string(), "copy".to_string(),
        output.clone(),
    ];
    run_ffmpeg_with_progress(&app, args, &task_id, meta.duration).await?;
    Ok(output)
}

// ─── Feature: Merge with Transitions ─────────────────────────────────────────

#[tauri::command]
pub async fn merge_with_transitions(
    app: AppHandle,
    inputs: Vec<String>,
    output: String,
    transition: String,
    duration: f64,
    task_id: String,
) -> Result<String, String> {
    if inputs.len() < 2 {
        return Err("至少需要兩個影片".to_string());
    }

    let mut clip_durations: Vec<f64> = Vec::new();
    for inp in &inputs {
        let meta = get_metadata_internal(&app, inp).await?;
        clip_durations.push(meta.duration);
    }

    let total_duration: f64 = clip_durations.iter().sum();
    let n = inputs.len();

    let mut filter_parts: Vec<String> = Vec::new();
    let mut offset_acc = 0.0f64;
    let mut last_v = String::new();
    let mut last_a = String::new();

    for i in 0..(n - 1) {
        let prev_v = if i == 0 { "0:v".to_string() } else { format!("fv{}", i - 1) };
        let prev_a = if i == 0 { "0:a".to_string() } else { format!("fa{}", i - 1) };

        offset_acc += clip_durations[i] - duration;
        if offset_acc < 0.0 { offset_acc = 0.0; }

        let out_v = format!("fv{}", i);
        let out_a = format!("fa{}", i);

        filter_parts.push(format!(
            "[{}][{}:v]xfade=transition={}:duration={:.3}:offset={:.3}[{}]",
            prev_v, i + 1, transition, duration, offset_acc, out_v
        ));
        filter_parts.push(format!(
            "[{}][{}:a]acrossfade=d={:.3}[{}]",
            prev_a, i + 1, duration, out_a
        ));

        last_v = out_v;
        last_a = out_a;
    }

    let mut args = vec!["-y".to_string()];
    for inp in &inputs {
        args.extend_from_slice(&["-i".to_string(), inp.clone()]);
    }
    args.extend_from_slice(&[
        "-filter_complex".to_string(), filter_parts.join(";"),
        "-map".to_string(), format!("[{}]", last_v),
        "-map".to_string(), format!("[{}]", last_a),
        "-c:v".to_string(), "libx264".to_string(),
        "-c:a".to_string(), "aac".to_string(),
        output.clone(),
    ]);

    run_ffmpeg_with_progress(&app, args, &task_id, total_duration).await?;
    Ok(output)
}
