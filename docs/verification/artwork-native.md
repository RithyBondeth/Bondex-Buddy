# Artwork and native follow-up — 2026-11-18

## Published baseline

[PR #6](https://github.com/RithyBondeth/Bondex-Buddy/pull/6) was squash-merged into `develop` as `b84e24681a9fc1fda8bb1576e022f927f5f14598`. Its hosted macOS Intel and Windows CI jobs both passed. Those jobs establish compilation and automated checks, not Windows GUI acceptance.

The artwork/fixture follow-up is tracked on `bondeth/fox-artwork-native-acceptance`. The checks below describe its verified behavior and remaining acceptance work.

## Automated verification

Frontend type checking, ESLint, Prettier, 27 TypeScript tests, five Rust tests with all features, Rust formatting, Clippy with all features and warnings denied, and the normal macOS debug app bundle build passed after the follow-up.

## Completed inspection

- The debug macOS app launches with the new artwork and no startup error.
- The native WebView renders all five moods: Idle, Working with glasses/notebook, Sleeping curled with a blanket, TeaBreak with a mug, and Happy with raised paws. Edges are sampled onto the integer grid; a shared palette removes source gradients. Final aesthetic approval and animation sheets remain open.
- A keyboard Left press on the focused shelf changed the fixture's live native coordinates from `300,150` to `276,150` at scale 2: exactly 24 logical pixels. The fixture confirmed actual native placement rather than a DOM offset.
- The fixture's Dock action, activated by keyboard, hides the checker and returns control to the pet. Cross-display docking accuracy is still unverified.
- Quit closes the native app. The normal debug bundle is rebuilt without the optional test window after testing.

## Inconclusive mouse acceptance

Coordinate automation changed the selected native window while targeting the overlaid pet/checker. An independent Chrome target was also attempted, but native input reported `windowNotFoundAtPosition` and ScreenCaptureKit errors `-3811`/`-3812`. Background counter increments during calibration/dragging do **not** prove an ordinary click passed through a known transparent pet pixel. No click-through, Ghost Mode, or native drag pass is claimed from this run.

Repeat those checks manually with a stable foreground background target. Keep the 40 ms polling-boundary race in scope. Windows native GUI, mixed-DPI monitors, physical dragging/snapping, long-duration activity/timer transitions, cosmetic unlock/restoration, full app + WebView profiling, and installed release login/signing checks remain open.

## Running the fixture

Build with `npm run desktop:build -- --debug --features native-test --bundles app` on macOS. For Windows, build a debug executable with the same feature (`npm run desktop:build -- --debug --features native-test --no-bundle`). Open the resulting app. Keyboard activation (Tab, then Enter) is reliable for fixture controls in the current automation setup; accessibility button clicks were not reliable.

The checker has an owned background button, an in-memory click counter with client coordinates, five rendered mood previews, and live relative overlay coordinates/scale/ignore/Ghost/visibility values. Place pet overlays the 220 × 200 habitat at checker coordinates `300,150`. Hide/Show test visibility. Ghost preview temporarily forces the native Working/Ghost policy; it does not run or complete a focus session or save that preference. Solid preview disables it. Dock pet resets placement, disables the preview, and hides the checker. Restart after preview tests to restore native Working state from the actual engine.

For a background owned by another app, run `npm run dev -- --port 1421` and open `http://127.0.0.1:1421/native-check.html` in a browser. Native controls are disabled there; the surface counter and artwork still work. Do not use DOM/accessibility activation of the background button as evidence of OS hit testing: use physical pointer clicks at known transparent/solid locations and compare the counter. First calibrate outside the overlay, then verify transparent pixels, solid pixels, shelf, Ghost preview, and hide/show. Record actual coordinates and counts for each assertion.

The fixture only activates when **both** debug assertions and the `native-test` Cargo feature are enabled. Commands reject callers unless the fixture is enabled and the caller is the `native-check` window. A normal build creates no checker; release builds keep the fixture disabled even if the feature is supplied. No OS login setting is changed. Rebuild with `npm run desktop:build -- --debug --bundles app` to restore the normal macOS bundle.
