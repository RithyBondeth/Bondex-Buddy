# Desktop polish and wardrobe

Phase 4 was committed and merged through PR #4 (`4ea801d`). The hosted macOS job could not acquire an ARM64 runner. CI-repair PR #5 switched to Intel macOS runners and removed duplicate feature-branch push runs; its hosted macOS and Windows checks subsequently passed. This follow-up publishes the Ember fox, wardrobe migration, desktop controls, and release-preparation infrastructure described below.

## Implemented

- The user selected Ember fox on 2026-11-18. The working pet and the first desktop icons used that reference. The reference is still sampled into a 48-pixel area; clean production animation sheets remain pending.
- Shelf dragging uses the native OS drag operation, with a held-left-button guard. Mouse release snaps within 16 logical pixels of the current monitor's work-area edges. Manual placement is clamped to usable bounds when the work area changes; Show retains placement, while Reset and display cycling return to docking.
- The shelf is keyboard focusable. Arrow keys move by 24 logical pixels without magnetically trapping the window at an edge.
- Optional Ghost Mode fades the Canvas to 30% during Working when the pointer is in the habitat. Artwork passes clicks through; toolbar/drawer controls remain interactive. Disable Ghost Mode to drag the shelf while working. Browser previews cannot enable native Ghost Mode.
- Outfit rewards: a beanie at two completions and a scarf at five. Accessories are provisional pixel layers and are hidden under the Sleeping blanket.
- Version 2 saves add `outfit` and `ghost`. Version 1 totals, decor, and lighting migrate in memory; the next explicit change/completion writes version 2. Newer unknown versions remain protected. Older app versions cannot read version 2 saves and must not replace them.
- An opt-in release-build launch-at-login tray item reflects OS registration through Tauri's autostart plugin. Startup never enables it automatically. Debug builds disable the item to avoid registering disposable development executables. No OS login setting was changed during testing.
- Privacy documentation and a manual unsigned packaging workflow are added. The workflow builds artifacts; it does not publish a release. It has not been executed for this branch.

## Verification and remaining work

25 TypeScript tests pass, including version-1 migration and locked/unlocked wardrobe restoration. Five native tests pass, including snapping/clamping on negative monitor origins. Frontend checks/build, Rust formatting/Clippy, and debug macOS packaging pass. Browser inspection confirms Ember fox, working focus controls, restored lighting, wardrobe locks, and keyboard drawer dismissal.

The native build opens and displays the new controls. Native pointer testing lost stable application state during the movement/Ghost interaction, so dragging and Ghost click-through are not marked accepted. Repeat those checks manually on macOS and Windows, including mixed-DPI monitors and monitor removal. Confirm real release-build login behavior from a stable installed location after a system restart.

Still open: production sprite sheets and Foley/listening review, total Rust+WebView resource profiling, complete native acceptance, signing/notarization, and installer/distribution validation. See `docs/release.md` and `docs/roadmap.md`. These are not claimed complete by compilation or a browser preview.
