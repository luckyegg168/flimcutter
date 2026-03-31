use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub path: String,
    pub filename: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub video_codec: String,
    pub audio_codec: String,
    pub bitrate: u64,
    pub file_size: u64,
    pub format: String,
}

impl Default for VideoMetadata {
    fn default() -> Self {
        Self {
            path: String::new(),
            filename: String::new(),
            duration: 0.0,
            width: 0,
            height: 0,
            fps: 0.0,
            video_codec: String::new(),
            audio_codec: String::new(),
            bitrate: 0,
            file_size: 0,
            format: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub fps: Option<f64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub filesize: Option<u64>,
    pub tbr: Option<f64>,
    pub format_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub webpage_url: String,
    pub ext: Option<String>,
    pub formats: Vec<VideoFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneInfo {
    pub timestamp: f64,
    pub frame_number: u64,
    pub score: f64,
}
