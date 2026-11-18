# Build roadmap

The original PDF remains the product reference. This checklist tracks implementation status; an unchecked item is not implemented.

## Step 0: Project foundation

- [x] Tauri + Vite + TypeScript scaffold.
- [x] Separate app, engine, rendering, and platform folders.
- [x] Reserve runtime asset folders and preserve pet concept references.
- [x] Document architecture, pixel-art direction, and local setup.
- [x] Configure frontend checks and native macOS/Windows CI.
- [x] Select Ember fox as the character direction.
- [ ] Approve grid-clean production sprite sheets.

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
- [x] Dedicated mood illustrations on a shared 48-pixel grid and 16-color runtime palette.
- [x] Held pixel motion timelines with grounded breathing/reading, cup lift, and a single Happy hop.
- [x] Isolated motion review with scrubbing, reduced motion, and cosmetic previews.
- [ ] Final visual approval of motion loops and character/cosmetic art.
- [x] Decorative steam, hearts, and sleep particles with stable interactive hit masks.
- [x] Muted-by-default procedural rain/chimes and a keyboard-accessible sound toggle.
- [ ] Approved final Foley/ambient audio assets.
- [x] Implement shelf dragging, edge snapping, and optional Ghost Mode.
- [ ] Complete native placement and Ghost Mode acceptance.
- [x] Reduced-motion support and hidden-window animation/audio suspension.
- [ ] Profile total native + WebView CPU and memory on both platforms.

Acceptance: interactions feel calm and responsive; pixel edges stay sharp at supported display scales. Check audio toggles and CPU usage while visible and hidden.

Phase 3 is in progress. Ember fox is selected and dedicated mood illustrations are integrated. Runtime motion studies and a review page are implemented; final visual approval, cosmetic art, approved sound assets, native mouse acceptance, and full resource measurements remain open. See [motion review](verification/motion.md). Native keyboard movement is verified on macOS; see [artwork/native follow-up](verification/artwork-native.md) and [Phase 3 notes](architecture/phase-3.md).

## Phase 4: Local progression

- [x] Versioned local JSON storage with safe failure handling.
- [x] Permanent plant/lantern unlock rules and Items drawer.
- [x] Restore saved decor and lighting choices on startup.
- [x] Time-of-day warm tint with a saved daylight override.
- [x] Outfit inventory, unlock rules, and version-1 save migration.
- [ ] Final cosmetic art.
- [ ] Complete native reward/equipment acceptance on macOS and Windows.
- [x] Implement an explicit release-build launch-at-login preference.
- [ ] Verify OS registration and a real login from an installed build.

Acceptance: completing a focus session unlocks an item that can be equipped and restored on restart, without penalties or streaks.

Phase 4 storage, wardrobe, and opt-in login implementations are merged into develop. Final cosmetic art, native progression acceptance, and installed release login verification remain open. See [save/progression notes](architecture/phase-4.md).

## Release preparation

- [ ] Native smoke checks on macOS and Windows.
- [x] Generate Ember fox desktop icons.
- [ ] Final app identifier/version and installer review.
- [ ] Signing/notarization and installer validation.
- [x] Privacy documentation.
- [x] Single-instance startup and macOS reopen handling implemented.
- [ ] Native duplicate-launch and hidden-session restoration acceptance.
- [x] Generate dependency/license-text inventory and asset provenance, with CI freshness checks.
- [x] Bundle notices and stage a standalone copy with unsigned QA artifacts.
- [ ] Curate the 15 remaining license-evidence entries and complete distribution notice review.
- [ ] Select the project license before distribution.

Desktop polish and motion are merged; the current local follow-up is described in [release notice verification](verification/release-notices.md). Production art, native acceptance, profiling, and signed distribution are still open.
