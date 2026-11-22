//! Small, bounded desktop excursions. No cursor history, screenshots, or Dock manipulation.
use serde::Serialize;
use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Instant,
};
use tauri::{Emitter, Manager, PhysicalPosition, WebviewWindow};

pub struct PlayState {
    pub enabled: AtomicBool,
    quiet: AtomicBool,
    reduced: AtomicBool,
    restart: AtomicBool,
    snapshot: Mutex<PlaySnapshot>,
}
impl Default for PlayState {
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(true),
            quiet: AtomicBool::new(true),
            reduced: AtomicBool::new(false),
            restart: AtomicBool::new(false),
            snapshot: Mutex::new(PlaySnapshot::default()),
        }
    }
}
impl PlayState {
    /// Reclaim a visible position after relaunch without changing session preferences.
    pub fn restart_route(&self) {
        self.restart.store(true, Ordering::Relaxed);
    }
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaySnapshot {
    pub action: &'static str,
    pub facing: i8,
    pub elapsed_ms: f64,
    pub roaming: bool,
    pub enabled: bool,
    pub gait_ms: f64,
    pub gait_rate: f64,
}
impl Default for PlaySnapshot {
    fn default() -> Self {
        Self {
            action: "rest",
            facing: -1,
            elapsed_ms: 0.0,
            roaming: false,
            enabled: true,
            gait_ms: 0.0,
            gait_rate: 0.0,
        }
    }
}
fn main_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Invalid habitat window".into());
    }
    Ok(())
}
#[tauri::command]
pub fn play_snapshot(
    window: WebviewWindow,
    state: tauri::State<'_, PlayState>,
) -> Result<PlaySnapshot, String> {
    main_only(&window)?;
    state
        .snapshot
        .lock()
        .map(|s| s.clone())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_play_context(
    window: WebviewWindow,
    state: tauri::State<'_, PlayState>,
    quiet: bool,
    reduced: bool,
) -> Result<(), String> {
    main_only(&window)?;
    state.quiet.store(quiet, Ordering::Relaxed);
    state.reduced.store(reduced, Ordering::Relaxed);
    Ok(())
}
pub fn set_enabled(window: &WebviewWindow, enabled: bool) {
    if !enabled {
        window
            .state::<crate::shell::ShellState>()
            .manual_placement
            .store(true, Ordering::Relaxed);
    }
    let state = window.state::<PlayState>();
    state.enabled.store(enabled, Ordering::Relaxed);
    state.restart_route();
}
#[tauri::command]
pub fn set_playful_roaming(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    main_only(&window)?;
    set_enabled(&window, enabled);
    Ok(())
}
pub fn active(window: &WebviewWindow) -> bool {
    window
        .state::<PlayState>()
        .snapshot
        .lock()
        .is_ok_and(|s| s.roaming)
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Point {
    x: f64,
    y: f64,
}
impl Point {
    fn physical(self) -> PhysicalPosition<i32> {
        PhysicalPosition::new(self.x.round() as i32, self.y.round() as i32)
    }
    fn mix(self, other: Self, t: f64) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
        }
    }
    fn distance(self, other: Self) -> f64 {
        (other.x - self.x).hypot(other.y - self.y)
    }
}
#[derive(Clone, Copy, Debug, PartialEq)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}
#[derive(Clone, Copy, Debug, PartialEq)]
enum Edge {
    Bottom,
    Left,
    Right,
}
#[derive(Clone, Copy, Debug, PartialEq)]
struct Layout {
    full: Rect,
    work: Rect,
    scale: f64,
    edge: Edge,
}
impl Layout {
    fn new(full: Rect, work: Rect, scale: f64) -> Self {
        let left = work.x - full.x;
        let right = full.x + full.w - work.x - work.w;
        let bottom = full.y + full.h - work.y - work.h;
        let edge = if left > 6.0 * scale && left > bottom && left > right {
            Edge::Left
        } else if right > 6.0 * scale && right > bottom {
            Edge::Right
        } else {
            Edge::Bottom
        };
        Self {
            full,
            work,
            scale,
            edge,
        }
    }
    fn floor(self) -> f64 {
        self.work.y + (self.work.h - 200.0 * self.scale).max(0.0)
    }
    fn left(self) -> f64 {
        self.work.x
    }
    fn right(self) -> f64 {
        self.work.x + (self.work.w - 220.0 * self.scale).max(0.0)
    }
    fn fit(self, p: Point) -> Point {
        Point {
            x: p.x.clamp(self.left(), self.right()),
            y: p.y.clamp(self.work.y, self.floor()),
        }
    }
    fn dock(self) -> Point {
        Point {
            x: match self.edge {
                Edge::Left => self.left(),
                Edge::Right => self.right(),
                Edge::Bottom => (self.full.x + self.full.w / 2.0 - 110.0 * self.scale)
                    .clamp(self.left(), self.right()),
            },
            y: self.floor(),
        }
    }
    fn hidden(self) -> Point {
        let p = self.dock();
        match self.edge {
            Edge::Bottom => Point {
                x: p.x,
                y: self.work.y + self.work.h - 108.0 * self.scale,
            },
            Edge::Left => Point {
                x: self.work.x - 164.0 * self.scale,
                y: p.y,
            },
            Edge::Right => Point {
                x: self.work.x + self.work.w - 56.0 * self.scale,
                y: p.y,
            },
        }
    }
    fn peek(self) -> Point {
        let p = self.dock();
        match self.edge {
            Edge::Bottom => Point {
                x: p.x,
                y: self.work.y + self.work.h - 170.0 * self.scale,
            },
            Edge::Left => Point {
                x: self.work.x - 112.0 * self.scale,
                y: p.y,
            },
            Edge::Right => Point {
                x: self.work.x + self.work.w - 108.0 * self.scale,
                y: p.y,
            },
        }
    }
    fn excursion(self, from: Point, cycle: u32) -> Point {
        let span = self.right() - self.left();
        let step = (220.0 + f64::from(cycle % 3) * 35.0) * self.scale;
        let direction = if from.x > self.left() + span / 2.0 {
            -1.0
        } else {
            1.0
        };
        Point {
            x: (from.x + step * direction).clamp(self.left(), self.right()),
            y: self.floor(),
        }
    }
}
fn layout(window: &WebviewWindow) -> tauri::Result<Option<Layout>> {
    let Some(m) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(None);
    };
    let a = m.work_area();
    let p = m.position();
    let s = m.size();
    Ok(Some(Layout::new(
        Rect {
            x: p.x as f64,
            y: p.y as f64,
            w: s.width as f64,
            h: s.height as f64,
        },
        Rect {
            x: a.position.x as f64,
            y: a.position.y as f64,
            w: a.size.width as f64,
            h: a.size.height as f64,
        },
        m.scale_factor(),
    )))
}
fn ease(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Paw phase tracks the eased world distance, including acceleration and braking.
fn gait_phase(action: &str, distance: f64, duration: f64, elapsed: f64) -> (f64, f64) {
    let (stride, cycle) = match action {
        "walk" => (48.0, 880.0),
        "run" => (84.0, 560.0),
        _ => (1.0, 0.0),
    };
    let t = (elapsed / duration).clamp(0.0, 1.0);
    (
        distance * ease(t) * cycle / stride,
        distance / duration * 6.0 * t * (1.0 - t) * cycle / stride,
    )
}

pub struct Roamer {
    last_tick: Instant,
    layout: Option<Layout>,
    position: Option<Point>,
    start: Point,
    target: Point,
    phase: u8,
    elapsed: f64,
    duration: f64,
    cycle: u32,
    facing: i8,
    last_action: Option<(&'static str, i8, bool, bool, u8)>,
    geometry_tick: u32,
    last_emit: f64,
}
impl Default for Roamer {
    fn default() -> Self {
        Self {
            last_tick: Instant::now(),
            layout: None,
            position: None,
            start: Point { x: 0.0, y: 0.0 },
            target: Point { x: 0.0, y: 0.0 },
            phase: 0,
            elapsed: 0.0,
            duration: 700.0,
            cycle: 0,
            facing: -1,
            last_action: None,
            geometry_tick: 0,
            last_emit: 0.0,
        }
    }
}
impl Roamer {
    fn enter(&mut self, phase: u8, bounds: Layout) {
        self.phase = phase;
        self.elapsed = 0.0;
        self.start = self.position.unwrap_or(bounds.dock());
        self.target = match phase {
            1 | 10 => bounds.excursion(self.start, self.cycle),
            3 | 9 => bounds.dock(),
            4 | 7 => bounds.hidden(),
            6 => bounds.peek(),
            _ => self.start,
        };
        self.duration = match phase {
            1 | 3 | 10 => {
                let speed = if phase == 3 { 60.0 } else { 120.0 };
                (self.start.distance(self.target) / (speed * bounds.scale) * 1000.0).max(700.0)
            }
            2 => 1500.0,
            4 => 650.0,
            5 => 700.0,
            6 => 1600.0,
            7 | 8 => 500.0,
            9 => 850.0,
            11 => 2200.0 + f64::from(self.cycle % 3) * 600.0,
            _ => 700.0,
        };
        if phase == 6 {
            match bounds.edge {
                Edge::Left => self.facing = 1,
                Edge::Right => self.facing = -1,
                Edge::Bottom => {}
            }
        } else if phase == 9 {
            // Turn while still concealed, then emerge facing the direction of the next run.
            self.facing = if bounds.excursion(bounds.dock(), self.cycle).x > bounds.dock().x {
                1
            } else {
                -1
            };
        }
        if (self.target.x - self.start.x).abs() > 1.0 {
            self.facing = if self.target.x > self.start.x { 1 } else { -1 };
        }
    }
    fn publish(
        &mut self,
        window: &WebviewWindow,
        action: &'static str,
        roaming: bool,
        enabled: bool,
    ) {
        let key = (action, self.facing, roaming, enabled, self.phase);
        let scale = self.layout.map_or(1.0, |b| b.scale);
        let distance = self.start.distance(self.target) / scale;
        let (gait_ms, gait_rate) = gait_phase(action, distance, self.duration, self.elapsed);
        let snapshot = PlaySnapshot {
            action,
            facing: self.facing,
            elapsed_ms: self.elapsed,
            roaming,
            enabled,
            gait_ms,
            gait_rate,
        };
        let state = window.state::<PlayState>();
        if let Ok(mut stored) = state.snapshot.lock() {
            *stored = snapshot.clone();
        }
        if self.last_action != Some(key)
            || ((action == "run" || action == "walk") && self.elapsed - self.last_emit >= 100.0)
        {
            self.last_emit = self.elapsed;
            self.last_action = Some(key);
            let _ = window.emit("habitat-play", snapshot);
        }
    }
    fn advance(&mut self, bounds: Layout, dt: f64) {
        self.elapsed += dt;
        if self.elapsed >= self.duration {
            self.position = Some(self.target);
            let next = if self.phase == 11 {
                self.cycle = self.cycle.wrapping_add(1);
                1
            } else {
                self.phase + 1
            };
            self.enter(next, bounds);
        }
        let travel_time = if self.phase == 6 {
            550.0
        } else {
            self.duration
        };
        self.position = Some(
            self.start
                .mix(self.target, ease(self.elapsed / travel_time)),
        );
    }
    pub fn tick(
        &mut self,
        window: &WebviewWindow,
        hovered: bool,
        dragging: bool,
        visible: bool,
    ) -> tauri::Result<()> {
        let now = Instant::now();
        let dt = now.duration_since(self.last_tick).as_secs_f64().min(0.08) * 1000.0;
        self.last_tick = now;
        let state = window.state::<PlayState>();
        let enabled = state.enabled.load(Ordering::Relaxed);
        if window
            .state::<crate::shell::ShellState>()
            .tools_open
            .load(Ordering::Relaxed)
        {
            self.position = None;
            self.layout = None;
            self.publish(window, "rest", false, enabled);
            return Ok(());
        }
        let allowed = enabled
            && !state.reduced.load(Ordering::Relaxed)
            && !state.quiet.load(Ordering::Relaxed)
            && !crate::settings::is_focused(window.app_handle())
            && !crate::native_check::enabled();
        if !visible || dragging {
            self.position = None;
            self.layout = None;
            self.publish(window, "rest", false, enabled);
            return Ok(());
        }
        // Refresh work-area geometry periodically rather than on every movement step.
        let restart = state.restart.swap(false, Ordering::Relaxed);
        if self.layout.is_none() || self.geometry_tick.is_multiple_of(30) || restart {
            let Some(bounds) = layout(window)? else {
                return Ok(());
            };
            if self.layout != Some(bounds) || restart {
                self.layout = Some(bounds);
                self.position = None;
            }
        }
        self.geometry_tick = self.geometry_tick.wrapping_add(1);
        let Some(bounds) = self.layout else {
            return Ok(());
        };
        if !allowed {
            if self.position.take().is_some() || restart {
                let p = window.outer_position()?;
                window.set_position(
                    bounds
                        .fit(Point {
                            x: p.x as f64,
                            y: p.y as f64,
                        })
                        .physical(),
                )?;
            }
            self.publish(window, "rest", false, enabled);
            return Ok(());
        }
        if self.position.is_none() {
            let p = window.outer_position()?;
            let fitted = bounds.fit(Point {
                x: p.x as f64,
                y: p.y as f64,
            });
            if fitted.physical() != p {
                window.set_position(fitted.physical())?;
            }
            self.position = Some(fitted);
            self.enter(0, bounds);
        }
        let behind_dock = (4..=9).contains(&self.phase);
        if hovered && (!behind_dock || window.is_focused().unwrap_or(false)) {
            if behind_dock {
                let p = bounds.fit(self.position.unwrap_or(bounds.dock()));
                window.set_position(p.physical())?;
                self.position = Some(p);
                self.enter(0, bounds);
            }
            self.publish(window, "rest", true, enabled);
            return Ok(());
        }
        let previous = self.position.map(Point::physical);
        self.advance(bounds, dt);
        if let Some(p) = self.position
            && previous != Some(p.physical())
        {
            window.set_position(p.physical())?;
        }
        let action = match self.phase {
            1 | 10 => "run",
            3 => "walk",
            2 => "pounce",
            4 | 5 | 7 | 8 => "hide",
            6 => "peek",
            9 => "peek",
            _ => "rest",
        };
        self.publish(window, action, true, enabled);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relaunch_restarts_the_route_without_changing_play_or_motion_preferences() {
        let state = PlayState::default();
        for enabled in [false, true] {
            state.enabled.store(enabled, Ordering::Relaxed);
            state.quiet.store(true, Ordering::Relaxed);
            state.reduced.store(true, Ordering::Relaxed);
            state.restart.store(false, Ordering::Relaxed);
            state.restart_route();
            assert_eq!(state.enabled.load(Ordering::Relaxed), enabled);
            assert!(state.quiet.load(Ordering::Relaxed));
            assert!(state.reduced.load(Ordering::Relaxed));
            assert!(state.restart.swap(false, Ordering::Relaxed));
        }
    }
    fn bounds(scale: f64, edge: Edge) -> Layout {
        let full = Rect {
            x: -1440.0 * scale,
            y: 0.0,
            w: 1440.0 * scale,
            h: 900.0 * scale,
        };
        let work = match edge {
            Edge::Bottom => Rect {
                x: full.x,
                y: 24.0 * scale,
                w: full.w,
                h: 796.0 * scale,
            },
            Edge::Left => Rect {
                x: full.x + 80.0 * scale,
                y: 24.0 * scale,
                w: 1360.0 * scale,
                h: 876.0 * scale,
            },
            Edge::Right => Rect {
                x: full.x,
                y: 24.0 * scale,
                w: 1360.0 * scale,
                h: 876.0 * scale,
            },
        };
        Layout::new(full, work, scale)
    }
    #[test]
    fn finds_dock_edges_without_treating_the_menu_bar_as_a_dock() {
        for scale in [1.0, 1.25, 2.0] {
            for edge in [Edge::Bottom, Edge::Left, Edge::Right] {
                assert_eq!(bounds(scale, edge).edge, edge);
            }
        }
        let b = bounds(1.0, Edge::Bottom);
        assert_eq!(
            Layout::new(b.full, Rect { h: 876.0, ..b.work }, 1.0).edge,
            Edge::Bottom
        );
    }
    #[test]
    fn excursions_and_recovery_fit_the_current_work_area_at_all_scales() {
        for scale in [1.0, 1.25, 2.0] {
            for edge in [Edge::Bottom, Edge::Left, Edge::Right] {
                let b = bounds(scale, edge);
                let p = b.excursion(b.dock(), 1);
                assert_eq!(b.fit(p), p);
                let recovered = b.fit(b.hidden());
                assert!(recovered.x >= b.left() && recovered.x <= b.right());
                assert!(recovered.y >= b.work.y && recovered.y <= b.floor());
                assert_ne!(b.peek(), b.hidden());
            }
        }
    }
    #[test]
    fn tiny_work_areas_do_not_panic_or_generate_reversed_bounds() {
        let r = Rect {
            x: 10.0,
            y: 10.0,
            w: 100.0,
            h: 80.0,
        };
        let b = Layout::new(r, r, 2.0);
        assert_eq!(b.left(), b.right());
        assert_eq!(b.floor(), r.y);
        assert_eq!(b.excursion(b.dock(), 0), b.dock());
    }
    #[test]
    fn paths_ease_to_exact_endpoints_without_overshoot() {
        assert_eq!(ease(-1.0), 0.0);
        assert_eq!(ease(2.0), 1.0);
        let b = bounds(2.0, Edge::Bottom);
        let mut pet = Roamer {
            position: Some(b.dock()),
            ..Roamer::default()
        };
        for phase in 0..12 {
            pet.enter(phase, b);
            assert!(pet.duration >= 500.0);
            for step in 0..100 {
                let p = pet.start.mix(pet.target, ease(f64::from(step) / 100.0));
                assert!(
                    p.x >= pet.start.x.min(pet.target.x) && p.x <= pet.start.x.max(pet.target.x)
                );
                assert!(
                    p.y >= pet.start.y.min(pet.target.y) && p.y <= pet.start.y.max(pet.target.y)
                );
            }
            pet.position = Some(pet.target);
        }
    }
    #[test]
    fn complete_excursions_always_reemerge_and_do_not_overshoot_when_frames_vary() {
        for edge in [Edge::Bottom, Edge::Left, Edge::Right] {
            let b = bounds(1.25, edge);
            let mut pet = Roamer {
                position: Some(b.dock()),
                ..Roamer::default()
            };
            pet.enter(0, b);
            let mut seen = std::collections::BTreeSet::new();
            let mut hidden_for = 0.0;
            for step in 0..4000 {
                let dt = if step % 7 == 0 { 66.0 } else { 33.0 };
                pet.advance(b, dt);
                seen.insert(pet.phase);
                let p = pet.position.unwrap();
                assert!(p.x.is_finite() && p.y.is_finite());
                if (4..=9).contains(&pet.phase) {
                    hidden_for += dt;
                } else {
                    assert!(hidden_for < 6000.0);
                    hidden_for = 0.0;
                    assert_eq!(b.fit(p), p);
                }
            }
            assert_eq!(seen.len(), 12);
            assert!(pet.cycle >= 3);
        }
    }
    #[test]
    fn stride_follows_distance_for_running_and_walking_and_stops_at_both_ends() {
        for (action, stride, cycle) in [("walk", 48.0, 880.0), ("run", 84.0, 560.0)] {
            for duration in [1000.0, 3000.0] {
                assert_eq!(gait_phase(action, stride, duration, 0.0), (0.0, 0.0));
                assert_eq!(gait_phase(action, stride, duration, duration), (cycle, 0.0));
                let (phase, rate) = gait_phase(action, stride, duration, duration / 2.0);
                assert_eq!(phase, cycle / 2.0);
                assert!(rate > 0.0);
            }
        }
        assert_eq!(gait_phase("rest", 100.0, 1000.0, 500.0), (0.0, 0.0));
    }
    #[test]
    fn hides_inside_the_dock_inset_and_peeks_above_it_instead_of_diving_far_offscreen() {
        let b = bounds(1.0, Edge::Bottom);
        let floor = b.work.y + b.work.h;
        assert_eq!(b.hidden().y + 108.0, floor);
        assert!(b.hidden().y + 100.0 < b.full.y + b.full.h);
        assert!(b.peek().y < b.hidden().y);
        let mut pet = Roamer {
            position: Some(b.dock()),
            ..Roamer::default()
        };
        pet.enter(6, b);
        pet.advance(b, 550.0);
        assert_eq!(pet.position, Some(b.peek()));
        pet.advance(b, 800.0);
        assert_eq!(pet.position, Some(b.peek()));
        assert_eq!(pet.phase, 6);
        pet.advance(b, 300.0);
        assert_eq!(pet.phase, 7);
    }
}
