use std::{
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{Emitter, WebviewWindow};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityReading {
    idle_seconds: Option<f64>,
    sampled_at_ms: u64,
}

#[cfg(target_os = "macos")]
fn idle_seconds() -> Option<f64> {
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state: i32, event_type: u32) -> f64;
    }
    // Read elapsed idle time only, using the combined session state and any input.
    // https://developer.apple.com/documentation/coregraphics/cgeventsource/secondssincelasteventtype(_:eventtype:)
    // SAFETY: scalar parameters match the CoreGraphics ABI; no pointers or hooks.
    let seconds = unsafe { CGEventSourceSecondsSinceLastEventType(0, u32::MAX) };
    (seconds.is_finite() && seconds >= 0.0).then_some(seconds)
}

#[cfg(target_os = "windows")]
fn idle_seconds() -> Option<f64> {
    #[repr(C)]
    struct LastInputInfo {
        size: u32,
        tick: u32,
    }
    #[link(name = "user32")]
    unsafe extern "system" {
        #[link_name = "GetLastInputInfo"]
        fn get_last_input_info(info: *mut LastInputInfo) -> i32;
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        #[link_name = "GetTickCount"]
        fn get_tick_count() -> u32;
    }
    let mut info = LastInputInfo {
        size: std::mem::size_of::<LastInputInfo>() as u32,
        tick: 0,
    };
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getlastinputinfo
    // SAFETY: initialized LASTINPUTINFO has the documented layout and a valid size.
    if unsafe { get_last_input_info(&mut info) } == 0 {
        return None;
    }
    // SAFETY: GetTickCount has no parameters. Wrapping subtraction handles rollover.
    let elapsed = unsafe { get_tick_count() }.wrapping_sub(info.tick);
    // Synthetic future timestamps should not turn into an enormous idle duration.
    (elapsed <= i32::MAX as u32).then_some(elapsed as f64 / 1000.0)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn idle_seconds() -> Option<f64> {
    None
}

#[tauri::command]
pub fn activity_snapshot() -> ActivityReading {
    ActivityReading {
        idle_seconds: idle_seconds(),
        sampled_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    }
}

pub fn start_observer(window: WebviewWindow) {
    thread::spawn(move || {
        loop {
            let _ = window.emit("activity-sample", activity_snapshot());
            thread::sleep(Duration::from_secs(5));
        }
    });
}
