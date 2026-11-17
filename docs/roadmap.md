# Build roadmap

The original PDF remains the product reference. This checklist tracks implementation status; an unchecked item is not implemented.

## Step 0: Project foundation

- [x] Tauri + Vite + TypeScript scaffold.
- [x] Separate app, engine, rendering, and platform folders.
- [x] Reserve runtime asset folders and preserve pet concept references.
- [x] Document architecture, pixel-art direction, and local setup.
- [x] Configure frontend checks and native macOS/Windows CI.
- [ ] Select one pet and approve a grid-clean idle sprite.

## Phase 1: Window and Canvas shell

- [x] Frameless transparent 220 × 200 desktop window configuration.
- [x] Always-on-top behavior and work-area placement above Dock/taskbar.
- [x] Tray/menu bar visibility, display cycling, reset, and quit controls.
- [x] Static test sprite rendered on Canvas at 2× integer scaling.
- [x] Alpha-mask-driven click-through implementation.
- [ ] Complete native visual and click-through acceptance checks on macOS and Windows.

Acceptance: place the pet over an editor, interact with the visible sprite, and click through empty areas. Verify on macOS and Windows, including scaled and multiple displays.

Implementation and automated checks are in place. Phase 1 acceptance remains open until the [native verification checklist](verification/phase-1.md) is completed; compilation and browser previews do not establish native click-through correctness.

## Phase 2: Activity, moods, and focus

- [x] Native five-second OS idle-duration observer, without recording input contents.
- [x] Deterministic Idle, Working, Sleeping, TeaBreak, and Happy states.
- [x] Guard running focus sessions against interaction overrides.
- [x] Hover/keyboard controls and a 25-minute focus / 5-minute break timer.
- [x] Pause/resume/reset semantics and focused fake-clock tests.
- [x] Provisional mood poses with matching hit-mask updates.
- [ ] Native activity/hover/timer acceptance checks on macOS and Windows.

Acceptance: verify transitions from activity, idle duration, local time, timer completion, and interaction. Pause freezes remaining time, Resume continues it, and Reset cancels without completion. See [Phase 2 behavior](architecture/phase-2.md) and the [verification checklist](verification/phase-2.md).

## Phase 3: Art, audio, and polish

- [x] Cached two-pose animation prototypes for all five moods, with a 30 fps render cap.
- [ ] Consistent pixel-art animation loops for all five moods.
- [x] Decorative steam, hearts, and sleep particles with stable interactive hit masks.
- [x] Muted-by-default procedural rain/chimes and a keyboard-accessible sound toggle.
- [ ] Approved final Foley/ambient audio assets.
- [ ] Dragging, edge snapping, and optional Ghost Mode.
- [x] Reduced-motion support and hidden-window animation/audio suspension.
- [ ] Profile total native + WebView CPU and memory on both platforms.

Acceptance: interactions feel calm and responsive; pixel edges stay sharp at supported display scales. Check audio toggles and CPU usage while visible and hidden.

Phase 3 is in progress. The first slice builds animation, particles, audio, and lifecycle infrastructure around the temporary concept. Final pet selection, clean sprite sheets, approved sound assets, dragging, snapping, Ghost Mode, and full resource measurements remain open. See [Phase 3 notes](architecture/phase-3.md).

## Phase 4: Local progression

- [x] Versioned local JSON storage with safe failure handling.
- [x] Permanent plant/lantern unlock rules and Items drawer.
- [x] Restore saved decor and lighting choices on startup.
- [x] Time-of-day warm tint with a saved daylight override.
- [ ] Wardrobe/outfit inventory and final cosmetic art.
- [ ] Complete native reward/equipment acceptance on macOS and Windows.
- [ ] Launch-at-login preference.

Acceptance: completing a focus session unlocks an item that can be equipped and restored on restart, without penalties or streaks.

Phase 4 is in progress on a local branch. See [save/progression notes](architecture/phase-4.md); launch at login and wardrobe expansion remain open.

## Release preparation

- [ ] Native smoke checks on macOS and Windows.
- [ ] Final icons, app identifier review, and packaging metadata.
- [ ] Signing/notarization and installer validation.
- [ ] Privacy documentation and third-party asset notices.
