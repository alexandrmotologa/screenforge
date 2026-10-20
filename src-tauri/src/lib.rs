use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CursorTelemetryPoint {
    pub x: f64, // normalized 0..1 across virtual screen
    pub y: f64,
    pub timestamp: u64, // ms from recording start
    pub event_type: String, // "move", "click", "mousedown"
    pub button: i32, // 0 = left, 1 = middle, 2 = right
}

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

static IS_RECORDING: AtomicBool = AtomicBool::new(false);
static BUFFER: LazyLock<Mutex<Vec<CursorTelemetryPoint>>> = LazyLock::new(|| Mutex::new(Vec::new()));
static START_TIME: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

// Win32 FFI bindings for zero-dependency global cursor capture on Windows
#[cfg(target_os = "windows")]
mod win32 {
    #[repr(C)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    unsafe extern "system" {
        pub fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        pub fn GetAsyncKeyState(vKey: i32) -> i16;
        pub fn GetSystemMetrics(nIndex: i32) -> i32;
    }

    pub const SM_CXSCREEN: i32 = 0;
    pub const SM_CYSCREEN: i32 = 1;
    pub const VK_LBUTTON: i32 = 0x01;
    pub const VK_RBUTTON: i32 = 0x02;
    #[allow(dead_code)]
    pub const VK_MBUTTON: i32 = 0x04;
}

fn push_telemetry(pt: CursorTelemetryPoint) {
    if let Ok(mut buf) = BUFFER.lock() {
        buf.push(pt);
    }
}

#[tauri::command]
fn start_global_telemetry() -> Result<(), String> {
    IS_RECORDING.store(true, Ordering::SeqCst);
    if let Ok(mut buf) = BUFFER.lock() {
        buf.clear();
    }
    if let Ok(mut st) = START_TIME.lock() {
        *st = Some(Instant::now());
    }

    // Spawn high-frequency (60Hz) polling thread
    thread::spawn(move || {
        let mut last_lbutton = false;
        let mut last_rbutton = false;
        let mut last_x = -1.0;
        let mut last_y = -1.0;

        while IS_RECORDING.load(Ordering::SeqCst) {
            #[cfg(target_os = "windows")]
            unsafe {
                let mut pt = win32::POINT { x: 0, y: 0 };
                if win32::GetCursorPos(&mut pt) != 0 {
                    let screen_w = win32::GetSystemMetrics(win32::SM_CXSCREEN).max(1) as f64;
                    let screen_h = win32::GetSystemMetrics(win32::SM_CYSCREEN).max(1) as f64;

                    let norm_x = (pt.x as f64 / screen_w).clamp(0.0, 1.0);
                    let norm_y = (pt.y as f64 / screen_h).clamp(0.0, 1.0);

                    let l_down = (win32::GetAsyncKeyState(win32::VK_LBUTTON) as u16 & 0x8000) != 0;
                    let r_down = (win32::GetAsyncKeyState(win32::VK_RBUTTON) as u16 & 0x8000) != 0;

                    let now = Instant::now();
                    let elapsed_ms = if let Ok(st) = START_TIME.lock() {
                        st.map(|t| now.duration_since(t).as_millis() as u64)
                            .unwrap_or(0)
                    } else {
                        0
                    };

                    let moved = (norm_x - last_x).abs() > 0.001 || (norm_y - last_y).abs() > 0.001;

                    if l_down && !last_lbutton {
                        push_telemetry(CursorTelemetryPoint {
                            x: norm_x,
                            y: norm_y,
                            timestamp: elapsed_ms,
                            event_type: "click".to_string(),
                            button: 0,
                        });
                    } else if r_down && !last_rbutton {
                        push_telemetry(CursorTelemetryPoint {
                            x: norm_x,
                            y: norm_y,
                            timestamp: elapsed_ms,
                            event_type: "click".to_string(),
                            button: 2,
                        });
                    } else if moved {
                        push_telemetry(CursorTelemetryPoint {
                            x: norm_x,
                            y: norm_y,
                            timestamp: elapsed_ms,
                            event_type: "move".to_string(),
                            button: -1,
                        });
                        last_x = norm_x;
                        last_y = norm_y;
                    }

                    last_lbutton = l_down;
                    last_rbutton = r_down;
                }
            }

            thread::sleep(Duration::from_millis(16)); // ~60 FPS
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_global_telemetry() -> Vec<CursorTelemetryPoint> {
    IS_RECORDING.store(false, Ordering::SeqCst);
    if let Ok(mut buf) = BUFFER.lock() {
        return buf.drain(..).collect();
    }
    Vec::new()
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
fn render_with_ffmpeg(
    input_path: String,
    output_path: String,
    format: String,
    resolution: String,
    fps: u32,
) -> Result<String, String> {
    let scale_filter = match resolution.as_str() {
        "4k" => "scale=3840:2160",
        "2k" => "scale=2560:1440",
        "720p" => "scale=1280:720",
        _ => "scale=1920:1080",
    };

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(&input_path);

    if format == "gif" {
        cmd.arg("-vf")
            .arg(format!("fps={},{},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3", fps, scale_filter));
    } else if format == "webm" {
        cmd.arg("-vf")
            .arg(scale_filter)
            .arg("-r")
            .arg(fps.to_string())
            .arg("-c:v")
            .arg("libvpx-vp9")
            .arg("-crf")
            .arg("24")
            .arg("-b:v")
            .arg("0");
    } else {
        // MP4
        cmd.arg("-vf")
            .arg(scale_filter)
            .arg("-r")
            .arg(fps.to_string())
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("medium")
            .arg("-crf")
            .arg("18")
            .arg("-pix_fmt")
            .arg("yuv420p");
    }

    cmd.arg(&output_path);

    let output = cmd.output().map_err(|e| format!("FFmpeg failed: {}", e))?;
    if !output.status.success() {
        let err_log = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", err_log));
    }

    Ok(output_path)
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
            open_file_in_folder,
            start_global_telemetry,
            stop_global_telemetry,
            render_with_ffmpeg
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
