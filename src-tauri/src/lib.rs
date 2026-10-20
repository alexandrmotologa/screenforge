use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Debug)]
pub struct FFmpegStatus {
    pub available: bool,
    pub version: String,
    pub nvenc_supported: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub ffmpeg: FFmpegStatus,
}

#[tauri::command]
fn check_ffmpeg() -> FFmpegStatus {
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let first_line = version_str
                .lines()
                .next()
                .unwrap_or("ffmpeg unknown")
                .to_string();
            let nvenc = version_str.contains("nvenc") || version_str.contains("cuda");
            FFmpegStatus {
                available: true,
                version: first_line,
                nvenc_supported: nvenc,
            }
        }
        Err(_) => FFmpegStatus {
            available: false,
            version: String::new(),
            nvenc_supported: false,
        },
    }
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let ffmpeg = check_ffmpeg();
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        ffmpeg,
    }
}

#[tauri::command]
fn open_file_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            get_system_info,
            open_file_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
