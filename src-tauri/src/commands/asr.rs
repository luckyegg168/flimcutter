use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::{Deserialize, Serialize};

use crate::models::task::{TranscriptionResult, TranscriptionSegment};

const CHUNK_SECS: f64 = 600.0; // 10 minutes per chunk

#[derive(Debug, Serialize, Deserialize)]
pub struct AsrOptions {
    pub api_url: String,
    pub model: String,
    pub language: Option<String>,
    pub task: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct AsrProgress {
    chunk: usize,
    total: usize,
    message: String,
}

/// Get media duration in seconds via ffmpeg stderr output.
async fn get_duration(app: &AppHandle, input: &str) -> Result<f64, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", input, "-f", "null", "-"])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut stderr_buf = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                stderr_buf.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    // Parse "Duration: HH:MM:SS.xx"
    for line in stderr_buf.lines() {
        if let Some(pos) = line.find("Duration:") {
            let rest = &line[pos + 9..].trim_start();
            let parts: Vec<&str> = rest.splitn(2, ',').next().unwrap_or("").split(':').collect();
            if parts.len() == 3 {
                let h: f64 = parts[0].trim().parse().unwrap_or(0.0);
                let m: f64 = parts[1].trim().parse().unwrap_or(0.0);
                let s: f64 = parts[2].trim().parse().unwrap_or(0.0);
                return Ok(h * 3600.0 + m * 60.0 + s);
            }
        }
    }
    Err("Could not determine media duration".to_string())
}

/// Extract a chunk of audio [start_sec, start_sec + duration_sec) to a temp WAV.
async fn extract_chunk(
    app: &AppHandle,
    input: &str,
    start_sec: f64,
    duration_sec: f64,
    tmp_path: &str,
) -> Result<(), String> {
    let start_str = format!("{:.3}", start_sec);
    let dur_str = format!("{:.3}", duration_sec);

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-ss", &start_str,
            "-i", input,
            "-t", &dur_str,
            "-vn",
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            tmp_path,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(status) = event {
            if status.code.unwrap_or(-1) != 0 {
                return Err(format!("ffmpeg failed extracting chunk at {:.0}s", start_sec));
            }
            break;
        }
    }
    Ok(())
}

/// Send a WAV file to the ASR API and return the result.
async fn transcribe_chunk(
    client: &reqwest::Client,
    endpoint: &str,
    model: &str,
    language: &Option<String>,
    task: &Option<String>,
    tmp_path: &str,
    time_offset: f64,
) -> Result<(String, Vec<TranscriptionSegment>, Option<String>), String> {
    let audio_bytes = tokio::fs::read(tmp_path)
        .await
        .map_err(|e| format!("Failed to read chunk audio: {}", e))?;

    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let mut form = reqwest::multipart::Form::new()
        .text("model", model.to_string())
        .text("response_format", "json")
        .part("file", part);

    if let Some(lang) = language.as_ref().filter(|l| l.as_str() != "auto") {
        form = form.text("language", lang.clone());
    }
    if let Some(t) = task.as_ref() {
        form = form.text("task", t.clone());
    }

    let resp = client
        .post(endpoint)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("ASR API request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("ASR API error {}: {}", status, body));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse ASR response: {}", e))?;

    let text = json["text"].as_str().unwrap_or("").trim().to_string();
    let language_out = json["language"].as_str().map(|s| s.to_string());

    let segments = json["segments"]
        .as_array()
        .map(|arr| {
            arr.iter().filter_map(|seg| {
                Some(TranscriptionSegment {
                    id: 0, // re-numbered after merge
                    start: seg["start"].as_f64()? + time_offset,
                    end: seg["end"].as_f64()? + time_offset,
                    text: seg["text"].as_str()?.trim().to_string(),
                })
            }).collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok((text, segments, language_out))
}

/// Transcribe audio by splitting into 10-minute chunks, then merging timelines.
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    input: String,
    api_url: String,
    model: String,
    language: Option<String>,
    task: Option<String>,
) -> Result<TranscriptionResult, String> {
    let duration = get_duration(&app, &input).await?;

    let total_chunks = ((duration / CHUNK_SECS).ceil() as usize).max(1);

    let endpoint = format!("{}/audio/transcriptions", api_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut all_segments: Vec<TranscriptionSegment> = Vec::new();
    let mut all_texts: Vec<String> = Vec::new();
    let mut detected_language: Option<String> = None;
    let tmp_dir = std::env::temp_dir();

    for chunk_idx in 0..total_chunks {
        let start_sec = chunk_idx as f64 * CHUNK_SECS;
        let chunk_dur = (duration - start_sec).min(CHUNK_SECS);

        let _ = app.emit("asr://progress", AsrProgress {
            chunk: chunk_idx + 1,
            total: total_chunks,
            message: format!("辨識第 {}/{} 段 ({:.0}–{:.0}s)…",
                chunk_idx + 1, total_chunks, start_sec, start_sec + chunk_dur),
        });

        let tmp_path = tmp_dir
            .join(format!("flimcutter_asr_{}_{}.wav", uuid::Uuid::new_v4(), chunk_idx))
            .to_string_lossy()
            .to_string();

        extract_chunk(&app, &input, start_sec, chunk_dur, &tmp_path).await?;

        match transcribe_chunk(&client, &endpoint, &model, &language, &task, &tmp_path, start_sec).await {
            Ok((text, segs, lang)) => {
                if !text.is_empty() {
                    all_texts.push(text);
                }
                all_segments.extend(segs);
                if detected_language.is_none() {
                    detected_language = lang;
                }
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&tmp_path).await;
                return Err(format!("Chunk {} failed: {}", chunk_idx + 1, e));
            }
        }

        let _ = tokio::fs::remove_file(&tmp_path).await;
    }

    // Re-number segment IDs sequentially after merge
    for (i, seg) in all_segments.iter_mut().enumerate() {
        seg.id = i as u32;
    }

    Ok(TranscriptionResult {
        text: all_texts.join(" "),
        segments: all_segments,
        language: detected_language,
    })
}

#[tauri::command]
pub async fn test_asr_connection(api_url: String) -> Result<String, String> {
    let endpoint = format!("{}/models", api_url.trim_end_matches('/'));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if resp.status().is_success() {
        let json: serde_json::Value = resp.json().await.unwrap_or(serde_json::Value::Null);
        let models: Vec<String> = json["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        Ok(format!("Connected. Available models: {}", models.join(", ")))
    } else {
        Err(format!("Server returned: {}", resp.status()))
    }
}
