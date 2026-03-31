use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use serde::{Deserialize, Serialize};

use crate::models::task::TranscriptionResult;

#[derive(Debug, Serialize, Deserialize)]
pub struct AsrOptions {
    pub api_url: String,
    pub model: String,
    pub language: Option<String>,
    pub task: Option<String>,
}

/// Extract audio from video to a temp WAV file, then send to ASR API.
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    input: String,
    api_url: String,
    model: String,
    language: Option<String>,
    task: Option<String>,
) -> Result<TranscriptionResult, String> {
    // Step 1: Extract audio to temp file
    let tmp_dir = std::env::temp_dir();
    let tmp_audio = tmp_dir.join(format!("flimcutter_asr_{}.wav", uuid::Uuid::new_v4()));
    let tmp_path = tmp_audio.to_string_lossy().to_string();

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-i", &input,
            "-vn",
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            &tmp_path,
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(status) = event {
            if status.code.unwrap_or(-1) != 0 {
                return Err("Failed to extract audio for transcription".to_string());
            }
            break;
        }
    }

    // Step 2: Send to ASR API via reqwest multipart
    let endpoint = format!("{}/audio/transcriptions", api_url.trim_end_matches('/'));

    let audio_bytes = tokio::fs::read(&tmp_path)
        .await
        .map_err(|e| format!("Failed to read temp audio: {}", e))?;

    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;

    let mut form = reqwest::multipart::Form::new()
        .text("model", model)
        .text("response_format", "verbose_json")
        .part("file", part);

    if let Some(lang) = language.filter(|l| l != "auto") {
        form = form.text("language", lang);
    }
    if let Some(t) = task {
        form = form.text("task", t);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&endpoint)
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

    // Clean up temp file
    let _ = tokio::fs::remove_file(&tmp_path).await;

    // Parse verbose_json response
    let text = json["text"].as_str().unwrap_or("").to_string();
    let language_out = json["language"].as_str().map(|s| s.to_string());

    let segments = json["segments"]
        .as_array()
        .map(|arr| arr.iter().enumerate().filter_map(|(i, seg)| {
            use crate::models::task::TranscriptionSegment;
            Some(TranscriptionSegment {
                id: i as u32,
                start: seg["start"].as_f64()?,
                end: seg["end"].as_f64()?,
                text: seg["text"].as_str()?.trim().to_string(),
            })
        }).collect())
        .unwrap_or_default();

    Ok(TranscriptionResult {
        text,
        segments,
        language: language_out,
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
            .map(|arr| arr.iter().filter_map(|m| m["id"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();
        Ok(format!("Connected. Available models: {}", models.join(", ")))
    } else {
        Err(format!("Server returned: {}", resp.status()))
    }
}
