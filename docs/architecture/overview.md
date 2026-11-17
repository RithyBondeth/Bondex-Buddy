# Architecture

## Stack decision

Use Tauri 2, a Vite-powered vanilla TypeScript frontend, an HTML Canvas renderer, and Rust native integration. This follows one of the stacks suggested by the original plan and the requirement to support both macOS and Windows.

Vanilla TypeScript keeps the initial widget small and avoids a component framework before we need one. Do not add a UI framework, global state library, or database during setup.

References: [Tauri project structure](https://v2.tauri.app/start/project-structure/) and [Vite guide](https://vite.dev/guide/).

## Layer boundaries

| Layer           | Owns                                                  | Must not own                  |
| --------------- | ----------------------------------------------------- | ----------------------------- |
| `src/app`       | Startup, wiring, later hover controls                 | OS-specific implementation    |
| `src/engine`    | State transitions, timer rules, progression           | DOM, Canvas, native API calls |
| `src/rendering` | Sprites, animation, particles, lighting               | Timer or unlock decisions     |
| `src/platform`  | Typed adapters around native calls                    | Pet behavior rules            |
| `src-tauri/src` | Windows, tray, OS activity observation, local storage | Frontend rendering            |

Planned data flow: native activity signal → platform adapter → engine → render state → Canvas. User interactions enter the engine through app wiring. Persistence stores only approved preferences, inventory, and progress.

Keep modules small; introduce concrete subfolders as features arrive rather than creating unused abstractions now.

## Phase 1 shell

The main window is a transparent, undecorated 220 × 200 logical-pixel overlay with no shadow, resizing, or taskbar entry. On macOS it runs with the accessory activation policy to avoid a persistent Dock icon. Default Tauri scaffold icons are temporary and do not represent a chosen pet.

`src-tauri/src/shell.rs` places the window at the bottom-right of the primary monitor's work area, excluding the Dock/taskbar. The tray can move it to another display. While visible, placement is reconciled every two seconds to account for work-area changes. Free dragging and snapping remain future polish work.

The renderer draws once and sends a 110 × 100 binary alpha mask through the app-defined `show_shell` command. The Rust command validates the window label, mask dimensions, and values before showing the window. The native shell polls cursor position every 40 milliseconds while visible and toggles whole-window mouse pass-through according to the mask. This keeps mouse handling alive even while the webview ignores input. It converts physical desktop coordinates into logical Canvas coordinates using the window scale factor. Invisible windows poll visibility at a reduced rate.

This is a polling-based approximation, not an OS-native per-pixel hit-test callback: a very fast pointer movement followed by a click can arrive before the next update. It needs native desktop checks on both platforms. Cursor coordinates are transient and never logged or persisted; this is not the Phase 2 activity observer.

`src-tauri/src/tray.rs` owns show/hide, position reset, display cycling, and quit. Closing the window hides it; quitting is explicit through the tray. The window stays hidden until its first Canvas/mask is ready. A load failure reveals an error message instead of silently leaving an invisible window.

Phase 2 adds scoped event listen/unlisten permissions and app-defined commands for mask updates, control visibility, and an initial activity snapshot. No shell, filesystem, network, or global input plugins are enabled. See [Phase 2 architecture](phase-2.md) for the engine and timer rules.

## Desktop verification

macOS and Windows need separate native checks. A successful frontend build cannot verify transparency, tray integration, Dock/taskbar behavior, monitor coordinates, display scaling, or click-through. CI will compile on each platform; use the roadmap's manual checks for actual desktop behavior.
