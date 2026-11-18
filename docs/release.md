# Release preparation

The manual `Package desktop app` workflow builds unsigned desktop artifacts on macOS Intel and Windows. It does not create a GitHub release or publish/install the app. The workflow is configured but has not been executed for this branch.

Dependency notices are described in [the notice workflow](../third-party/README.md) and [verification report](verification/release-notices.md). `npm run notices:generate` builds the supported desktop dependency inventory and copies available texts; `npm run notices:check` verifies snapshot freshness. Desktop packaging performs that check automatically and includes the files under `third-party/` in the application resources. The manual packaging workflow also stages a standalone copy beside its app/installer artifacts.

The current snapshot covers 276 packages and 177 distinct texts. Fifteen entries still need license-text/source-notice curation. `npm run notices:require-texts` reports those entries with a nonzero exit status. Project licensing remains an owner decision.

For resource measurements, identify the app and its associated WebView PIDs in the OS process viewer, then run `python3 scripts/profile_processes.py --pid APP_PID --pid WEBVIEW_PID --seconds 10 --label visible-idle`. Repeat for hidden, focusing, and audio-on states. CPU is expressed as a percentage of one core; summed RSS can double-count shared pages. Supplying only the main PID does not measure the entire application. The helper uses `ps` on macOS and `Get-Process` on Windows; Windows execution still needs native verification.

Before distributing:

- Finish the native acceptance checklist on both platforms, including mixed-DPI monitors, drag release, snapping, Ghost Mode click-through, wardrobe restoration, and login behavior after a real system restart.
- Run the release app from a stable installed location before enabling login. Debug builds disable login registration. Do not enable startup for a disposable build path.
- Profile both the Rust process and its associated WebView processes while visible, hidden, focusing, and muted/unmuted. No resource budget is claimed yet.
- Replace provisional fox poses and wardrobe layers with approved sprite sheets; review procedural sound or supply approved Foley.
- Resolve the remaining notice evidence and run `npm run notices:require-texts`. Review the app identifier/version, icons, and distribution notice obligations. The source repository has no selected project license; do not imply a redistribution license without an owner decision.
- Configure Apple signing/notarization and Windows signing through approved CI secrets before shipping signed installers. No signing credentials are stored or configured in this repository.
- Review `PRIVACY.md` against the final shipped behavior and bundle third-party license notices.

Signing and native OS acceptance are not established by a frontend build or unit tests. The manual packaging workflow intentionally keeps distribution separate from compilation.
