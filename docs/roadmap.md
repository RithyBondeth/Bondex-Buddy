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

- [ ] Poll OS idle duration every five seconds without recording input contents.
- [ ] Deterministic Idle, Working, Sleeping, TeaBreak, and Happy states.
- [ ] Guard focus sessions against brief interaction overrides.
- [ ] Hover controls and a 25-minute focus / 5-minute break timer.
- [ ] Focused tests for state priority, elapsed time, sleep/resume, and timer completion.

Acceptance: verify transitions from activity, idle duration, local time, timer completion, and interaction. Clarify pause/resume semantics before implementing the clock.

## Phase 3: Art, audio, and polish

- [ ] Consistent pixel-art animation loops for all five moods.
- [ ] Steam, hearts, and sleep particles.
- [ ] Optional muted-by-default sound controls and approved audio assets.
- [ ] Dragging, edge snapping, and optional Ghost Mode.
- [ ] Respect reduced motion and measure resource usage.

Acceptance: interactions feel calm and responsive; pixel edges stay sharp at supported display scales. Check audio toggles and CPU usage while visible and hidden.

## Phase 4: Local progression

- [ ] Versioned local preferences and progress storage.
- [ ] Cosmetic unlock rules and wardrobe/decor controls.
- [ ] Restore equipped items across restarts.
- [ ] Time-of-day lighting.
- [ ] Launch-at-login preference.

Acceptance: completing a focus session unlocks an item that can be equipped and restored on restart, without penalties or streaks.

## Release preparation

- [ ] Native smoke checks on macOS and Windows.
- [ ] Final icons, app identifier review, and packaging metadata.
- [ ] Signing/notarization and installer validation.
- [ ] Privacy documentation and third-party asset notices.
