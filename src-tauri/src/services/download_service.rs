// Download service utilities
// Core logic is implemented in commands/download.rs

/// Parse a human-readable speed string (e.g., "1.50MiB/s") into bytes per second
pub fn parse_speed(speed_str: &str) -> Option<u64> {
    let s = speed_str.trim();
    if let Some(val_str) = s.strip_suffix("GiB/s") {
        val_str.parse::<f64>().ok().map(|v| (v * 1_073_741_824.0) as u64)
    } else if let Some(val_str) = s.strip_suffix("MiB/s") {
        val_str.parse::<f64>().ok().map(|v| (v * 1_048_576.0) as u64)
    } else if let Some(val_str) = s.strip_suffix("KiB/s") {
        val_str.parse::<f64>().ok().map(|v| (v * 1_024.0) as u64)
    } else if let Some(val_str) = s.strip_suffix("B/s") {
        val_str.parse::<f64>().ok().map(|v| v as u64)
    } else {
        None
    }
}

/// Parse ETA string ("01:23") into seconds
pub fn parse_eta(eta_str: &str) -> Option<u64> {
    let parts: Vec<&str> = eta_str.split(':').collect();
    match parts.len() {
        2 => {
            let m: u64 = parts[0].parse().ok()?;
            let s: u64 = parts[1].parse().ok()?;
            Some(m * 60 + s)
        }
        3 => {
            let h: u64 = parts[0].parse().ok()?;
            let m: u64 = parts[1].parse().ok()?;
            let s: u64 = parts[2].parse().ok()?;
            Some(h * 3600 + m * 60 + s)
        }
        _ => None,
    }
}
