use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    // Copy sidecar binaries with target-triple suffix to the output dir for dev mode.
    // Tauri's sidecar() resolves to "<name>-<triple>.exe" next to the executable,
    // but tauri-build only copies them as "<name>.exe" (without the triple).
    let target_triple = env::var("TARGET").unwrap_or_default();
    let out_dir = env::var("OUT_DIR").ok().map(PathBuf::from);

    if let Some(out) = out_dir {
        // Walk up from OUT_DIR (e.g. target/debug/build/.../out) to target/debug
        if let Some(target_dir) = out.ancestors().nth(3) {
            let binaries_src = PathBuf::from("binaries");
            for name in &["ffmpeg", "yt-dlp"] {
                let src = binaries_src.join(format!("{}-{}.exe", name, target_triple));
                let dst = target_dir.join(format!("{}-{}.exe", name, target_triple));
                if src.exists() && !dst.exists() {
                    let _ = fs::copy(&src, &dst);
                }
            }
        }
    }

    tauri_build::build()
}
