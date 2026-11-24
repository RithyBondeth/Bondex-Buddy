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
    water_requested: AtomicBool,
    water_return: AtomicBool,
    snapshot: Mutex<PlaySnapshot>,
}
impl Default for PlayState {
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(true),
            quiet: AtomicBool::new(true),
            reduced: AtomicBool::new(false),
            restart: AtomicBool::new(false),
            water_requested: AtomicBool::new(false),
            water_return: AtomicBool::new(false),
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
    pub duration_ms: f64,
    pub roaming: bool,
    pub enabled: bool,
    pub gait_ms: f64,
    pub gait_rate: f64,
    pub water: Option<&'static str>,
}
impl Default for PlaySnapshot {
    fn default() -> Self {
        Self {
            action: "rest",
            facing: -1,
            elapsed_ms: 0.0,
            duration_ms: 0.0,
            roaming: false,
            enabled: true,
            gait_ms: 0.0,
            gait_rate: 0.0,
            water: None,
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

#[tauri::command]
pub fn start_water_walk(window: WebviewWindow, preview: bool) -> Result<bool, String> {
    main_only(&window)?;
    let shell = window.state::<crate::shell::ShellState>();
    if shell.tools_open.load(Ordering::Relaxed) || shell.dragging.load(Ordering::Relaxed) {
        return Ok(false);
    }
    if !window.is_visible().map_err(|error| error.to_string())? {
        if !preview {
            return Ok(false);
        }
        window
            .unminimize()
            .and_then(|_| window.show())
            .map_err(|error| error.to_string())?;
    }
    let state = window.state::<PlayState>();
    if state.snapshot.lock().is_ok_and(|s| s.water.is_some()) {
        return Ok(false);
    }
    state.water_return.store(false, Ordering::Relaxed);
    Ok(!state.water_requested.swap(true, Ordering::Relaxed))
}

#[tauri::command]
pub fn return_water_walk(window: WebviewWindow) -> Result<(), String> {
    main_only(&window)?;
    let state = window.state::<PlayState>();
    state.water_requested.store(false, Ordering::Relaxed);
    state.water_return.store(true, Ordering::Relaxed);
    Ok(())
}

pub fn active(window: &WebviewWindow) -> bool {
    window
        .state::<PlayState>()
        .snapshot
        .lock()
        .is_ok_and(|s| s.roaming || s.water.is_some())
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

/// Shift weight onto each grip before the next pull. The derivative drives the
/// interpolated gait between native updates, so hands and window stay in sync.
fn travel_curve(t: f64, distance: f64, climbing: bool) -> (f64, f64) {
    let t = t.clamp(0.0, 1.0);
    let position = ease(t);
    let speed = 6.0 * t * (1.0 - t);
    if !climbing || t == 0.0 || t == 1.0 {
        return (position, speed);
    }
    let frequency = (distance / 16.0).round().max(1.0) * std::f64::consts::TAU;
    let angle = position * frequency;
    (
        position - 0.42 * angle.sin() / frequency,
        speed * (1.0 - 0.42 * angle.cos()),
    )
}

/// Paw phase tracks the eased world distance, including acceleration and braking.
fn gait_phase(action: &str, distance: f64, duration: f64, elapsed: f64) -> (f64, f64) {
    let (stride, cycle) = match action {
        "walk" => (48.0, 880.0),
        "run" => (84.0, 560.0),
        "climbUp" | "climbDown" => (32.0, 880.0),
        _ => (1.0, 0.0),
    };
    let (position, speed) = travel_curve(
        elapsed / duration,
        distance,
        matches!(action, "climbUp" | "climbDown"),
    );
    (
        distance * position * cycle / stride,
        distance / duration * speed * cycle / stride,
    )
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum WaterBeat {
    Walk,
    Offer,
    Return,
}

impl WaterBeat {
    fn label(self) -> &'static str {
        match self {
            Self::Walk => "walk",
            Self::Offer => "offer",
            Self::Return => "return",
        }
    }
}

struct WaterVisit {
    home: Point,
    start: Point,
    target: Point,
    beat: WaterBeat,
    elapsed: f64,
    duration: f64,
}

impl WaterVisit {
    fn new(home: Point, bounds: Layout, reduced: bool) -> Self {
        let span = bounds.right() - bounds.left();
        let direction = if home.x > bounds.left() + span / 2.0 {
            -1.0
        } else {
            1.0
        };
        let target = bounds.fit(Point {
            x: home.x + (span * 0.62).min(520.0 * bounds.scale) * direction,
            y: home.y,
        });
        let mut visit = Self {
            home,
            start: home,
            target: home,
            beat: WaterBeat::Offer,
            elapsed: 0.0,
            duration: 12_000.0,
        };
        if !reduced && home.distance(target) > bounds.scale {
            visit.enter(WaterBeat::Walk, home, target, bounds.scale);
        }
        visit
    }

    fn enter(&mut self, beat: WaterBeat, from: Point, to: Point, scale: f64) {
        self.beat = beat;
        self.start = from;
        self.target = to;
        self.elapsed = 0.0;
        self.duration = if beat == WaterBeat::Offer {
            12_000.0
        } else {
            (from.distance(to) / (126.0 * scale) * 1000.0).max(550.0)
        };
    }

    fn position(&self) -> Point {
        self.start
            .mix(self.target, ease(self.elapsed / self.duration))
    }

    fn advance(&mut self, elapsed: f64, return_now: bool, reduced: bool, bounds: Layout) -> bool {
        if return_now && self.beat != WaterBeat::Return {
            self.enter(
                WaterBeat::Return,
                self.position(),
                bounds.fit(self.home),
                bounds.scale,
            );
        }
        if reduced && self.beat == WaterBeat::Walk {
            let here = self.position();
            self.enter(WaterBeat::Offer, here, here, bounds.scale);
        }
        self.elapsed += elapsed;
        if self.elapsed < self.duration && !(reduced && self.beat == WaterBeat::Return) {
            return true;
        }
        match self.beat {
            WaterBeat::Walk => self.enter(WaterBeat::Offer, self.target, self.target, bounds.scale),
            WaterBeat::Offer if !reduced && self.target.distance(self.home) > bounds.scale => self
                .enter(
                    WaterBeat::Return,
                    self.target,
                    bounds.fit(self.home),
                    bounds.scale,
                ),
            _ => return false,
        }
        true
    }
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
    last_action: Option<(u8, &'static str, i8, bool, bool)>,
    geometry_tick: u32,
    last_emit: f64,
    water: Option<WaterVisit>,
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
            water: None,
        }
    }
}
// Wall phases share the existing rest and departure beats with the Dock route.
const APPROACH_WALL: u8 = 12;
const CLIMB_UP: u8 = 13;
const HOLD_WALL: u8 = 14;
const CLIMB_DOWN: u8 = 15;
const LEAVE_WALL: u8 = 16;

impl Roamer {
    fn enter(&mut self, phase: u8, bounds: Layout) {
        self.phase = phase;
        self.elapsed = 0.0;
        self.start = self.position.unwrap_or(bounds.dock());
        self.target = match phase {
            APPROACH_WALL => {
                // The transparent window is 220 points wide. Bring the sprite's
                // outer paw (roughly 22 points from centre) to the work-area edge.
                let left = self.start.x < (bounds.left() + bounds.right()) / 2.0;
                Point {
                    x: if left {
                        bounds.left() - 88.0 * bounds.scale
                    } else {
                        bounds.right() + 88.0 * bounds.scale
                    },
                    y: self.start.y,
                }
            }
            CLIMB_UP => Point {
                x: self.start.x,
                y: (self.start.y - (112.0 + 24.0 * f64::from(self.cycle % 3)) * bounds.scale)
                    .max(bounds.work.y),
            },
            CLIMB_DOWN => Point {
                x: self.start.x,
                y: bounds.floor(),
            },
            LEAVE_WALL => bounds.excursion(self.start, self.cycle),
            1 | 10 => bounds.excursion(self.start, self.cycle),
            3 | 9 => bounds.dock(),
            4 | 7 => bounds.hidden(),
            6 => bounds.peek(),
            _ => self.start,
        };
        self.duration = match phase {
            1 | 3 | 10 | APPROACH_WALL | CLIMB_UP | CLIMB_DOWN | LEAVE_WALL => {
                let speed = match phase {
                    CLIMB_UP => 47.0,
                    CLIMB_DOWN => 36.0,
                    3 | LEAVE_WALL => 65.0,
                    APPROACH_WALL => 84.0,
                    _ => 120.0,
                };
                (self.start.distance(self.target) / (speed * bounds.scale) * 1000.0).max(700.0)
            }
            HOLD_WALL => 780.0,
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
        let phase = match self.water.as_ref().map(|visit| visit.beat) {
            Some(WaterBeat::Walk) => 12,
            Some(WaterBeat::Offer) => 13,
            Some(WaterBeat::Return) => 14,
            None => self.phase,
        };
        let key = (phase, action, self.facing, roaming, enabled);
        let scale = self.layout.map_or(1.0, |b| b.scale);
        let distance = self.start.distance(self.target) / scale;
        let (gait_ms, gait_rate) = gait_phase(action, distance, self.duration, self.elapsed);
        let snapshot = PlaySnapshot {
            action,
            facing: self.facing,
            elapsed_ms: self.elapsed,
            duration_ms: self.duration,
            roaming,
            enabled,
            gait_ms,
            gait_rate,
            water: self.water.as_ref().map(|visit| visit.beat.label()),
        };
        let state = window.state::<PlayState>();
        if let Ok(mut stored) = state.snapshot.lock() {
            *stored = snapshot.clone();
        }
        if self.last_action != Some(key)
            || (matches!(action, "run" | "walk" | "climbUp" | "climbDown")
                && self.elapsed - self.last_emit >= 100.0)
        {
            self.last_emit = self.elapsed;
            self.last_action = Some(key);
            let _ = window.emit("habitat-play", snapshot);
        }
    }

    fn water_tick(
        &mut self,
        window: &WebviewWindow,
        bounds: Layout,
        dt: f64,
        state: &PlayState,
        enabled: bool,
    ) -> tauri::Result<bool> {
        if state.water_requested.swap(false, Ordering::Relaxed) && self.water.is_none() {
            let here = window.outer_position()?;
            let origin = bounds.fit(Point {
                x: here.x as f64,
                y: here.y as f64,
            });
            self.water = Some(WaterVisit::new(
                origin,
                bounds,
                state.reduced.load(Ordering::Relaxed),
            ));
        }
        let Some(visit) = &mut self.water else {
            return Ok(false);
        };
        let reduced = state.reduced.load(Ordering::Relaxed);
        let returning = state.water_return.swap(false, Ordering::Relaxed);
        if !visit.advance(dt, returning, reduced, bounds) {
            window.set_position(bounds.fit(visit.home).physical())?;
            self.water = None;
            self.position = None;
            self.publish(window, "rest", false, enabled);
            return Ok(true);
        }
        let position = bounds.fit(visit.position());
        if self.position != Some(position) {
            window.set_position(position.physical())?;
            self.position = Some(position);
        }
        self.start = visit.start;
        self.target = visit.target;
        self.elapsed = visit.elapsed;
        self.duration = visit.duration;
        if visit.beat != WaterBeat::Offer {
            self.facing = if visit.target.x >= visit.start.x {
                1
            } else {
                -1
            };
        }
        let action = if visit.beat == WaterBeat::Offer {
            "rest"
        } else {
            "walk"
        };
        self.publish(window, action, !reduced, enabled);
        Ok(true)
    }
    fn advance(&mut self, bounds: Layout, dt: f64) {
        self.elapsed += dt;
        while self.elapsed >= self.duration {
            let remainder = self.elapsed - self.duration;
            self.position = Some(self.target);
            if self.phase == 11 {
                self.cycle = self.cycle.wrapping_add(1);
            }
            let next = match self.phase {
                0 | 11
                    if self.cycle.is_multiple_of(2)
                        && bounds.right() > bounds.left() + 80.0 * bounds.scale
                        && bounds.floor() > bounds.work.y + 40.0 * bounds.scale =>
                {
                    APPROACH_WALL
                }
                11 => 1,
                LEAVE_WALL => 11,
                _ => self.phase + 1,
            };
            self.enter(next, bounds);
            self.elapsed = remainder;
        }
        let travel_time = if self.phase == 6 {
            550.0
        } else {
            self.duration
        };
        let (position, _) = travel_curve(
            self.elapsed / travel_time,
            self.start.distance(self.target) / bounds.scale,
            matches!(self.phase, CLIMB_UP | CLIMB_DOWN),
        );
        self.position = Some(self.start.mix(self.target, position));
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
        let shell = window.state::<crate::shell::ShellState>();
        if !visible || dragging || shell.dragging.load(Ordering::Relaxed) {
            self.water = None;
            state.water_requested.store(false, Ordering::Relaxed);
            self.position = None;
            self.layout = None;
            self.publish(window, "rest", false, enabled);
            return Ok(());
        }
        if shell.tools_open.load(Ordering::Relaxed) {
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
        if self.water_tick(window, bounds, dt, &state, enabled)? {
            return Ok(());
        }
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
            let waiting = if matches!(self.phase, CLIMB_UP | HOLD_WALL | CLIMB_DOWN) {
                "cling"
            } else {
                "rest"
            };
            self.publish(window, waiting, true, enabled);
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
            APPROACH_WALL | LEAVE_WALL => "walk",
            CLIMB_UP => "climbUp",
            HOLD_WALL => "cling",
            CLIMB_DOWN => "climbDown",
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
    fn water_walk_stays_on_the_display_and_returns_home() {
        let bounds = bounds(2.0, Edge::Bottom);
        let home = Point {
            x: bounds.right(),
            y: bounds.floor(),
        };
        let mut visit = WaterVisit::new(home, bounds, false);
        assert_eq!(visit.beat, WaterBeat::Walk);
        assert_eq!(visit.position(), home);
        assert!(visit.target.x < home.x);
        assert_eq!(visit.target.y, home.y);
        assert_eq!(bounds.fit(visit.target), visit.target);
        assert!(visit.advance(visit.duration, false, false, bounds));
        assert_eq!(visit.beat, WaterBeat::Offer);
        assert!(visit.advance(visit.duration, false, false, bounds));
        assert_eq!(visit.beat, WaterBeat::Return);
        assert!(!visit.advance(visit.duration, false, false, bounds));
        assert_eq!(visit.position(), home);
    }

    #[test]
    fn water_offer_can_stay_still_or_end_an_active_walk_early() {
        let bounds = bounds(1.0, Edge::Left);
        let home = bounds.dock();
        let mut still = WaterVisit::new(home, bounds, true);
        assert_eq!(still.beat, WaterBeat::Offer);
        assert_eq!(still.position(), home);
        assert!(!still.advance(still.duration, false, true, bounds));
        let mut moving = WaterVisit::new(home, bounds, false);
        assert!(moving.advance(moving.duration / 2.0, false, false, bounds));
        assert_ne!(moving.position(), home);
        assert!(moving.advance(1.0, true, false, bounds));
        assert_eq!(moving.beat, WaterBeat::Return);
        assert_eq!(moving.target, home);
    }
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
                    if (APPROACH_WALL..=LEAVE_WALL).contains(&pet.phase) {
                        assert!(
                            p.x >= b.left() - 88.0 * b.scale && p.x <= b.right() + 88.0 * b.scale
                        );
                        assert!((b.work.y..=b.floor()).contains(&p.y));
                        if matches!(pet.phase, CLIMB_UP | CLIMB_DOWN | HOLD_WALL) {
                            assert_eq!(p.x, pet.start.x);
                            assert_eq!(pet.target.x, pet.start.x);
                            if pet.phase == CLIMB_UP {
                                assert!(pet.target.y < pet.start.y);
                            }
                            if pet.phase == CLIMB_DOWN {
                                assert!(pet.target.y > pet.start.y);
                            }
                        }
                    } else {
                        assert_eq!(b.fit(p), p);
                    }
                }
            }
            assert_eq!(seen.len(), 17);
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
