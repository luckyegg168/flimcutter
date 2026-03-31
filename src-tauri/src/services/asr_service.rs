// ASR service utilities
// Core logic is implemented in commands/asr.rs

use crate::models::task::TranscriptionSegment;

/// Generate SRT subtitle content from transcript segments
pub fn generate_srt(segments: &[TranscriptionSegment]) -> String {
    segments.iter().enumerate().map(|(i, seg)| {
        format!(
            "{}\n{} --> {}\n{}\n\n",
            i + 1,
            format_srt_time(seg.start),
            format_srt_time(seg.end),
            seg.text.trim(),
        )
    }).collect()
}

/// Generate WebVTT subtitle content from transcript segments
pub fn generate_vtt(segments: &[TranscriptionSegment]) -> String {
    let mut vtt = "WEBVTT\n\n".to_string();
    for (i, seg) in segments.iter().enumerate() {
        vtt.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            i + 1,
            format_vtt_time(seg.start),
            format_vtt_time(seg.end),
            seg.text.trim(),
        ));
    }
    vtt
}

fn format_srt_time(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = secs % 60.0;
    let ms = ((s - s.floor()) * 1000.0) as u64;
    format!("{:02}:{:02}:{:02},{:03}", h, m, s as u64, ms)
}

fn format_vtt_time(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = secs % 60.0;
    let ms = ((s - s.floor()) * 1000.0) as u64;
    format!("{:02}:{:02}:{:02}.{:03}", h, m, s as u64, ms)
}
