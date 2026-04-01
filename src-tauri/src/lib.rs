mod commands;
mod models;
mod services;

use commands::{asr, download, ffmpeg, file};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // ffmpeg commands
            ffmpeg::get_video_metadata,
            ffmpeg::get_ffmpeg_version,
            ffmpeg::trim_video,
            ffmpeg::split_video,
            ffmpeg::merge_videos,
            ffmpeg::extract_audio,
            ffmpeg::convert_video,
            ffmpeg::compress_video,
            ffmpeg::take_screenshot,
            ffmpeg::make_gif,
            ffmpeg::adjust_speed,
            ffmpeg::rotate_video,
            ffmpeg::adjust_volume,
            ffmpeg::detect_scenes,
            ffmpeg::watermark_video,
            ffmpeg::image_watermark,
            ffmpeg::crop_video,
            // download commands
            download::get_video_info,
            download::start_download,
            download::cancel_download,
            download::get_ytdlp_version,
            // asr commands
            asr::transcribe_audio,
            asr::test_asr_connection,
            // file commands
            file::open_in_explorer,
            file::get_file_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
