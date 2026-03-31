// FFmpeg service helper utilities
// Core processing is implemented directly in commands/ffmpeg.rs

use crate::models::video::VideoMetadata;

pub fn format_output_path(input: &str, suffix: &str, ext: &str) -> String {
    let stem = std::path::Path::new(input)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or("output".to_string());

    let dir = std::path::Path::new(input)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or(".".to_string());

    format!("{}\\{}_{}.{}", dir, stem, suffix, ext)
}

pub fn estimate_output_size(metadata: &VideoMetadata, crf: u32) -> u64 {
    // Rough estimate: higher CRF = smaller file
    let quality_factor = match crf {
        0..=17 => 1.0,
        18..=23 => 0.5,
        24..=27 => 0.3,
        28..=35 => 0.15,
        _ => 0.08,
    };
    (metadata.file_size as f64 * quality_factor) as u64
}
