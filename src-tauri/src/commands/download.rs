use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use crate::models::video::{VideoInfo, VideoFormat};
use crate::models::task::{DownloadProgress, TaskStatus};

// Global map to track cancellation tokens per task_id
type CancelMap = Arc<Mutex<HashMap<String, bool>>>;

fn get_cancel_map() -> CancelMap {
    use std::sync::OnceLock;
    static CANCEL_MAP: OnceLock<CancelMap> = OnceLock::new();
    CANCEL_MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new()))).clone()
}

#[tauri::command]
pub async fn get_video_info(app: AppHandle, url: String) -> Result<VideoInfo, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args([
            "--dump-json",
            "--no-playlist",
            "--flat-playlist",
            &url,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut json_output = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                json_output.push_str(&String::from_utf8_lossy(&line));
                json_output.push('\n');
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    // Parse yt-dlp JSON output
    parse_ytdlp_json(&json_output, &url)
}

fn parse_ytdlp_json(json_str: &str, url: &str) -> Result<VideoInfo, String> {
    let trimmed = json_str.lines()
        .find(|l| l.trim_start().starts_with('{'))
        .unwrap_or("{}");

    let v: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse yt-dlp output: {}", e))?;

    let formats: Vec<VideoFormat> = v["formats"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|f| {
            let format_id = f["format_id"].as_str()?.to_string();
            let ext = f["ext"].as_str().unwrap_or("").to_string();
            let resolution = f["resolution"].as_str().map(|s| s.to_string());
            let fps = f["fps"].as_f64();
            let vcodec = f["vcodec"].as_str()
                .filter(|&c| c != "none")
                .map(|s| s.to_string());
            let acodec = f["acodec"].as_str()
                .filter(|&c| c != "none")
                .map(|s| s.to_string());
            let filesize = f["filesize"].as_u64()
                .or_else(|| f["filesize_approx"].as_u64());
            let tbr = f["tbr"].as_f64();
            let format_note = f["format_note"].as_str().map(|s| s.to_string());

            Some(VideoFormat {
                format_id,
                ext,
                resolution,
                fps,
                vcodec,
                acodec,
                filesize,
                tbr,
                format_note,
            })
        }).collect())
        .unwrap_or_default();

    Ok(VideoInfo {
        id: v["id"].as_str().unwrap_or("").to_string(),
        title: v["title"].as_str().unwrap_or("Unknown").to_string(),
        description: v["description"].as_str().map(|s| s.to_string()),
        duration: v["duration"].as_f64(),
        thumbnail: v["thumbnail"].as_str().map(|s| s.to_string()),
        uploader: v["uploader"].as_str().map(|s| s.to_string()),
        webpage_url: v["webpage_url"].as_str().unwrap_or(url).to_string(),
        ext: v["ext"].as_str().map(|s| s.to_string()),
        formats,
    })
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    url: String,
    output_dir: String,
    format_id: Option<String>,
    task_id: String,
) -> Result<String, String> {
    // Register task in cancel map
    {
        let cancel_map = get_cancel_map();
        let mut map = cancel_map.lock().map_err(|e| e.to_string())?;
        map.insert(task_id.clone(), false);
    }

    let output_template = format!("{}\\%(title)s.%(ext)s", output_dir);
    let mut args = vec![
        "--newline".to_string(),
        "--progress".to_string(),
        "-o".to_string(), output_template,
        "--no-playlist".to_string(),
    ];

    if let Some(fid) = format_id {
        args.extend_from_slice(&["-f".to_string(), fid]);
    } else {
        args.extend_from_slice(&[
            "-f".to_string(),
            "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best".to_string(),
        ]);
    }

    args.push(url.clone());

    let (mut rx, _child) = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    let re_progress = regex::Regex::new(
        r"\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\w+\s+at\s+([\d.]+\w+/s)\s+ETA\s+(\S+)"
    ).map_err(|e| e.to_string())?;

    let re_dest = regex::Regex::new(r"\[download\] Destination: (.+)").map_err(|e| e.to_string())?;
    let re_merge = regex::Regex::new(r#"\[Merger\] Merging formats into "(.+)""#).map_err(|e| e.to_string())?;
    let re_already = regex::Regex::new(r"\[download\] (.+) has already been downloaded").map_err(|e| e.to_string())?;

    let cancel_map = get_cancel_map();
    let mut output_path = String::new();
    let mut last_err = String::new();

    while let Some(event) = rx.recv().await {
        // Check cancellation
        {
            let map = cancel_map.lock().map_err(|e| e.to_string())?;
            if map.get(&task_id).copied().unwrap_or(false) {
                let _ = app.emit("download_progress", DownloadProgress {
                    task_id: task_id.clone(),
                    progress: 0.0,
                    speed: None,
                    eta: None,
                    status: TaskStatus::Cancelled,
                    output_path: None,
                    error: Some("Cancelled by user".to_string()),
                });
                return Err("Download cancelled".to_string());
            }
        }

        match event {
            CommandEvent::Stdout(line) => {
                let s = String::from_utf8_lossy(&line);
                
                if let Some(caps) = re_progress.captures(&s) {
                    let progress: f64 = caps[1].parse().unwrap_or(0.0);
                    let speed = Some(caps[2].to_string());
                    let eta = Some(caps[3].to_string());
                    
                    let _ = app.emit("download_progress", DownloadProgress {
                        task_id: task_id.clone(),
                        progress,
                        speed,
                        eta,
                        status: TaskStatus::Running,
                        output_path: None,
                        error: None,
                    });
                }

                if let Some(caps) = re_dest.captures(&s) {
                    output_path = caps[1].trim().to_string();
                }
                if let Some(caps) = re_merge.captures(&s) {
                    output_path = caps[1].trim().to_string();
                }
                if let Some(caps) = re_already.captures(&s) {
                    output_path = caps[1].trim().to_string();
                }
            }
            CommandEvent::Stderr(line) => {
                last_err = String::from_utf8_lossy(&line).to_string();
            }
            CommandEvent::Terminated(status) => {
                let code = status.code.unwrap_or(-1);
                if code != 0 {
                    let _ = app.emit("download_progress", DownloadProgress {
                        task_id: task_id.clone(),
                        progress: 0.0,
                        speed: None,
                        eta: None,
                        status: TaskStatus::Failed,
                        output_path: None,
                        error: Some(last_err.clone()),
                    });
                    return Err(format!("Download failed: {}", last_err));
                }
                let _ = app.emit("download_progress", DownloadProgress {
                    task_id: task_id.clone(),
                    progress: 100.0,
                    speed: None,
                    eta: None,
                    status: TaskStatus::Completed,
                    output_path: Some(output_path.clone()),
                    error: None,
                });
                break;
            }
            _ => {}
        }
    }

    // Clean up cancel map
    {
        let mut map = cancel_map.lock().map_err(|e| e.to_string())?;
        map.remove(&task_id);
    }

    Ok(output_path)
}

#[tauri::command]
pub async fn cancel_download(task_id: String) -> Result<(), String> {
    let cancel_map = get_cancel_map();
    let mut map = cancel_map.lock().map_err(|e| e.to_string())?;
    map.insert(task_id, true);
    Ok(())
}

#[tauri::command]
pub async fn get_ytdlp_version(app: AppHandle) -> Result<String, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| e.to_string())?
        .args(["--version"])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut version = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                version = String::from_utf8_lossy(&line).trim().to_string();
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    if version.is_empty() {
        Err("Could not get yt-dlp version".to_string())
    } else {
        Ok(version)
    }
}
