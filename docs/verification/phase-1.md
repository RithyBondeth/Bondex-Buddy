# Phase 1 verification

For the latest artwork, CI, and native acceptance status, see [the 2026-11-18 follow-up](artwork-native.md). The notes below record the original phase checks.

## Verified in this workspace

- Frontend strict TypeScript, ESLint, Prettier, and production build pass.
- Rust formatting, unit tests, and Clippy with warnings denied pass on macOS.
- Unit tests cover transparent vs. solid mask pixels, bounds, invalid scale, multiple display scales (1×, 1.25×, 1.5×, 2×), negative monitor origins, and work-area docking.
- A debug macOS `.app` bundle builds successfully.
- The native app launches and exposes the test-pet button through accessibility.
- A browser screenshot shows the pixel-art test pet and shelf with no startup error.

## Native checks still pending

macOS native screen capture failed with ScreenCaptureKit error -3811 during automated inspection. That prevented visual confirmation of native transparency and reliable end-to-end click-through testing. Browser screenshots verify the Canvas appearance only. Windows hardware and CI execution were not available in this local session.

Run the native app with `npm run desktop:dev`, then check:

- [ ] Only the sprite and ledge are visible: no white rectangle, title bar, border, or shadow.
- [ ] The pet stays above an editor while typing in the editor.
- [ ] There is no persistent Dock/taskbar app icon; the tray/menu bar icon remains available.
- [ ] The ledge rests at the bottom-right of the usable screen above the Dock/taskbar.
- [ ] Click a known editor button through several empty areas inside the 220 × 200 window.
- [ ] Click the pet: it briefly brightens and the underlying editor does not receive that click.
- [ ] Click the ledge: it is also interactive; pixels outside its silhouette pass through.
- [ ] Hide and show the spirit through the tray, then recheck click-through.
- [ ] Reset placement and cycle displays through the tray (including different display scales).
- [ ] Move/change the Dock or taskbar and confirm placement adjusts.
- [ ] Disconnect a display and confirm the pet can be recovered through Show/Reset.
- [ ] Quit through the tray and confirm both the window and tray icon disappear.
- [ ] Repeat the same checks on Windows at 100%, 125%, 150%, and 200% scaling where available.

## Known boundaries

- Pass-through toggles on a 40 ms native polling interval. Fast movement-plus-click at the silhouette boundary may race the update; assess this during native checks before treating the interaction as release-ready.
- The Canvas is static. Any future silhouette-changing animation must update its hit mask.
- The temporary concept is downsampled at render time; final art still needs a clean native grid and palette.
- The test interaction only changes brightness for 600 ms. Mood transitions and petting animation belong to later phases.
- Dragging, edge snapping, Ghost Mode, and placement persistence are not implemented in Phase 1.
